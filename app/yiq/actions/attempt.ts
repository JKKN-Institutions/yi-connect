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
  pacingFor,
  judgeAnswer,
  ANSWER_REFUSAL_TEXT,
  questionDeadlineMs,
} from "@/lib/yiq/pacing";
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
      /** null = one clock for the whole paper (the original behaviour). */
      secondsPerQuestion: number | null;
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
    .select("id, name, duration_minutes, shuffle_questions, shuffle_options, total_questions, seconds_per_question")
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
    seconds_per_question?: number | null;
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
    secondsPerQuestion: (() => {
      const p = pacingFor(paper.seconds_per_question);
      return p.paced ? p.secondsPerQuestion : null;
    })(),
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

  // PER-QUESTION DEADLINE (anti-AI pacing, Director 2026-08-27).
  //
  // Anchored to the SERVER's record of when this question was first shown —
  // yiq.attempt_question_views, whose primary key makes the first view final.
  // Anchoring to anything the client sends, or to the wall clock at render,
  // would let a student refresh the page for a fresh timer and the whole
  // measure would be theatre.
  //
  // An unpaced paper reaches exactly the verdict it always did.
  const { data: pacingRow } = await svc
    .from("attempts")
    .select("papers(seconds_per_question)")
    .eq("id", attemptId)
    .maybeSingle();
  const pacing = pacingFor(
    (pacingRow?.papers as { seconds_per_question: number | null } | null)
      ?.seconds_per_question
  );

  if (pacing.paced) {
    const { data: view } = await svc
      .from("attempt_question_views")
      .select("first_shown_at")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle();

    const verdict = judgeAnswer({
      nowMs: Date.now(),
      paperExpiresAtMs: Date.parse(attempt.expires_at),
      questionFirstShownAtMs: view?.first_shown_at
        ? Date.parse(view.first_shown_at)
        : null,
      pacing,
    });

    if (!verdict.accepted) {
      return {
        success: false,
        error: ANSWER_REFUSAL_TEXT[verdict.reason],
        // NOT `expired` — that flag makes the client submit the whole paper.
        // One question running out must not end the paper.
        expired: verdict.reason === "paper_time_up",
      };
    }
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
 * Record that a question has been put in front of this student, and say when
 * its own clock runs out.
 *
 * THIS IS THE ANTI-RELOAD LOCK. The insert is ON CONFLICT DO NOTHING against
 * a primary key of (attempt_id, question_id), so the FIRST view is final and
 * every later call — a refresh, a back-navigation, a second tab — reads back
 * the original timestamp instead of writing a new one. Without that a student
 * refreshes for a fresh timer and the pacing is theatre.
 *
 * Returns `deadlineAt: null` for an unpaced paper, which is every paper today
 * unless a human sets seconds_per_question. Callers must then fall back to the
 * whole-paper clock rather than inventing a deadline.
 *
 * NEVER THROWS AND NEVER BLOCKS THE PAPER. If the view cannot be written, the
 * student still gets their question — with no per-question deadline, because
 * `judgeAnswer` treats a missing view record as unpaced. A database blip must
 * not cost a child their round; the worst case is one question that is not
 * paced, which is the behaviour every paper has had until now.
 */
export async function beginQuestion(
  attemptId: string,
  questionId: string
): Promise<{ deadlineAt: string | null; secondsPerQuestion: number | null }> {
  const NONE = { deadlineAt: null, secondsPerQuestion: null };

  const gate = await requireStudentSession();
  if (!gate.ok) return NONE;

  try {
    const svc = await createServiceClient();

    const { data: attempt } = await svc
      .from("attempts")
      .select("id, student_id, status, papers(seconds_per_question)")
      .eq("id", attemptId)
      .maybeSingle();

    if (!attempt) return NONE;
    if (attempt.student_id !== gate.session.id) return NONE;
    if (attempt.status !== "in_progress") return NONE;

    const pacing = pacingFor(
      (attempt.papers as { seconds_per_question: number | null } | null)
        ?.seconds_per_question
    );
    if (!pacing.paced) return NONE;

    // First view wins. `ignoreDuplicates` is what makes a refresh harmless.
    await svc
      .from("attempt_question_views")
      .upsert(
        { attempt_id: attemptId, question_id: questionId },
        { onConflict: "attempt_id,question_id", ignoreDuplicates: true }
      );

    // Re-read rather than trusting the insert: on a repeat view the upsert
    // wrote nothing, and the ORIGINAL timestamp is the one that counts.
    const { data: view } = await svc
      .from("attempt_question_views")
      .select("first_shown_at")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle();

    const deadline = questionDeadlineMs(
      view?.first_shown_at ? Date.parse(view.first_shown_at) : null,
      pacing
    );

    return {
      deadlineAt: deadline === null ? null : new Date(deadline).toISOString(),
      secondsPerQuestion: pacing.secondsPerQuestion,
    };
  } catch (e) {
    console.error("[yiq] beginQuestion failed", e);
    return NONE;
  }
}

/**
 * The student left the page while the paper was open.
 *
 * EVIDENCE FOR A HUMAN, NEVER AN AUTOMATIC VERDICT. A phone call, a
 * notification, a dying battery and a nosy sibling all blur a page, and
 * disqualifying a child on that signal would be wrong. An organiser reads
 * these counters next to a score that looks surprising and decides.
 *
 * Honest about what this is worth: a student who disables scripting simply
 * reports nothing. It is a signal, not a gate, and it is only meaningful in
 * aggregate — twelve one-second glances is a different story from two
 * two-minute absences, which is why both the count and the total are kept.
 *
 * Silently ignores anything implausible rather than failing: this runs on a
 * background event and must never interrupt a paper.
 */
export async function reportFocusLoss(
  attemptId: string,
  awaySeconds: number
): Promise<void> {
  const gate = await requireStudentSession();
  if (!gate.ok) return;

  // A single absence longer than the longest paper is a clock change or a
  // suspended phone, not a real reading of time away.
  const away = Math.floor(awaySeconds);
  if (!Number.isFinite(away) || away < 0 || away > 4 * 60 * 60) return;

  try {
    const svc = await createServiceClient();

    const { data: attempt } = await svc
      .from("attempts")
      .select("id, student_id, status, focus_lost_count, focus_lost_seconds")
      .eq("id", attemptId)
      .maybeSingle();

    if (!attempt) return;
    if (attempt.student_id !== gate.session.id) return;
    if (attempt.status !== "in_progress") return;

    await svc
      .from("attempts")
      .update({
        focus_lost_count: (attempt.focus_lost_count ?? 0) + 1,
        focus_lost_seconds: (attempt.focus_lost_seconds ?? 0) + away,
      })
      .eq("id", attemptId)
      .eq("status", "in_progress");
  } catch (e) {
    console.error("[yiq] reportFocusLoss failed", e);
  }
}
