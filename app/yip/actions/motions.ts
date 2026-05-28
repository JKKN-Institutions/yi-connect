"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
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
  revalidatePath(`/dashboard/events/${input.event_id}/motions`);
  return { success: true, data: data as Motion };
}

export async function admitMotion(
  motionId: string,
  speakerNote?: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id, motion_type")
    .eq("id", motionId)
    .single();

  const { error } = await supabase
    .from("motions")
    .update({
      status: motion?.motion_type === "no_confidence" ? "voting" : "discussing",
      speaker_ruling: "admitted",
      speaker_note: speakerNote ?? null,
      ruled_at: new Date().toISOString(),
      ruled_by: user?.id ?? null,
    })
    .eq("id", motionId);

  if (error) return { success: false, error: error.message };
  if (motion) revalidatePath(`/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: null };
}

export async function rejectMotion(
  motionId: string,
  speakerNote: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: motion } = await supabase
    .from("motions")
    .select("event_id")
    .eq("id", motionId)
    .single();

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
  if (motion) revalidatePath(`/dashboard/events/${motion.event_id}/motions`);
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
  revalidatePath(`/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: { outcome } };
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
  if (motion) revalidatePath(`/dashboard/events/${motion.event_id}/motions`);
  return { success: true, data: null };
}

export async function deleteMotion(
  motionId: string,
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("motions").delete().eq("id", motionId);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "motions",
    target_id: motionId,
    target_event_id: eventId,
  });
  revalidatePath(`/dashboard/events/${eventId}/motions`);
  return { success: true, data: null };
}

// ─── Participant-side motion actions ───────────────────────────────

export async function raiseMotion(input: {
  eventId: string;
  participantId: string;
  motionType: MotionType;
  subject: string;
  details: string;
  directedToMinistry:
    | "home"
    | "finance"
    | "education"
    | "health"
    | "women_child"
    | "disaster_management"
    | "youth_sports"
    | "it_digital"
    | null;
}): Promise<ActionResult<{ id: string }>> {
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
    .select("id")
    .eq("id", input.eventId)
    .single();
  if (!event) return { success: false, error: "Event not found" };

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
