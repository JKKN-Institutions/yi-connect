import "server-only";

import type { createServiceClient } from "@/lib/yip/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Clear the raise-to-speak floor when the House moves to a new agenda item.
 * A 'waiting'/'called' placard belongs to the debate that was live; the next
 * session starts every member on a fresh floor. Called from the agenda-advance
 * transitions (advanceAgenda / startAgendaItem / createTemporaryAgendaItem) so
 * the Chair's live queue only ever holds requests for the current session and
 * the "one active placard per participant" invariant tracks the live floor.
 *
 * Best-effort: it must NEVER turn a successful agenda transition into a
 * failure — floor cleanup is cosmetic next to moving the House on. Runs on the
 * service client the caller already holds (yip.speaking_requests writes bypass
 * RLS, same as every other yip write path).
 */
export async function expireActiveSpeakingRequests(
  supabase: ServiceClient,
  eventId: string
): Promise<void> {
  try {
    await supabase
      .from("speaking_requests")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .in("status", ["waiting", "called"]);
  } catch {
    // Never block an agenda transition on floor cleanup.
  }
}
