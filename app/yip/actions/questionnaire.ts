"use server";

/**
 * YIP Selection Questionnaire — server actions.
 *
 * ─── TWO GATES, NEVER MIXED ───────────────────────────────────────────────
 * STUDENT actions resolve identity from the `yip_session` cookie ONLY, via
 * requireMe(). The client never sends a participant id, and no action in this
 * file returns another student's answers, name or score. Students are MINORS.
 *
 * ORGANISER actions gate on getYipEventAccess(eventId): `.canView` to read,
 * `.canManage` to switch a window, edit questions, export or re-score.
 *
 * ─── THE STUDENT NEVER SEES A SCORE ───────────────────────────────────────
 * Not their own, not anyone's. getMyQuestionnaire deliberately returns no
 * scoring fields at all — not "hidden in the UI", absent from the payload.
 *
 * ─── THE CLOCK IS SERVER-SIDE ─────────────────────────────────────────────
 * `expires_at` is written once at start. The countdown on the phone is display
 * only; every answer write re-checks the column. A student cannot buy time by
 * changing their device clock.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { enqueueAiDraft, getAiDraft } from "@/lib/yip/ai/drafts";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
import {
  ATTEMPT_MINUTES,
  MARKING_STALL_MINUTES,
  MAX_PER_ANSWER,
  QUESTIONNAIRE_POSTS,
  attemptExpired,
  buildQuestionnaireCsv,
  buildQuestionnaireResponsesCsv,
  drawQuestions,
  expiryFor,
  isQuestionnairePostKey,
  normalizeAnswerText,
  questionnairePostLabel,
  questionsPerAttempt,
  type QuestionnaireActionResult as R,
  type QuestionnaireMarkingProgress,
  type QuestionnairePostKey,
  type QuestionnaireMissingRow,
  type QuestionnaireResponseRow,
  type QuestionnaireResultRow,
  type ScoringStatus,
  type WindowStatus,
} from "@/lib/yip/questionnaire";

// ─── Loose table access ──────────────────────────────────────────
//
// The four questionnaire tables are not in types/yip/database.ts. That file is
// never regenerated here because `supabase gen types` appends a version banner
// that corrupts it, so every new table in this codebase is reached through a
// narrow local cast (same idiom as selfNominations() and votesTable()).
// One generic shape rather than four hand-written interfaces.

type PgErr = { message: string } | null;
type SB = Awaited<ReturnType<typeof createServiceClient>>;

type Q<T> = {
  select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => Q<T>;
  insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => Q<T>;
  update: (patch: Record<string, unknown>) => Q<T>;
  upsert: (
    rows: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) => Q<T>;
  delete: () => Q<T>;
  eq: (col: string, val: unknown) => Q<T>;
  is: (col: string, val: unknown) => Q<T>;
  in: (col: string, vals: readonly unknown[]) => Q<T>;
  not: (col: string, op: string, val: unknown) => Q<T>;
  order: (col: string, opts?: { ascending?: boolean }) => Q<T>;
  limit: (n: number) => Q<T>;
  range: (from: number, to: number) => Q<T>;
  maybeSingle: () => Promise<{ data: T | null; error: PgErr }>;
  single: () => Promise<{ data: T | null; error: PgErr }>;
  then: Promise<{ data: T[] | null; error: PgErr; count?: number | null }>["then"];
};

function tbl<T>(sb: SB, name: string): Q<T> {
  return (sb as unknown as { from: (t: string) => Q<T> }).from(name);
}

type QuestionDb = {
  id: string;
  event_id: string | null;
  post_key: string;
  body: string;
  display_order: number;
  is_active: boolean;
};
type WindowDb = {
  id: string;
  event_id: string;
  post_key: string;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
};
type AttemptDb = {
  id: string;
  event_id: string;
  participant_id: string;
  post_key: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  scoring_status: string;
  total_score: number | null;
  max_score: number | null;
  pct: number | null;
  score_error: string | null;
  /** ORGANISER-ONLY AI read of this paper. Never sent to a student surface. */
  analysis_note: string | null;
};
type AnswerDb = {
  id: string;
  attempt_id: string;
  question_id: string | null;
  question_text: string;
  position: number;
  answer_text: string | null;
  answered_at: string | null;
  grounding: number | null;
  depth: number | null;
  voice: number | null;
  red_flag_penalty: number | null;
  score: number | null;
  flags: unknown;
  scored_at: string | null;
};

const questionsT = (sb: SB) => tbl<QuestionDb>(sb, "questionnaire_questions");
const windowsT = (sb: SB) => tbl<WindowDb>(sb, "questionnaire_windows");
const attemptsT = (sb: SB) => tbl<AttemptDb>(sb, "questionnaire_attempts");
const answersT = (sb: SB) => tbl<AnswerDb>(sb, "questionnaire_answers");
const selfNomsT = (sb: SB) =>
  tbl<{ participant_id: string; roles: string[] }>(sb, "self_nominations");
const participantsT = (sb: SB) =>
  tbl<{ id: string; full_name: string; constituency_number: number | null }>(
    sb,
    "participants"
  );

/** PostgREST caps an unbounded select at 1000 rows; a busy event exceeds that. */
const PAGE = 1000;

