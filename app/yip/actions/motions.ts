"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { revalidatePath } from "next/cache";
import { isHouseVoteMotionType } from "@/lib/yip/motions";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import type { MotionType, MotionStatus } from "@/lib/yip/motions";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type Motion = {
  id: string;
  event_id: string;
  agenda_item_id: string | null;
  motion_type: MotionType;
  status: MotionStatus;
  raised_by_id: string | null;
  raised_by_name: string | null;
  raised_by_role: string | null;
  raised_by_party_side: string | null;
  directed_to_id: string | null;
  directed_to_ministry: string | null;
  subject: string;
  details: string | null;
  speaker_ruling: string | null;
  speaker_note: string | null;
  ruled_at: string | null;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  outcome: string | null;
  minister_response: string | null;
  resolution_note: string | null;
  raised_at: string;
  resolved_at: string | null;
};

export async function listMotions(
  eventId: string,
  filter?: { type?: MotionType; status?: MotionStatus }
): Promise<Motion[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("motions")
    .select("*")
    .eq("event_id", eventId)
    .order("raised_at", { ascending: false });

  if (filter?.type) q = q.eq("motion_type", filter.type);
  if (filter?.status) q = q.eq("status", filter.status);

  const { data } = await q;
  return (data ?? []) as Motion[];
}

