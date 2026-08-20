"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

// use_bucket_model is newer than the generated Database types, so reads/writes
// that reference it use an untyped client view (values are validated/coerced).
async function settingsClient(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

// Global scoring-rule settings (singleton). Super-admin controlled; read by the
// results engine so no aggregation decision is hardcoded.
//
// DELIBERATELY NOT SCOPED BY ROUND LEVEL (2026-08). yip.session_parameters,
// yip.scoring_buckets and the position merit table were all given a `levels`
// scope so a regional round can be marked differently from a chapter round.
// This table was considered and left GLOBAL on purpose:
//
//   • aggregation_method and normalize_per_session describe the SHAPE OF THE
//     ARITHMETIC, not the difficulty of a round. "Every session is scored on its
//     own rubric, normalised to a fraction of its own max, weighted, out of 90"
//     is what a YIP score MEANS. Letting one level average and another take a
//     weighted percentage would make two rounds' scores incomparable, which
//     defeats the point of a national pipeline that promotes across levels.
//     What genuinely differs between levels is the rubrics and the weights, and
//     those are exactly what session_parameters and scoring_buckets now scope.
//
//   • use_bucket_model is a CUTOVER TOGGLE between two scoring engines. Scoping
//     it would let chapter rounds run the legacy per-session model while
//     regional rounds run the bucket model, against one results table, with no
//     way to compare them. The toggle exists to move everyone at once.
//
//   • best_n only has meaning under best_n aggregation, so it follows the
//     method.
//
// If this ever does need to vary, note the shape: the row is a HARD singleton
// (id boolean PRIMARY KEY, CHECK (id)), so it cannot hold a second row without
// dropping its primary key. Follow the overlay-table approach taken for the
// merit points in supabase/migrations/yip_position_bonus_config_round_level.sql
// rather than performing identity surgery on a live table.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AggregationMethod =
  | "weighted_average"
  | "average"
  | "best_n"
  | "sum"
  | "weighted_90"
  // Uniform /100 model (#635/#636): every session scored on its own rubric,
  // normalised to a fraction of its own max, weighted by session_weight → /90.
  // The engine (results.ts) + DB CHECK constraint already accept this; it was
  // missing ONLY from this app-level allow-list, so getScoringSettings silently
  // sanitised the live setting back to weighted_average — the intended model
  // never ran. Adding it here makes the configured method actually take effect.
  | "weighted_pct_90";
const METHODS: AggregationMethod[] = [
  "weighted_average",
  "average",
  "best_n",
  "sum",
  "weighted_90",
  "weighted_pct_90",
];

export type ScoringSettings = {
  aggregation_method: AggregationMethod;
  normalize_per_session: boolean;
  best_n: number;
  use_bucket_model: boolean;
  updated_at: string | null;
};

const DEFAULTS: ScoringSettings = {
  aggregation_method: "weighted_average",
  normalize_per_session: true,
  best_n: 3,
  use_bucket_model: false,
  updated_at: null,
};

const PATH = "/dashboard/admin/scoring-rules";

export async function getScoringSettings(): Promise<ScoringSettings> {
  const supabase = await settingsClient();
  const { data } = await supabase
    .from("scoring_settings")
    .select("aggregation_method, normalize_per_session, best_n, use_bucket_model, updated_at")
    .eq("id", true)
    .maybeSingle();
  if (!data) return { ...DEFAULTS };
  return {
    aggregation_method: (METHODS.includes(data.aggregation_method as AggregationMethod)
      ? data.aggregation_method
      : "weighted_average") as AggregationMethod,
    normalize_per_session: data.normalize_per_session !== false,
    best_n: Number(data.best_n) || 3,
    use_bucket_model: data.use_bucket_model === true,
    updated_at: data.updated_at,
  };
}

// Cutover toggle: switch live scoring between the legacy per-session model and
// the configurable scoring_buckets model. Super-admin only.
export async function setUseBucketModel(
  on: boolean
): Promise<ActionResult<{ use_bucket_model: boolean }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await settingsClient();
  const { error } = await supabase
    .from("scoring_settings")
    .upsert(
      { id: true, use_bucket_model: !!on, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  revalidatePath("/dashboard/admin/scoring-framework");
  return { success: true, data: { use_bucket_model: !!on } };
}

export async function updateScoringSettings(input: {
  aggregation_method: AggregationMethod;
  normalize_per_session: boolean;
  best_n: number;
}): Promise<ActionResult<ScoringSettings>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!METHODS.includes(input.aggregation_method)) {
    return { success: false, error: "Invalid aggregation method" };
  }
  const best_n = Math.max(1, Math.round(Number(input.best_n) || 3));

  const supabase = await settingsClient();
  const { data, error } = await supabase
    .from("scoring_settings")
    .upsert(
      {
        id: true,
        aggregation_method: input.aggregation_method,
        normalize_per_session: !!input.normalize_per_session,
        best_n,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save settings" };
  }
  revalidatePath(PATH);
  return {
    success: true,
    data: {
      aggregation_method: input.aggregation_method,
      normalize_per_session: !!input.normalize_per_session,
      best_n,
      use_bucket_model: data.use_bucket_model === true,
      updated_at: data.updated_at,
    },
  };
}
