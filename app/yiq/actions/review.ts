"use server";

/**
 * The student's post-paper review.
 *
 * SECURITY MODEL — read lib/yiq/review.ts first.
 *  - Identity is the signed `yiq_session` cookie ONLY (requireStudentSession).
 *    A client-supplied studentId is never trusted; the attempt row's own
 *    student_id is compared against the session.
 *  - The answer key is stripped at the QUERY, not at the render. When the
 *    reveal is not permitted, `correct_option` and `answer_explanation` are
 *    never selected, and `is_correct` / `marks_awarded` are never selected
 *    either — a per-question "you got this right" is itself an answer to a
 *    student who knows what they picked.
 *  - Everything unknown denies: no session, no attempt, foreign attempt,
 *    unfinished attempt, missing chapter event, unrecognised status.
 */

import { requireStudentSession } from "@/lib/yiq/auth/yiq-session";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import {
  buildReview,
  reviewGate,
  type ReviewItem,
  type ReviewOption,
  type ReviewQuestionSource,
} from "@/lib/yiq/review";
import type { OptionKey } from "@/lib/yiq/paper";
import { applyOptionOrder } from "@/lib/yiq/option-order";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AttemptSummary = {
  attemptId: string;
  paperName: string;
  isMock: boolean;
  status: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  /** The attempt is finished, so a review screen can be opened. */
  canReview: boolean;
  /** The answer key may be shown. */
  canReveal: boolean;
  /** Why the key is closed, in a sentence a 15-year-old can read. */
  reason: string | null;
};

export type ListMyAttemptsResult =
  | {
      success: true;
      attempts: AttemptSummary[];
      chapterName: string | null;
      eventStatus: string | null;
    }
  | { success: false; error: string };

/** Every paper this student has sat — practice runs and the real round. */
export async function listMyAttempts(): Promise<ListMyAttemptsResult> {
  const gate = await requireStudentSession();
  if (!gate.ok) return { success: false, error: gate.error };
  const { session } = gate;

  const svc = await createServiceClient();

  const [{ data: event }, { data: rows }] = await Promise.all([
    svc
      .from("chapter_events")
      .select("id, chapter_name, status, results_published_at")
      .eq("id", session.chapterEventId)
      .maybeSingle(),
    svc
      .from("attempts")
      .select(
        "id, student_id, is_mock, status, score, correct_count, wrong_count, unanswered_count, time_taken_seconds, submitted_at, papers(name)"
      )
      .eq("student_id", session.id)
      .order("created_at", { ascending: false }),
  ]);

  const eventFacts = event
    ? { status: event.status, resultsPublishedAt: event.results_published_at }
    : null;

  const attempts: AttemptSummary[] = (rows ?? []).map((a) => {
    const g = reviewGate({
      viewerStudentId: session.id,
      attempt: {
        studentId: a.student_id,
        status: a.status,
        isMock: a.is_mock,
      },
      event: eventFacts,
    });
    const correct = a.correct_count ?? 0;
    const wrong = a.wrong_count ?? 0;
    const unanswered = a.unanswered_count ?? 0;
    return {
      attemptId: a.id,
      paperName: (a.papers as { name: string } | null)?.name ?? "Paper",
      isMock: a.is_mock,
      status: a.status,
      score: Number(a.score ?? 0),
      correctCount: correct,
      wrongCount: wrong,
      unansweredCount: unanswered,
      // gradeAttempt() grades every question on the paper, so the three
      // counts always add back up to the paper length.
      totalQuestions: correct + wrong + unanswered,
      timeTakenSeconds: a.time_taken_seconds,
      submittedAt: a.submitted_at,
      canReview: g.canView,
      canReveal: g.canReveal,
      reason: g.reason,
    };
  });

  return {
    success: true,
    attempts,
    chapterName: event?.chapter_name ?? null,
    eventStatus: event?.status ?? null,
  };
}

export type Review = {
  attemptId: string;
  paperName: string;
  isMock: boolean;
  status: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  canReveal: boolean;
  /** Null when the key is open. */
  reason: string | null;
  items: ReviewItem[];
};

export type GetReviewResult =
  | { success: true; review: Review }
  | { success: false; error: string };

/**
 * One paper, question by question, in the order this student sat it.
 *
 * The `attemptId` is a hint only — it is validated against the session's own
 * attempts before a single question row is read.
 */
