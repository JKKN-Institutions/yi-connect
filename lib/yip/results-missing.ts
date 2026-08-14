/**
 * "Scores but no results" — the post-event rule.
 *
 * An event can finish with hundreds of submitted scores and ZERO rows in
 * `yip.results`, because `computeResults()` only runs when someone opens the
 * Results page and presses "Show Results". Nothing else in the platform ever
 * says so, and the one existing signal (`getResultsFreshness`) is rendered ON
 * the results page — i.e. only after you have already visited the page you
 * forgot to visit. Varanasi Chapter Round 2026 sat like that for a month:
 * 667 submitted scores, 0 results, no ranking, no awards, no promotions.
 *
 * ⚠️  EVENT-DAY SAFETY — why this rule is deliberately time-gated.
 * A previous attempt (PR #915) put the same finding in the Control panel's
 * readiness checklist. That hijacked the live "your next step" pointer during a
 * running event: every fresh score invalidates any compute within seconds, so
 * the amber "go compute results" nag could never be satisfied while scoring was
 * in progress, and it sat next to the Publish control. It was rejected.
 *
 * This rule therefore fires ONLY once the round is demonstrably over, and is
 * rendered on the event's own overview page — never on any live surface.
 *
 * Deciding "over" from the real status machine (lib/yip/constants EVENT_STATUSES):
 *   draft → registration_open → registration_closed → day1_live →
 *   day1_complete → day2_live → completed → results_published
 *
 *   • draft / registration_* — the round never ran. NEVER warn. (This alone
 *     excludes the two stray-score draft events, Bhubaneswar and Vellore.)
 *   • day1_live / day1_complete / day2_live — NOT a reliable "over" signal in
 *     either direction. Organisers routinely never advance the status: 8 of the
 *     13 real events that have already been scored are still sitting in a
 *     *_live status weeks later, Varanasi included. Equally, an event that IS
 *     mid-run is in exactly these statuses. So for these we ignore the status
 *     entirely and use the CALENDAR instead.
 *   • completed / results_published — the organiser has explicitly closed the
 *     round. Definitely over.
 *
 * The calendar gate: the round is over once the last scheduled day has ended
 * (IST midnight after `day2_date ?? day1_date`) plus a grace period. Terminal
 * statuses get no extra grace beyond the end of the last scheduled day;
 * non-terminal ones get two clear days, so a session that overruns — even into
 * the following day — can never be nagged while it is still being scored.
 */

/** Minutes-since-epoch offset of IST (UTC+05:30), in milliseconds. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extra quiet time after the last scheduled day ends, before we are willing to
 * call a round "over" from the calendar alone. Two clear days.
 */
const OVERRUN_GRACE_MS = 2 * ONE_DAY_MS;

/** Statuses the organiser sets only when the round is finished. */
const TERMINAL_STATUSES = new Set(["completed", "results_published"]);

/** Statuses that mean the event never started — never warn about these. */
const PRE_RUN_STATUSES = new Set([
  "draft",
  "registration_open",
  "registration_closed",
]);

/**
 * A handful of stray scores is noise, not a finished round with lost results
 * (e.g. a mock regional event with 4 test scores). A real chapter round submits
 * hundreds. Below this, stay silent.
 */
export const MISSING_RESULTS_MIN_SCORES = 20;

/** Instant (ms) at which the given IST calendar day ends, i.e. next midnight IST. */
function endOfIstDayMs(isoDate: string): number | null {
  const parsed = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return null;
  // `parsed` is midnight UTC of that date; midnight IST is 5h30m earlier.
  return parsed - IST_OFFSET_MS + ONE_DAY_MS;
}

/**
 * Is this event's round finished? Pure — no I/O, so it can be reasoned about
 * and replayed against any event row.
 */
export function isRoundOver(
  status: string,
  day1Date: string | null,
  day2Date: string | null,
  now: Date = new Date()
): boolean {
  if (PRE_RUN_STATUSES.has(status)) return false;

  const lastDay = day2Date ?? day1Date;
  if (!lastDay) return false;
  const lastDayEnd = endOfIstDayMs(lastDay);
  if (lastDayEnd === null) return false;

  const grace = TERMINAL_STATUSES.has(status) ? 0 : OVERRUN_GRACE_MS;
  return now.getTime() >= lastDayEnd + grace;
}

export type MissingResultsNotice = {
  /** Submitted scores sitting on the event with nothing computed from them. */
  scoreCount: number;
  /** Results page — the one with the "Show Results" (compute) button. */
  href: string;
};

/**
 * The whole rule in one place. Returns null when there is nothing to say.
 * Warn only when ALL of these hold:
 *   1. not a mock event,
 *   2. the round is over (see isRoundOver),
 *   3. at least MISSING_RESULTS_MIN_SCORES submitted scores exist,
 *   4. zero rows in yip.results for the event.
 */
export function buildMissingResultsNotice(input: {
  eventId: string;
  status: string;
  day1Date: string | null;
  day2Date: string | null;
  isMock: boolean;
  submittedScoreCount: number;
  resultRowCount: number;
  now?: Date;
}): MissingResultsNotice | null {
  if (input.isMock) return null;
  if (!isRoundOver(input.status, input.day1Date, input.day2Date, input.now))
    return null;
  if (input.submittedScoreCount < MISSING_RESULTS_MIN_SCORES) return null;
  if (input.resultRowCount > 0) return null;

  return {
    scoreCount: input.submittedScoreCount,
    href: `/yip/dashboard/events/${input.eventId}/results`,
  };
}
