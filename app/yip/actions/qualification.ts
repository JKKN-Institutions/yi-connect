"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  markQualified,
  unmarkQualified,
  getEventQualificationData,
} from "./pipeline";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Per-zone award→qualification config ─────────────────────────
// Advancement is AWARD-BASED: each QUALIFYING award's chosen advancer moves to
// the next round. A zone may mark specific awards RECOGNITION-ONLY (awarded +
// shown, but do NOT advance). Stored in yip.zone_award_config; ABSENCE of a row
// = the award qualifies (default-true). Service-role read only (the table is
// RLS-locked with no policies); callers reach it through this action.

export type ZoneAwardConfig = Record<string, boolean>; // award_key -> qualifies

export async function getZoneAwardConfig(
  zoneCode: string | null
): Promise<ZoneAwardConfig> {
  if (!zoneCode) return {};
  const supabase = await createServiceClient();
  // Untyped client — zone_award_config is newer than the generated types.
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from("zone_award_config")
    .select("award_key, qualifies")
    .eq("yi_zone_code", zoneCode);
  if (error || !data) return {};
  const map: ZoneAwardConfig = {};
  for (const row of data as { award_key: string; qualifies: boolean }[]) {
    map[row.award_key] = row.qualifies;
  }
  return map;
}

// ─── Lock the award-based qualifiers ─────────────────────────────
// Sets participants.qualified_for_next to EXACTLY the supplied advancer set
// (one chosen advancer per qualifying award, already deduped client-side; we
// dedupe again defensively). REUSES the pipeline primitives markQualified /
// unmarkQualified (which carry the super-admin gate) rather than touching
// qualified_for_next directly, so there is ONE qualification mechanism.
// A student picked as the advancer for two awards qualifies exactly once
// (qualified_for_next is a boolean).
export async function lockAwardQualifiers(
  eventId: string,
  advancerIds: string[]
): Promise<ActionResult<{ qualified: number; added: number; removed: number }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const unique = Array.from(new Set(advancerIds.filter(Boolean)));
  const target = new Set(unique);

  // Diff against the current qualified set so LOCK is idempotent + a re-lock
  // after a swap removes the previously-advanced student who is no longer chosen.
  const { qualifiedIds: current } = await getEventQualificationData(eventId);
  const toMark = unique.filter((id) => !current.includes(id));
  const toUnmark = current.filter((id) => !target.has(id));

  if (toMark.length > 0) {
    const r = await markQualified(toMark, eventId);
    if (!r.success) return { success: false, error: r.error };
  }
  if (toUnmark.length > 0) {
    const r = await unmarkQualified(toUnmark, eventId);
    if (!r.success) return { success: false, error: r.error };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  return {
    success: true,
    data: { qualified: unique.length, added: toMark.length, removed: toUnmark.length },
  };
}
