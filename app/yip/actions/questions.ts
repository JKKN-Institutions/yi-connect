"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import type { Tables, Database } from "@/types/yip/database";

type Question = Tables<{ schema: "yip" }, "questions">;
type MinistryType = Database["public"]["Enums"]["ministry_type"];

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
  ministryKey: MinistryType,
  questionText: string
): Promise<ActionResult<{ id: string }>> {
  // Participant self-service: verify the caller's session owns participantId.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const supabase = await createServiceClient();

  // Validate text length
  if (!questionText || questionText.trim().length < 20) {
    return { success: false, error: "Question must be at least 20 characters" };
  }

  // Enforce the submission window server-side: open_at <= now() <= close_at.
  // questions_open_at = earliest accepted (event-days only); questions_close_at
  // = handbook 4-day-prior cutoff. Either may be NULL (unbounded on that side).
  const { data: eventRow } = await supabase
    .from("events")
    .select("questions_open_at, questions_close_at")
    .eq("id", eventId)
    .single();

  if (eventRow?.questions_open_at) {
    const openAt = new Date(eventRow.questions_open_at);
    if (Date.now() < openAt.getTime()) {
      return {
        success: false,
        error:
          "Question submissions are not open yet. They open at the start of the event window.",
      };
    }
  }

  if (eventRow?.questions_close_at) {
    const closeAt = new Date(eventRow.questions_close_at);
    if (Date.now() > closeAt.getTime()) {
      return {
        success: false,
        error:
          "Question submissions have closed. Handbook requires all Question Hour questions to be submitted at least 4 days before the session.",
      };
    }
  }

  // Check count
  const { count } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("submitted_by", participantId);

  if ((count ?? 0) >= 3) {
    return {
      success: false,
      error: "You have already submitted the maximum of 3 questions",
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

export async function getQuestions(
  eventId: string
): Promise<QuestionWithSubmitter[]> {
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

  // Find the next approved question by queue_order
  const { data: next } = await supabase
    .from("questions")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .not("queue_order", "is", null)
    .order("queue_order", { ascending: true })
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
// Returns approved questions with queue_order set, ordered by queue_order

export async function getQueuedQuestions(
  eventId: string
): Promise<QuestionWithSubmitter[]> {
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
    .not("queue_order", "is", null)
    .order("queue_order", { ascending: true });

  if (error || !data) return [];
  return data as unknown as QuestionWithSubmitter[];
}

// ─── Get Completed Questions ─────────────────────────────────────

export async function getCompletedQuestions(
  eventId: string
): Promise<QuestionWithSubmitter[]> {
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
