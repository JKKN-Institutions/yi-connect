"use server";

/**
 * The online-round test engine.
 *
 * SECURITY / INTEGRITY MODEL
 *  - The signed `yiq_session` cookie is the ONLY identity. Every call verifies
 *    that the session owns the attempt; a client-supplied studentId is never
 *    trusted.
 *  - `attempts.expires_at` is written once at start and is the authoritative
 *    deadline. Every write re-checks it server-side, so a tampered client
 *    clock, a reload, or a paused phone cannot buy extra time.
 *  - Correct answers are NEVER sent to the client while a paper is live. The
 *    presented question payload has no key on it.
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { applyOptionOrder } from "@/lib/yiq/option-order";
import {
  canRevealNow,
  type CardFeedback,
} from "@/lib/yiq/practice-feedback";
import {
  checkStudentSessionLive,
  STALE_SESSION_MESSAGE,
} from "@/lib/yiq/auth/stale-session";
import { requireStudentSession } from "@/lib/yiq/auth/yiq-session";
import {
  LATE_WRITE_GRACE_MS,
  OPTION_KEYS,
  shuffle,
  type OptionKey,
  type PresentedQuestion,
} from "@/lib/yiq/paper";
import { gradeAttempt, type AnswerKey } from "@/lib/yiq/scoring";
import { consumeGrantedRestart } from "@/app/yiq/actions/restart";

export type StartResult =
  | {
      success: true;
      attemptId: string;
      expiresAt: string;
      durationMinutes: number;
      questions: PresentedQuestion[];
      answers: Record<string, OptionKey>;
      paperName: string;
    }
  | { success: false; error: string; alreadyDone?: boolean };

/**
 * Start (or resume) an attempt. Idempotent: calling it twice returns the same
 * live attempt rather than creating a second one, and a real online-round
 * attempt is capped to one per student by a unique index.
 */
