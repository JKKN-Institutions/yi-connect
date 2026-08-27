import "server-only";

import type { createServiceClient } from "@/lib/yip/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * SPEAKING FLOOR — SESSION SCOPE (single source of truth)
 * ─────────────────────────────────────────────────────────────────────
 * An "active" (status = waiting/called) yip.speaking_requests row belongs to
 * ONE agenda item — the one that was live when the hand went up
 * (agenda_item_id is stamped once at insert in requestToSpeak and never
 * changes). When the House moves on, those rows don't get rewritten; the
 * only thing that clears them is expireActiveSpeakingRequests
 * (lib/yip/speaking-floor-expiry.ts) — a BEST-EFFORT cleanup, deliberately
 * wrapped so it can never fail an agenda transition, which means it can also
 * fail *silently*.
 *
 * So every query that reads or writes the active set MUST filter by
 * agenda_item_id = the event's CURRENT current_agenda_item_id, through the
 * helpers below — never by trusting that expiry already ran. That is the
 * whole fix: even when expiry silently fails, a stale row simply stops
 * counting as "active" for any purpose the instant the House moves on,
 * because nothing will match it against the new current_agenda_item_id.
 *
 * FAIL CLOSED: when no agenda item is live right now (current_agenda_item_id
 * is null — no debate is running), `activeAgendaItemFilter` is a sentinel
 * UUID that can never be a real yip.agenda.id. Filtering on it always
 * matches zero rows, so "no live session" means the active queue is EMPTY —
 * never "everything." Do not special-case a null current_agenda_item_id by
 * skipping the `.eq("agenda_item_id", ...)` call instead of using the
 * sentinel — that re-opens exactly the unscoped-query bug this file exists
 * to close (a null-scope query must never silently degrade to unfiltered).
 */

// Nil UUID — a value gen_random_uuid() can never produce and no real
// yip.agenda row can ever have. Used only as a "match nothing" filter value.
const NO_LIVE_SESSION = "00000000-0000-0000-0000-000000000000";

export interface SpeakingFloorScope {
  /** The live agenda item id, or null if no debate is running right now. */
  currentAgendaItemId: string | null;
  /** Filter value for speaking_requests.agenda_item_id. Always the real live
   *  id when a session is live; otherwise the sentinel above (fail closed). */
  activeAgendaItemFilter: string;
}

/**
 * Turn an already-known `events.current_agenda_item_id` into the safe filter
 * value. Use this when the caller already fetched that column for another
 * reason (liveItemTitle, hasLiveItem, the "is the floor open" check, …) so it
 * doesn't need a second round trip just to get the scope.
 */
export function scopeToLiveSession(currentAgendaItemId: string | null): string {
  return currentAgendaItemId ?? NO_LIVE_SESSION;
}

/**
 * Fetch the event's live session and its safe filter value in one call — for
 * callers (gateRequest / gateRequestForSpeaker) that resolve an eventId from
 * a request id and don't already have events.current_agenda_item_id in hand.
 */
export async function getSpeakingFloorScope(
  supabase: ServiceClient,
  eventId: string
): Promise<SpeakingFloorScope> {
  const { data } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();
  const currentAgendaItemId = data?.current_agenda_item_id ?? null;
  return {
    currentAgendaItemId,
    activeAgendaItemFilter: scopeToLiveSession(currentAgendaItemId),
  };
}
