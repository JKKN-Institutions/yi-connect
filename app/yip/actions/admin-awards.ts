"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  AWARD_ELIGIBILITIES,
  AWARD_RANK_MODES,
} from "@/lib/yip/award-formula";
import {
  describeRoundLevels,
  fetchEventRoundLevel,
  normaliseRoundLevels,
  pickByLevel,
  scopesOverlap,
  type RoundLevel,
} from "@/lib/yip/round-level";
import { resolveAwardsForLevel } from "@/lib/yip/awards";

// Admin configuration for the workbook awards (yip.award_definitions). The
// award MATH (eligibility + ranking) is now editable here via eligibility /
// rank_mode / rank_keys; the results engine interprets those on every Compute.
//
// ROUND LEVEL (2026-08)
// An award may be scoped to chapter / regional / national rounds via `levels`.
// NULL = every round, which is what every pre-existing award means, so nothing
// changes until a scope is set. Because the regional set reuses seven of the
// chapter award_keys (same award, different level), an award_key is no longer
// unique — the identity of a row is its `id`. Updating by award_key would write
// BOTH the chapter and the regional row at once. See lib/yip/round-level.ts.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// id/levels/eligibility/rank_mode/rank_keys are newer than the generated
// Database types (which have been stale for this table since the June formula
// columns landed), so reads/writes use an untyped client view — values are
// validated/coerced here.
async function awardsClient(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

export type AwardDefinition = {
  /** Row identity. award_key is NOT unique once an award is level-scoped. */
  id: string;
  award_key: string;
  label: string;
  basis_description: string;
  default_recipients: number;
  is_team: boolean;
  is_active: boolean;
  display_order: number;
  eligibility: string;
  rank_mode: string;
  rank_keys: string[];
  /** Round levels this award applies to. null = every round. */
  levels: RoundLevel[] | null;
};

const COLS =
  "id, award_key, label, basis_description, default_recipients, is_team, is_active, display_order, eligibility, rank_mode, rank_keys, levels";

/** Normalise a raw DB row: `levels` NULL stays NULL — "every round". */
function toAwardDefinition(row: unknown): AwardDefinition {
  const r = row as AwardDefinition & { levels?: string[] | null };
  return { ...r, levels: normaliseRoundLevels(r.levels) };
}

/** EVERY award row, at every level — the admin console shows and groups them
 *  all. Level resolution for a single event is getEventAwardConfig(). */
export async function listAwardDefinitions(): Promise<AwardDefinition[]> {
  const supabase = await awardsClient();
  const { data, error } = await supabase
    .from("award_definitions")
    .select(COLS)
    .order("display_order");
  if (error || !data) return [];
  return data.map(toAwardDefinition);
}

export type AwardDefinitionPatch = {
  label?: string;
  default_recipients?: number;
  is_active?: boolean;
  eligibility?: string;
  rank_mode?: string;
  rank_keys?: string[];
  /** Round levels; empty / all three / null all mean "every round". */
  levels?: string[] | null;
};

/**
 * Edit ONE award row, identified by its `id`.
 *
 * NOT by award_key: the chapter and regional sets share seven keys, so
 * `.eq("award_key", …)` would silently write both rows at once.
 */
export async function updateAwardDefinition(
  id: string,
  patch: AwardDefinitionPatch
): Promise<ActionResult<AwardDefinition>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "No award was specified." };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.label === "string") {
    const label = patch.label.trim();
    if (label.length < 2)
      return { success: false, error: "Award name must be at least 2 characters." };
    if (label.length > 80)
      return { success: false, error: "Award name is too long (max 80)." };
    update.label = label;
  }
  if (typeof patch.default_recipients === "number") {
    const n = Math.round(patch.default_recipients);
    if (n < 1 || n > 50)
      return {
        success: false,
        error: "Recipients must be between 1 and 50.",
      };
    update.default_recipients = n;
  }
  if (typeof patch.is_active === "boolean") update.is_active = patch.is_active;
  if (typeof patch.eligibility === "string") {
    if (!(AWARD_ELIGIBILITIES as readonly string[]).includes(patch.eligibility))
      return { success: false, error: "Unknown eligibility." };
    update.eligibility = patch.eligibility;
  }
  if (typeof patch.rank_mode === "string") {
    if (!(AWARD_RANK_MODES as readonly string[]).includes(patch.rank_mode))
      return { success: false, error: "Unknown rank mode." };
    update.rank_mode = patch.rank_mode;
  }
  if (Array.isArray(patch.rank_keys)) {
    update.rank_keys = patch.rank_keys
      .map((k) => String(k).trim())
      .filter((k) => k.length > 0 && k.length <= 60)
      .slice(0, 12);
  }

  const supabase = await awardsClient();

  // Changing the level scope: two SCOPED awards sharing a key must not both
  // claim a level — resolution would be ambiguous. A global (every-round) award
  // never conflicts; it is the documented fallback a scoped award overrides.
  if (patch.levels !== undefined) {
    const levels = normaliseRoundLevels(patch.levels);

    const { data: self } = await supabase
      .from("award_definitions")
      .select("award_key")
      .eq("id", id)
      .maybeSingle();
    if (!self) return { success: false, error: "That award no longer exists." };

    const { data: siblings } = await supabase
      .from("award_definitions")
      .select("id, levels")
      .eq("award_key", (self as { award_key: string }).award_key);

    const clash = (siblings ?? []).find(
      (r) =>
        (r as { id: string }).id !== id &&
        scopesOverlap(
          normaliseRoundLevels((r as { levels?: string[] | null }).levels),
          levels
        )
    );
    if (clash)
      return {
        success: false,
        error: `Another award with the same key already covers ${describeRoundLevels(
          levels
        )}. Change the rounds this one applies to, or edit that award instead.`,
      };

    update.levels = levels;
  }

  const { data, error } = await supabase
    .from("award_definitions")
    .update(update)
    .eq("id", id)
    .select(COLS)
    .single();

  if (error || !data)
    return {
      success: false,
      error: error?.message ?? "Failed to update award.",
    };

  revalidatePath("/yip/dashboard/admin/awards");
  return { success: true, data: toAwardDefinition(data) };
}

