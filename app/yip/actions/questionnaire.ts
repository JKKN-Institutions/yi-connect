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
// Imported, never re-exported: see saveManualQuestionnaireMarks for why the
// writer must not become an exported action in this file.
import { applyAttemptScores } from "@/lib/yip/questionnaire-scoring";
import { revalidatePath } from "next/cache";
import {
  ATTEMPT_MINUTES,
  MARKING_STALL_MINUTES,
  MAX_PER_ANSWER,
  QUESTIONNAIRE_FILE_URL_SECONDS,
  QUESTIONNAIRE_MAX_FILES_PER_ANSWER,
  QUESTIONNAIRE_MAX_FILE_BYTES,
  QUESTIONNAIRE_POSTS,
  QUESTIONNAIRE_UPLOAD_MIME_EXT,
  answerIsGiven,
  attemptExpired,
  buildQuestionnaireCsv,
  buildQuestionnaireResponsesCsv,
  CABINET_QUESTIONS_PER_MINISTRY,
  compareByScoreThenStableKey,
  drawCabinetPaper,
  drawQuestions,
  expiryFor,
  isQuestionnairePostKey,
  ministryMatchKey,
  nominatedPostKeys,
  normalizeAnswerText,
  parseAnswerFiles,
  questionnaireContestKey,
  questionnairePostLabel,
  questionsPerAttempt,
  type QuestionnaireActionResult as R,
  type QuestionnaireAnswerFile,
  type QuestionnaireMarkingProgress,
  type QuestionnairePostKey,
  type QuestionnaireMissingRow,
  type QuestionnaireResponseRow,
  type QuestionnaireResultRow,
  type ScoringStatus,
  type WindowStatus,
} from "@/lib/yip/questionnaire";

/**
 * The PRIVATE bucket handed-in files live in. Never made public and never
 * turned into a public URL: these are minors' personal data, so every read is
 * a short-lived signed URL minted behind a server-side gate — the same posture
 * as yip-bill-documents.
 */
const UPLOAD_BUCKET = "yip-questionnaire-uploads";

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
  /** Portfolio this question belongs to — cabinet_minister only, else null. */
  ministry: string | null;
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
  /** jsonb array of {path,name,size,mime,uploaded_at}. Read via parseAnswerFiles. */
  files: unknown;
};

const questionsT = (sb: SB) => tbl<QuestionDb>(sb, "questionnaire_questions");
const windowsT = (sb: SB) => tbl<WindowDb>(sb, "questionnaire_windows");
const attemptsT = (sb: SB) => tbl<AttemptDb>(sb, "questionnaire_attempts");
const answersT = (sb: SB) => tbl<AnswerDb>(sb, "questionnaire_answers");
const selfNomsT = (sb: SB) =>
  tbl<{
    participant_id: string;
    roles: string[];
    ministries: string[] | null;
  }>(sb, "self_nominations");

/**
 * The two portfolios on THIS student's Cabinet/Shadow nomination.
 *
 * Read from their own nomination row rather than anything the client sent —
 * the paper a candidate sits is decided by what they nominated for, and a
 * client that could name its own portfolios could choose the easy two. Returns
 * [] when there is no nomination or it carries none, which the caller reports
 * rather than silently handing out an empty paper.
 */
async function readMyNominatedMinistries(
  sb: SB,
  eventId: string,
  participantId: string
): Promise<string[]> {
  const { data, error } = await selfNomsT(sb)
    .select("participant_id, roles, ministries")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error || !data) return [];
  return Array.isArray(data.ministries)
    ? data.ministries.filter((m): m is string => typeof m === "string")
    : [];
}

/**
 * Portfolios that real candidates nominated for but that cannot fill a paper.
 *
 * Returns one row per short portfolio with how many questions it has and how
 * many candidates are waiting on it. An empty array means every nominated
 * portfolio can fill its share of the paper.
 *
 * Fails LOUD, not open: if the read errors we report the whole thing as short
 * rather than reporting all-clear, because the cost of a wrong all-clear is a
 * cohort sitting a blank paper inside a 30-minute window.
 */