async function readAllPaged<T>(build: () => Q<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

// ─── Shared helpers ──────────────────────────────────────────────

/**
 * The student gate. Identity comes from the signed httpOnly cookie and nowhere
 * else — eventId is a scope hint that must match, never an authorization input.
 */
async function requireMe(
  eventId: string
): Promise<{ ok: true; participantId: string } | { ok: false; error: string }> {
  const sess = await getYipSession();
  if (!sess || sess.type !== "participant") {
    return { ok: false, error: "Sign in with your access code first." };
  }
  if (sess.eventId !== eventId) {
    return { ok: false, error: "Your session is for a different event." };
  }
  return { ok: true, participantId: sess.id };
}

/** Idempotent: three window rows per event, so no caller needs a "no row" branch. */
async function ensureWindows(sb: SB, eventId: string): Promise<void> {
  await windowsT(sb).upsert(
    QUESTIONNAIRE_POSTS.map((p) => ({
      event_id: eventId,
      post_key: p.key,
      status: "pending",
    })),
    { onConflict: "event_id,post_key", ignoreDuplicates: true }
  );
}

async function readWindows(sb: SB, eventId: string): Promise<WindowDb[]> {
  const { data } = await windowsT(sb)
    .select("id, event_id, post_key, status, opened_at, closed_at")
    .eq("event_id", eventId)
    .limit(50);
  return data ?? [];
}

/** Fails CLOSED: any error, or a missing row, reads as not open. */
function windowOpen(windows: readonly WindowDb[], postKey: string): boolean {
  return windows.find((w) => w.post_key === postKey)?.status === "open";
}

/**
 * The UNIFORM deadline for a post (Director, 2026-08-15).
 *
 * Every candidate's 30 minutes runs from the moment the organiser OPENED the
 * window, not from the moment each student tapped Start — so the whole cohort
 * writes to one clock and the room can be called to pens-down together. A
 * student who starts late gets the remainder, not a fresh 30 minutes; that is
 * the accepted consequence of a uniform start.
 *
 * Re-opening a window rewrites `opened_at`, which restarts the 30 minutes for
 * everyone who has not yet started. That is deliberate: re-opening is how an
 * organiser runs the post again after a false start.
 *
 * Falls back to the student's own clock if `opened_at` is somehow missing on an
 * open window. Failing that way hands out at most a full 30 minutes rather than
 * refusing a legitimate candidate over a data gap.
 */
function uniformExpiry(
  windows: readonly WindowDb[],
  postKey: string,
  startedAt: Date
): string {
  const openedAt = windows.find((w) => w.post_key === postKey)?.opened_at;
  if (!openedAt) return expiryFor(startedAt, postKey);
  const parsed = new Date(openedAt);
  if (Number.isNaN(parsed.getTime())) return expiryFor(startedAt, postKey);
  return expiryFor(parsed, postKey);
}

/**
 * The effective question set for a post at an event.
 *
 * If the event has ANY active rows for that post they REPLACE the national set
 * — they do not merge. That keeps "how many questions will I be asked" a
 * question you can answer by reading one scope, and it means a chapter that
 * writes 6 of its own does not accidentally hand its students 26.
 */
async function effectiveQuestions(
  sb: SB,
  eventId: string,
  postKey: QuestionnairePostKey
): Promise<{ questions: QuestionDb[]; source: "chapter" | "national" }> {
  const { data: own } = await questionsT(sb)
    .select("id, event_id, post_key, body, display_order, is_active")
    .eq("event_id", eventId)
    .eq("post_key", postKey)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(200);
  if (own && own.length > 0) return { questions: own, source: "chapter" };

  const { data: national } = await questionsT(sb)
    .select("id, event_id, post_key, body, display_order, is_active")
    .is("event_id", null)
    .eq("post_key", postKey)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(200);
  return { questions: national ?? [], source: "national" };
}

/**
 * Questions lock at the FIRST submitted answer for that post+event
 * (Director, 2026-08-15). Derived rather than stored, so it can never disagree
 * with reality: if a submitted attempt exists, the set is locked, full stop.
 */
async function postLocked(
  sb: SB,
  eventId: string,
  postKey: string
): Promise<boolean> {
  const { data } = await attemptsT(sb)
    .select("id")
    .eq("event_id", eventId)
    .eq("post_key", postKey)
    .not("submitted_at", "is", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function myNominatedPosts(sb: SB, eventId: string, participantId: string) {
  const { data } = await selfNomsT(sb)
    .select("participant_id, roles")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle();
  const roles = Array.isArray(data?.roles) ? data!.roles : [];
  return roles.filter(isQuestionnairePostKey);
}

/**
 * Wake the external scoring routine.
 *
 * YIP's production app never calls an LLM — docs/yip-ai-routine.md states that
 * as a rule, and the reason is that these surfaces involve minors and the
 * decisions must be dispute-proof. So scoring is queued here and drained by the
 * routine that already services yip.ai_drafts. This ping just says "there is
 * work"; it carries no payload and no answer text.
 *
 * It is an accelerator, never a dependency: if it fails, or the URL is unset,
 * the scheduled run picks the queue up instead and the only cost is latency.
 */
async function pingScoringRoutine(): Promise<void> {
  const url = process.env.YIP_AI_LIVE_TRIGGER_URL;
  if (!url) return;
  const token = process.env.YIP_AI_LIVE_TRIGGER_TOKEN;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Deliberately swallowed — the queue drains on schedule regardless.
  }
}

function revalidateStudent() {
  revalidatePath("/yip/me");
  revalidatePath("/yip/me/questionnaire");
}
function revalidateAdmin(eventId: string) {
  revalidatePath(`/yip/dashboard/events/${eventId}/questionnaire`);
}

function toFlags(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// ─── STUDENT ─────────────────────────────────────────────────────

export type MyPostState = {
  postKey: QuestionnairePostKey;
  label: string;
  /** Did this student nominate for this post? */
  nominated: boolean;
  windowOpen: boolean;
  /**
   * The cohort's shared deadline for this post — 30 minutes from when the
   * organiser opened the window. Null when the window has never been opened.
   *
   * The clock is uniform, so a window can be `open` while its 30 minutes are
   * already spent. Without this the card would offer a Start button that can
   * only ever fail, which is the worst thing to show a candidate who is late.
   */
  closesAt: string | null;
  /** Present once started. Carries NO scoring fields, by design. */
  attempt: {
    startedAt: string;
    expiresAt: string;
    submittedAt: string | null;
    answered: number;
    total: number;
  } | null;
};

export async function getMyQuestionnaire(
  eventId: string
): Promise<R<{ posts: MyPostState[] }>> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };

  const sb = await createServiceClient();
  const [windows, nominated] = await Promise.all([
    readWindows(sb, eventId),
    myNominatedPosts(sb, eventId, me.participantId),
  ]);

  const { data: attempts } = await attemptsT(sb)
    .select(
      "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
    )
    .eq("event_id", eventId)
    .eq("participant_id", me.participantId)
    .limit(10);

  const byPost = new Map((attempts ?? []).map((a) => [a.post_key, a]));

  // Answer counts for the student's own attempts only.
  const ids = (attempts ?? []).map((a) => a.id);
  const counts = new Map<string, { answered: number; total: number }>();
  if (ids.length > 0) {
    const { data: rows } = await answersT(sb)
      .select("attempt_id, answer_text")
      .in("attempt_id", ids)
      .limit(500);
    for (const r of rows ?? []) {
      const c = counts.get(r.attempt_id) ?? { answered: 0, total: 0 };
      c.total += 1;
      if ((r.answer_text ?? "").trim() !== "") c.answered += 1;
      counts.set(r.attempt_id, c);
    }
  }

  const posts: MyPostState[] = QUESTIONNAIRE_POSTS.map((p) => {
    const a = byPost.get(p.key);
    const c = a ? counts.get(a.id) ?? { answered: 0, total: 0 } : null;
    return {
      postKey: p.key,
      label: p.label,
      nominated: nominated.includes(p.key),
      windowOpen: windowOpen(windows, p.key),
      closesAt: windows.find((w) => w.post_key === p.key)?.opened_at
        ? uniformExpiry(windows, p.key, new Date())
        : null,
      attempt: a
        ? {
            startedAt: a.started_at,
            expiresAt: a.expires_at,
            submittedAt: a.submitted_at,
            answered: c?.answered ?? 0,
            total: c?.total ?? 0,
          }
        : null,
    };
  });

  return { success: true, data: { posts } };
}

export type StartedAttempt = {
  postKey: QuestionnairePostKey;
  expiresAt: string;
  submittedAt: string | null;
  questions: { position: number; text: string; answer: string }[];
};

export async function startQuestionnaire(
  eventId: string,
  postKeyRaw: string
): Promise<R<StartedAttempt>> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const postKey = postKeyRaw;
  const sb = await createServiceClient();

  // Already started? Resume rather than refuse — this is the dropped-connection
  // path, and it must return the SAME paper.
  //
  // An attempt with NO questions is a half-written start: the attempt row
  // inserted and the answer rows did not. Left alone the student gets a screen
  // reading "Question 1 of 0" that can never be completed, and the unique index
  // stops them starting again. So repair it by drawing a paper onto the
  // existing attempt rather than refusing. Their original clock stands.
  const existing = await loadMyAttempt(sb, eventId, me.participantId, postKey);
  if (existing && existing.questions.length > 0) {
    return { success: true, data: existing };
  }
  if (existing && existing.submittedAt) {
    // Submitted with no answers — nothing to repair, and nothing to re-open.
    return { success: true, data: existing };
  }

  const nominated = await myNominatedPosts(sb, eventId, me.participantId);
  if (!nominated.includes(postKey)) {
    return {
      success: false,
      error: `You did not nominate yourself for ${questionnairePostLabel(postKey)}.`,
    };
  }

  const windows = await readWindows(sb, eventId);
  if (!windowOpen(windows, postKey)) {
    return { success: false, error: "This questionnaire is not open right now." };
  }

  const { questions } = await effectiveQuestions(sb, eventId, postKey);
  if (questions.length === 0) {
    return {
      success: false,
      error: "No questions have been set up for this post yet. Tell your organiser.",
    };
  }

  const drawn = drawQuestions(questions, questionsPerAttempt(postKey));
  const startedAt = new Date();

  // One clock for the whole cohort, anchored on when the window was opened.
  const expiresAt = uniformExpiry(windows, postKey, startedAt);
  if (new Date(expiresAt).getTime() <= startedAt.getTime()) {
    // The shared 30 minutes are already spent. Refuse rather than hand out a
    // zero-second paper the student can never complete — and say so plainly,
    // because "nothing happened" is the one outcome a candidate cannot act on.
    return {
      success: false,
      error:
        "The 30 minutes for this questionnaire are over. Tell your organiser if you were not able to start.",
    };
  }

  let attemptId: string;

  if (existing) {
    // Repair path: reuse the half-written attempt. Do NOT reset the clock —
    // the student's 30 minutes started when they first pressed Start.
    const { data: row } = await attemptsT(sb)
      .select("id")
      .eq("event_id", eventId)
      .eq("participant_id", me.participantId)
      .eq("post_key", postKey)
      .maybeSingle();
    if (!row) return { success: false, error: "Could not start the questionnaire." };
    attemptId = row.id;
  } else {
    const { data: attempt, error: attemptErr } = await attemptsT(sb)
      .insert({
        event_id: eventId,
        participant_id: me.participantId,
        post_key: postKey,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (attemptErr || !attempt) {
      // Most likely the unique index caught a double-tap or a second tab. Re-read
      // rather than surface a constraint error to a student.
      const again = await loadMyAttempt(sb, eventId, me.participantId, postKey);
      if (again && again.questions.length > 0) return { success: true, data: again };
      return {
        success: false,
        error: attemptErr?.message ?? "Could not start the questionnaire.",
      };
    }
    attemptId = attempt.id;
  }

  const { error: answersErr } = await answersT(sb).insert(
    drawn.map((qn, i) => ({
      attempt_id: attemptId,
      question_id: qn.id,
      question_text: qn.body,
      position: i + 1,
    }))
  );
  if (answersErr) {
    return { success: false, error: "Could not prepare your questions. Try again." };
  }

  revalidateStudent();
  const loaded = await loadMyAttempt(sb, eventId, me.participantId, postKey);
  return loaded
    ? { success: true, data: loaded }
    : { success: false, error: "Could not load your questions." };
}

async function loadMyAttempt(
  sb: SB,
  eventId: string,
  participantId: string,
  postKey: QuestionnairePostKey
): Promise<StartedAttempt | null> {
  const { data: attempt } = await attemptsT(sb)
    .select(
      "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
    )
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .eq("post_key", postKey)
    .maybeSingle();
  if (!attempt) return null;

  const { data: answers } = await answersT(sb)
    .select("position, question_text, answer_text")
    .eq("attempt_id", attempt.id)
    .order("position", { ascending: true })
    .limit(100);

  return {
    postKey,
    expiresAt: attempt.expires_at,
    submittedAt: attempt.submitted_at,
    questions: (answers ?? []).map((a) => ({
      position: a.position,
      text: a.question_text,
      answer: a.answer_text ?? "",
    })),
  };
}

export async function saveQuestionnaireAnswer(
  eventId: string,
  postKeyRaw: string,
  position: number,
  answerRaw: string
): Promise<R<{ saved: true }>> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const sb = await createServiceClient();

  const { data: attempt } = await attemptsT(sb)
    .select(
      "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
    )
    .eq("event_id", eventId)
    .eq("participant_id", me.participantId)
    .eq("post_key", postKeyRaw)
    .maybeSingle();

  if (!attempt) return { success: false, error: "You have not started this questionnaire." };
  if (attempt.submitted_at) {
    return { success: false, error: "You have already submitted this questionnaire." };
  }
  // Server-side deadline. The countdown on the phone is display only.
  if (attemptExpired(attempt)) {
    return { success: false, error: "Your time is up. Submit what you have." };
  }

  const { error } = await answersT(sb)
    .update({
      answer_text: normalizeAnswerText(answerRaw),
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("attempt_id", attempt.id)
    .eq("position", position);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { saved: true } };
}

export async function submitQuestionnaire(
  eventId: string,
  postKeyRaw: string
): Promise<R<{ submittedAt: string }>> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const sb = await createServiceClient();

  const { data: attempt } = await attemptsT(sb)
    .select(
      "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
    )
    .eq("event_id", eventId)
    .eq("participant_id", me.participantId)
    .eq("post_key", postKeyRaw)
    .maybeSingle();

  if (!attempt) return { success: false, error: "You have not started this questionnaire." };
  if (attempt.submitted_at) {
    return { success: true, data: { submittedAt: attempt.submitted_at } };
  }

  // Submitting AFTER the deadline is allowed on purpose: that is the auto-submit
  // path — whatever was written gets recorded. Only further EDITS are refused,
  // which saveQuestionnaireAnswer already does.
  const submittedAt = new Date().toISOString();
  const { error } = await attemptsT(sb)
    .update({
      submitted_at: submittedAt,
      scoring_status: "pending",
      updated_at: submittedAt,
    })
    .eq("id", attempt.id);
  if (error) return { success: false, error: error.message };

  revalidateStudent();
  revalidateAdmin(eventId);
  await pingScoringRoutine();
  return { success: true, data: { submittedAt } };
}

// ─── ORGANISER ───────────────────────────────────────────────────

export type PostOverview = {
  postKey: QuestionnairePostKey;
  label: string;
  status: WindowStatus;
  locked: boolean;
  questionCount: number;
  questionSource: "chapter" | "national";
  drawSize: number;
  /** Window length for THIS post — 30 for the three original posts, 60 for the journalist report. */
  minutes: number;
  nominated: number;
  started: number;
  submitted: number;
  scored: number;
};

export async function getQuestionnaireOverview(
  eventId: string
): Promise<R<{ posts: PostOverview[]; minutes: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const sb = await createServiceClient();
  await ensureWindows(sb, eventId);

  const windows = await readWindows(sb, eventId);
  const noms = await readAllPaged<{ participant_id: string; roles: string[] }>(() =>
    selfNomsT(sb).select("participant_id, roles").eq("event_id", eventId)
  );
  const attempts = await readAllPaged<AttemptDb>(() =>
    attemptsT(sb)
      .select(
        "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
      )
      .eq("event_id", eventId)
  );

  const posts: PostOverview[] = [];
  for (const p of QUESTIONNAIRE_POSTS) {
    const { questions, source } = await effectiveQuestions(sb, eventId, p.key);
    const mine = attempts.filter((a) => a.post_key === p.key);
    posts.push({
      postKey: p.key,
      label: p.label,
      status: (windows.find((w) => w.post_key === p.key)?.status ?? "pending") as WindowStatus,
      locked: mine.some((a) => a.submitted_at !== null),
      questionCount: questions.length,
      questionSource: source,
      drawSize: Math.min(p.questionsPerAttempt, questions.length),
      minutes: p.attemptMinutes,
      nominated: noms.filter((n) => Array.isArray(n.roles) && n.roles.includes(p.key)).length,
      started: mine.length,
      submitted: mine.filter((a) => a.submitted_at !== null).length,
      scored: mine.filter((a) => a.scoring_status === "scored").length,
    });
  }

  return { success: true, data: { posts, minutes: ATTEMPT_MINUTES } };
}

export async function setQuestionnaireWindow(
  eventId: string,
  postKeyRaw: string,
  open: boolean
): Promise<R<{ status: WindowStatus }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const sb = await createServiceClient();
  await ensureWindows(sb, eventId);

  // ONE POST AT A TIME (Director, 2026-08-15).
  //
  // The clock is uniform, so two posts running together means their 30 minutes
  // overlap. 57% of nominees put their name down for more than one post and 22
  // for all three — those students would have to write two papers at once and
  // lose one of them. Refuse, and name the post that is holding the slot so the
  // organiser knows what to close.
  //
  // A post whose 30 minutes are already spent does NOT hold the slot: it is
  // finished in every way that matters, and making an organiser close it first
  // would be busywork at exactly the wrong moment.
  if (open) {
    const current = await readWindows(sb, eventId);
    const blocking = current.find(
      (w) =>
        w.post_key !== postKeyRaw &&
        w.status === "open" &&
        new Date(uniformExpiry(current, w.post_key, new Date())).getTime() > Date.now()
    );
    if (blocking) {
      return {
        success: false,
        error: `${questionnairePostLabel(
          blocking.post_key as QuestionnairePostKey
        )} is still running. Close it before opening ${questionnairePostLabel(
          postKeyRaw
        )} — students who nominated for both cannot sit two at once.`,
      };
    }
  }

  const now = new Date().toISOString();
  const status: WindowStatus = open ? "open" : "closed";
  const { error } = await windowsT(sb)
    .update({
      status,
      ...(open ? { opened_at: now } : { closed_at: now }),
      updated_at: now,
    })
    .eq("event_id", eventId)
    .eq("post_key", postKeyRaw);
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "update",
    target_table: "questionnaire_windows",
    target_event_id: eventId,
    metadata: { post_key: postKeyRaw, status },
  });

  revalidateAdmin(eventId);
  revalidateStudent();
  return { success: true, data: { status } };
}

