"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  getYipSession,
  requireParticipantSession,
} from "@/lib/yip/auth/yip-session";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import {
  MAX_QUESTIONS_PER_PARTICIPANT,
  MIN_QUESTION_LENGTH,
  resolveQuestionWindowState,
  type QuestionWindowState,
} from "@/lib/yip/question-window";
import type { Tables } from "@/types/yip/database";

type Question = Tables<{ schema: "yip" }, "questions">;

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// Resolve a question's event then require organiser (canManage) on it. Used by
// the organiser Question-Hour controls that take only a questionId. yip.questions
// has an INSERT/UPDATE-to-public RLS policy, so this app gate is the ONLY guard.
async function requireQuestionManage(
  questionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServiceClient();
  const { data: q } = await supabase
    .from("questions")
    .select("event_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!q) return { ok: false, error: "Question not found" };
  const access = await getYipEventAccess(q.event_id);
  if (!access.canManage) return { ok: false, error: "Not authorized to manage this event" };
  return { ok: true };
}

// ─── Submit Question ─────────────────────────────────────────────
// Max 3 questions per student per event

export async function submitQuestion(
  eventId: string,
  participantId: string,
  ministryKey: string,
  questionText: string
): Promise<ActionResult<{ id: string }>> {
  // Participant self-service: verify the caller's session owns participantId.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const supabase = await createServiceClient();

  // Validate text length
  if (!questionText || questionText.trim().length < MIN_QUESTION_LENGTH) {
    return {
      success: false,
      error: `Question must be at least ${MIN_QUESTION_LENGTH} characters`,
    };
  }

  // Enforce the submission window server-side: open_at <= now() <= close_at.
  // questions_open_at = earliest accepted (event-days only); questions_close_at
  // = handbook 4-day-prior cutoff. Either may be NULL (unbounded on that side).
  // cabinet_ministries lets us validate the directed ministry KEY against the
  // event's effective portfolios (directed_to_ministry is now free text, so the
  // DB no longer constrains it — this app gate does).
  const { data: eventRow } = await supabase
    .from("events")
    .select("questions_open_at, questions_close_at, cabinet_ministries")
    .eq("id", eventId)
    .single();

  // The submitted ministry must be one of the event's effective cabinet
  // portfolios (per-event override, else the handbook default). Fail closed.
  const validKeys = new Set(
    effectiveMinistries(eventRow?.cabinet_ministries).map((m) => m.key)
  );
  if (!ministryKey || !validKeys.has(ministryKey)) {
    return {
      success: false,
      error: "Please select a valid ministry for this event.",
    };
  }

  // One rule, read from lib/yip/question-window — the same helper the member's
  // Question Hour screen uses to decide what to show. Two copies of this
  // comparison is how a member ends up typing a whole question into a form the
  // server was always going to reject.
  const windowState = resolveQuestionWindowState(
    eventRow?.questions_open_at,
    eventRow?.questions_close_at
  );

  if (windowState === "not_yet") {
    return {
      success: false,
      error:
        "Question submissions are not open yet. They open at the start of the event window.",
    };
  }

  if (windowState === "closed") {
    return {
      success: false,
      error:
        "Question submissions have closed. Handbook requires all Question Hour questions to be submitted at least 4 days before the session.",
    };
  }

  // Check count
  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("submitted_by", participantId);

  if ((count ?? 0) >= MAX_QUESTIONS_PER_PARTICIPANT) {
    return {
      success: false,
      error: `You have already submitted the maximum of ${MAX_QUESTIONS_PER_PARTICIPANT} questions`,
    };
  }

  const { data, error } = await supabase
    .from("questions")
    .insert({
      event_id: eventId,
      submitted_by: participantId,
      directed_to_ministry: ministryKey,
      question_text: questionText.trim(),
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to submit question" };
  }

  return { success: true, data: { id: data.id } };
}

// ─── Get All Questions (with submitter info) ────────────────────

export type QuestionWithSubmitter = Question & {
  submitter: {
    id: string;
    full_name: string;
    party_side: string | null;
    party_number: number | null;
    constituency_name: string | null;
    school_name: string;
    parliament_role: string | null;
  } | null;
};

// ─── Set / clear the question-submission deadline ──────────────────
// Handbook p22: Question Hour questions are collected from all students at
// least 4 days before the session. submitQuestion enforces
// events.questions_close_at; this is the organiser-facing setter for it.
// Pass null to remove the deadline (submissions stay open).
export async function setQuestionsDeadline(
  eventId: string,
  closeAtIso: string | null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (closeAtIso !== null && Number.isNaN(new Date(closeAtIso).getTime())) {
    return { success: false, error: "Invalid date/time" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ questions_close_at: closeAtIso })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/questions`);
  return { success: true, data: null };
}

// ─── Set / clear the question-submission OPEN time ─────────────────
// Open bound for the submission window (typically the event's day-1). Mirrors
// setQuestionsDeadline; submitQuestion enforces open_at <= now() <= close_at.
// Pass null to remove the open bound (submissions open from the start).
export async function setQuestionsOpen(
  eventId: string,
  openAtIso: string | null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (openAtIso !== null && Number.isNaN(new Date(openAtIso).getTime())) {
    return { success: false, error: "Invalid date/time" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ questions_open_at: openAtIso })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/questions`);
  return { success: true, data: null };
}

// ─── Widen the window in one tap ───────────────────────────────────
/**
 * Push the submission deadline out by `hours` without picking a date.
 *
 * The SRTN regional round ran a single 5.5-hour weekday window: 196 members,
 * 59 of whom ever tabled a question. Re-opening it took a database edit,
 * because the only control was a datetime picker an organiser has to reason
 * about mid-event. This is the same setting, one tap.
 *
 * Extends from whichever is later — the standing deadline or now — so
 * re-opening a window that lapsed overnight gives the full extension from
 * this moment rather than handing back hours nobody could use.
 */
export async function extendQuestionsDeadline(
  eventId: string,
  hours: number
): Promise<ActionResult<{ closeAt: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    return {
      success: false,
      error: "Extension must be between 1 hour and 30 days",
    };
  }

  const supabase = await createServiceClient();
  const { data: row, error: readError } = await supabase
    .from("events")
    .select("questions_close_at")
    .eq("id", eventId)
    .single();

  if (readError) return { success: false, error: readError.message };

  // No deadline means the window is ALREADY unbounded. Extending from "now"
  // here would invent a cutoff that did not exist — a button that reads "give
  // them more time" would silently take time away. Refuse instead.
  if (!row?.questions_close_at) {
    return {
      success: false,
      error:
        "There is no deadline to extend — submissions are already open with no cutoff.",
    };
  }

  const now = Date.now();
  const standing = new Date(row.questions_close_at).getTime();
  const base = Number.isNaN(standing) ? now : Math.max(standing, now);
  const nextIso = new Date(base + hours * 3_600_000).toISOString();

  const { error } = await supabase
    .from("events")
    .update({ questions_close_at: nextIso })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/questions`);
  return { success: true, data: { closeAt: nextIso } };
}

// ─── Who has actually tabled a question ────────────────────────────
/**
 * How many of the event's members have tabled at least one question.
 *
 * The Question Hour page counts QUESTIONS — total, approved, starred. None of
 * those numbers tells an organiser that 137 of 196 members never got one in,
 * which is the fact that decides whether the window should be widened. This
 * returns that fact. Counts real members only (mock rows excluded on both
 * sides), and is read-only, so `canView` is the right bar.
 */
export type QuestionCoverage = {
  totalParticipants: number;
  withQuestion: number;
  withoutQuestion: number;
};

export async function getQuestionCoverage(
  eventId: string
): Promise<QuestionCoverage | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const supabase = await createServiceClient();

  const { count: totalParticipants } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("is_mock", false);

  const { data: rows } = await supabase
    .from("questions")
    .select("submitted_by")
    .eq("event_id", eventId)
    .eq("is_mock", false);

  const tabled = new Set(
    (rows ?? []).map((r) => r.submitted_by).filter((v): v is string => !!v)
  );

  const total = totalParticipants ?? 0;
  // A question can outlive its submitter's participant row, so clamp rather
  // than letting "without" go negative.
  const withQuestion = Math.min(tabled.size, total);

  return {
    totalParticipants: total,
    withQuestion,
    withoutQuestion: Math.max(0, total - withQuestion),
  };
}

// ─── The member's own view of the window ───────────────────────────
/**
 * What THIS member needs to know before typing: is the window open, how long
 * is left, and how many of their three they have used.
 *
 * Reads the signed participant cookie itself (no id passed from the client —
 * same shape as getMySpeakingStatus), so it can be dropped onto any member
 * screen. Returns null for anyone who is not a participant, which every caller
 * renders as "nothing", never as "open".
 */
export type MyQuestionStatus = {
  eventId: string;
  openAt: string | null;
  closeAt: string | null;
  state: QuestionWindowState;
  submittedCount: number;
  maxPerParticipant: number;
  remaining: number;
};

export async function getMyQuestionStatus(): Promise<MyQuestionStatus | null> {
  const session = await getYipSession();
  if (!session || session.type !== "participant") return null;

  const supabase = await createServiceClient();

  const { data: eventRow } = await supabase
    .from("events")
    .select("questions_open_at, questions_close_at")
    .eq("id", session.eventId)
    .maybeSingle();

  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("event_id", session.eventId)
    .eq("submitted_by", session.id);

  const submittedCount = count ?? 0;
  const openAt = eventRow?.questions_open_at ?? null;
  const closeAt = eventRow?.questions_close_at ?? null;

  return {
    eventId: session.eventId,
    openAt,
    closeAt,
    state: resolveQuestionWindowState(openAt, closeAt),
    submittedCount,
    maxPerParticipant: MAX_QUESTIONS_PER_PARTICIPANT,
    remaining: Math.max(0, MAX_QUESTIONS_PER_PARTICIPANT - submittedCount),
  };
}

export async function getQuestions(
  eventId: string
): Promise<QuestionWithSubmitter[]> {
  // GATE. Every one of these readers embeds the submitter's full_name,
  // party, constituency and school — identifying detail about minors — and
  // runs on the SERVICE client, which bypasses RLS. As a "use server" export
  // it is a directly invocable endpoint, so being called only from gated
  // pages is not a guarantee; the caller's page gate protects the page, not
  // this function. yip.questions also carries an INSERT/UPDATE-to-public RLS
  // policy (see requireQuestionManage above), so there is no database-side
  // guard to fall back on. Fails CLOSED: an unknown scope returns nothing.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("questions")
    .select(
      `
      *,
      submitter:participants!questions_submitted_by_fkey(
        id,
        full_name,
        party_side,
        party_number,
        constituency_name,
        school_name,
        parliament_role
      )
    `
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as QuestionWithSubmitter[];
}

// ─── Get My Questions ────────────────────────────────────────────

export async function getMyQuestions(
  eventId: string,
  participantId: string
): Promise<Question[]> {
  // Only the student themselves may read their own questions.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return [];
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", eventId)
    .eq("submitted_by", participantId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data;
}

// ─── Filter Question (starred / unstarred) ──────────────────────

export async function filterQuestion(
  questionId: string,
  type: "starred" | "unstarred"
): Promise<ActionResult> {
  const gate = await requireQuestionManage(questionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      question_type: type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Approve Question ────────────────────────────────────────────

export async function approveQuestion(
  questionId: string
): Promise<ActionResult> {
  const gate = await requireQuestionManage(questionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Reject Question ─────────────────────────────────────────────

export async function rejectQuestion(
  questionId: string
): Promise<ActionResult> {
  const gate = await requireQuestionManage(questionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Set Queue Order ─────────────────────────────────────────────

export async function setQueueOrder(
  questionId: string,
  order: number
): Promise<ActionResult> {
  const gate = await requireQuestionManage(questionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      queue_order: order,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Bulk Approve ────────────────────────────────────────────────

export async function bulkApprove(
  questionIds: string[]
): Promise<ActionResult> {
  if (questionIds.length === 0) return { success: true, data: null };
  const gate = await requireQuestionManage(questionIds[0]);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .in("id", questionIds);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Bulk Reject ─────────────────────────────────────────────────

export async function bulkReject(
  questionIds: string[]
): Promise<ActionResult> {
  if (questionIds.length === 0) return { success: true, data: null };
  const gate = await requireQuestionManage(questionIds[0]);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .in("id", questionIds);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Advance Question (live session) ─────────────────────────────
// During live Question Hour: mark current as 'asked' is done,
// then move to next queued question.

export async function advanceQuestion(
  eventId: string
): Promise<ActionResult<{ nextQuestionId: string | null }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Find the currently asked question
  const { data: current } = await supabase
    .from("questions")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "asked")
    .maybeSingle();

  // If there's a current question being asked, mark it as answered (or skipped)
  if (current) {
    await supabase
      .from("questions")
      .update({
        status: "answered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);
  }

  // The next approved question. A hand-typed queue_order still wins, but its
  // ABSENCE no longer means "no question" — requiring it made this a silent
  // no-op for the whole of the SRTN round (see getQueuedQuestions above), so a
  // Chair pressing Next got nothing and the projector never showed a question.
  const { data: next } = await supabase
    .from("questions")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("queue_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (next) {
    await supabase
      .from("questions")
      .update({
        status: "asked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", next.id);

    return { success: true, data: { nextQuestionId: next.id } };
  }

  return { success: true, data: { nextQuestionId: null } };
}

// ─── Mark Answered ───────────────────────────────────────────────

export async function markAnswered(
  questionId: string,
  answerSummary?: string
): Promise<ActionResult> {
  const gate = await requireQuestionManage(questionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "answered",
      answer_summary: answerSummary?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Skip Question (during live) ─────────────────────────────────

export async function skipQuestion(
  questionId: string
): Promise<ActionResult> {
  const gate = await requireQuestionManage(questionId);
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("questions")
    .update({
      status: "skipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Get Current Question ────────────────────────────────────────
// Returns the question currently being asked (status='asked')

export type CurrentQuestionInfo = Question & {
  submitter: {
    id: string;
    full_name: string;
    party_side: string | null;
    party_number: number | null;
    constituency_name: string | null;
    school_name: string;
    parliament_role: string | null;
  } | null;
};

export async function getCurrentQuestion(
  eventId: string
): Promise<CurrentQuestionInfo | null> {
  // GATE. Every one of these readers embeds the submitter's full_name,
  // party, constituency and school — identifying detail about minors — and
  // runs on the SERVICE client, which bypasses RLS. As a "use server" export
  // it is a directly invocable endpoint, so being called only from gated
  // pages is not a guarantee; the caller's page gate protects the page, not
  // this function. yip.questions also carries an INSERT/UPDATE-to-public RLS
  // policy (see requireQuestionManage above), so there is no database-side
  // guard to fall back on. Fails CLOSED: an unknown scope returns nothing.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("questions")
    .select(
      `
      *,
      submitter:participants!questions_submitted_by_fkey(
        id,
        full_name,
        party_side,
        party_number,
        constituency_name,
        school_name,
        parliament_role
      )
    `
    )
    .eq("event_id", eventId)
    .eq("status", "asked")
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as CurrentQuestionInfo;
}

// ─── Get Queued Questions ────────────────────────────────────────
/**
 * The approved questions waiting to be put, in the order they will be put.
 *
 * This used to return ONLY questions with a hand-typed `queue_order`, and that
 * number is entered one question at a time. On the SRTN round nobody typed 135
 * of them, so this returned an EMPTY list, `advanceQuestion` found nothing to
 * advance, no question ever reached status 'asked', and the projector's Question
 * Hour panel — which renders the question with status 'asked' — stayed blank all
 * session. Across every event in the database, no question has ever held the
 * 'asked', 'answered' or 'queued' status: the live Question Hour has never once
 * run. The research behind 135 approved questions left no trace of being put.
 *
 * An approved question is therefore queued by default. An explicit `queue_order`
 * still wins and still orders the front of the list; everything else follows in
 * submission order, so a Chair who orders nothing still has a working session
 * and one who orders the first ten gets exactly those ten first.
 */
export async function getQueuedQuestions(
  eventId: string
): Promise<QuestionWithSubmitter[]> {
  // GATE. Every one of these readers embeds the submitter's full_name,
  // party, constituency and school — identifying detail about minors — and
  // runs on the SERVICE client, which bypasses RLS. As a "use server" export
  // it is a directly invocable endpoint, so being called only from gated
  // pages is not a guarantee; the caller's page gate protects the page, not
  // this function. yip.questions also carries an INSERT/UPDATE-to-public RLS
  // policy (see requireQuestionManage above), so there is no database-side
  // guard to fall back on. Fails CLOSED: an unknown scope returns nothing.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("questions")
    .select(
      `
      *,
      submitter:participants!questions_submitted_by_fkey(
        id,
        full_name,
        party_side,
        party_number,
        constituency_name,
        school_name,
        parliament_role
      )
    `
    )
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("queue_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as QuestionWithSubmitter[];
}

// ─── Get Completed Questions ─────────────────────────────────────

export async function getCompletedQuestions(
  eventId: string
): Promise<QuestionWithSubmitter[]> {
  // GATE. Every one of these readers embeds the submitter's full_name,
  // party, constituency and school — identifying detail about minors — and
  // runs on the SERVICE client, which bypasses RLS. As a "use server" export
  // it is a directly invocable endpoint, so being called only from gated
  // pages is not a guarantee; the caller's page gate protects the page, not
  // this function. yip.questions also carries an INSERT/UPDATE-to-public RLS
  // policy (see requireQuestionManage above), so there is no database-side
  // guard to fall back on. Fails CLOSED: an unknown scope returns nothing.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("questions")
    .select(
      `
      *,
      submitter:participants!questions_submitted_by_fkey(
        id,
        full_name,
        party_side,
        party_number,
        constituency_name,
        school_name,
        parliament_role
      )
    `
    )
    .eq("event_id", eventId)
    .in("status", ["answered", "skipped"])
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as QuestionWithSubmitter[];
}
