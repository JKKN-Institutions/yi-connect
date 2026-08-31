/**
 * Per-question pacing — the half of the anti-AI measures that costs a
 * cheater TIME.
 *
 * WHY THIS EXISTS, and why a timer alone was not enough. The live paper is
 * 30 questions in 30 minutes: 60 seconds per question. Copying a question
 * into an AI and reading the answer back takes 15-25 seconds, so a cheater
 * currently has 35-45 seconds of slack. Even a 30-second timer leaves them
 * about 10. Any timer short enough to beat a copy-paste is too short to be
 * fair to an honest student who has to READ the question first.
 *
 * The timer becomes decisive only once copying is blocked, because then the
 * cheater has to RETYPE the question — 25-40 seconds on a phone — and the
 * timer runs out mid-sentence. Neither half works alone. This module is the
 * timing half; the copy block lives in the quiz client.
 *
 * THE CLOCK IS ANCHORED TO THE SERVER'S RECORD OF THE FIRST VIEW, never to
 * anything the client says and never to the wall clock at render time. A
 * student who refreshes the page must NOT get a fresh timer, or the whole
 * feature is theatre: yiq.attempt_question_views has (attempt_id,
 * question_id) as its primary key precisely so the first view is final.
 *
 * PURE FUNCTIONS ONLY. No database, no auth — those live in
 * app/yiq/actions/attempt.ts. Everything here decides whether a real
 * student's answer counts, so each rule is separately testable.
 */

/**
 * Latency forgiveness on a submitted answer.
 *
 * A student on a school 3G connection can tap an option a comfortable
 * moment before the deadline and still have the request arrive after it.
 * Rejecting that would punish a bad network rather than a cheat — and three
 * seconds is nowhere near enough to consult anything.
 */
export const ANSWER_GRACE_MS = 3000;

/** Bounds mirrored from the CHECK constraint on papers.seconds_per_question. */
export const MIN_SECONDS_PER_QUESTION = 5;
export const MAX_SECONDS_PER_QUESTION = 600;

export type PacingMode =
  | { paced: false }
  | { paced: true; secondsPerQuestion: number };

/**
 * How this paper is paced.
 *
 * FAILS TO UNPACED on anything unusable — a null, a zero, a NaN, a number
 * outside the sane range. That is the safe direction: an unpaced paper is
 * the behaviour every student has had until now, whereas a paper accidentally
 * paced at 0 seconds would auto-fail everybody instantly.
 */
export function pacingFor(secondsPerQuestion: unknown): PacingMode {
  const n =
    typeof secondsPerQuestion === "number"
      ? secondsPerQuestion
      : typeof secondsPerQuestion === "string"
        ? Number(secondsPerQuestion)
        : NaN;

  if (!Number.isFinite(n)) return { paced: false };
  const secs = Math.floor(n);
  if (secs < MIN_SECONDS_PER_QUESTION) return { paced: false };
  if (secs > MAX_SECONDS_PER_QUESTION) return { paced: false };
  return { paced: true, secondsPerQuestion: secs };
}

/**
 * When this question's own time runs out.
 *
 * `firstShownAtMs` is the server's record of when the question was first
 * served to this student. Returns null when the paper is unpaced or the
 * record is unusable — callers must then fall back to the whole-paper
 * deadline rather than inventing one.
 */
export function questionDeadlineMs(
  firstShownAtMs: number | null | undefined,
  pacing: PacingMode
): number | null {
  if (!pacing.paced) return null;
  if (typeof firstShownAtMs !== "number" || !Number.isFinite(firstShownAtMs)) {
    return null;
  }
  return firstShownAtMs + pacing.secondsPerQuestion * 1000;
}

export type AnswerVerdict =
  | { accepted: true }
  | { accepted: false; reason: "question_time_up" | "paper_time_up" };

/**
 * May this answer be saved?
 *
 * Two independent deadlines, and BOTH must still be open:
 *   - the paper's own expiry, which has always applied;
 *   - this question's expiry, when the paper is paced.
 *
 * The paper deadline is checked FIRST so a student whose whole paper has
 * ended is told that, rather than being told a single question timed out —
 * the second message would send them looking for the wrong problem.
 *
 * An unpaced paper reaches exactly the same verdict it always did, so
 * turning this on for one paper cannot change another.
 */
export function judgeAnswer(input: {
  nowMs: number;
  paperExpiresAtMs: number | null | undefined;
  questionFirstShownAtMs: number | null | undefined;
  pacing: PacingMode;
}): AnswerVerdict {
  const { nowMs, paperExpiresAtMs, questionFirstShownAtMs, pacing } = input;

  if (
    typeof paperExpiresAtMs === "number" &&
    Number.isFinite(paperExpiresAtMs) &&
    nowMs > paperExpiresAtMs + ANSWER_GRACE_MS
  ) {
    return { accepted: false, reason: "paper_time_up" };
  }

  const qDeadline = questionDeadlineMs(questionFirstShownAtMs, pacing);
  // No usable per-question deadline means this question is not paced. That
  // is NOT a reason to refuse: an unpaced paper, or a question the server
  // has no view record for yet, falls back to the paper deadline alone.
  if (qDeadline === null) return { accepted: true };

  if (nowMs > qDeadline + ANSWER_GRACE_MS) {
    return { accepted: false, reason: "question_time_up" };
  }

  return { accepted: true };
}

/** What the student is told. One wording, so every surface agrees. */
export const ANSWER_REFUSAL_TEXT: Record<
  Exclude<AnswerVerdict, { accepted: true }>["reason"],
  string
> = {
  question_time_up:
    "Time ran out on that question, so this answer was not saved. Keep going — the next one is waiting.",
  paper_time_up: "Your paper has finished, so this answer was not saved.",
};

/**
 * Seconds still on THIS question's clock, for the countdown.
 *
 * Never negative, and rounded UP so a student is never shown "0 seconds
 * left" while the answer they are about to give would still be accepted.
 */
export function questionSecondsRemaining(
  firstShownAtMs: number | null | undefined,
  pacing: PacingMode,
  nowMs: number
): number | null {
  const deadline = questionDeadlineMs(firstShownAtMs, pacing);
  if (deadline === null) return null;
  const left = deadline - nowMs;
  return left <= 0 ? 0 : Math.ceil(left / 1000);
}

/**
 * A paced paper's total length, for showing an honest figure before the
 * student starts.
 *
 * A paced paper is bounded by whichever runs out first: the sum of the
 * question timers, or the paper's own duration. Advertising the paper
 * duration when the question timers total less would be a lie — the source
 * paper this pattern came from claimed 30 minutes while its own per-question
 * timers summed to 19.
 */
export function pacedPaperSeconds(
  totalQuestions: number,
  pacing: PacingMode,
  paperDurationMinutes: number
): number {
  const paperSeconds = Math.max(0, Math.floor(paperDurationMinutes * 60));
  if (!pacing.paced) return paperSeconds;
  const summed = Math.max(0, Math.floor(totalQuestions)) * pacing.secondsPerQuestion;
  return Math.min(summed, paperSeconds);
}