export async function getReview(attemptId: string): Promise<GetReviewResult> {
  const gate = await requireStudentSession();
  if (!gate.ok) return { success: false, error: gate.error };
  const { session } = gate;

  if (typeof attemptId !== "string" || !UUID_RE.test(attemptId)) {
    return { success: false, error: "Paper not found." };
  }

  const svc = await createServiceClient();

  const { data: attempt } = await svc
    .from("attempts")
    .select(
      "id, student_id, chapter_event_id, is_mock, status, score, correct_count, wrong_count, unanswered_count, time_taken_seconds, submitted_at, question_order, papers(name, shuffle_options)"
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return { success: false, error: "Paper not found." };

  const { data: event } = attempt.chapter_event_id
    ? await svc
        .from("chapter_events")
        .select("id, status, results_published_at")
        .eq("id", attempt.chapter_event_id)
        .maybeSingle()
    : { data: null };

  const g = reviewGate({
    viewerStudentId: session.id,
    attempt: {
      studentId: attempt.student_id,
      status: attempt.status,
      isMock: attempt.is_mock,
    },
    event: event
      ? { status: event.status, resultsPublishedAt: event.results_published_at }
      : null,
  });

  if (!g.canView) {
    return { success: false, error: g.reason ?? "Paper not available." };
  }

  const reveal = g.canReveal;
  const order: string[] = attempt.question_order ?? [];

  // The paper's own setting, so the review reproduces the option order this
  // student actually sat. Defaults to false if the paper row is missing —
  // showing the authored order is a nuisance, guessing is worse.
  const shuffleOptions = Boolean(
    (attempt.papers as { shuffle_options?: boolean } | null)?.shuffle_options
  );

  // A paper with no stored order has nothing to walk. Return the summary.
  const ids = order.length > 0 ? order : [];

  // -------------------------------------------------------------------
  // THE KEY LEAVES THE DATABASE ONLY WHEN THE REVEAL IS PERMITTED.
  // Two literal column lists rather than one built by string concatenation:
  // the non-revealing branch cannot name `correct_option` or
  // `answer_explanation` even by accident, and the Supabase types prove it.
  // -------------------------------------------------------------------
  let questions: ReviewQuestionSource[] = [];
  if (ids.length > 0) {
    if (reveal) {
      const { data } = await svc
        .from("questions")
        .select(
          "id, question_text, media_url, option_a, option_b, option_c, option_d, correct_option, answer_explanation, topics(name)"
        )
        .in("id", ids);
      questions = (data ?? []).map((r) => ({
        id: r.id,
        topic: (r.topics as { name: string } | null)?.name ?? null,
        questionText: r.question_text,
        mediaUrl: r.media_url,
        options: toOptions(r, attemptId, shuffleOptions),
        correctOption: r.correct_option,
        explanation: r.answer_explanation,
      }));
    } else {
      const { data } = await svc
        .from("questions")
        .select(
          "id, question_text, media_url, option_a, option_b, option_c, option_d, topics(name)"
        )
        .in("id", ids);
      questions = (data ?? []).map((r) => ({
        id: r.id,
        topic: (r.topics as { name: string } | null)?.name ?? null,
        questionText: r.question_text,
        mediaUrl: r.media_url,
        options: toOptions(r, attemptId, shuffleOptions),
      }));
    }
  }

  // Same treatment for the graded answers: `is_correct` and `marks_awarded`
  // are per-question verdicts, so they are keys in all but name.
  let answers: {
    questionId: string;
    selectedOption: string | null;
    isCorrect?: boolean | null;
    marksAwarded?: number | null;
  }[] = [];
  if (reveal) {
    const { data } = await svc
      .from("attempt_answers")
      .select("question_id, selected_option, is_correct, marks_awarded")
      .eq("attempt_id", attemptId);
    answers = (data ?? []).map((a) => ({
      questionId: a.question_id,
      selectedOption: a.selected_option,
      isCorrect: a.is_correct,
      marksAwarded: a.marks_awarded,
    }));
  } else {
    const { data } = await svc
      .from("attempt_answers")
      .select("question_id, selected_option")
      .eq("attempt_id", attemptId);
    answers = (data ?? []).map((a) => ({
      questionId: a.question_id,
      selectedOption: a.selected_option,
    }));
  }

  const items = buildReview(order, questions, answers, reveal);

  const correct = attempt.correct_count ?? 0;
  const wrong = attempt.wrong_count ?? 0;
  const unanswered = attempt.unanswered_count ?? 0;

  return {
    success: true,
    review: {
      attemptId: attempt.id,
      paperName: (attempt.papers as { name: string } | null)?.name ?? "Paper",
      isMock: attempt.is_mock,
      status: attempt.status,
      score: Number(attempt.score ?? 0),
      correctCount: correct,
      wrongCount: wrong,
      unansweredCount: unanswered,
      totalQuestions: order.length || correct + wrong + unanswered,
      timeTakenSeconds: attempt.time_taken_seconds,
      submittedAt: attempt.submitted_at,
      canReveal: reveal,
      reason: g.reason,
      items,
    },
  };
}

/**
 * The four options, IN THE ORDER THIS STUDENT SAW THEM.
 *
 * The paper is rendered with a per-student option order
 * (lib/yiq/option-order.ts). The review screen MUST reproduce it: a student
 * comparing their answer against the correct one, with the options in a
 * different order from the one they sat, cannot tell whether they were right.
 * The order is derived, not stored, so passing the same two ids is enough.
 */
function toOptions(row: {
  id: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
}, attemptId: string, shuffle: boolean): ReviewOption[] {
  return applyOptionOrder([
    { key: "a" as OptionKey, text: row.option_a ?? "" },
    { key: "b" as OptionKey, text: row.option_b ?? "" },
    { key: "c" as OptionKey, text: row.option_c ?? "" },
    { key: "d" as OptionKey, text: row.option_d ?? "" },
  ], attemptId, row.id, shuffle);
}