// ─── Per-event overrides (each chapter can "recognise more" on its own event) ──

export type EventAwardRow = AwardDefinition & {
  effective_recipients: number;
  effective_active: boolean;
  has_override: boolean;
};

/** THIS EVENT'S awards with their EFFECTIVE recipient count + on/off (per-event
 * override falling back to the global default). Read-gated to score viewers.
 *
 * Which awards those are depends on the event's ROUND LEVEL: a round with its
 * own award set gets that set, anything else gets the every-round set
 * (resolveAwardsForLevel). Per-event overrides stay keyed by award_key — an
 * event has exactly one level, so at most one definition per key is in play. */
export async function getEventAwardConfig(
  eventId: string
): Promise<EventAwardRow[]> {
  const access = await getYipEventAccess(eventId);
  // Manager-gated (chapter organiser), NOT score-gated: recipient counts are a
  // setup choice and reveal no scores, so the chapter that runs the event can set
  // them on its own Awards tab.
  if (!access.canManage) return [];
  const supabase = await awardsClient();
  const [defsRes, cfgRes, level] = await Promise.all([
    supabase.from("award_definitions").select(COLS).order("display_order"),
    supabase
      .from("event_award_config")
      .select("award_key, recipients, is_active")
      .eq("event_id", eventId),
    fetchEventRoundLevel(supabase as never, eventId),
  ]);
  const cfg = new Map(
    (cfgRes.data ?? []).map((c) => [c.award_key, c])
  );
  const defs = resolveAwardsForLevel(
    (defsRes.data ?? []).map(toAwardDefinition),
    level
  );
  return defs.map((d) => {
    const o = cfg.get(d.award_key);
    return {
      ...d,
      effective_recipients: o?.recipients ?? d.default_recipients,
      effective_active: o?.is_active ?? d.is_active,
      has_override: !!o && (o.recipients != null || o.is_active != null),
    };
  });
}

/**
 * The award LABELS this event gives out, in display order — level-resolved, and
 * including inactive awards (an award chosen by hand is seeded inactive so the
 * engine never auto-assigns it, but the chair must still be able to pin it).
 *
 * Feeds the Results screen's award grid and its manual-override picker so both
 * show the round's real awards instead of the hardcoded chapter 15. Gated to the
 * same audience that can read results; returns [] otherwise, and the caller
 * falls back to the chapter set.
 */
export async function getEventAwardLabels(eventId: string): Promise<string[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return [];
  const supabase = await awardsClient();
  const [defsRes, level] = await Promise.all([
    supabase
      .from("award_definitions")
      .select("award_key, label, display_order, levels")
      .order("display_order"),
    fetchEventRoundLevel(supabase as never, eventId),
  ]);
  const rows = (defsRes.data ?? []) as {
    label: string;
    levels?: string[] | null;
  }[];
  return resolveAwardsForLevel(rows, level).map((r) => r.label);
}

/** Set (or clear) this event's recipient/on-off override for one award. Pass
 * null to fall back to the global default. Manager-gated (chapter chair+). */
export async function setEventAwardConfig(
  eventId: string,
  awardKey: string,
  patch: { recipients?: number | null; is_active?: boolean | null }
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };
  if (
    typeof patch.recipients === "number" &&
    (patch.recipients < 1 || patch.recipients > 50)
  )
    return { success: false, error: "Recipients must be between 1 and 50." };

  const supabase = await awardsClient();
  const row: {
    event_id: string;
    award_key: string;
    updated_at: string;
    recipients?: number | null;
    is_active?: boolean | null;
  } = {
    event_id: eventId,
    award_key: awardKey,
    updated_at: new Date().toISOString(),
  };
  if (patch.recipients !== undefined) row.recipients = patch.recipients;
  if (patch.is_active !== undefined) row.is_active = patch.is_active;

  const { error } = await supabase
    .from("event_award_config")
    .upsert(row, { onConflict: "event_id,award_key" });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  return { success: true, data: null };
}
