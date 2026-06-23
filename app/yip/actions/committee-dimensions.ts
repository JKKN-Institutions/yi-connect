"use server";

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
  const supabase = await createServiceClient();
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

  const supabase = await createServiceClient();
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
