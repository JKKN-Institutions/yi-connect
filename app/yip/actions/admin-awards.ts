"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  AWARD_ELIGIBILITIES,
  AWARD_RANK_MODES,
} from "@/lib/yip/award-formula";

// Admin configuration for the 15 workbook awards (yip.award_definitions). The
// award MATH lives in the results engine's registry keyed by award_key; this
// surface owns the operational knobs — label, how many recipients, on/off. The
// engine reads these on every Compute Results, so changes here are wired live.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AwardDefinition = {
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
};

const COLS =
  "award_key, label, basis_description, default_recipients, is_team, is_active, display_order, eligibility, rank_mode, rank_keys";

export async function listAwardDefinitions(): Promise<AwardDefinition[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("award_definitions")
    .select(COLS)
    .order("display_order");
  if (error || !data) return [];
  return data as AwardDefinition[];
}

export type AwardDefinitionPatch = {
  label?: string;
  default_recipients?: number;
  is_active?: boolean;
  eligibility?: string;
  rank_mode?: string;
  rank_keys?: string[];
};

export async function updateAwardDefinition(
  awardKey: string,
  patch: AwardDefinitionPatch
): Promise<ActionResult<AwardDefinition>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

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

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("award_definitions")
    .update(update)
    .eq("award_key", awardKey)
    .select(COLS)
    .single();

  if (error || !data)
    return {
      success: false,
      error: error?.message ?? "Failed to update award.",
    };

  revalidatePath("/yip/dashboard/admin/awards");
  return { success: true, data: data as AwardDefinition };
}

// ─── Per-event overrides (each chapter can "recognise more" on its own event) ──

export type EventAwardRow = AwardDefinition & {
  effective_recipients: number;
  effective_active: boolean;
  has_override: boolean;
};

/** The 15 awards with this event's EFFECTIVE recipient count + on/off (per-event
 * override falling back to the global default). Read-gated to score viewers. */
export async function getEventAwardConfig(
  eventId: string
): Promise<EventAwardRow[]> {
  const access = await getYipEventAccess(eventId);
  // Manager-gated (chapter organiser), NOT score-gated: recipient counts are a
  // setup choice and reveal no scores, so the chapter that runs the event can set
  // them on its own Awards tab.
  if (!access.canManage) return [];
  const supabase = await createServiceClient();
  const [defsRes, cfgRes] = await Promise.all([
    supabase.from("award_definitions").select(COLS).order("display_order"),
    supabase
      .from("event_award_config")
      .select("award_key, recipients, is_active")
      .eq("event_id", eventId),
  ]);
  const cfg = new Map(
    (cfgRes.data ?? []).map((c) => [c.award_key, c])
  );
  return (defsRes.data ?? []).map((d) => {
    const o = cfg.get((d as AwardDefinition).award_key);
    return {
      ...(d as AwardDefinition),
      effective_recipients: o?.recipients ?? (d as AwardDefinition).default_recipients,
      effective_active: o?.is_active ?? (d as AwardDefinition).is_active,
      has_override: !!o && (o.recipients != null || o.is_active != null),
    };
  });
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

  const supabase = await createServiceClient();
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