export async function listQuestionnaireQuestions(
  eventId: string,
  postKeyRaw: string
): Promise<
  R<{
    questions: { id: string; body: string; order: number }[];
    source: "chapter" | "national";
    locked: boolean;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const sb = await createServiceClient();
  const [{ questions, source }, locked] = await Promise.all([
    effectiveQuestions(sb, eventId, postKeyRaw),
    postLocked(sb, eventId, postKeyRaw),
  ]);
  return {
    success: true,
    data: {
      questions: questions.map((q) => ({ id: q.id, body: q.body, order: q.display_order })),
      source,
      locked,
    },
  };
}

/**
 * Replace this event's question set for one post.
 *
 * Refused once the post is locked — the first submitted answer freezes the set
 * so every candidate for that post is compared on the same questions, and no
 * stored answer can end up attached to a question nobody was asked.
 */
export async function saveQuestionnaireQuestions(
  eventId: string,
  postKeyRaw: string,
  bodiesRaw: string[]
): Promise<R<{ count: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const sb = await createServiceClient();

  if (await postLocked(sb, eventId, postKeyRaw)) {
    return {
      success: false,
      error:
        "Students have already answered for this post, so its questions are locked. Everyone must be asked the same questions.",
    };
  }

  const bodies = (Array.isArray(bodiesRaw) ? bodiesRaw : [])
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter((b) => b.length >= 10)
    .slice(0, 100);

  const need = questionsPerAttempt(postKeyRaw);
  if (bodies.length > 0 && bodies.length < need) {
    return {
      success: false,
      error: `${questionnairePostLabel(postKeyRaw)} candidates are asked ${need} questions, so you need at least ${need}. You have ${bodies.length}.`,
    };
  }

  await questionsT(sb).delete().eq("event_id", eventId).eq("post_key", postKeyRaw);

  if (bodies.length > 0) {
    const { error } = await questionsT(sb).insert(
      bodies.map((body, i) => ({
        event_id: eventId,
        post_key: postKeyRaw,
        body,
        display_order: i + 1,
      }))
    );
    if (error) return { success: false, error: error.message };
  }

  await logAuditAction({
    action_type: "update",
    target_table: "questionnaire_questions",
    target_event_id: eventId,
    metadata: { post_key: postKeyRaw, count: bodies.length },
  });

  revalidateAdmin(eventId);
  return { success: true, data: { count: bodies.length } };
}