export async function startAttempt(
  kind: "mock" | "online_round"
): Promise<StartResult> {
  const gate = await requireStudentSession();
  if (!gate.ok) return { success: false, error: gate.error };
  const { session } = gate;

  const svc = await createServiceClient();

  // A signed cookie is not proof the student still exists. Check BEFORE the
  // round-status checks below, or a student whose team was deleted is told
  // "the round is not open" — which is both wrong and unactionable.
  const liveness = await checkStudentSessionLive(svc as never, {
    id: session.id,
    teamId: session.teamId,
  });
  if (!liveness.live) {
    return { success: false, error: STALE_SESSION_MESSAGE };
  }

  // ---- Locate the published paper for this category ---------------------
  const { data: event } = await svc
    .from("chapter_events")
    .select("id, edition_id, status, online_round_opens_at, online_round_closes_at")
    .eq("id", session.chapterEventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Chapter event not found." };

  if (kind === "online_round") {
    if (event.status !== "online_round_live") {
      return {
        success: false,
        error:
          "The online round is not open right now. Your chapter organiser opens it at the scheduled time.",
      };
    }
    const now = Date.now();
    if (event.online_round_opens_at && now < Date.parse(event.online_round_opens_at)) {
      return { success: false, error: "The online round has not started yet." };
    }
    if (event.online_round_closes_at && now > Date.parse(event.online_round_closes_at)) {
      return { success: false, error: "The online round has closed." };
    }
  }

  const { data: paper } = await svc
    .from("papers")
    .select("id, name, duration_minutes, shuffle_questions, shuffle_options, total_questions")
    .eq("edition_id", event.edition_id)
    .eq("paper_kind", kind)
    .eq("category", session.category)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!paper) {
    return {
      success: false,
      error:
        kind === "mock"
          ? "No practice paper is available yet. Check back soon."
          : "The paper for your category has not been published yet.",
    };
  }

  // ---- Existing attempt? -------------------------------------------------
  const existingQuery = svc
    .from("attempts")
    .select("id, status, expires_at, question_order")
    .eq("paper_id", paper.id)
    .eq("student_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: existing } = await existingQuery.maybeSingle();

  let attemptId: string;
  let expiresAt: string;
  let order: string[];

  if (existing && existing.status === "in_progress") {
    // Expired but never submitted — close it out now, do not resume.
    if (Date.parse(existing.expires_at) <= Date.now()) {
      await finaliseAttempt(existing.id, "auto_submitted");
      if (kind === "online_round") {
        return {
          success: false,
          error: "Your time ran out and the paper was submitted automatically.",
          alreadyDone: true,
        };
      }
    } else {
      attemptId = existing.id;
      expiresAt = existing.expires_at;
      order = existing.question_order ?? [];
      return buildResume(attemptId, expiresAt, order, paper, session.category);
    }
  }

  if (existing && existing.status !== "in_progress" && kind === "online_round") {
    // A chapter organiser may have granted this student their ONE restart
    // (app/yiq/actions/restart.ts). It is spent HERE, on the student's own
    // next start, so the clock begins when they actually get back in rather
    // than when the organiser clicked. Same paper, same order, same answers.
    const restart = await consumeGrantedRestart(existing.id);
    if (restart.resumed) {
      return buildResume(
        existing.id,
        restart.expiresAt,
        existing.question_order ?? [],
        paper,
        session.category
      );
    }
    return {
      success: false,
      error: "You have already taken the online round. Only one attempt is allowed.",
      alreadyDone: true,
    };
  }

  // ---- Create a fresh attempt -------------------------------------------
  const { data: pqs } = await svc
    .from("paper_questions")
    .select("question_id, display_order")
    .eq("paper_id", paper.id)
    .order("display_order");

  const ids = (pqs ?? []).map((p) => p.question_id);
  if (ids.length === 0) {
    return { success: false, error: "That paper has no questions yet." };
  }

  order = paper.shuffle_questions ? shuffle(ids) : ids;
  expiresAt = new Date(
    Date.now() + paper.duration_minutes * 60 * 1000
  ).toISOString();

  const { data: created, error: createErr } = await svc
    .from("attempts")
    .insert({
      paper_id: paper.id,
      student_id: session.id,
      team_id: session.teamId,
      chapter_event_id: session.chapterEventId,
      is_mock: kind === "mock",
      status: "in_progress",
      expires_at: expiresAt,
      question_order: order,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    console.error("[yiq] attempt create failed", createErr);
    return { success: false, error: "Could not start the paper. Please retry." };
  }
  attemptId = created.id;

  return buildResume(attemptId, expiresAt, order, paper, session.category);
}

async function buildResume(
  attemptId: string,
  expiresAt: string,
  order: string[],
  paper: {
    id: string;
    name: string;
    duration_minutes: number;
    shuffle_options: boolean;
  },
  _category: string
): Promise<StartResult> {
  const svc = await createServiceClient();

  const { data: rows } = await svc
    .from("questions")
    .select("id, question_text, media_url, option_a, option_b, option_c, option_d, topics(name)")
    .in("id", order);

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  const questions: PresentedQuestion[] = order
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => {
      const opts = [
        { key: "a" as OptionKey, text: r.option_a ?? "" },
        { key: "b" as OptionKey, text: r.option_b ?? "" },
        { key: "c" as OptionKey, text: r.option_c ?? "" },
        { key: "d" as OptionKey, text: r.option_d ?? "" },
      ];
      // Per-student option order (lib/yiq/option-order.ts). Each option keeps
      // its CANONICAL key, which is what the client submits and what
      // attempt_answers.selected_option stores — so a permutation cannot make
      // a saved answer point at different text, and scoring is untouched.
      // The order is DERIVED from (attemptId, questionId), so it is identical
      // on every reload and on a resumed attempt after a restart.
      return {
        id: r.id,
        topic: (r.topics as { name: string } | null)?.name ?? "",
        text: r.question_text,
        mediaUrl: r.media_url,
        options: applyOptionOrder(opts, attemptId, r.id, paper.shuffle_options),
      };
    });

  const { data: saved } = await svc
    .from("attempt_answers")
    .select("question_id, selected_option")
    .eq("attempt_id", attemptId);

  const answers: Record<string, OptionKey> = {};
  for (const a of saved ?? []) {
    if (a.selected_option) {
      answers[a.question_id] = a.selected_option as OptionKey;
    }
  }

  return {
    success: true,
    attemptId,
    expiresAt,
    durationMinutes: paper.duration_minutes,
    questions,
    answers,
    paperName: paper.name,
  };
}

/** Save one answer. Rejected once the server-side deadline has passed. */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  option: OptionKey | null
): Promise<{ success: boolean; error?: string; expired?: boolean }> {
  const gate = await requireStudentSession();
  if (!gate.ok) return { success: false, error: gate.error };

  if (option !== null && !OPTION_KEYS.includes(option)) {
    return { success: false, error: "Invalid option." };
  }

  const svc = await createServiceClient();
  const { data: attempt } = await svc
    .from("attempts")
    .select("id, student_id, status, expires_at")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return { success: false, error: "Attempt not found." };
  if (attempt.student_id !== gate.session.id) {
    return { success: false, error: "That paper belongs to a different student." };
  }
  if (attempt.status !== "in_progress") {
    return { success: false, error: "This paper is already submitted.", expired: true };
  }
  if (Date.parse(attempt.expires_at) + LATE_WRITE_GRACE_MS <= Date.now()) {
    return { success: false, error: "Time is up.", expired: true };
  }

  const { error } = await svc.from("attempt_answers").upsert(
    {
      attempt_id: attemptId,
      question_id: questionId,
      selected_option: option,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" }
  );

  if (error) {
    console.error("[yiq] saveAnswer failed", error);
    return { success: false, error: "Could not save that answer." };
  }
  return { success: true };
}

export type SubmitResult =
  | {
      success: true;
      score: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
      totalQuestions: number;
      isMock: boolean;
    }
  | { success: false; error: string };

/** Submit and grade. Safe to call twice — a submitted attempt returns its result. */
export async function submitAttempt(attemptId: string): Promise<SubmitResult> {
  const gate = await requireStudentSession();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const { data: attempt } = await svc
    .from("attempts")
    .select("id, student_id, status, expires_at, is_mock")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return { success: false, error: "Attempt not found." };
  if (attempt.student_id !== gate.session.id) {
    return { success: false, error: "That paper belongs to a different student." };
  }

  const graded = await finaliseAttempt(
    attemptId,
    Date.parse(attempt.expires_at) <= Date.now() ? "auto_submitted" : "submitted"
  );
  if (!graded) return { success: false, error: "Could not submit the paper." };

  revalidatePath("/yiq/me");
  return { ...graded, isMock: attempt.is_mock };
}

/**
 * Grade + close an attempt. Idempotent: an already-closed attempt returns its
 * stored figures rather than re-grading, so a double submit (or a submit
 * racing the auto-submit) can never change a recorded score.
 */
export async function finaliseAttempt(
  attemptId: string,
  status: "submitted" | "auto_submitted"
): Promise<{
  success: true;
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
} | null> {
  const svc = await createServiceClient();

  const { data: attempt } = await svc
    .from("attempts")
    .select(
      "id, paper_id, status, started_at, question_order, score, correct_count, wrong_count, unanswered_count"
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return null;

  const order: string[] = attempt.question_order ?? [];

  if (attempt.status !== "in_progress") {
    return {
      success: true,
      score: Number(attempt.score ?? 0),
      correctCount: attempt.correct_count ?? 0,
      wrongCount: attempt.wrong_count ?? 0,
      unansweredCount: attempt.unanswered_count ?? 0,
      totalQuestions: order.length,
    };
  }

  const { data: paper } = await svc
    .from("papers")
    .select("marks_per_question, negative_marks")
    .eq("id", attempt.paper_id)
    .maybeSingle();

  const { data: keyRows } = await svc
    .from("questions")
    .select("id, correct_option")
    .in("id", order.length > 0 ? order : ["00000000-0000-0000-0000-000000000000"]);

  const keyById = new Map((keyRows ?? []).map((k) => [k.id, k.correct_option]));
  const key: AnswerKey[] = order.map((id) => ({
    questionId: id,
    correctOption: keyById.get(id) ?? null,
  }));

  const { data: answers } = await svc
    .from("attempt_answers")
    .select("question_id, selected_option")
    .eq("attempt_id", attemptId);

  const graded = gradeAttempt(
    key,
    (answers ?? []).map((a) => ({
      questionId: a.question_id,
      selectedOption: a.selected_option,
    })),
    {
      marksPerQuestion: Number(paper?.marks_per_question ?? 1),
      negativeMarks: Number(paper?.negative_marks ?? 0),
    }
  );

  const submittedAt = new Date();
  const timeTaken = Math.max(
    0,
    Math.round((submittedAt.getTime() - Date.parse(attempt.started_at)) / 1000)
  );

  // Write the per-question marks back so a review screen can show them.
  for (const a of graded.answers) {
    if (a.selectedOption === null) continue;
    await svc
      .from("attempt_answers")
      .update({ is_correct: a.isCorrect, marks_awarded: a.marksAwarded })
      .eq("attempt_id", attemptId)
      .eq("question_id", a.questionId);
  }

  // Guarded by status so a concurrent submit cannot double-write.
  const { data: closed } = await svc
    .from("attempts")
    .update({
      status,
      submitted_at: submittedAt.toISOString(),
      score: graded.score,
      correct_count: graded.correctCount,
      wrong_count: graded.wrongCount,
      unanswered_count: graded.unansweredCount,
      time_taken_seconds: timeTaken,
    })
    .eq("id", attemptId)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();

  if (!closed) {
    const { data: fresh } = await svc
      .from("attempts")
      .select("score, correct_count, wrong_count, unanswered_count")
      .eq("id", attemptId)
      .maybeSingle();
    return {
      success: true,
      score: Number(fresh?.score ?? 0),
      correctCount: fresh?.correct_count ?? 0,
      wrongCount: fresh?.wrong_count ?? 0,
      unansweredCount: fresh?.unanswered_count ?? 0,
      totalQuestions: order.length,
    };
  }

  return {
    success: true,
    score: graded.score,
    correctCount: graded.correctCount,
    wrongCount: graded.wrongCount,
    unansweredCount: graded.unansweredCount,
    totalQuestions: order.length,
  };
}

/**
 * Save a PRACTICE answer and say immediately whether it was right.
 *
 * THE ONE PLACE A CORRECT ANSWER LEAVES THE DATABASE MID-PAPER. On a
 * practice deck that is the entire point — you tap, the card turns, you find
 * out and read why. On the scored round the same behaviour would hand every
 * student the answer key one tap at a time.
 *
 * So this refuses on ANYTHING it does not positively recognise
 * (lib/yiq/practice-feedback.ts: `is_mock` must be exactly true, the attempt
 * must be in progress, and it must belong to the student asking, checked
 * against the server session). A refusal returns `feedback: null` rather
 * than an error — the answer is still SAVED, the card simply does not turn.
 *
 * WHY THE KEY IS NOT SENT WITH THE PAPER INSTEAD. Shipping the answers to
 * the client for practice papers would put the key in the page source, and
 * one bad conditional later that same payload is on a scored paper. A round
 * trip per answer costs a few hundred milliseconds on a practice paper and
 * keeps the key server-side, permanently.
 */
export async function answerPracticeCard(
  attemptId: string,
  questionId: string,
  option: OptionKey
): Promise<{
  success: boolean;
  error?: string;
  feedback: CardFeedback | null;
}> {
  const gate = await requireStudentSession();
  if (!gate.ok) return { success: false, error: gate.error, feedback: null };

  if (!OPTION_KEYS.includes(option)) {
    return { success: false, error: "Invalid option.", feedback: null };
  }

  // Save through the ordinary path, so every deadline, guard and audit that
  // applies to an answer applies to this one too. No shortcuts.
  const saved = await saveAnswer(attemptId, questionId, option);
  if (!saved.success) {
    return { success: false, error: saved.error, feedback: null };
  }

  const svc = await createServiceClient();

  const { data: attempt } = await svc
    .from("attempts")
    .select("id, student_id, is_mock, status")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return { success: true, feedback: null };

  const verdict = canRevealNow(
    {
      id: attempt.id,
      studentId: attempt.student_id,
      isMock: attempt.is_mock,
      status: attempt.status,
    },
    gate.session.id
  );

  if (!verdict.ok) {
    // The answer IS saved. Only the reveal is refused, and silently — a
    // student on a scored paper should see nothing unusual at all.
    return { success: true, feedback: null };
  }

  const { data: q } = await svc
    .from("questions")
    .select("id, correct_option, answer_explanation")
    .eq("id", questionId)
    .maybeSingle();

  if (!q?.correct_option) return { success: true, feedback: null };

  const key = q.correct_option.trim().toLowerCase();
  return {
    success: true,
    feedback: {
      correct: key === option,
      correctOption: key,
      explanation: q.answer_explanation,
    },
  };
}
