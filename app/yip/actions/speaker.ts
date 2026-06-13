"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  requireLeadershipRole,
  PRESIDING_ROLES,
} from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";
import type { Motion } from "@/app/yip/actions/motions";

/**
 * Speaker / Deputy Speaker motion-processing actions (student presiding officer).
 *
 * Mirrors the field-writes of the organiser actions in app/yip/actions/motions.ts
 * (admitMotion / rejectMotion / recordMotionVote) but gated to the presiding
 * participant via requireLeadershipRole. Both the Speaker AND the organiser may
 * act on a motion; the organiser can overrule (last-write-wins, no locking —
 * product-owner decision 2026-06-13). `ruled_by` is set to the SPEAKER's
 * participant id for provenance (participants have no auth user).
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/** All motions for the event — the presiding officer's queue. Participant + role gated. */
export async function getSpeakerMotions(
  eventId: string,
  participantId: string
): Promise<ActionResult<Motion[]>> {
  const gate = await requireLeadershipRole(participantId, eventId, PRESIDING_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("motions")
    .select("*")
    .eq("event_id", eventId)
    .order("raised_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as unknown as Motion[] };
}

type LoadedMotion =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServiceClient>>;
      motion: { id: string; event_id: string; motion_type: string; status: string };
      speakerId: string;
    }
  | { ok: false; error: string };

/** Gate + load a motion that belongs to this event (no cross-event IDOR). */
async function loadMotionForSpeaker(
  eventId: string,
  participantId: string,
  motionId: string
): Promise<LoadedMotion> {
  const gate = await requireLeadershipRole(participantId, eventId, PRESIDING_ROLES);
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createServiceClient();
  const { data: motion } = await supabase
    .from("motions")
    .select("id, event_id, motion_type, status")
    .eq("id", motionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!motion) return { ok: false, error: "Motion not found for this event" };
  return {
    ok: true,
    supabase,
    motion: motion as { id: string; event_id: string; motion_type: string; status: string },
    speakerId: participantId,
  };
}

export async function speakerAdmitMotion(
  eventId: string,
  participantId: string,
  motionId: string,
  speakerNote?: string
): Promise<ActionResult> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "submitted") {
    return { success: false, error: "This motion has already been processed." };
  }

  const { error } = await r.supabase
    .from("motions")
    .update({
      status: r.motion.motion_type === "no_confidence" ? "voting" : "discussing",
      speaker_ruling: "admitted",
      speaker_note: speakerNote ?? null,
      ruled_at: new Date().toISOString(),
      // motions.ruled_by FKs to auth.users(id); a participant (Speaker) has no
      // auth user, so writing the participant id violates the FK. Leave null —
      // the ruling is recorded via speaker_ruling / speaker_note / ruled_at.
      ruled_by: null,
    })
    .eq("id", motionId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: null };
}

export async function speakerRejectMotion(
  eventId: string,
  participantId: string,
  motionId: string,
  speakerNote: string
): Promise<ActionResult> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "submitted") {
    return { success: false, error: "This motion has already been processed." };
  }

  const now = new Date().toISOString();
  const { error } = await r.supabase
    .from("motions")
    .update({
      status: "rejected",
      speaker_ruling: "rejected",
      speaker_note: speakerNote,
      ruled_at: now,
      // ruled_by FKs to auth.users(id); a participant (Speaker) has no auth
      // row, so leave null (ruling recorded via speaker_ruling/speaker_note).
      ruled_by: null,
      resolved_at: now,
    })
    .eq("id", motionId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: null };
}

export async function speakerRecordMotionVote(
  eventId: string,
  participantId: string,
  motionId: string,
  votes: { for: number; against: number; abstain: number }
): Promise<ActionResult<{ outcome: "passed" | "rejected" }>> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "voting") {
    return { success: false, error: "This motion is not open for a vote." };
  }

  // Validate the tally — a forged call could send negatives / non-integers, and
  // 'resolved' is terminal with no re-open path, so a bad result would strand.
  if (![votes.for, votes.against, votes.abstain].every((n) => Number.isInteger(n) && n >= 0)) {
    return { success: false, error: "Vote counts must be whole, non-negative numbers." };
  }

  // Majority decides; a tie is rejected (Speaker's casting-vote convention) —
  // matches the organiser recordMotionVote.
  const outcome = votes.for > votes.against ? "passed" : "rejected";

  const { error } = await r.supabase
    .from("motions")
    .update({
      votes_for: votes.for,
      votes_against: votes.against,
      votes_abstain: votes.abstain,
      outcome,
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", motionId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: { outcome } };
}
