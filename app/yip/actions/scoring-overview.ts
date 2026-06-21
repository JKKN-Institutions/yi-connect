"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

/**
 * Per-participant jury-scoring tally for an event, for the organiser's Speeches
 * overview. Maps participant_id → the number of DISTINCT jurors who have
 * SUBMITTED a score for that delegate across all scored sessions. A participant
 * absent from the map (or mapped to 0) has not been scored yet.
 *
 * This is the "has the jury scored them?" signal — separate from the 90-second
 * speech (a logistics checkmark). canManage-gated (mirrors getEventParticipants);
 * returns {} when the caller can't manage the event.
 */
export async function getEventScoredCounts(
  eventId: string
): Promise<Record<string, number>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return {};

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("scores")
    .select("participant_id, jury_assignment_id")
    .eq("event_id", eventId)
    .eq("status", "submitted");
  if (error || !data) return {};

  // Distinct jurors (jury_assignment_id) per participant — a delegate scored by
  // 3 jurors across 5 sessions counts as 3, not 15.
  const jurorsByParticipant = new Map<string, Set<string>>();
  for (const row of data as {
    participant_id: string | null;
    jury_assignment_id: string | null;
  }[]) {
    const pid = row.participant_id;
    if (!pid) continue;
    let set = jurorsByParticipant.get(pid);
    if (!set) {
      set = new Set<string>();
      jurorsByParticipant.set(pid, set);
    }
    set.add(row.jury_assignment_id ?? "");
  }

  const out: Record<string, number> = {};
  for (const [pid, set] of jurorsByParticipant) out[pid] = set.size;
  return out;
}