export async function getQuestionnaireResults(
  eventId: string
): Promise<
  R<{ rows: QuestionnaireResultRow[]; unscored: number; missing: QuestionnaireMissingRow[] }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const sb = await createServiceClient();

  // Read the nominations too, not just the attempts: the ranking can only ever
  // show students who handed something in, so without this an organiser cannot
  // tell "nobody is missing" from "eight people are missing".
  const [attempts, noms] = await Promise.all([
    readAllPaged<AttemptDb>(() =>
      attemptsT(sb)
        .select(
          "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
        )
        .eq("event_id", eventId)
        .not("submitted_at", "is", null)
    ),
    readAllPaged<{ participant_id: string; roles: string[] }>(() =>
      selfNomsT(sb).select("participant_id, roles").eq("event_id", eventId)
    ),
  ]);

  const answers =
    attempts.length === 0
      ? []
      : await readAllPaged<AnswerDb>(() =>
          answersT(sb)
            .select("id, attempt_id, position, answer_text, red_flag_penalty, score, flags")
            .in(
              "attempt_id",
              attempts.map((a) => a.id)
            )
        );
  const agg = new Map<string, { answered: number; drawn: number; flags: number }>();
  for (const a of answers) {
    const c = agg.get(a.attempt_id) ?? { answered: 0, drawn: 0, flags: 0 };
    c.drawn += 1;
    if ((a.answer_text ?? "").trim() !== "") c.answered += 1;
    c.flags += toFlags(a.flags).length;
    agg.set(a.attempt_id, c);
  }

  // Everyone we need a name for: anyone who sat it, plus anyone who nominated.
  const needNames = new Set<string>([
    ...attempts.map((a) => a.participant_id),
    ...noms.map((n) => n.participant_id),
  ]);
  if (needNames.size === 0) {
    return { success: true, data: { rows: [], unscored: 0, missing: [] } };
  }
  const people = await readAllPaged<{
    id: string;
    full_name: string;
    constituency_number: number | null;
  }>(() =>
    participantsT(sb)
      .select("id, full_name, constituency_number")
      .in("id", [...needNames])
  );
  const byId = new Map(people.map((p) => [p.id, p]));

  const rows: QuestionnaireResultRow[] = attempts.map((a) => {
    const c = agg.get(a.id) ?? { answered: 0, drawn: 0, flags: 0 };
    const p = byId.get(a.participant_id);
    return {
      attemptId: a.id,
      participantId: a.participant_id,
      fullName: p?.full_name ?? "(removed student)",
      constituencyNumber: p?.constituency_number ?? null,
      postKey: a.post_key as QuestionnairePostKey,
      submittedAt: a.submitted_at,
      scoringStatus: a.scoring_status as ScoringStatus,
      pct: a.pct,
      totalScore: a.total_score,
      maxScore: a.max_score,
      redFlagCount: c.flags,
      answered: c.answered,
      drawn: c.drawn,
    };
  });

  // A paper with nothing written on it is not a candidacy — decision 9 says no
  // answers means not considered. Splitting it out here rather than hiding it in
  // the UI matters: the shortlist cutoff counts scored candidates, so leaving
  // blanks in would push a post past 15 and widen the shortlist from 5 to 10 on
  // the strength of students who never wrote a word.
  const ranked = rows.filter((r) => r.answered > 0);
  const blankByKey = new Set(
    rows.filter((r) => r.answered === 0).map((r) => `${r.participantId}:${r.postKey}`)
  );

  // Ranked within post, scored first, best first.
  ranked.sort((x, y) => {
    if (x.postKey !== y.postKey) return x.postKey.localeCompare(y.postKey);
    const xs = x.scoringStatus === "scored" ? 0 : 1;
    const ys = y.scoringStatus === "scored" ? 0 : 1;
    if (xs !== ys) return xs - ys;
    return (y.pct ?? -1) - (x.pct ?? -1);
  });

  const rankedKeys = new Set(ranked.map((r) => `${r.participantId}:${r.postKey}`));
  const missing: QuestionnaireMissingRow[] = [];
  for (const n of noms) {
    for (const role of n.roles ?? []) {
      if (!isQuestionnairePostKey(role)) continue;
      const key = `${n.participant_id}:${role}`;
      if (rankedKeys.has(key)) continue;
      const p = byId.get(n.participant_id);
      missing.push({
        participantId: n.participant_id,
        fullName: p?.full_name ?? "(removed student)",
        constituencyNumber: p?.constituency_number ?? null,
        postKey: role,
        startedButBlank: blankByKey.has(key),
      });
    }
  }
  missing.sort(
    (a, b) => a.postKey.localeCompare(b.postKey) || a.fullName.localeCompare(b.fullName)
  );

  return {
    success: true,
    data: {
      rows: ranked,
      unscored: ranked.filter((r) => r.scoringStatus !== "scored").length,
      missing,
    },
  };
}