async function cabinetCoverageShortfall(
  sb: SB,
  eventId: string
): Promise<{ ministry: string; have: number; candidates: number }[]> {
  const { data: noms, error } = await selfNomsT(sb)
    .select("participant_id, roles, ministries")
    .eq("event_id", eventId);
  if (error) {
    return [{ ministry: "could not read the nominations", have: 0, candidates: 0 }];
  }

  const waiting = new Map<string, { label: string; candidates: number }>();
  for (const n of noms ?? []) {
    // Shadow Ministers sit this same paper, so they must be counted here too.
    if (!nominatedPostKeys(n.roles).includes("cabinet_minister")) continue;
    if (!Array.isArray(n.ministries)) continue;
    for (const m of n.ministries) {
      if (typeof m !== "string" || m.trim() === "") continue;
      const key = ministryMatchKey(m);
      const seen = waiting.get(key);
      if (seen) seen.candidates += 1;
      else waiting.set(key, { label: m, candidates: 1 });
    }
  }
  if (waiting.size === 0) return [];

  const { questions } = await effectiveQuestions(sb, eventId, "cabinet_minister");
  const have = new Map<string, number>();
  for (const q of questions) {
    const key = ministryMatchKey(q.ministry);
    have.set(key, (have.get(key) ?? 0) + 1);
  }

  const short: { ministry: string; have: number; candidates: number }[] = [];
  for (const [key, info] of waiting) {
    const count = have.get(key) ?? 0;
    if (count < CABINET_QUESTIONS_PER_MINISTRY) {
      short.push({ ministry: info.label, have: count, candidates: info.candidates });
    }
  }
  return short.sort((a, b) => b.candidates - a.candidates);
}
const participantsT = (sb: SB) =>
  tbl<{
    id: string;
    full_name: string;
    constituency_number: number | null;
    // The bench a candidate sits on. Needed because the Cabinet paper serves
    // two separate contests — see QuestionnaireResultRow.bench.
    party_side: string | null;
  }>(sb, "participants");

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
    .select("id, event_id, post_key, ministry, body, display_order, is_active")
    .eq("event_id", eventId)
    .eq("post_key", postKey)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(200);
  if (own && own.length > 0) return { questions: own, source: "chapter" };

  const { data: national } = await questionsT(sb)
    .select("id, event_id, post_key, ministry, body, display_order, is_active")
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
  // NOT `roles.filter(isQuestionnairePostKey)` — that drops shadow_minister,
  // whose paper is the Cabinet one. See nominatedPostKeys.
  return nominatedPostKeys(roles);
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
      .select("attempt_id, answer_text, files")
      .in("attempt_id", ids)
      .limit(500);
    for (const r of rows ?? []) {
      const c = counts.get(r.attempt_id) ?? { answered: 0, total: 0 };
      c.total += 1;
      // Text OR a handed-in file. A candidate who photographed a handwritten
      // report and typed nothing must not be told "0 of 1 answered".
      if (answerIsGiven(r.answer_text, r.files)) c.answered += 1;
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
  questions: {
    position: number;
    text: string;
    answer: string;
    /** Anything already handed in for this question — survives a reload. */
    files: QuestionnaireAnswerFile[];
  }[];
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

  // The Cabinet paper is drawn per portfolio (6 + 6), not as one draw over the
  // merged bank — a single draw could hand a candidate ten Finance questions
  // and two Health ones when they are judged on both. Every other post is a
  // straight draw over its whole bank.
  let drawn: typeof questions;
  if (postKey === "cabinet_minister") {
    const myMinistries = await readMyNominatedMinistries(
      sb,
      eventId,
      me.participantId
    );
    if (myMinistries.length === 0) {
      return {
        success: false,
        error:
          "Your nomination does not have two portfolios on it. Tell your organiser.",
      };
    }
    drawn = drawCabinetPaper(questions, myMinistries);
    if (drawn.length === 0) {
      return {
        success: false,
        error:
          "No questions have been set up for your portfolios yet. Tell your organiser.",
      };
    }
  } else {
    drawn = drawQuestions(questions, questionsPerAttempt(postKey));
  }
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
    .select("position, question_text, answer_text, files")
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
      files: parseAnswerFiles(a.files),
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

// ─── STUDENT · handing in a file ─────────────────────────────────
//
// The Student Journalist paper is ONE 300–500 word news report in 60 minutes.
// On 2026-08-22, 32 candidates submitted and only 5 had typed anything — 27
// handed in blank. Typing a full report on a phone inside the window is the
// suspected cause, so a candidate may hand in a document, or a photo of a
// handwritten report, as well as or instead of typing.
//
// A FILE IS NOT A WAY AROUND THE CLOCK. Every refusal that stops a candidate
// editing text stops them uploading too — submitted, window shut, own
// expires_at passed. That is why upload and remove share one gate with save.

/**
 * The gate every write to one answer row must pass: the caller owns the
 * attempt, the attempt is still open, and the row exists.
 *
 * Mirrors saveQuestionnaireAnswer's checks exactly — deliberately one helper
 * rather than two copies, because a file route that drifted from the text
 * route would be a way to keep writing after pens-down.
 */
async function requireWritableAnswer(
  eventId: string,
  postKeyRaw: string,
  position: number
): Promise<
  | { ok: true; sb: SB; attemptId: string; files: QuestionnaireAnswerFile[] }
  | { ok: false; error: string }
> {
  const me = await requireMe(eventId);
  if (!me.ok) return { ok: false, error: me.error };
  if (!isQuestionnairePostKey(postKeyRaw)) {
    return { ok: false, error: "Unknown post." };
  }
  if (!Number.isInteger(position) || position < 1) {
    return { ok: false, error: "Unknown question." };
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

  if (!attempt) return { ok: false, error: "You have not started this questionnaire." };
  if (attempt.submitted_at) {
    return { ok: false, error: "You have already submitted this questionnaire." };
  }
  const windows = await readWindows(sb, eventId);
  if (!windowOpen(windows, postKeyRaw)) {
    return { ok: false, error: "This questionnaire is not open right now." };
  }
  // Server-side deadline. The countdown on the phone is display only.
  if (attemptExpired(attempt)) {
    return { ok: false, error: "Your time is up. Submit what you have." };
  }

  const { data: answer } = await answersT(sb)
    .select("id, attempt_id, position, answer_text, files")
    .eq("attempt_id", attempt.id)
    .eq("position", position)
    .maybeSingle();
  if (!answer) return { ok: false, error: "That question is not part of your paper." };

  return { ok: true, sb, attemptId: attempt.id, files: parseAnswerFiles(answer.files) };
}

/** Best-effort object delete; the caller decides whether failure matters. */
async function removeUploadObject(sb: SB, path: string): Promise<void> {
  const { error } = await sb.storage.from(UPLOAD_BUCKET).remove([path]);
  if (error) {
    console.error("[yip-questionnaire-uploads] storage remove failed:", error.message);
  }
}

/**
 * Hand in one file for one answer.
 *
 * Everything is validated HERE, from the bytes that actually arrived — the
 * browser's reported type and size are only a hint, and the extension is
 * derived from the validated mime, never from the filename. The original
 * filename survives as display text inside the jsonb and nowhere else.
 */
export async function uploadQuestionnaireFile(
  eventId: string,
  postKeyRaw: string,
  position: number,
  formData: FormData
): Promise<R<{ files: QuestionnaireAnswerFile[] }>> {
  const gate = await requireWritableAnswer(eventId, postKeyRaw, position);
  if (!gate.ok) return { success: false, error: gate.error };
  const { sb, attemptId } = gate;

  const raw = formData.get("file");
  if (!raw || typeof raw === "string") {
    return { success: false, error: "Pick a file first, then tap Add file again." };
  }
  const file = raw as File;

  const ext = QUESTIONNAIRE_UPLOAD_MIME_EXT.get(file.type ?? "");
  if (!ext) {
    return {
      success: false,
      error:
        "That kind of file can't be used. Send a photo (JPG, PNG, HEIC or WebP), a PDF, or a Word document.",
    };
  }
  if (file.size <= 0) {
    return { success: false, error: "That file is empty. Pick the file again." };
  }
  if (file.size > QUESTIONNAIRE_MAX_FILE_BYTES) {
    return {
      success: false,
      error: `That file is too big — ${Math.round(
        QUESTIONNAIRE_MAX_FILE_BYTES / (1024 * 1024)
      )} MB is the most we can take. Take the photo again at a smaller size, or send one page at a time.`,
    };
  }
  if (gate.files.length >= QUESTIONNAIRE_MAX_FILES_PER_ANSWER) {
    return {
      success: false,
      error: `You've already added ${QUESTIONNAIRE_MAX_FILES_PER_ANSWER} files, which is the most allowed. Remove one if you need to swap it.`,
    };
  }

  // Read the bytes and re-check the LENGTH THAT ACTUALLY ARRIVED. A client can
  // lie about File.size; it cannot lie about how many bytes it sent.
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return { success: false, error: "We couldn't read that file. Try picking it again." };
  }
  if (buffer.byteLength <= 0 || buffer.byteLength > QUESTIONNAIRE_MAX_FILE_BYTES) {
    return {
      success: false,
      error: `That file is too big — ${Math.round(
        QUESTIONNAIRE_MAX_FILE_BYTES / (1024 * 1024)
      )} MB is the most we can take.`,
    };
  }

  // The path is built ENTIRELY from server-known values plus a fresh UUID, so
  // it cannot traverse and one candidate's folder can never name another's.
  const path = `${eventId}/${attemptId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await sb.storage
    .from(UPLOAD_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return {
      success: false,
      error: "The upload didn't go through. Check your signal and try once more.",
    };
  }

  const entry: QuestionnaireAnswerFile = {
    path,
    name: (file.name ?? "").trim().slice(0, 255) || `report.${ext}`,
    size: buffer.byteLength,
    mime: file.type,
    uploaded_at: new Date().toISOString(),
  };
  const files = [...gate.files, entry];

  const { error } = await answersT(sb)
    .update({
      files,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("attempt_id", attemptId)
    .eq("position", position);
  if (error) {
    // Don't strand the object if the row failed to record it.
    await removeUploadObject(sb, path);
    return { success: false, error: "We couldn't save that file. Try once more." };
  }

  revalidateStudent();
  return { success: true, data: { files } };
}

/**
 * Take one handed-in file back off an answer.
 *
 * The path is checked against THIS attempt's own file list before anything is
 * deleted — a client naming a path is naming a string, not proving it owns it.
 */
export async function removeQuestionnaireFile(
  eventId: string,
  postKeyRaw: string,
  position: number,
  path: string
): Promise<R<{ files: QuestionnaireAnswerFile[] }>> {
  const gate = await requireWritableAnswer(eventId, postKeyRaw, position);
  if (!gate.ok) return { success: false, error: gate.error };
  const { sb, attemptId } = gate;

  // Ownership, twice over: the path must be one this answer actually holds,
  // AND it must sit under this attempt's own folder.
  const owned =
    typeof path === "string" &&
    gate.files.some((f) => f.path === path) &&
    path.startsWith(`${eventId}/${attemptId}/`);
  if (!owned) {
    return { success: false, error: "That file is not on your answer." };
  }

  const files = gate.files.filter((f) => f.path !== path);
  const { error } = await answersT(sb)
    .update({ files, updated_at: new Date().toISOString() })
    .eq("attempt_id", attemptId)
    .eq("position", position);
  if (error) {
    return { success: false, error: "We couldn't remove that file. Try once more." };
  }

  // Storage last: an orphaned object is harmless, a row still pointing at a
  // deleted object is a broken link on the organiser's screen.
  await removeUploadObject(sb, path);

  revalidateStudent();
  return { success: true, data: { files } };
}

/**
 * ORGANISER: a short-lived link to one handed-in file.
 *
 * The bucket is PRIVATE and stays private — these are minors' personal data.
 * Every read is signed here, behind getYipEventAccess, and the link expires in
 * five minutes. There is no public URL anywhere in this feature.
 */
export async function getQuestionnaireFileUrl(
  eventId: string,
  attemptId: string,
  path: string
): Promise<R<{ url: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event." };
  }
  const sb = await createServiceClient();

  // Scope check: the attempt must belong to THIS event, so an attempt id from
  // another event cannot be read through an event the caller happens to manage.
  const { data: attempt } = await attemptsT(sb)
    .select("id, event_id")
    .eq("id", attemptId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attempt) return { success: false, error: "Not found." };

  // The path must be one THIS attempt actually holds — never signed because a
  // caller named it.
  const { data: answers } = await answersT(sb)
    .select("id, attempt_id, files")
    .eq("attempt_id", attemptId)
    .limit(100);
  const owned = (answers ?? []).some((a) =>
    parseAnswerFiles(a.files).some((f) => f.path === path)
  );
  if (!owned) return { success: false, error: "Not found." };

  const { data, error } = await sb.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(path, QUESTIONNAIRE_FILE_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return { success: false, error: "Could not open that file. Try again." };
  }
  return { success: true, data: { url: data.signedUrl } };
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
      nominated: noms.filter((n) => nominatedPostKeys(n.roles).includes(p.key)).length,
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

    // COVERAGE GATE — Cabinet only (2026-08-23).
    //
    // The Cabinet paper is drawn per portfolio, so a portfolio with no
    // questions yields a short paper — or, when both of a candidate's
    // portfolios are empty, no paper at all. On 2026-08-22 that is exactly
    // what happened: the bank was fully stocked but under different portfolio
    // names, every one of the 77 candidates drew nothing, and the round was
    // abandoned 41 seconds in. Nothing warned the organiser beforehand.
    //
    // So refuse to open, and name the portfolios that are short. Checked
    // against the portfolios candidates ACTUALLY NOMINATED FOR, not every
    // portfolio the event lists — an unchosen portfolio with no questions
    // harms nobody, and blocking on it would be a false alarm.
    if (postKeyRaw === "cabinet_minister") {
      const shortfall = await cabinetCoverageShortfall(sb, eventId);
      if (shortfall.length > 0) {
        const named = shortfall
          .map((s) => `${s.ministry} (${s.have} of ${CABINET_QUESTIONS_PER_MINISTRY}, ${s.candidates} waiting)`)
          .join("; ");
        return {
          success: false,
          error:
            `Not opening yet — these portfolios do not have enough questions: ${named}. ` +
            `Candidates who nominated for them would get a short paper or none at all. ` +
            `Add the questions, then open.`,
        };
      }
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
            .select(
              "id, attempt_id, position, answer_text, files, red_flag_penalty, score, flags"
            )
            .in(
              "attempt_id",
              attempts.map((a) => a.id)
            )
        );
  const agg = new Map<
    string,
    { answered: number; drawn: number; flags: number; files: number }
  >();
  for (const a of answers) {
    const c = agg.get(a.attempt_id) ?? { answered: 0, drawn: 0, flags: 0, files: 0 };
    c.drawn += 1;
    // Text OR a handed-in file. Without this a candidate who photographed a
    // handwritten report lands in "Nominated, nothing answered" and is dropped
    // from the ranking entirely — reported as blank when they handed in work.
    if (answerIsGiven(a.answer_text, a.files)) c.answered += 1;
    c.files += parseAnswerFiles(a.files).length;
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
  // party_side comes along because the Cabinet paper is TWO contests wearing
  // one post key — see QuestionnaireResultRow.bench.
  const people = await readAllPaged<{
    id: string;
    full_name: string;
    constituency_number: number | null;
    party_side: string | null;
  }>(() =>
    participantsT(sb)
      .select("id, full_name, constituency_number, party_side")
      .in("id", [...needNames])
  );
  const byId = new Map(people.map((p) => [p.id, p]));

  const rows: QuestionnaireResultRow[] = attempts.map((a) => {
    const c = agg.get(a.id) ?? { answered: 0, drawn: 0, flags: 0, files: 0 };
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
      fileCount: c.files,
      bench:
        p?.party_side === "ruling" || p?.party_side === "opposition"
          ? p.party_side
          : null,
    };
  });

  // A paper with nothing on it at all is not a candidacy — decision 9 says no
  // answers means not considered. Splitting it out here rather than hiding it in
  // the UI matters: the shortlist cutoff counts scored candidates, so leaving
  // blanks in would push a post past 15 and widen the shortlist from 5 to 10 on
  // the strength of students who never wrote a word.
  //
  // "Nothing on it" now means no typed text AND no handed-in file — `answered`
  // already counts both, so a file-only report ranks like any other paper.
  const ranked = rows.filter((r) => r.answered > 0);
  const blankByKey = new Set(
    rows.filter((r) => r.answered === 0).map((r) => `${r.participantId}:${r.postKey}`)
  );

  // Ranked within CONTEST, scored first, best first.
  //
  // Contest, not post: the Cabinet paper is sat by both benches, so grouping on
  // post alone builds one league table out of two separate competitions — 12
  // Cabinet seats among the ruling parties and 12 Shadow seats among the
  // opposition. An organiser reading the top of that list is not looking at a
  // shortlist for either. Grouping by contest keeps each bench's ranking its
  // own, and the label on screen says which one you are reading.
  ranked.sort((x, y) => {
    const xk = questionnaireContestKey(x.postKey, x.bench);
    const yk = questionnaireContestKey(y.postKey, y.bench);
    if (xk !== yk) return xk.localeCompare(yk);
    const xs = x.scoringStatus === "scored" ? 0 : 1;
    const ys = y.scoringStatus === "scored" ? 0 : 1;
    if (xs !== ys) return xs - ys;
    // Same comparator the cut-tie detector uses (compareByScoreThenStableKey)
    // — a neutral, stable tiebreak so two candidates level on points sit in
    // the same order here as they do there. See its doc comment: display
    // order only, never a claim about who wins a tie.
    return compareByScoreThenStableKey(x, y);
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
      /**
       * Files handed in for this answer. Carries the storage path so the
       * organiser's screen can ask for a signed URL — never a URL itself, and
       * never a public one.
       */
      files: QuestionnaireAnswerFile[];
    }[];
    maxPerAnswer: number;
    /**
     * The routine's organiser-only read of this paper, if it wrote one. Null
     * until the paper is marked — and null forever if the routine sent marks
     * without a note, which is a valid response.
     */
    analysisNote: string | null;
    /**
     * Gates the manual marks form, and is read from the SAME fetch as the
     * answers rather than from the table row. The row is a snapshot that can be
     * minutes old; if the routine marked this paper in the meantime, a form
     * opened off the stale row would overwrite real marks with hand-typed ones.
     */
    scoringStatus: string;
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
      "position, question_text, answer_text, files, score, grounding, depth, voice, red_flag_penalty, flags"
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
        files: parseAnswerFiles(a.files),
      })),
      maxPerAnswer: MAX_PER_ANSWER,
      analysisNote: attempt.analysis_note ?? null,
      scoringStatus: String(attempt.scoring_status ?? ""),
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
 * Papers with nothing on them are left out: a blank has nothing to analyse and
 * would only pad the file. Within a paper that HAS answers, every drawn
 * question is included even where the answer is blank.
 *
 * "Nothing on it" means no typed text AND no handed-in file. A candidate who
 * photographed a handwritten report belongs in this export — the Files column
 * says how many pages to go and look at, so a 0-word row is never mistaken for
 * a question they skipped.
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
        "id, attempt_id, position, question_text, answer_text, files, grounding, depth, voice, red_flag_penalty, score, flags"
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
    // Skip a paper with nothing on it at all — see the note above.
    if (!mine.some((a) => answerIsGiven(a.answer_text, a.files))) continue;
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
        fileCount: parseAnswerFiles(a.files).length,
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
    return {
      success: false,
      error: "Nobody has written an answer or handed in a file for this event yet.",
    };
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
      // Counts a file-only answer too — otherwise the toast reports "12
      // answers" on an export that carries 20.
      answers: rows.filter((r) => r.answer.trim() !== "" || r.fileCount > 0).length,
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
 * Record a PERSON's marks for a paper the automatic scorer cannot read.
 *
 * ─── WHY THIS ACTION EXISTS ───────────────────────────────────────────────
 * A paper handed in as a file rests at `needs_human`: complete, unscored, and
 * deliberately NOT re-queueable, because the scorer receives answer TEXT only
 * and would return a near-zero on a photographed report. Until now the app
 * could SAY "read this one yourself" and could open the pages — but there was
 * nowhere to put the mark once a person had read them, so a real submission
 * could never enter the ranking at all.
 *
 * ─── WHY IT WRAPS THE LIB INSTEAD OF EXPORTING IT ─────────────────────────
 * `applyAttemptScores` lives outside any `"use server"` file on purpose: in an
 * actions file every exported async function is a public HTTP endpoint with no
 * session behind it, so exporting the writer would let anyone mark any attempt
 * scored. Importing it here and gating on `canManage` keeps exactly one gated
 * door onto that writer.
 *
 * ─── NO RED FLAGS ON THIS PATH ────────────────────────────────────────────
 * The rubric's red flags describe machine-detectable tells of text that was not
 * written by the candidate ("vocabulary inconsistent with a student this age").
 * A person reading a handwritten report is making a different judgement, and a
 * penalty they cannot calibrate would silently cost a real candidate marks. So
 * the manual path submits the three rubric criteria and a zero penalty.
 */
export async function saveManualQuestionnaireMarks(
  eventId: string,
  attemptId: string,
  marks: readonly { position: number; grounding: number; depth: number; voice: number }[]
): Promise<R<{ total: number; max: number; pct: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }
  if (!Array.isArray(marks) || marks.length === 0) {
    return { success: false, error: "No marks to save." };
  }

  const sb = await createServiceClient();

  // Scope check: the attempt must belong to THIS event, so an attempt id from
  // another event cannot be marked through an event the caller happens to
  // manage.
  const { data: attempt } = await attemptsT(sb)
    .select("id, event_id, scoring_status")
    .eq("id", attemptId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!attempt) return { success: false, error: "Not found." };

  // Only a paper actually waiting on a person. Re-checked HERE and not trusted
  // from the screen: if the routine marked it between the page loading and the
  // organiser pressing Save, hand-typed marks must not overwrite its marks.
  if (attempt.scoring_status !== "needs_human") {
    return {
      success: false,
      error:
        attempt.scoring_status === "scored"
          ? "This paper has already been marked. Reload the page to see its marks."
          : "This paper is not waiting on a person, so it cannot be marked by hand.",
    };
  }

  // The positions must be ones THIS attempt actually holds — never written
  // because a caller named them.
  const { data: ownedRows } = await answersT(sb)
    .select("position")
    .eq("attempt_id", attemptId)
    .limit(100);
  const owned = new Set((ownedRows ?? []).map((a) => a.position));
  if (owned.size === 0) return { success: false, error: "This paper has no answers." };
  for (const m of marks) {
    if (!owned.has(m.position)) {
      return { success: false, error: "That paper does not have that question." };
    }
  }

  // Every value is clamped to the rubric's own ranges inside applyAttemptScores,
  // so a hand-typed 99 cannot become 99 marks.
  const res = await applyAttemptScores(
    attemptId,
    marks.map((m) => ({
      position: m.position,
      grounding: m.grounding,
      depth: m.depth,
      voice: m.voice,
      redFlagPenalty: 0,
      flags: [],
    }))
  );
  if (!res.ok) return { success: false, error: res.error };

  await logAuditAction({
    action_type: "update",
    target_table: "questionnaire_attempts",
    target_event_id: eventId,
    metadata: {
      attempt_id: attemptId,
      marked_by: "human",
      answers: marks.length,
      total: res.total,
      max: res.max,
    },
  });

  revalidateAdmin(eventId);
  return { success: true, data: { total: res.total, max: res.max, pct: res.pct } };
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
