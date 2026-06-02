"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Flag deltas (Special Remarks) ────────────────────────────────
//
// Singleton row in yip.scoring_flags_config. The `deltas` JSONB column
// stores the point delta applied to a participant's total when a jury
// member ticks the corresponding Special Remark for them.
//
// Seeded default (migration 20260527200000_yip_demo_readiness.sql):
//   { "no_confidence_brought":  3
//   , "walkout":               -5
//   , "ruckus":                -3
//   , "suspension":           -10 }

export type FlagKey =
  | "no_confidence_brought"
  | "walkout"
  | "ruckus"
  | "suspension";

export type FlagDeltas = Record<FlagKey, number>;

const DEFAULT_DELTAS: FlagDeltas = {
  no_confidence_brought: 3,
  walkout: -5,
  ruckus: -3,
  suspension: -10,
};

function coerceDeltas(raw: unknown): FlagDeltas {
  const obj = (raw ?? {}) as Partial<Record<string, unknown>>;
  return {
    no_confidence_brought:
      typeof obj.no_confidence_brought === "number"
        ? obj.no_confidence_brought
        : DEFAULT_DELTAS.no_confidence_brought,
    walkout:
      typeof obj.walkout === "number" ? obj.walkout : DEFAULT_DELTAS.walkout,
    ruckus:
      typeof obj.ruckus === "number" ? obj.ruckus : DEFAULT_DELTAS.ruckus,
    suspension:
      typeof obj.suspension === "number"
        ? obj.suspension
        : DEFAULT_DELTAS.suspension,
  };
}

export async function getScoringFlagsConfig(): Promise<
  ActionResult<{ deltas: FlagDeltas; updated_at: string | null }>
> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("scoring_flags_config")
    .select("deltas, updated_at")
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data) {
    // No singleton row yet — return defaults so callers always have a shape.
    return {
      success: true,
      data: { deltas: { ...DEFAULT_DELTAS }, updated_at: null },
    };
  }

  return {
    success: true,
    data: {
      deltas: coerceDeltas(data.deltas),
      updated_at: data.updated_at,
    },
  };
}

// Super-admin: update the Special Remarks point deltas (singleton, global).
export async function updateScoringFlagsConfig(
  deltas: FlagDeltas
): Promise<ActionResult<{ deltas: FlagDeltas }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const clean = coerceDeltas(deltas);
  for (const v of Object.values(clean)) {
    if (!Number.isFinite(v)) {
      return { success: false, error: "All deltas must be numbers" };
    }
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("scoring_flags_config").upsert(
    {
      id: true,
      deltas: clean as unknown as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/admin/scoring-rules");
  return { success: true, data: { deltas: clean } };
}