export async function getQuestionnaireAttemptDetail(
  eventId: string,
  attemptId: string
): Promise<
  R<{
    answers: {
      position: number;
      question: string;
      answer: string;
      score: number | null;
      grounding: number | null;
      depth: number | null;
      voice: number | null;
      penalty: number | null;
      flags: string[];
    }[];
    maxPerAnswer: number;
    /**
     * The routine's organiser-only read of this paper, if it wrote one. Null
     * until the paper is marked — and null forever if the routine sent marks
     * without a note, which is a valid response.
     */
    analysisNote: string | null;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const sb = await createServiceClient();

  // Scope check: the attempt must belong to THIS event, so an attempt id from
  // another event cannot be read through an event the caller happens to manage.
  const { data: attempt } = await attemptsT(sb)
    .select(
      "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error, analysis_note"
    )
    .eq("id", attemptId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attempt) return { success: false, error: "Not found." };

  const { data: answers } = await answersT(sb)
    .select(
      "position, question_text, answer_text, score, grounding, depth, voice, red_flag_penalty, flags"
    )
    .eq("attempt_id", attemptId)
    .order("position", { ascending: true })
    .limit(100);

  return {
    success: true,
    data: {
      answers: (answers ?? []).map((a) => ({
        position: a.position,
        question: a.question_text,
        answer: a.answer_text ?? "",
        score: a.score,
        grounding: a.grounding,
        depth: a.depth,
        voice: a.voice,
        penalty: a.red_flag_penalty,
        flags: toFlags(a.flags),
      })),
      maxPerAnswer: MAX_PER_ANSWER,
      analysisNote: attempt.analysis_note ?? null,
    },
  };
}

