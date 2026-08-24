/**
 * YIQ post-paper review — pure functions, no I/O.
 *
 * WHY THIS FILE EXISTS SEPARATELY
 *   Students sit a timed, one-attempt competitive paper. The answer key is the
 *   whole competition: if a review screen can be opened on a second phone
 *   while anyone in the chapter is still sitting the paper, the chapter round
 *   is compromised. So the reveal rule is written once, here, as data-in /
 *   boolean-out — testable without a database and impossible to "nearly" get
 *   right in three different call sites.
 *
 * THE RULE (all four must hold before a key is revealed)
 *   1. The viewer OWNS the attempt. Identity comes from the signed
 *      `yiq_session` cookie via requireStudentSession() — never from a
 *      client-supplied id.
 *   2. The attempt is finished: `submitted` or `auto_submitted`. An
 *      `in_progress` paper reveals nothing (it is the live paper), and a
 *      `disqualified` one is not a study aid.
 *   3. For a REAL attempt, the chapter event has moved past the round —
 *      status `online_round_closed` or later, OR `results_published_at` set.
 *      While the round is `online_round_live` the student sees their own
 *      score summary but NOT the per-question keys.
 *   4. A MOCK/practice attempt may reveal immediately — instant feedback is
 *      the entire point of practice, and a mock paper is not the competition.
 *
 * Everything unknown FAILS CLOSED: a missing session, a missing attempt, a
 * missing event, an unrecognised status — all deny.
 */

import type { ChapterEventStatus } from "./constants";
import { OPTION_KEYS, type OptionKey } from "./paper";

/**
 * Chapter-event statuses at or after the online round is over.
 *
 * Deliberately an explicit allow-set, NOT an index into the ordered status
 * list: reordering that list elsewhere must never silently open the key. Any
 * status not named here — including one added later — denies.
 */
const ROUND_OVER_STATUSES: ReadonlySet<ChapterEventStatus> =
  new Set<ChapterEventStatus>([
    "online_round_closed",
    "finals_scheduled",
    "finals_live",
    "finals_complete",
  ]);

/** Attempt statuses that mean "the paper is done and graded". */
const FINISHED_ATTEMPT_STATUSES: ReadonlySet<string> = new Set([
  "submitted",
  "auto_submitted",
]);

export type ReviewAttemptFacts = {
  /** attempts.student_id — the row's owner, read from the database. */
  studentId: string;
  /** attempts.status */
  status: string;
  /** attempts.is_mock */
  isMock: boolean;
};

export type ReviewEventFacts = {
  /** chapter_events.status */
  status: string | null;
  /** chapter_events.results_published_at */
  resultsPublishedAt: string | null;
};

export type RevealInput = {
  /** The id from the SIGNED session cookie. Null when not signed in. */
  viewerStudentId: string | null | undefined;
  attempt: ReviewAttemptFacts | null | undefined;
  event: ReviewEventFacts | null | undefined;
};

/**
 * May the correct answers be shown to this viewer, for this attempt, right
 * now? The single authority for that question. Fails closed.
 */
export function canRevealAnswers(input: RevealInput): boolean {
  const { viewerStudentId, attempt, event } = input;

  // 1. Ownership — the session must own the attempt.
  if (!viewerStudentId || !attempt) return false;
  if (attempt.studentId !== viewerStudentId) return false;

  // 2. The paper must be finished.
  if (!FINISHED_ATTEMPT_STATUSES.has(attempt.status)) return false;

  // 4. Practice papers open immediately — that is what practice is for.
  if (attempt.isMock) return true;

  // 3. A real paper waits for the chapter to move past the round.
  if (!event) return false; // unknown event -> closed
  if (event.resultsPublishedAt) return true;
  if (!event.status) return false;
  return ROUND_OVER_STATUSES.has(event.status as ChapterEventStatus);
}

export type ReviewGate = {
  /** May this viewer open the review screen for this attempt at all? */
  canView: boolean;
  /** May the correct answers be revealed? Always false when canView is false. */
  canReveal: boolean;
  /**
   * Plain-English reason to show the student. Null when the keys are open.
   * Never leaks anything about the paper itself.
   */
  reason: string | null;
};

/**
 * The same rule as canRevealAnswers(), plus the sentence the student should
 * read when the keys are not open yet. The UI must never invent its own
 * version of this logic.
 */
