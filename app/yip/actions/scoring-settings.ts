"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

// Global scoring-rule settings (singleton). Super-admin controlled; read by the
// results engine so no aggregation decision is hardcoded.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AggregationMethod = "weighted_average" | "average" | "best_n";
const METHODS: AggregationMethod[] = ["weighted_average", "average", "best_n"];

export type ScoringSettings = {
  aggregation_method: AggregationMethod;
  normalize_per_session: boolean;
  best_n: number;
  updated_at: string | null;
};

const DEFAULTS: ScoringSettings = {
  aggregation_method: "weighted_average",
  normalize_per_session: true,
  best_n: 3,
  updated_at: null,
};

const PATH = "/dashboard/admin/scoring-rules";

export async function getScoringSettings(): Promise<ScoringSettings> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("scoring_settings")
    .select("aggregation_method, normalize_per_session, best_n, updated_at")
    .eq("id", true)
    .maybeSingle();
  if (!data) return { ...DEFAULTS };
  return {
    aggregation_method: (METHODS.includes(data.aggregation_method as AggregationMethod)
      ? data.aggregation_method
      : "weighted_average") as AggregationMethod,
    normalize_per_session: data.normalize_per_session !== false,
    best_n: Number(data.best_n) || 3,
    updated_at: data.updated_at,
  };
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

  const supabase = await createServiceClient();
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
      updated_at: data.updated_at,
    },
  };
}
