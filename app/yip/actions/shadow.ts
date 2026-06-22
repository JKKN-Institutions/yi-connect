"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireLeadershipRole } from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/yip/database";

type MinistryType = Database["public"]["Enums"]["ministry_type"];

/**
 * Shadow minister "leadership desk" (Slice 5).
 *
 * A Shadow minister shadows ONE counterpart ministry — their own
 * participant.ministry. This desk lets them:
 *   (a) READ that ministry's Question-Hour questions + the cabinet minister's
 *       recorded answer (questions.answer_summary), and the motions directed to
 *       that ministry + the cabinet minister's recorded response
 *       (motions.minister_response); and
 *   (b) FILE a counter / follow-up — either a new Question-Hour question or a
 *       Short Duration Discussion motion — directed back at the SAME ministry.
 *
 * The shadow minister NEVER writes answer_summary / minister_response (that is
 * the cabinet minister's instrument — see ministry.ts, where shadow is read-only).
 * Filing a question/motion mirrors the existing submitQuestion / raiseMotion
 * inserts exactly (same columns, status='submitted' so the organiser still
 * moderates). The Speaker/organiser process the filed item like any other.
 *
 * Every action is gated by requireLeadershipRole(..., ['shadow_minister']) and
 * fails CLOSED on a null/unknown ministry. yip.questions / yip.motions have
 * INSERT policies open to `public`, so this server action is the only auth layer.
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const SHADOW_ROLES = ["shadow_minister"] as const;

export type ShadowQuestion = {
  id: string;
  question_text: string;
  directed_to_ministry: string | null;
  status: string;
  answer_summary: string | null;
};

export type ShadowMotion = {
  id: string;
  subject: string;
  details: string | null;
  motion_type: string;
  directed_to_ministry: string | null;
  minister_response: string | null;
  status: string;
};

export type ShadowDesk = {
  ministry: string | null;
  questions: ShadowQuestion[];
  motions: ShadowMotion[];
};

/**
 * Read the shadow minister's counterpart-ministry desk: that ministry's
 * questions + the minister's answers, and motions directed to it + the
 * minister's responses. A shadow minister with NO ministry assigned sees
 * nothing (fail closed).
 */
export async function getShadowDesk(
  eventId: string,
  participantId: string
): Promise<ActionResult<ShadowDesk>> {
  const gate = await requireLeadershipRole(participantId, eventId, SHADOW_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const ministry = gate.participant.ministry;
  // Fail closed: a shadow minister without a counterpart ministry sees nothing.
  if (!ministry) {
    return { success: true, data: { ministry: null, questions: [], motions: [] } };
  }

  const supabase = await createServiceClient();

  // Questions directed to the shadowed ministry. Only organiser-vetted questions
  // are surfaced — never 'submitted' (un-approved) or 'rejected' — to mirror the
  // minister's own read scope and avoid leaking the moderation queue.
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, directed_to_ministry, status, answer_summary")
    .eq("event_id", eventId)
    .eq("directed_to_ministry", ministry as MinistryType)
    .in("status", ["approved", "asked", "answered"])
    .order("created_at", { ascending: false });

  // Motions directed to the shadowed ministry + the minister's recorded response.
  const { data: motions } = await supabase
    .from("motions")
    .select("id, subject, details, motion_type, directed_to_ministry, minister_response, status")
    .eq("event_id", eventId)
    .eq("directed_to_ministry", ministry as MinistryType)
    .order("raised_at", { ascending: false });

  return {
    success: true,
    data: {
      ministry,
      questions: (questions ?? []) as ShadowQuestion[],
      motions: (motions ?? []) as ShadowMotion[],
    },
  };
}

/**
 * File a follow-up Question-Hour question directed at the shadowed ministry.
 * Mirrors submitQuestion's insert (event_id, submitted_by, directed_to_ministry,
 * question_text, status='submitted') — the organiser still approves/queues it.
 * The ministry is the shadow minister's OWN ministry (never client-supplied),
 * so a null ministry fails closed.
 */
export async function shadowFileQuestion(
  eventId: string,
  participantId: string,
  questionText: string
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireLeadershipRole(participantId, eventId, SHADOW_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const ministry = gate.participant.ministry;
  if (!ministry) {
    return { success: false, error: "You have no shadow ministry assigned." };
  }

  const text = questionText.trim();
  if (text.length < 20) {
    return { success: false, error: "Question must be at least 20 characters" };
  }
  if (text.length > 2000) {
    return { success: false, error: "Question is too long (max 2000 characters)." };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      event_id: eventId,
      submitted_by: participantId,
      directed_to_ministry: ministry as MinistryType,
      question_text: text,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to file the question" };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/questions`);
  revalidatePath(`/yip/me/shadow`);
  return { success: true, data: { id: data.id } };
}

/**
 * Move a Short Duration Discussion motion as a counter against the shadowed
 * ministry. Mirrors raiseMotion's insert (status='submitted' → goes to the
 * Speaker's queue). motion_type is fixed to 'short_duration' (a topic-based,
 * needs-ministry discussion — see lib/yip/motions.ts). The directed ministry is
 * the shadow minister's OWN ministry, so a null ministry fails closed.
 */
export async function shadowMoveCounterMotion(
  eventId: string,
  participantId: string,
  subject: string,
  details: string
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireLeadershipRole(participantId, eventId, SHADOW_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const ministry = gate.participant.ministry;
  if (!ministry) {
    return { success: false, error: "You have no shadow ministry assigned." };
  }

  const s = subject.trim();
  const d = details.trim();
  if (s.length < 5) return { success: false, error: "Subject must be at least 5 characters" };
  if (d.length < 20) return { success: false, error: "Details must be at least 20 characters" };

  const supabase = await createServiceClient();
  const p = gate.participant;

  const { data, error } = await supabase
    .from("motions")
    .insert({
      event_id: eventId,
      motion_type: "short_duration",
      subject: s,
      details: d,
      directed_to_ministry: ministry as MinistryType,
      raised_by_id: p.id,
      raised_by_name: p.full_name,
      raised_by_role: p.parliament_role,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to move the motion" };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/shadow`);
  return { success: true, data: { id: data.id } };
}