export function reviewGate(input: RevealInput): ReviewGate {
  const { viewerStudentId, attempt } = input;

  if (!viewerStudentId || !attempt) {
    return {
      canView: false,
      canReveal: false,
      reason: "Please sign in with your YIQ access code.",
    };
  }

  if (attempt.studentId !== viewerStudentId) {
    return {
      canView: false,
      canReveal: false,
      reason: "That paper belongs to a different student.",
    };
  }

  if (attempt.status === "in_progress") {
    return {
      canView: false,
      canReveal: false,
      reason: "This paper is still open. Finish and submit it first.",
    };
  }

  if (!FINISHED_ATTEMPT_STATUSES.has(attempt.status)) {
    // disqualified, or anything unrecognised.
    return {
      canView: false,
      canReveal: false,
      reason: "This paper is not available for review.",
    };
  }

  if (canRevealAnswers(input)) {
    return { canView: true, canReveal: true, reason: null };
  }

  return {
    canView: true,
    canReveal: false,
    reason: "Answers open after your chapter closes the round.",
  };
}

// ---------------------------------------------------------------------------
// Display model
// ---------------------------------------------------------------------------

export type ReviewOption = { key: OptionKey; text: string };

/**
 * One question as read from the database.
 *
 * `correctOption` / `explanation` are OPTIONAL because the caller must not
 * select those columns at all when the reveal is not permitted — the key
 * should never be in the process, let alone in the payload. buildReview()
 * nulls them a second time as defence in depth.
 */
export type ReviewQuestionSource = {
  id: string;
  topic: string | null;
  questionText: string;
  mediaUrl: string | null;
  options: ReviewOption[];
  correctOption?: string | null;
  explanation?: string | null;
};

export type ReviewAnswerSource = {
  questionId: string;
  selectedOption: string | null;
  isCorrect?: boolean | null;
  marksAwarded?: number | null;
};

export type ReviewItem = {
  questionId: string;
  /** 1-based position in the order THIS student sat the paper. */
  number: number;
  topic: string | null;
  questionText: string;
  mediaUrl: string | null;
  options: ReviewOption[];
  yourAnswer: OptionKey | null;
  /** null whenever the reveal is not permitted. */
  correctAnswer: OptionKey | null;
  /**
   * null whenever the reveal is not permitted — "you got Q3 right" IS the
   * answer to Q3, because the student knows what they picked.
   */
  isCorrect: boolean | null;
  /** null whenever the reveal is not permitted — marks leak correctness too. */
  marksAwarded: number | null;
  /** null whenever the reveal is not permitted. */
  explanation: string | null;
};

/** "A" / " a " / "x" -> "a" / "a" / null. Anything unrecognised is null. */
export function normaliseOptionKey(
  value: string | null | undefined
): OptionKey | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return (OPTION_KEYS as string[]).includes(v) ? (v as OptionKey) : null;
}

/**
 * Zip the paper, the student's answers and (when permitted) the key into the
 * display model.
 *
 * `questionOrder` is `attempts.question_order` — the exact shuffled order this
 * student sat. The review MUST walk that order, not the paper's own order, or
 * "question 7" in the review is a different question from the one they
 * remember.
 *
 * When `reveal` is false, correctAnswer / isCorrect / marksAwarded /
 * explanation are ALL null. This is enforced here rather than only in the UI
 * so the key cannot reach the client even if a future caller forgets.
 */
export function buildReview(
  questionOrder: string[],
  questions: ReviewQuestionSource[],
  answers: ReviewAnswerSource[],
  reveal: boolean
): ReviewItem[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answerById = new Map(answers.map((a) => [a.questionId, a]));

  const items: ReviewItem[] = [];

  for (const questionId of questionOrder) {
    const q = byId.get(questionId);
    // A question retired or deleted since the paper was sat simply drops out
    // rather than rendering a blank card.
    if (!q) continue;

    const answer = answerById.get(questionId);
    const yourAnswer = normaliseOptionKey(answer?.selectedOption);

    if (!reveal) {
      items.push({
        questionId,
        number: items.length + 1,
        topic: q.topic,
        questionText: q.questionText,
        mediaUrl: q.mediaUrl,
        options: q.options,
        yourAnswer,
        correctAnswer: null,
        isCorrect: null,
        marksAwarded: null,
        explanation: null,
      });
      continue;
    }

    const correctAnswer = normaliseOptionKey(q.correctOption);

    // An unanswered question is never right or wrong. Otherwise derive from
    // the key — one source of truth — falling back to the stored grade only
    // when the question has no usable key at all.
    let isCorrect: boolean | null = null;
    if (yourAnswer !== null) {
      isCorrect =
        correctAnswer !== null
          ? yourAnswer === correctAnswer
          : (answer?.isCorrect ?? null);
    }

    items.push({
      questionId,
      number: items.length + 1,
      topic: q.topic,
      questionText: q.questionText,
      mediaUrl: q.mediaUrl,
      options: q.options,
      yourAnswer,
      correctAnswer,
      isCorrect,
      marksAwarded: answer?.marksAwarded ?? 0,
      explanation: q.explanation ?? null,
    });
  }

  return items;
}
