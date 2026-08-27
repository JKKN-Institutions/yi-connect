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
 *
 * DEFENSE IN DEPTH: every read/write of the active queue (see
 * lib/yip/speaking-floor-scope.ts) is independently scoped to the event's
 * *current* current_agenda_item_id, so a request left un-expired by a failure
 * here can no longer surface in any queue, count, or action once the House
 * has moved on — it just sits inert until this runs successfully again. That
 * is what makes it safe for this function to swallow its own error instead of
 * throwing: the failure is cosmetic (an orphaned row), not correctness-critical
 * (a leaked queue entry) the way it would be without that scoping. It is
 * still logged below so a persistent failure is visible in the Vercel runtime
 * logs rather than invisible forever.
 */
export async function expireActiveSpeakingRequests(
  supabase: ServiceClient,
  eventId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("speaking_requests")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .in("status", ["waiting", "called"]);
    if (error) {
      console.error(
        `[speaking-floor-expiry] failed to expire active requests for event ${eventId}:`,
        error
      );
    }
  } catch (err) {
    // Never block an agenda transition on floor cleanup — but don't let the
    // failure vanish silently either.
    console.error(
      `[speaking-floor-expiry] threw while expiring active requests for event ${eventId}:`,
      err
    );
  }
}
