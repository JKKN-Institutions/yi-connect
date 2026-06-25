"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  requireLeadershipRole,
  PRESIDING_ROLES,
} from "@/lib/yip/auth/leadership";
import { revalidatePath } from "next/cache";
import { isHouseVoteMotionType, HOUSE_VOTE_MOTION_TYPES } from "@/lib/yip/motions";
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

// Motion types decided by a whole-House Aye/Nay/Abstain floor vote (not a
// Speaker-typed tally). Both reuse the exact same vote machinery; impeach adds
// a post-pass role swap (see speakerRecordMotionVote). Sourced from the shared
// lib so the Speaker and organiser paths agree on what goes to a House vote.
const HOUSE_VOTE_MOTIONS = HOUSE_VOTE_MOTION_TYPES;
const isHouseVoteMotion = isHouseVoteMotionType;

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
      status: isHouseVoteMotion(r.motion.motion_type) ? "voting" : "discussing",
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

/** Open the House floor vote for a No-Confidence OR Impeach-the-Speaker motion. */
export async function speakerOpenMotionVote(
  eventId: string,
  participantId: string,
  motionId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const r = await loadMotionForSpeaker(eventId, participantId, motionId);
  if (!r.ok) return { success: false, error: r.error };
  if (!isHouseVoteMotion(r.motion.motion_type)) {
    return { success: false, error: "Only a No-Confidence or Impeach motion goes to a House vote." };
  }
  if (r.motion.status !== "voting") {
    return { success: false, error: "Admit the motion before opening the vote." };
  }
  const supabase = r.supabase;
  const motionType = r.motion.motion_type;
  const defaultSubject =
    motionType === "impeach_speaker" ? "Impeach the Speaker" : "No-Confidence Motion";

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
      // The session's vote_type mirrors the motion type so the House ballot,
      // tally, and reveal all key off the same value (both validate as
      // aye/nay/abstain). impeach_speaker triggers the role swap at reveal.
      vote_type: motionType,
      status: "open",
      opened_at: new Date().toISOString(),
      config: { motionId, motionSubject: motionRow?.subject ?? defaultSubject },
    })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to open the vote." };
  }

  revalidatePath(`/yip/me/speaker`);
  return { success: true, data: { sessionId: data.id } };
}

/** Live floor-vote state for each House-voted motion (No-Confidence / Impeach) that is open/closed. */
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
    .in("vote_type", [...HOUSE_VOTE_MOTIONS])
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
 * Reveal a No-Confidence OR Impeach result: COUNT the House's real ballots,
 * write the motion tally + outcome, and close the floor vote. No hand-entered
 * numbers. For a PASSED impeach_speaker, also vacate the Speaker/Deputy and open
 * a Speaker re-election (see vacateAndReElectSpeaker).
 */
export async function speakerRecordMotionVote(
  eventId: string,
  participantId: string,
  motionId: string
): Promise<
  ActionResult<{
    outcome: "passed" | "rejected";
    tally: MotionVoteTally;
    reElection?: ImpeachReElection | null;
  }>
> {
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
    .in("vote_type", [...HOUSE_VOTE_MOTIONS])
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

  // ── Impeach passed → depose Speaker + Deputy to their Ex- roles ──────────
  // They keep their leadership points; the organiser then runs a fresh Speaker
  // nomination for the replacement (who also scores). No auto re-election.
  // Best-effort: a failure here must not unwind the recorded impeach result.
  let reElection: ImpeachReElection | null = null;
  if (r.motion.motion_type === "impeach_speaker" && outcome === "passed") {
    reElection = await vacateAndReElectSpeaker(supabase, eventId);
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/motions`);
  revalidatePath(`/yip/me/speaker`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { outcome, tally, reElection } };
}

// ─── Impeach pass → depose the sitting Speaker/Deputy to their Ex- roles ─────
//
// Deposing them (not resetting to mp) preserves their leadership points. The
// replacement is then chosen by the organiser through the normal Speaker
// nomination + election (revealResults("speaker_election") in voting.ts), so
// the new Speaker is a real choice rather than a re-vote on the deposed
// officers. `electionOpened` is therefore always false here.
export type ImpeachReElection = {
  vacated: number;
  electionOpened: boolean;
  reason?: string;
};

async function vacateAndReElectSpeaker(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<ImpeachReElection> {
  // DEPOSE the sitting Speaker → ex_speaker and Deputy → ex_deputy_speaker
  // (per-role so each keeps the correct Ex-). They retain their leadership
  // points; the organiser then runs a FRESH Speaker nomination + election so
  // the replacement is a real choice — re-voting on the deposed officers would
  // just revert the Ex- status. We never auto-open the replacement here, so
  // electionOpened is always false (the caller/UI already handle that value).
  const { data: exSpeaker } = await supabase
    .from("participants")
    .update({ parliament_role: "ex_speaker" })
    .eq("event_id", eventId)
    .eq("parliament_role", "speaker")
    .select("id");
  const { data: exDeputy } = await supabase
    .from("participants")
    .update({ parliament_role: "ex_deputy_speaker" })
    .eq("event_id", eventId)
    .eq("parliament_role", "deputy_speaker")
    .select("id");
  const vacated = (exSpeaker ?? []).length + (exDeputy ?? []).length;

  return { vacated, electionOpened: false, reason: "manual_reelection" };
}
