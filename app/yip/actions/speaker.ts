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

// ─── No-Confidence: real House floor vote ─────────────────────────
// A No-Confidence motion is decided by the whole House voting Aye/Nay/Abstain
// from their phones (reusing the bill-vote machinery), not a Speaker-typed
// tally. The Speaker opens the floor vote, the House votes, then the Speaker
// reveals the result — COUNTED from yip.votes.

export type MotionVoteTally = {
  for: number;
  against: number;
  abstain: number;
  total: number;
};

export type MotionVoteState = {
  motionId: string;
  sessionId: string;
  status: string; // open | closed | revealed
  tally: MotionVoteTally;
};

/** Count this session's Aye/Nay/Abstain ballots (session-scoped, never mixed). */
async function countSessionTally(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  sessionId: string
): Promise<MotionVoteTally> {
  const { data } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string
          ) => Promise<{ data: { vote_value: string }[] | null }>;
        };
      };
    }
  )
    .from("votes")
    .select("vote_value")
    .eq("session_id", sessionId);

  let f = 0,
    a = 0,
    ab = 0;
  for (const v of data ?? []) {
    if (v.vote_value === "aye") f++;
    else if (v.vote_value === "nay") a++;
    else if (v.vote_value === "abstain") ab++;
  }
  return { for: f, against: a, abstain: ab, total: (data ?? []).length };
}

/** Open the House floor vote for a No-Confidence motion. */
export async function speakerOpenMotionVote(
  eventId: string,
  participantId: string,
  motionId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.motion_type !== "no_confidence") {
    return { success: false, error: "Only a No-Confidence motion goes to a House vote." };
  }
  if (r.motion.status !== "voting") {
    return { success: false, error: "Admit the motion before opening the vote." };
  }
  const supabase = r.supabase;

  // One active vote session at a time (mirrors openVote) — don't let the motion
  // vote collide with a bill vote / election.
  const { data: existing } = await supabase
    .from("vote_sessions")
    .select("id")
    .eq("event_id", eventId)
    .in("status", ["open", "closed"])
    .maybeSingle();
  if (existing) {
    return { success: false, error: "Close the current vote before opening this one." };
  }

  // vote_sessions.agenda_item_id is NOT NULL → attach to the live agenda item;
  // the motion is identified by config.motionId.
  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.current_agenda_item_id) {
    return { success: false, error: "Start an agenda item before opening the floor vote." };
  }

  // Carry the motion subject in config so the House vote screen can show it
  // without a separate (RLS-gated) motions read on the browser client.
  const { data: motionRow } = await supabase
    .from("motions")
    .select("subject")
    .eq("id", motionId)
    .eq("event_id", eventId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("vote_sessions")
    .insert({
      event_id: eventId,
      agenda_item_id: event.current_agenda_item_id,
      vote_type: "no_confidence",
      status: "open",
      opened_at: new Date().toISOString(),
      config: { motionId, motionSubject: motionRow?.subject ?? "No-Confidence Motion" },
    })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to open the vote." };
  }

  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: { sessionId: data.id } };
}

/** Live floor-vote state for each No-Confidence motion that is open/closed. */
export async function getNoConfidenceVoteState(
  eventId: string,
  participantId: string
): Promise<ActionResult<Record<string, MotionVoteState>>> {
  const gate = await requireLeadershipRole(participantId, eventId, PRESIDING_ROLES);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();
  const { data: sessions } = await supabase
    .from("vote_sessions")
    .select("id, status, config")
    .eq("event_id", eventId)
    .eq("vote_type", "no_confidence")
    .in("status", ["open", "closed"])
    .order("opened_at", { ascending: false });

  const map: Record<string, MotionVoteState> = {};
  for (const s of sessions ?? []) {
    const cfg = (s.config ?? {}) as { motionId?: string };
    if (!cfg.motionId || map[cfg.motionId]) continue; // keep the latest per motion
    const tally = await countSessionTally(supabase, s.id);
    map[cfg.motionId] = {
      motionId: cfg.motionId,
      sessionId: s.id,
      status: s.status as string,
      tally,
    };
  }
  return { success: true, data: map };
}

/**
 * Reveal a No-Confidence result: COUNT the House's real ballots, write the
 * motion tally + outcome, and close the floor vote. No hand-entered numbers.
 */
export async function speakerRecordMotionVote(
  eventId: string,
  participantId: string,
  motionId: string
): Promise<ActionResult<{ outcome: "passed" | "rejected"; tally: MotionVoteTally }>> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (r.motion.status !== "voting") {
    return { success: false, error: "This motion is not open for a vote." };
  }
  const supabase = r.supabase;

  const { data: sessions } = await supabase
    .from("vote_sessions")
    .select("id, status, config")
    .eq("event_id", eventId)
    .eq("vote_type", "no_confidence")
    .in("status", ["open", "closed"])
    .order("opened_at", { ascending: false });
  const session = (sessions ?? []).find((s) => {
    const cfg = (s.config ?? {}) as { motionId?: string };
    return cfg.motionId === motionId;
  });
  if (!session) {
    return { success: false, error: "Open the floor vote first." };
  }

  const tally = await countSessionTally(supabase, session.id);
  // Majority decides; a tie keeps confidence (the Government stands unless a
  // majority votes Aye for the no-confidence motion).
  const outcome: "passed" | "rejected" = tally.for > tally.against ? "passed" : "rejected";

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("motions")
    .update({
      votes_for: tally.for,
      votes_against: tally.against,
      votes_abstain: tally.abstain,
      outcome,
      status: "resolved",
      resolved_at: nowIso,
    })
    .eq("id", motionId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  // Close the floor vote so the House stops seeing it.
  await supabase
    .from("vote_sessions")
    .update({ status: "revealed", revealed_at: nowIso, closed_at: nowIso })
    .eq("id", session.id);

  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: { outcome, tally } };
}
