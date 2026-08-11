/**
 * Which check-in session does the chapter-wide Delegates page show?
 *
 * Attendance in Yi-Future is recorded PER phase event — `future.phase_event_attendance`
 * is keyed on `(phase_event_id, delegate_id)` — but /yi-future/chapter/delegates is
 * chapter-wide, not event-scoped. So the page must pick ONE session and say out loud
 * which one it picked, or a chair reads yesterday's numbers as today's.
 *
 * THE RULE: the session whose scheduled start is NEAREST to now, looking both
 * backwards and forwards. A chair opening the page on the morning of an event sees
 * that event; opening it the evening after, still that event; only once the NEXT
 * session is closer than the last one does the page move on. Equal distance goes to
 * the later session. Any chapter with more than one session also gets a picker, so
 * the default is never a trap.
 *
 * There is deliberately NO "check-in type" test. `future.phase_events.type` has no
 * check-in value — the enum is orientation / policy_workshop / expert_talk /
 * mentorship_clinic / execution_planning / midpoint_review / refinement_workshop /
 * mock_jury / doc_support — and EVERY phase event can carry attendance (the chapter
 * Journey screen puts a check-in list on all of them). Erode's 12 Aug final, titled
 * "Erode Chapter Final 6.0 — Day Check-in", is stored as `doc_support`, so filtering
 * on type would have hidden the one session this feature exists to show.
 */

export type CheckInSession = {
  id: string;
  title: string;
  scheduled_at: string;
};

/**
 * Picks the session nearest `now` (past or future). Returns null for an empty list.
 * Sessions with an unparseable `scheduled_at` are skipped rather than sorted to the
 * front by a NaN comparison.
 */
export function pickCheckInSession<T extends CheckInSession>(
  sessions: readonly T[],
  now: number = Date.now()
): T | null {
  let best: T | null = null;
  let bestAt = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const session of sessions) {
    const at = Date.parse(session.scheduled_at);
    if (Number.isNaN(at)) continue;
    const distance = Math.abs(at - now);
    if (distance < bestDistance || (distance === bestDistance && at > bestAt)) {
      best = session;
      bestAt = at;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * IST, matching the convention #885 set across the Yi-Future tree: every date/time
 * formatter passes `timeZone: "Asia/Kolkata"` inline. #885 added no shared helper —
 * it edited 52 formatters in place — so this is that same call, named, not a new
 * timezone policy. Without it a server component renders in the Vercel container's
 * UTC and shows a 09:00 IST session as 03:30.
 */
export function formatIst(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Who marked a delegate present.
 *
 * `marked_by_volunteer_id` (FK -> future.volunteers) has been written by the
 * volunteer desk since it shipped and read by nothing. A BEFORE trigger keeps
 * exactly one of `marked_by` / `marked_by_volunteer_id` set, so this is never
 * ambiguous — but the two mean very different things operationally (someone at the
 * desk as the delegate walked in, versus an admin ticking a box later), which is why
 * the page renders them differently instead of flattening both to a name.
 */
export type CheckInMarker =
  | { kind: "volunteer"; name: string; station: string | null }
  | { kind: "admin"; name: string };

export type CheckIn = {
  attended: boolean;
  markedAt: string | null;
  marker: CheckInMarker | null;
};
