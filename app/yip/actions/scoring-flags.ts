"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

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