export async function exportQuestionnaireCsv(
  eventId: string
): Promise<R<{ filename: string; csv: string; unscored: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to export this event." };
  }
  const res = await getQuestionnaireResults(eventId);
  if (!res.success) return res;

  return {
    success: true,
    data: {
      filename: `yip-questionnaire-${eventId.slice(0, 8)}.csv`,
      csv: buildQuestionnaireCsv(res.data.rows),
      unscored: res.data.unscored,
    },
  };
}

/**
 * Download every answer, question by question.
 *
 * The other export is a scoreboard — rank, score, percent — with no writing in
 * it, so there was no way to read the cohort's answers anywhere except one
 * student at a time on screen. This is what lets the shortlist be worked out
 * off-platform while the in-app scorer is still being wired up; decision 3
 * already says the AI only advises and a human confirms, so an outside reading
 * of the same answers is no less legitimate.
 *
 * Papers with nothing written on them are left out: a blank has nothing to
 * analyse and would only pad the file. Within a paper that HAS answers, every
 * drawn question is included even where the answer is blank.
 */
export async function exportQuestionnaireResponsesCsv(
  eventId: string
): Promise<R<{ filename: string; csv: string; students: number; answers: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to export this event." };
  }
  const sb = await createServiceClient();

  const attempts = await readAllPaged<AttemptDb>(() =>
    attemptsT(sb)
      .select(
        "id, event_id, participant_id, post_key, started_at, expires_at, submitted_at, scoring_status, total_score, max_score, pct, score_error"
      )
      .eq("event_id", eventId)
      .not("submitted_at", "is", null)
  );
  if (attempts.length === 0) {
    return { success: false, error: "Nobody has submitted answers for this event yet." };
  }

  const answers = await readAllPaged<AnswerDb>(() =>
    answersT(sb)
      .select(
        "id, attempt_id, position, question_text, answer_text, grounding, depth, voice, red_flag_penalty, score, flags"
      )
      .in(
        "attempt_id",
        attempts.map((a) => a.id)
      )
  );

  const people = await readAllPaged<{
    id: string;
    full_name: string;
    constituency_number: number | null;
  }>(() =>
    participantsT(sb)
      .select("id, full_name, constituency_number")
      .in(
        "id",
        attempts.map((a) => a.participant_id)
      )
  );
  const byId = new Map(people.map((p) => [p.id, p]));

  const byAttempt = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byAttempt.get(a.attempt_id) ?? [];
    list.push(a);
    byAttempt.set(a.attempt_id, list);
  }

  const rows: QuestionnaireResponseRow[] = [];
  for (const at of attempts) {
    const mine = byAttempt.get(at.id) ?? [];
    // Skip a paper with nothing written on it — see the note above.
    if (!mine.some((a) => (a.answer_text ?? "").trim() !== "")) continue;
    const p = byId.get(at.participant_id);
    for (const a of [...mine].sort((x, y) => x.position - y.position)) {
      rows.push({
        postKey: at.post_key as QuestionnairePostKey,
        fullName: p?.full_name ?? "(removed student)",
        constituencyNumber: p?.constituency_number ?? null,
        submittedAt: at.submitted_at,
        position: a.position,
        question: a.question_text,
        answer: a.answer_text ?? "",
        score: a.score,
        grounding: a.grounding ?? null,
        depth: a.depth ?? null,
        voice: a.voice ?? null,
        redFlagPenalty: a.red_flag_penalty,
        flags: toFlags(a.flags),
      });
    }
  }
  if (rows.length === 0) {
    return { success: false, error: "Nobody has written an answer for this event yet." };
  }

  rows.sort(
    (x, y) =>
      x.postKey.localeCompare(y.postKey) ||
      x.fullName.localeCompare(y.fullName) ||
      x.position - y.position
  );

  return {
    success: true,
    data: {
      filename: `yip-questionnaire-answers-${eventId.slice(0, 8)}.csv`,
      csv: buildQuestionnaireResponsesCsv(rows),
      students: new Set(rows.map((r) => `${r.fullName}:${r.postKey}`)).size,
      answers: rows.filter((r) => r.answer.trim() !== "").length,
    },
  };
}

