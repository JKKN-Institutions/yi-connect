"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireLeadershipRole } from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/yip/database";

type MinistryType = Database["public"]["Enums"]["ministry_type"];

/**
 * Cabinet minister / PM / Deputy PM / Shadow minister "ministry desk".
 *
 * - cabinet_minister + shadow_minister: scoped to their OWN ministry.
 * - prime_minister + deputy_prime_minister: ALL ministries.
 * - shadow_minister: READ-ONLY (counter prep) — canAnswer = false.
 *
 * Answering writes the SAME columns the organiser already writes
 * (questions.answer_summary + status='answered'; motions.minister_response).
 * Both the minister AND the organiser can act; the organiser overrules
 * (last-write-wins). All gated by requireLeadershipRole + a ministry match.
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const MINISTRY_VIEW_ROLES = [
  "cabinet_minister",
  "prime_minister",
  "deputy_prime_minister",
  "shadow_minister",
] as const;
const MINISTRY_ANSWER_ROLES = [
  "cabinet_minister",
  "prime_minister",
  "deputy_prime_minister",
] as const;

function isAllMinistries(role: string | null): boolean {
  return role === "prime_minister" || role === "deputy_prime_minister";
}

export type MinistryQuestion = {
  id: string;
  question_text: string;
  directed_to_ministry: string | null;
  status: string;
  answer_summary: string | null;
};
export type MinistryMotion = {
  id: string;
  subject: string;
  details: string | null;
  motion_type: string;
  directed_to_ministry: string | null;
  minister_response: string | null;
  status: string;
};
export type MinistryDesk = {
  scope: "own" | "all";
  ministry: string | null;
  canAnswer: boolean;
  roleLabel: string;
  questions: MinistryQuestion[];
  motions: MinistryMotion[];
};

export async function getMinistryDesk(
  eventId: string,
  participantId: string
): Promise<ActionResult<MinistryDesk>> {
  const gate = await requireLeadershipRole(participantId, eventId, MINISTRY_VIEW_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const role = gate.participant.parliament_role ?? "";
  const all = isAllMinistries(role);
  const ministry = gate.participant.ministry;
  const canAnswer = role !== "shadow_minister";

  // A cabinet/shadow minister with no ministry assigned sees nothing (fail closed).
  if (!all && !ministry) {
    return {
      success: true,
      data: { scope: "own", ministry: null, canAnswer, roleLabel: role, questions: [], motions: [] },
    };
  }

  const supabase = await createServiceClient();

  let qQuery = supabase
    .from("questions")
    .select("id, question_text, directed_to_ministry, status, answer_summary")
    .eq("event_id", eventId);
  if (!all) qQuery = qQuery.eq("directed_to_ministry", ministry as MinistryType);
  // Only organiser-vetted questions are answerable — never surface 'submitted'
  // (un-approved) or 'rejected' questions to the minister (moderation bypass).
  qQuery = qQuery.in("status", ["approved", "asked", "answered"]);
  const { data: questions } = await qQuery.order("created_at", { ascending: false });

  let mQuery = supabase
    .from("motions")
    .select("id, subject, details, motion_type, directed_to_ministry, minister_response, status")
    .eq("event_id", eventId)
    .not("directed_to_ministry", "is", null);
  if (!all) mQuery = mQuery.eq("directed_to_ministry", ministry as MinistryType);
  const { data: motions } = await mQuery.order("raised_at", { ascending: false });

  return {
    success: true,
    data: {
      scope: all ? "all" : "own",
      ministry: all ? null : ministry,
      canAnswer,
      roleLabel: role,
      questions: (questions ?? []) as MinistryQuestion[],
      motions: (motions ?? []) as MinistryMotion[],
    },
  };
}

/** Verify the caller may answer for the item's ministry. PM/DPM = any ministry. */
async function assertMinistryMatch(
  eventId: string,
  participantId: string,
  itemMinistry: string | null
): Promise<{ ok: true; supabase: Awaited<ReturnType<typeof createServiceClient>> } | { ok: false; error: string }> {
  const gate = await requireLeadershipRole(participantId, eventId, MINISTRY_ANSWER_ROLES);
  if (!gate.ok) return { ok: false, error: gate.error };
  // The ministry desk only handles ministry-directed items. An undirected item
  // (e.g. a no_confidence motion with null ministry) is never answerable here —
  // reject before the match so a null ministry can't equal a null target.
  if (!itemMinistry) {
    return { ok: false, error: "This item is not directed to a ministry." };
  }
  const role = gate.participant.parliament_role ?? "";
  if (!isAllMinistries(role) && itemMinistry !== gate.participant.ministry) {
    return { ok: false, error: "That item is not directed to your ministry." };
  }
  return { ok: true, supabase: await createServiceClient() };
}

export async function ministerAnswerQuestion(
  eventId: string,
  participantId: string,
  questionId: string,
  answer: string
): Promise<ActionResult> {
  const text = answer.trim();
  if (text.length < 3) return { success: false, error: "Answer is too short." };
  if (text.length > 2000)
    return { success: false, error: "Answer is too long (max 2000 characters)." };

  // Pre-gate (role) + load the question to learn its ministry + status.
  const pre = await requireLeadershipRole(participantId, eventId, MINISTRY_ANSWER_ROLES);
  if (!pre.ok) return { success: false, error: pre.error };
  const svc = await createServiceClient();
  const { data: q } = await svc
    .from("questions")
    .select("id, directed_to_ministry, status")
    .eq("id", questionId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!q) return { success: false, error: "Question not found for this event" };
  // Answer only organiser-vetted questions, and NEVER mutate status here — the
  // organiser owns the live Question-Hour queue/projector (advanceQuestion /
  // markAnswered). The minister writes ONLY the answer text. (Caught by ultracheck.)
  if (!q.status || !["approved", "asked", "answered"].includes(q.status)) {
    return { success: false, error: "This question isn't open for an answer yet." };
  }

  const match = await assertMinistryMatch(eventId, participantId, q.directed_to_ministry);
  if (!match.ok) return { success: false, error: match.error };

  const { error } = await match.supabase
    .from("questions")
    .update({ answer_summary: text })
    .eq("id", questionId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/questions`);
  revalidatePath(`/yip/me/ministry`);
  return { success: true, data: null };
}

export async function ministerRespondToMotion(
  eventId: string,
  participantId: string,
  motionId: string,
  response: string
): Promise<ActionResult> {
  const text = response.trim();
  if (text.length < 3) return { success: false, error: "Response is too short." };
  if (text.length > 2000)
    return { success: false, error: "Response is too long (max 2000 characters)." };

  const pre = await requireLeadershipRole(participantId, eventId, MINISTRY_ANSWER_ROLES);
  if (!pre.ok) return { success: false, error: pre.error };
  const svc = await createServiceClient();
  const { data: m } = await svc
    .from("motions")
    .select("id, directed_to_ministry, status")
    .eq("id", motionId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!m) return { success: false, error: "Motion not found for this event" };
  // Don't respond once the Speaker/organiser has closed the motion.
  if (["resolved", "rejected"].includes(m.status)) {
    return { success: false, error: "This motion is closed." };
  }

  const match = await assertMinistryMatch(eventId, participantId, m.directed_to_ministry);
  if (!match.ok) return { success: false, error: match.error };

  const { error } = await match.supabase
    .from("motions")
    .update({ minister_response: text })
    .eq("id", motionId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/ministry`);
  return { success: true, data: null };
}
