"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import {
  COMMITTEE_DIMENSIONS,
  DEFAULT_COMMITTEE_DIVISORS,
  type CommitteeDimensionLabel,
  type CommitteeDimensionsConfig,
} from "@/lib/yip/committee-score";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// committee_dimensions_config is newer than the generated Database types, so
// reads/writes use an untyped client view (values are validated/coerced here).
async function dimsClient(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

// DELIBERATELY NOT SCOPED BY ROUND LEVEL (2026-08). The scoring criteria
// (yip.session_parameters), the /100 composition (yip.scoring_buckets) and the
// position merit table were all given a `levels` scope so a regional round can
// be marked differently from a chapter round. This table was considered and
// left GLOBAL on purpose, because there is very little here that CAN differ:
//
//   • the 6 dimension KEYS are fixed — they map 1:1 to the committee_scores
//     columns, so no level can add, drop or reorder a dimension. Only the
//     LABELS are editable, and renaming "Innovation" for regional rounds only
//     is cosmetic churn, not a scoring rule.
//
//   • the two divisors exist to convert the workbook's /60 committee marks into
//     the two /5 committee-level points (drafting /50 -> /5, presentation /10 ->
//     /5). That conversion is the normalisation step itself, and the national
//     admin's 2026-08-18 rule — every session worth exactly 10 points per
//     student — makes it MORE uniform across levels, not less. A level that
//     needs the committee session to carry a different share of the total
//     expresses that by reweighting the committee BUCKET, which is now scoped.
//
// So scoping this would add a second place to express something already
// expressible, for no behaviour anyone has asked for.
//
// If this ever does need to vary, note the shape: the row is a HARD singleton
// (id boolean PRIMARY KEY, CHECK (id)), so it cannot hold a second row without
// dropping its primary key. Follow the overlay-table approach taken in
// supabase/migrations/yip_position_bonus_config_round_level.sql rather than
// performing identity surgery on a live table.

// COMMITTEE_DIMENSIONS holds the 6 fixed keys (mapping 1:1 to the
// committee_scores columns). Labels are editable; keys are not.
function defaultConfig(): CommitteeDimensionsConfig {
  return {
    dimensions: COMMITTEE_DIMENSIONS.map((d) => ({ key: d.key, label: d.label })),
    draftingDivisor: DEFAULT_COMMITTEE_DIVISORS.draftingDivisor,
    presentationDivisor: DEFAULT_COMMITTEE_DIVISORS.presentationDivisor,
  };
}

// Coerce a stored row into the typed config, always returning the 6 fixed keys
// in canonical order (labels from the row when present, else the default).
function rowToConfig(row: {
  dimensions: unknown;
  drafting_divisor: unknown;
  presentation_divisor: unknown;
} | null): CommitteeDimensionsConfig {
  const def = defaultConfig();
  if (!row) return def;
  const labelByKey = new Map<string, string>();
  if (Array.isArray(row.dimensions)) {
    for (const d of row.dimensions as Array<{ key?: unknown; label?: unknown }>) {
      if (typeof d?.key === "string" && typeof d?.label === "string") {
        labelByKey.set(d.key, d.label);
      }
    }
  }
  const dimensions: CommitteeDimensionLabel[] = COMMITTEE_DIMENSIONS.map((d) => ({
    key: d.key,
    label: labelByKey.get(d.key) ?? d.label,
  }));
  const dd = Number(row.drafting_divisor);
  const pd = Number(row.presentation_divisor);
  return {
    dimensions,
    draftingDivisor: Number.isFinite(dd) && dd > 0 ? dd : def.draftingDivisor,
    presentationDivisor: Number.isFinite(pd) && pd > 0 ? pd : def.presentationDivisor,
  };
}

// Live config read by the scoring engine + screens. Falls back to defaults when
// the singleton row is missing, so behaviour is never undefined.
export async function getCommitteeDimensionsConfig(): Promise<CommitteeDimensionsConfig> {
  const supabase = await dimsClient();
  const { data } = await supabase
    .from("committee_dimensions_config")
    .select("dimensions, drafting_divisor, presentation_divisor")
    .maybeSingle();
  return rowToConfig(data);
}

// Admin console read (same data; named separately for symmetry with the other
// config domains and to signal the privileged surface).
export async function getCommitteeDimensionsConfigAdmin(): Promise<CommitteeDimensionsConfig> {
  return getCommitteeDimensionsConfig();
}

export async function updateCommitteeDimensionsConfig(input: {
  dimensions: { key: string; label: string }[];
  draftingDivisor: number;
  presentationDivisor: number;
}): Promise<ActionResult<CommitteeDimensionsConfig>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  // Validate divisors — must be > 0 (and sane) so a level can never divide by 0.
  const dd = Number(input.draftingDivisor);
  const pd = Number(input.presentationDivisor);
  if (!Number.isFinite(dd) || dd <= 0 || dd > 1000) {
    return { success: false, error: "Drafting divisor must be greater than 0." };
  }
  if (!Number.isFinite(pd) || pd <= 0 || pd > 1000) {
    return { success: false, error: "Presentation divisor must be greater than 0." };
  }

  // Keep only the 6 fixed keys; take the admin's label, fall back to default.
  const labelByKey = new Map<string, string>();
  for (const d of input.dimensions ?? []) {
    if (typeof d?.key === "string" && typeof d?.label === "string") {
      const label = d.label.trim();
      if (label.length >= 1 && label.length <= 60) labelByKey.set(d.key, label);
    }
  }
  const dimensions = COMMITTEE_DIMENSIONS.map((d) => ({
    key: d.key,
    label: labelByKey.get(d.key) ?? d.label,
  }));

  const supabase = await dimsClient();
  const { data, error } = await supabase
    .from("committee_dimensions_config")
    .upsert(
      {
        id: true,
        dimensions: dimensions as unknown as never,
        drafting_divisor: dd,
        presentation_divisor: pd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("dimensions, drafting_divisor, presentation_divisor")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save committee dimensions." };
  }

  revalidatePath("/yip/dashboard/admin/scoring-config");
  return { success: true, data: rowToConfig(data) };
}