/**
 * Put one attempt back in the scoring queue. Organiser-only and deliberately
 * per-attempt: each run costs a real model call, so nothing re-scores in bulk
 * or on a schedule.
 */
export async function rescoreQuestionnaireAttempt(
  eventId: string,
  attemptId: string
): Promise<R<{ queued: true }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  const sb = await createServiceClient();
  const { error } = await attemptsT(sb)
    .update({
      scoring_status: "pending",
      score_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidateAdmin(eventId);
  await pingScoringRoutine();
  return { success: true, data: { queued: true } };
}

/**
 * How far the marking has actually got, and whether it is still moving.
 *
 * Read-only and deliberately narrow — three columns, no answers, no names — so
 * the organiser's screen can poll it every half-minute without weight.
 *
 * The elapsed figures are measured HERE rather than on the client. A phone with
 * a wrong clock would otherwise either invent a stall or, worse, hide one.
 */
export async function getQuestionnaireMarkingProgress(
  eventId: string
): Promise<R<QuestionnaireMarkingProgress>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const sb = await createServiceClient();

  // Submitted papers only: an attempt nobody handed in is not waiting to be
  // marked, and counting it would make the queue look permanently behind.
  const rows = await readAllPaged<{
    scoring_status: string;
    updated_at: string;
  }>(() =>
    tbl<{ scoring_status: string; updated_at: string }>(sb, "questionnaire_attempts")
      .select("scoring_status, updated_at")
      .eq("event_id", eventId)
      .not("submitted_at", "is", null)
  );

  const now = Date.now();
  const stallMs = MARKING_STALL_MINUTES * 60_000;
  let pending = 0;
  let scoring = 0;
  let scored = 0;
  let failed = 0;
  let stuckScoring = 0;
  let lastMovedMs: number | null = null;
  let oldestStuckMs: number | null = null;

  for (const r of rows) {
    const t = Date.parse(r.updated_at);
    const known = !Number.isNaN(t);
    if (known) lastMovedMs = lastMovedMs === null ? t : Math.max(lastMovedMs, t);

    switch (r.scoring_status) {
      case "pending":
        pending += 1;
        break;
      case "scoring":
        scoring += 1;
        // A claimed paper never times out on its own — claimScoringWork flips
        // it to 'scoring' before the routine reads it, and nothing puts it back.
        if (known && now - t >= stallMs) {
          stuckScoring += 1;
          oldestStuckMs = oldestStuckMs === null ? t : Math.min(oldestStuckMs, t);
        }
        break;
      case "scored":
        scored += 1;
        break;
      case "failed":
        failed += 1;
        break;
      default:
        break;
    }
  }

  return {
    success: true,
    data: {
      submitted: rows.length,
      pending,
      scoring,
      scored,
      failed,
      lastMovedAt: lastMovedMs === null ? null : new Date(lastMovedMs).toISOString(),
      stalledMinutes:
        lastMovedMs === null ? null : Math.floor((now - lastMovedMs) / 60_000),
      stuckScoring,
      oldestStuckMinutes:
        oldestStuckMs === null ? null : Math.floor((now - oldestStuckMs) / 60_000),
      checkedAt: new Date(now).toISOString(),
    },
  };
}

