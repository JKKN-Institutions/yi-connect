/**
 * Instant right-or-wrong on a PRACTICE card — and the gate that keeps it
 * away from anything scored.
 *
 * WHY THIS IS THE MOST DANGEROUS FILE IN THE VERTICAL. It exists to return
 * the correct answer to a student MID-PAPER. On a practice paper that is the
 * whole point: you tap, the card turns, you find out immediately and read
 * why. On the scored September round the same behaviour would hand every
 * student the answer key one tap at a time and destroy the competition
 * nationally. There is no partial version of that failure.
 *
 * So the gate here is deliberately paranoid, and every rule is separately
 * tested:
 *
 *   - `is_mock` must be EXACTLY true. Not truthy — true. A null, an
 *     undefined, a missing column or a string "false" all DENY.
 *   - The attempt must still be in progress. A finished practice paper is
 *     reviewed through lib/yiq/review.ts, which is the audited path.
 *   - The attempt must belong to the student asking. Checked server-side
 *     against the session, never against anything the client sends.
 *
 * Anything unrecognised denies. This is the opposite posture from the
 * practice pacing rules, which fail OPEN so a database blip cannot cost a
 * child their round — here, failing open costs everyone the competition.
 */

/** The only fields the reveal decision is allowed to look at. */
export type FeedbackAttempt = {
  id: string;
  studentId: string;
  /** attempts.is_mock — must be EXACTLY true. */
  isMock: unknown;
  status: string | null | undefined;
};

export type FeedbackRefusal =
  | "not_practice"
  | "not_in_progress"
  | "not_your_paper"
  | "unknown_status";

export type FeedbackDecision =
  | { ok: true }
  | { ok: false; reason: FeedbackRefusal };

/**
 * May this attempt be told, right now, whether an answer was correct?
 *
 * `viewerStudentId` comes from the server-side session. Passing anything a
 * client supplied would defeat the whole check.
 */
export function canRevealNow(
  attempt: FeedbackAttempt,
  viewerStudentId: string
): FeedbackDecision {
  // EXACTLY true. `Boolean(attempt.isMock)` would let the string "false"
  // through, and a missing column reads as undefined, which must deny.
  if (attempt.isMock !== true) return { ok: false, reason: "not_practice" };

  if (attempt.studentId !== viewerStudentId) {
    return { ok: false, reason: "not_your_paper" };
  }

  switch (attempt.status) {
    case "in_progress":
      return { ok: true };
    case "submitted":
    case "auto_submitted":
    case "disqualified":
      // A finished paper is reviewed through the audited review path, which
      // applies its own gate. This one is only for a card mid-deck.
      return { ok: false, reason: "not_in_progress" };
    default:
      // A status this file has never heard of is a schema change nobody has
      // read yet. Deny until a human has.
      return { ok: false, reason: "unknown_status" };
  }
}

/** What a practice card shows after a tap. Never sent for a scored paper. */
export type CardFeedback = {
  correct: boolean;
  /** The key that was actually right — so a wrong card can show it. */
  correctOption: string;
  /** Why. This is the part that teaches; a bare cross teaches nothing. */
  explanation: string | null;
};

/**
 * The streak a student is on.
 *
 * DELIBERATELY RESETS TO ZERO ON A WRONG ANSWER, and deliberately does not
 * punish beyond that. A streak is there to make a fifth practice round feel
 * worth starting, not to make a student afraid of getting one wrong — which
 * on a PRACTICE paper is the single most useful thing that can happen to
 * them.
 */
export function nextStreak(current: number, correct: boolean): number {
  if (!correct) return 0;
  const n = Number.isFinite(current) ? Math.floor(current) : 0;
  return Math.max(0, n) + 1;
}

/**
 * The line shown beside the streak. Silent below three, because celebrating
 * a streak of one is the kind of thing that makes a sixteen-year-old close
 * the tab.
 */
export function streakLabel(streak: number): string | null {
  if (!Number.isFinite(streak)) return null;
  const n = Math.floor(streak);
  if (n < 3) return null;
  if (n < 5) return `${n} in a row`;
  if (n < 10) return `${n} in a row — good run`;
  if (n < 20) return `${n} in a row — seriously`;
  return `${n} in a row — untouchable`;
}