export async function createMotion(input: {
  event_id: string;
  motion_type: MotionType;
  raised_by_id?: string | null;
  directed_to_id?: string | null;
  directed_to_ministry?: string | null;
  subject: string;
  details?: string | null;
  agenda_item_id?: string | null;
}): Promise<ActionResult<Motion>> {
  const access = await getYipEventAccess(input.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Denormalize raiser info for audit survival
  let raised_by_name: string | null = null;
  let raised_by_role: string | null = null;
  let raised_by_party_side: string | null = null;

  if (input.raised_by_id) {
    const { data: raiser } = await supabase
      .from("participants")
      .select("full_name, parliament_role, party_side")
      .eq("id", input.raised_by_id)
      .single();
    if (raiser) {
      raised_by_name = raiser.full_name;
      raised_by_role = raiser.parliament_role;
      raised_by_party_side = raiser.party_side;
    }
  }

  const { data, error } = await supabase
    .from("motions")
    .insert({
      event_id: input.event_id,
      motion_type: input.motion_type,
      raised_by_id: input.raised_by_id ?? null,
      raised_by_name,
      raised_by_role,
      raised_by_party_side: raised_by_party_side as "ruling" | "opposition" | null,
      directed_to_id: input.directed_to_id ?? null,
      directed_to_ministry: (input.directed_to_ministry ?? null) as never,
      subject: input.subject,
      details: input.details ?? null,
      agenda_item_id: input.agenda_item_id ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${input.event_id}/motions`);
  return { success: true, data: data as Motion };
}

export async function admitMotion(
  motionId: string,
  speakerNote?: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id, motion_type")
    .eq("id", motionId)
    .single();

  if (!motion) return { success: false, error: "Motion not found" };
  const access = await getYipEventAccess(motion.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("motions")
    .update({
      status:
        motion && isHouseVoteMotionType(motion.motion_type) ? "voting" : "discussing",
      speaker_ruling: "admitted",
      speaker_note: speakerNote ?? null,
      ruled_at: new Date().toISOString(),
      ruled_by: user?.id ?? null,
    })
    .eq("id", motionId);

  if (error) return { success: false, error: error.message };
  if (motion) revalidatePath(`/yip/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: null };
}

export async function rejectMotion(
  motionId: string,
  speakerNote: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id")
    .eq("id", motionId)
    .single();

  if (!motion) return { success: false, error: "Motion not found" };
  const access = await getYipEventAccess(motion.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("motions")
    .update({
      status: "rejected",
      speaker_ruling: "rejected",
      speaker_note: speakerNote,
      ruled_at: new Date().toISOString(),
      ruled_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", motionId);

  if (error) return { success: false, error: error.message };
  if (motion) revalidatePath(`/yip/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: null };
}

export async function recordMotionVote(
  motionId: string,
  votes: { for: number; against: number; abstain: number }
): Promise<ActionResult<{ outcome: "passed" | "rejected" }>> {
  const supabase = await createServiceClient();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id, motion_type")
    .eq("id", motionId)
    .single();

  if (!motion) return { success: false, error: "Motion not found" };
  const access = await getYipEventAccess(motion.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  // Majority decides. Ties count as rejected (Speaker's casting vote convention).
  const outcome = votes.for > votes.against ? "passed" : "rejected";

  const { error } = await supabase
    .from("motions")
    .update({
      votes_for: votes.for,
      votes_against: votes.against,
      votes_abstain: votes.abstain,
      outcome,
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", motionId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: { outcome } };
}

/**
 * Organiser backup launcher for the DIGITAL House vote on an admitted
 * No-Confidence / Impeach-the-Speaker motion. Mirrors speaker.ts
 * `speakerOpenMotionVote` but gated by canManage instead of the presiding-officer
 * role — so the digital vote doesn't depend on a student Speaker driving it.
 * Opens a vote_session (delegates then vote Aye/Nay/Abstain on their phones);
 * `revealResults` already writes the tally back onto the motion + resolves it.
 */
export async function organiserOpenMotionVote(
  eventId: string,
  motionId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = await createServiceClient();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id, motion_type, status, subject")
    .eq("id", motionId)
    .single();
  if (!motion) return { success: false, error: "Motion not found" };
  if (motion.event_id !== eventId)
    return { success: false, error: "Motion does not belong to this event" };

  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  if (!isHouseVoteMotionType(motion.motion_type))
    return {
      success: false,
      error: "Only a No-Confidence or Impeach motion goes to a House vote.",
    };
  if (motion.status !== "voting")
    return { success: false, error: "Admit the motion before opening the vote." };

  // One active vote session at a time (mirrors openVote / speakerOpenMotionVote).
  const { data: existing } = await supabase
    .from("vote_sessions")
    .select("id")
    .eq("event_id", eventId)
    .in("status", ["open", "closed"])
    .maybeSingle();
  if (existing)
    return { success: false, error: "Close the current vote before opening this one." };

  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.current_agenda_item_id)
    return { success: false, error: "Start an agenda item before opening the floor vote." };

  const defaultSubject =
    motion.motion_type === "impeach_speaker"
      ? "Impeach the Speaker"
      : "No-Confidence Motion";

  const { data, error } = await supabase
    .from("vote_sessions")
    .insert({
      event_id: eventId,
      agenda_item_id: event.current_agenda_item_id,
      // vote_type mirrors the motion type so the House ballot, tally + reveal
      // all key off the same value (validated as aye/nay/abstain).
      vote_type: motion.motion_type,
      status: "open",
      opened_at: new Date().toISOString(),
      config: { motionId, motionSubject: motion.subject ?? defaultSubject },
    })
    .select("id")
    .single();
  if (error || !data)
    return { success: false, error: error?.message ?? "Failed to open the vote." };

  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { sessionId: data.id } };
}

export async function recordMinisterResponse(
  motionId: string,
  response: string,
  resolve: boolean = true
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id")
    .eq("id", motionId)
    .single();

  if (!motion) return { success: false, error: "Motion not found" };
  const access = await getYipEventAccess(motion.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const update: {
    minister_response: string;
    status?: MotionStatus;
    resolved_at?: string;
  } = { minister_response: response };
  if (resolve) {
    update.status = "resolved";
    update.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("motions")
    .update(update)
    .eq("id", motionId);

  if (error) return { success: false, error: error.message };
  if (motion) revalidatePath(`/yip/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: null };
}

export async function deleteMotion(
  motionId: string,
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can delete motions" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase.from("motions").delete().eq("id", motionId).eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "motions",
    target_id: motionId,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  return { success: true, data: null };
}

// ─── Participant-side motion actions ───────────────────────────────

export async function raiseMotion(input: {
  eventId: string;
  participantId: string;
  motionType: MotionType;
  subject: string;
  details: string;
  // A per-event cabinet portfolio KEY (events.cabinet_ministries) or null.
  // Free text now (directed_to_ministry is no longer the fixed enum) — validated
  // against the event's effective ministries below when a motion needs one.
  directedToMinistry: string | null;
}): Promise<ActionResult<{ id: string }>> {
  // Participant self-service (a student raises a motion). Verify the session
  // owns participantId — NOT canManage (that's the organiser gate and would
  // wrongly block the very participant this action is for).
  const sess = await requireParticipantSession(input.participantId, input.eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  // No-Confidence is the Leader of Opposition's instrument only — it must go
  // through moveNoConfidence (which enforces the LoP role + the one-active cap),
  // never the general student raise-a-motion path.
  if (input.motionType === "no_confidence") {
    return {
      success: false,
      error: "A No-Confidence motion can only be moved by the Leader of Opposition.",
    };
  }

  const supabase = await createServiceClient();

  if (!input.subject || input.subject.trim().length < 5) {
    return { success: false, error: "Subject must be at least 5 characters" };
  }
  if (!input.details || input.details.trim().length < 20) {
    return { success: false, error: "Details must be at least 20 characters" };
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id, full_name, party_side, parliament_role, event_id")
    .eq("id", input.participantId)
    .single();
  if (!participant || participant.event_id !== input.eventId) {
    return { success: false, error: "Participant not found or event mismatch" };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, cabinet_ministries")
    .eq("id", input.eventId)
    .single();
  if (!event) return { success: false, error: "Event not found" };

  // When a ministry is supplied it must be one of the event's effective cabinet
  // portfolios (custom override or handbook default). directed_to_ministry is
  // free text now, so this app gate is the only constraint. Fail closed.
  if (input.directedToMinistry) {
    const validKeys = new Set(
      effectiveMinistries(event.cabinet_ministries).map((m) => m.key)
    );
    if (!validKeys.has(input.directedToMinistry)) {
      return { success: false, error: "Please select a valid ministry for this event." };
    }
  }

  const { data, error } = await supabase
    .from("motions")
    .insert({
      event_id: input.eventId,
      motion_type: input.motionType,
      subject: input.subject.trim(),
      details: input.details.trim(),
      directed_to_ministry: input.directedToMinistry,
      raised_by_id: participant.id,
      raised_by_name: participant.full_name,
      raised_by_party_side: participant.party_side,
      raised_by_role: participant.parliament_role,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to raise motion" };
  }

  revalidatePath("/me/motion");
  return { success: true, data: { id: data.id } };
}

export async function getMyMotions(
  eventId: string,
  participantId: string
): Promise<Motion[]> {
  // Only the student themselves may read their own motions.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return [];
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("motions")
    .select("*")
    .eq("event_id", eventId)
    .eq("raised_by_id", participantId)
    .order("raised_at", { ascending: false });
  return ((data as unknown) as Motion[]) ?? [];
}

export async function getEventMotionCutoff(
  eventId: string
): Promise<string | null> {
  // No motions_cutoff_at column on events yet; placeholder for future migration.
  void eventId;
  return null;
}