/** PostgREST puts `.in()` values in the query string — keep the URL sane. */
function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Throw away every mark for one post and put its papers back in the queue.
 *
 * WHY THIS EXISTS: rescoreQuestionnaireAttempt already does this one paper at a
 * time, which is fine for a single disputed mark and useless when the marking
 * routine dies mid-batch and leaves fifty papers claimed-and-abandoned. There is
 * no timeout on a claim, so without this the only way back is one click per
 * paper.
 *
 * WHAT IT CLEARS: marks, and only marks — the per-answer rubric numbers, the
 * flags, the attempt's totals, the organiser-only analysis note, and the status
 * back to 'pending' so the routine picks it up again.
 *
 * WHAT IT NEVER TOUCHES: `answer_text`, `answered_at` and `submitted_at`. The
 * student's writing and the moment they handed it in are the record of what
 * happened in the room; a marking mistake is not a reason to disturb either,
 * and a paper that lost its submitted_at would silently drop out of the results
 * view and out of the scoring queue at the same time.
 *
 * Answers are cleared BEFORE the attempts are re-queued: the other order would
 * let the routine claim a paper and start writing marks into rows this action
 * is about to blank, and the paper would end up 'scored' with half its answers
 * wiped.
 */
export async function clearQuestionnaireMarksForPost(
  eventId: string,
  postKeyRaw: string
): Promise<R<{ postKey: QuestionnairePostKey; attempts: number; answers: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { success: false, error: "Unknown post." };
  }
  const postKey = postKeyRaw;
  const sb = await createServiceClient();

  const attempts = await readAllPaged<{ id: string }>(() =>
    tbl<{ id: string }>(sb, "questionnaire_attempts")
      .select("id")
      .eq("event_id", eventId)
      .eq("post_key", postKey)
      .not("submitted_at", "is", null)
  );
  if (attempts.length === 0) {
    return {
      success: false,
      error: `Nobody has handed in a ${questionnairePostLabel(
        postKey
      )} paper yet, so there are no marks to clear.`,
    };
  }

  const ids = attempts.map((a) => a.id);
  const batches = chunked(ids, 100);
  const now = new Date().toISOString();

  let answersCleared = 0;
  for (const batch of batches) {
    const { data, error } = await answersT(sb)
      .update({
        grounding: null,
        depth: null,
        voice: null,
        red_flag_penalty: null,
        score: null,
        // The column is `jsonb not null default '[]'` — an empty array, never null.
        flags: [],
        scored_at: null,
        updated_at: now,
      })
      .in("attempt_id", batch)
      .select("id");
    if (error) return { success: false, error: error.message };
    answersCleared += data?.length ?? 0;
  }

  let attemptsCleared = 0;
  for (const batch of batches) {
    const { data, error } = await attemptsT(sb)
      .update({
        scoring_status: "pending",
        total_score: null,
        max_score: null,
        pct: null,
        scored_at: null,
        score_error: null,
        analysis_note: null,
        updated_at: now,
      })
      .in("id", batch)
      // Belt and braces: the ids came from this event, and they stay in it.
      .eq("event_id", eventId)
      .select("id");
    if (error) return { success: false, error: error.message };
    attemptsCleared += data?.length ?? 0;
  }

  await logAuditAction({
    action_type: "update",
    target_table: "questionnaire_attempts",
    target_event_id: eventId,
    metadata: {
      post_key: postKey,
      action: "clear_marks_and_requeue",
      attempts: attemptsCleared,
      answers: answersCleared,
    },
  });

  revalidateAdmin(eventId);
  await pingScoringRoutine();
  return {
    success: true,
    data: { postKey, attempts: attemptsCleared, answers: answersCleared },
  };
}

// ─── Question-bank review (organiser-only, out-of-band) ──────────────────

/**
 * Ask the routine to read this event's questions and write back what it makes
 * of them.
 *
 * WHY THIS EXISTS: some of the bank was AI-drafted in the style of the
 * originals, and 180 candidates answered it before a human read it back
 * (Director, 2026-08-16). This is a second reader on the WORDING — ambiguity,
 * leading phrasing, two questions that ask the same thing, a question that
 * cannot be answered in the time allowed.
 *
 * It reviews the QUESTIONS, never the answers: the grounding payload is built
 * from yip.questionnaire_questions alone (see
 * buildQuestionnaireQuestionReviewGrounding), so no candidate's work is in
 * scope and none can leak.
 *
 * Same doctrine as everything else here — the app enqueues and pings; the model
 * runs outside. `pinged` distinguishes "being written now" from "queued for the
 * next scheduled run" so the UI can say which.
 */
export async function requestQuestionnaireQuestionReview(
  eventId: string
): Promise<R<{ id: string; pinged: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const res = await enqueueAiDraft({
    eventId,
    kind: "questionnaire_question_review",
    subjectId: null,
    // The organiser pressed the button: redo it even if a review already
    // exists, because the usual reason to press it is that the questions
    // changed since the last one.
    force: true,
  });
  if ("error" in res) return { success: false, error: res.error };

  await pingScoringRoutine();
  revalidateAdmin(eventId);
  return { success: true, data: { id: res.id, pinged: Boolean(process.env.YIP_AI_LIVE_TRIGGER_URL) } };
}

/**
 * The current question-bank review, if there is one.
 *
 * `status` is the draft's own lifecycle: 'requested'/'generating' means the
 * routine has not written it yet, 'ready' means the text below is final. There
 * is no approval gate — this never reaches a student, only the organiser
 * reading their own question set.
 */
export async function getQuestionnaireQuestionReview(eventId: string): Promise<
  R<{
    status: string | null;
    text: string | null;
    generatedAt: string | null;
    modelNote: string | null;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const row = await getAiDraft(eventId, "questionnaire_question_review", null, null);
  return {
    success: true,
    data: {
      status: row?.status ?? null,
      text: row?.draft_text ?? null,
      generatedAt: row?.generated_at ?? null,
      modelNote: row?.model_note ?? null,
    },
  };
}
