"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { isAwardLabel } from "@/lib/yip/awards";
import { computeResults } from "./results";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AwardOverride = {
  id: string;
  award_label: string;
  participant_id: string;
  participant_name: string | null;
  note: string | null;
  set_by_email: string | null;
  created_at: string;
};

const CHAIR_ONLY =
  "Only the chapter chair (or a regional/national admin) can override award winners.";

/**
 * Current manual award overrides for the event. Gated to the same audience that
 * can read results (national/super-admin) so the override panel only renders
 * where the leaderboard does.
 */
export async function getAwardOverrides(
  eventId: string
): Promise<AwardOverride[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) return [];

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("award_overrides")
    .select(
      "id, award_label, participant_id, note, set_by_email, created_at, participant:participants(full_name)"
    )
    .eq("event_id", eventId)
    .order("award_label");

  if (error || !data) return [];
  return data.map((r) => {
    const participant = r.participant as { full_name: string } | null;
    return {
      id: r.id,
      award_label: r.award_label,
      participant_id: r.participant_id,
      participant_name: participant?.full_name ?? null,
      note: r.note,
      set_by_email: r.set_by_email,
      created_at: r.created_at,
    };
  });
}

/**
 * Pin THE winner of one award to a chosen participant (chair's final say).
 * Upserts the override and re-runs computeResults so it takes effect at once and
 * survives every future recompute (the override is applied as a final pass).
 */
export async function setAwardWinner(
  eventId: string,
  awardLabel: string,
  participantId: string,
  note?: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) return { success: false, error: CHAIR_ONLY };
  if (!isAwardLabel(awardLabel)) {
    return { success: false, error: "Unknown award." };
  }

  const supabase = await createServiceClient();

  // The pick must be a participant of THIS event (no cross-event override).
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "That participant is not in this event." };
  }

  // Who is making the change (for the audit trail + the override card).
  let email: string | null = null;
  try {
    const authed = await createClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    email = user?.email ?? null;
  } catch {
    // best-effort — the override still records via the audit log
  }

  const { error } = await supabase.from("award_overrides").upsert(
    {
      event_id: eventId,
      award_label: awardLabel,
      participant_id: participantId,
      note: note?.trim() || null,
      set_by_email: email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,award_label" }
  );
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "update",
    target_table: "award_overrides",
    target_id: participantId,
    target_event_id: eventId,
  });

  // Re-persist results so the override wins immediately.
  const recompute = await computeResults(eventId);
  if (!recompute.success) {
    return {
      success: false,
      error: `Override saved, but the results recompute failed: ${recompute.error}`,
    };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  return { success: true, data: null };
}

/** Remove an award override → the auto-computed winner takes the award back. */
export async function clearAwardOverride(
  eventId: string,
  awardLabel: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) return { success: false, error: CHAIR_ONLY };
  if (!isAwardLabel(awardLabel)) {
    return { success: false, error: "Unknown award." };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("award_overrides")
    .delete()
    .eq("event_id", eventId)
    .eq("award_label", awardLabel);
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "delete",
    target_table: "award_overrides",
    target_event_id: eventId,
  });

  const recompute = await computeResults(eventId);
  if (!recompute.success) {
    return {
      success: false,
      error: `Override cleared, but the results recompute failed: ${recompute.error}`,
    };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/results`);
  return { success: true, data: null };
}
