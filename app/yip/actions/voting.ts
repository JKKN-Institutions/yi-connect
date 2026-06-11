"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { validateVoteValue } from "@/lib/yip/vote-validate";
import {
  computeElectionOutcome,
  type VoteTally,
  type ElectionTie,
} from "@/lib/yip/election-outcome";
import type { Tables, Json } from "@/types/yip/database";

type VoteSession = Tables<{ schema: "yip" }, "vote_sessions">;
type Vote = Tables<{ schema: "yip" }, "votes">;

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Types ──────────────────────────────────────────────────────

export interface VoteCandidate {
  id: string;
  full_name: string;
  school_name: string;
  party_side: string | null;
  parliament_role: string | null;
}

export interface VoteSessionWithDetails extends VoteSession {
  bill?: {
    id: string;
    title: string;
    objective: string | null;
    party_side: string;
  } | null;
}

export interface VoteResults {
  session: VoteSession;
  tallies: VoteTally[];
  totalVotes: number;
  totalParticipants: number;
  winner?: string | null;
  // Speaker election only: #1 = Speaker, next 2 = Deputy Speakers (Director
  // ruling). Empty when a tie blocks a clean designation (see `tie`).
  speakerId?: string | null;
  deputySpeakerIds?: string[];
  // Party-leader election only: the elected leader's participant id.
  partyLeaderId?: string | null;
  // Present when an exact tie at a seat boundary needs a runoff. When set, no
  // roles/party-leader are written — the organiser opens a runoff first.
  tie?: ElectionTie | null;
}

// ─── Open Vote ──────────────────────────────────────────────────

export async function openVote(
  eventId: string,
  agendaItemId: string,
  voteType: "speaker_election" | "bill_vote" | "party_leader",
  config?: {
    candidateIds?: string[];
    billId?: string;
    // party_leader only: the party whose leader is being elected. Voting is
    // restricted to that party's own members.
    partyId?: string;
    // Marks a session opened as a tie runoff (UI hint only).
    isRunoff?: boolean;
    runoffOf?: string;
  }
): Promise<ActionResult<{ sessionId: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Check for existing active session
  const { data: existing } = await supabase
    .from("vote_sessions")
    .select("id")
    .eq("event_id", eventId)
    .in("status", ["open", "closed"])
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: "There is already an active vote session. Close or reveal it first.",
    };
  }

  const insertData: {
    event_id: string;
    agenda_item_id: string;
    vote_type: string;
    status: string;
    opened_at: string;
    config: Json;
    bill_id?: string;
  } = {
    event_id: eventId,
    agenda_item_id: agendaItemId,
    vote_type: voteType,
    status: "open",
    opened_at: new Date().toISOString(),
    config: (config ?? {}) as Json,
  };

  if (config?.billId) {
    insertData.bill_id = config.billId;
  }

  const { data, error } = await supabase
    .from("vote_sessions")
    .insert(insertData)
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to open vote session" };
  }

  return { success: true, data: { sessionId: data.id } };
}

// ─── Close Vote ─────────────────────────────────────────────────

export async function closeVote(
  sessionId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Resolve event_id from the session, then gate (organiser-control).
  const { data: voteSession } = await supabase
    .from("vote_sessions")
    .select("event_id")
    .eq("id", sessionId)
    .single();

  if (!voteSession) return { success: false, error: "Vote session not found" };

  const access = await getYipEventAccess(voteSession.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const { error } = await supabase
    .from("vote_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "open");

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── Reveal Results ─────────────────────────────────────────────

export async function revealResults(
  sessionId: string
): Promise<ActionResult<VoteResults>> {
  const supabase = await createServiceClient();

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from("vote_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return { success: false, error: "Vote session not found" };
  }

  // Gate organiser-control BEFORE mutating the session status.
  const access = await getYipEventAccess(session.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  // Update status to revealed
  await supabase
    .from("vote_sessions")
    .update({
      status: "revealed",
      revealed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  // Get tallies
  const { data: votes } = await supabase
    .from("votes")
    .select("vote_value")
    .eq("agenda_item_id", session.agenda_item_id)
    .eq("vote_type", session.vote_type);

  // Count votes by value
  const tallyMap: Record<string, number> = {};
  (votes ?? []).forEach((v) => {
    tallyMap[v.vote_value] = (tallyMap[v.vote_value] || 0) + 1;
  });

  const tallies: VoteTally[] = Object.entries(tallyMap)
    .map(([vote_value, count]) => ({ vote_value, count }))
    .sort((a, b) => b.count - a.count);

  // Count total participants for this event
  const { count: totalParticipants } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", session.event_id)
    .eq("checked_in", true);

  const totalVotes = (votes ?? []).length;
  const winner = tallies.length > 0 ? tallies[0].vote_value : null;

  // If bill vote, update bill record with vote counts
  if (session.vote_type === "bill_vote" && session.bill_id) {
    const votesFor = tallyMap["aye"] || 0;
    const votesAgainst = tallyMap["nay"] || 0;
    const votesAbstain = tallyMap["abstain"] || 0;

    const billStatus = votesFor > votesAgainst ? "passed" : "rejected";

    await supabase
      .from("bills")
      .update({
        votes_for: votesFor,
        votes_against: votesAgainst,
        votes_abstain: votesAbstain,
        status: billStatus,
      })
      .eq("id", session.bill_id);
  }

  // Designate seats from the tally and persist what is unambiguously decided.
  const outcome = computeElectionOutcome(session.vote_type, tallies);

  if (session.vote_type === "speaker_election" && outcome.speakerId) {
    // A Speaker was decided (no Speaker-seat tie). Reset all current Speaker /
    // Deputy candidates for this event to plain MP, then assign the winners.
    // Scoped to speaker/deputy_speaker so PM / LoP / ministers are untouched.
    await supabase
      .from("participants")
      .update({ parliament_role: "mp" })
      .eq("event_id", session.event_id)
      .in("parliament_role", ["speaker", "deputy_speaker"]);
    await supabase
      .from("participants")
      .update({ parliament_role: "speaker" })
      .eq("id", outcome.speakerId);
    if (outcome.deputyIds.length > 0) {
      await supabase
        .from("participants")
        .update({ parliament_role: "deputy_speaker" })
        .in("id", outcome.deputyIds);
    }
  }

  if (session.vote_type === "party_leader" && outcome.partyLeaderId) {
    const cfg = (session.config ?? {}) as { partyId?: string };
    if (cfg.partyId) {
      await supabase
        .from("parties")
        .update({ party_leader_id: outcome.partyLeaderId })
        .eq("id", cfg.partyId);
    }
  }

  const results: VoteResults = {
    session: { ...session, status: "revealed" },
    tallies,
    totalVotes,
    totalParticipants: totalParticipants ?? 0,
    winner,
    speakerId: outcome.speakerId,
    deputySpeakerIds: outcome.deputyIds,
    partyLeaderId: outcome.partyLeaderId,
    tie: outcome.tie,
  };

  return { success: true, data: results };
}

// ─── Cast Vote ──────────────────────────────────────────────────

export async function castVote(
  sessionId: string,
  participantId: string,
  voteValue: string
): Promise<ActionResult<{ status: "success" | "already_voted" | "closed" }>> {
  const supabase = await createServiceClient();

  // Get the session
  const { data: session } = await supabase
    .from("vote_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { success: false, error: "Vote session not found" };
  }

  // Participant self-service: verify the voter owns this participantId for this event.
  const sess = await requireParticipantSession(participantId, session.event_id);
  if (!sess.ok) return { success: false, error: sess.error };

  if (session.status !== "open") {
    return {
      success: true,
      data: { status: "closed" },
    };
  }

  // Reject junk / non-candidate values before they pollute the tally.
  const valid = validateVoteValue(session, voteValue);
  if (!valid.ok) return { success: false, error: valid.error };

  // Party-leader elections are party-scoped: only members of the party whose
  // leader is being elected may vote. (Director ruling: each party elects its
  // own leader, party members only.)
  if (session.vote_type === "party_leader") {
    const cfg = (session.config ?? {}) as { partyId?: string };
    if (cfg.partyId) {
      const { data: voter } = await supabase
        .from("participants")
        .select("party_id")
        .eq("id", participantId)
        .single();
      if (!voter || voter.party_id !== cfg.partyId) {
        return {
          success: false,
          error: "Only members of this party can vote for its leader",
        };
      }
    }
  }

  // Check if already voted (via unique constraint)
  const { data: existingVote } = await supabase
    .from("votes")
    .select("id")
    .eq("agenda_item_id", session.agenda_item_id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingVote) {
    return {
      success: true,
      data: { status: "already_voted" },
    };
  }

  // Cast the vote
  const { error } = await supabase.from("votes").insert({
    event_id: session.event_id,
    agenda_item_id: session.agenda_item_id,
    participant_id: participantId,
    vote_type: session.vote_type,
    vote_value: voteValue,
  });

  if (error) {
    // Handle unique constraint violation
    if (error.code === "23505") {
      return { success: true, data: { status: "already_voted" } };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: { status: "success" } };
}

// ─── Get Active Vote Session ────────────────────────────────────

export async function getVoteSession(
  eventId: string
): Promise<VoteSessionWithDetails | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("vote_sessions")
    .select(
      `
      *,
      bill:bills(id, title, objective, party_side)
    `
    )
    .eq("event_id", eventId)
    .in("status", ["open", "closed", "revealed"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data as unknown as VoteSessionWithDetails;
}

// ─── Get Vote Results ───────────────────────────────────────────

export async function getVoteResults(
  sessionId: string
): Promise<ActionResult<VoteResults>> {
  const supabase = await createServiceClient();

  const { data: session } = await supabase
    .from("vote_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { success: false, error: "Vote session not found" };
  }

  // Get tallies
  const { data: votes } = await supabase
    .from("votes")
    .select("vote_value")
    .eq("agenda_item_id", session.agenda_item_id)
    .eq("vote_type", session.vote_type);

  const tallyMap: Record<string, number> = {};
  (votes ?? []).forEach((v) => {
    tallyMap[v.vote_value] = (tallyMap[v.vote_value] || 0) + 1;
  });

  const tallies: VoteTally[] = Object.entries(tallyMap)
    .map(([vote_value, count]) => ({ vote_value, count }))
    .sort((a, b) => b.count - a.count);

  const { count: totalParticipants } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", session.event_id)
    .eq("checked_in", true);

  const totalVotes = (votes ?? []).length;
  const winner = tallies.length > 0 ? tallies[0].vote_value : null;
  const outcome = computeElectionOutcome(session.vote_type, tallies);

  return {
    success: true,
    data: {
      session,
      tallies,
      totalVotes,
      speakerId: outcome.speakerId,
      deputySpeakerIds: outcome.deputyIds,
      partyLeaderId: outcome.partyLeaderId,
      tie: outcome.tie,
      totalParticipants: totalParticipants ?? 0,
      winner,
    },
  };
}

// ─── Get Speaker Candidates ─────────────────────────────────────

export async function getSpeakerCandidates(
  eventId: string
): Promise<VoteCandidate[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, school_name, party_side, parliament_role")
    .eq("event_id", eventId)
    .eq("parliament_role", "speaker");

  if (error || !data) return [];
  return data;
}

// ─── Get Bills for Voting ───────────────────────────────────────

export async function getEventBills(
  eventId: string
): Promise<
  Array<{
    id: string;
    title: string;
    objective: string | null;
    party_side: string;
    status: string | null;
  }>
> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bills")
    .select("id, title, objective, party_side, status")
    .eq("event_id", eventId)
    .in("status", ["submitted", "approved", "presented"]);

  if (error || !data) return [];
  return data;
}

// ─── Get Live Vote Counts (for organizer) ───────────────────────

export async function getLiveVoteCounts(
  sessionId: string
): Promise<ActionResult<{ tallies: VoteTally[]; totalVotes: number }>> {
  const supabase = await createServiceClient();

  const { data: session } = await supabase
    .from("vote_sessions")
    .select("agenda_item_id, vote_type")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("vote_value")
    .eq("agenda_item_id", session.agenda_item_id)
    .eq("vote_type", session.vote_type);

  const tallyMap: Record<string, number> = {};
  (votes ?? []).forEach((v) => {
    tallyMap[v.vote_value] = (tallyMap[v.vote_value] || 0) + 1;
  });

  const tallies: VoteTally[] = Object.entries(tallyMap)
    .map(([vote_value, count]) => ({ vote_value, count }))
    .sort((a, b) => b.count - a.count);

  return {
    success: true,
    data: {
      tallies,
      totalVotes: (votes ?? []).length,
    },
  };
}

// ─── Has the current participant voted? ─────────────────────────────
//
// After the votes RLS was tightened to "readable only when revealed", the
// browser client can no longer check a student's own vote during an OPEN
// session. This participant-gated server action restores that check via the
// service client — it returns ONLY a boolean for the caller's own id, never
// any other student's vote or the running tally.
export async function hasParticipantVoted(
  sessionId: string,
  participantId: string
): Promise<ActionResult<{ hasVoted: boolean }>> {
  const supabase = await createServiceClient();

  const { data: session } = await supabase
    .from("vote_sessions")
    .select("event_id, agenda_item_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { success: false, error: "Vote session not found" };

  // Verify the caller owns this participant identity for this event.
  const sess = await requireParticipantSession(participantId, session.event_id);
  if (!sess.ok) return { success: false, error: sess.error };

  const { data: existing } = await supabase
    .from("votes")
    .select("id")
    .eq("agenda_item_id", session.agenda_item_id)
    .eq("participant_id", participantId)
    .maybeSingle();

  return { success: true, data: { hasVoted: Boolean(existing) } };
}

// ─── Parties (for Party-Leader elections) ───────────────────────

export interface PartyLite {
  id: string;
  name: string;
  side: string;
  party_number: number;
  party_leader_id: string | null;
  member_count: number;
}

export async function getEventParties(
  eventId: string
): Promise<PartyLite[]> {
  const supabase = await createServiceClient();
  const { data: parties } = await supabase
    .from("parties")
    .select("id, name, side, party_number, party_leader_id")
    .eq("event_id", eventId)
    .order("party_number");
  if (!parties) return [];

  // Member count per party (for the organiser's nomination UI).
  const { data: members } = await supabase
    .from("participants")
    .select("party_id")
    .eq("event_id", eventId);
  const counts: Record<string, number> = {};
  (members ?? []).forEach((m) => {
    if (m.party_id) counts[m.party_id] = (counts[m.party_id] ?? 0) + 1;
  });

  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    side: p.side,
    party_number: p.party_number,
    party_leader_id: p.party_leader_id,
    member_count: counts[p.id] ?? 0,
  }));
}

// ─── Party-Leader candidates (members of one party) ─────────────
// The organiser/YUVA nominates 3–5 of these on the floor; the chosen ids go
// into the party_leader vote session's config.candidateIds.
export async function getPartyMembers(
  eventId: string,
  partyId: string
): Promise<VoteCandidate[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, school_name, party_side, parliament_role")
    .eq("event_id", eventId)
    .eq("party_id", partyId)
    .order("full_name");
  if (error || !data) return [];
  return data;
}

// ─── Open a tie-runoff ──────────────────────────────────────────
// Opens a fresh election (same vote_type) restricted to ONLY the tied
// candidates, so the organiser can break a Speaker/Deputy/Party-Leader tie with
// a short 60-second vote (Director ruling). The original session must already
// be revealed (it is — the tie is surfaced at reveal time).
export async function openRunoff(
  revealedSessionId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = await createServiceClient();

  const { data: session } = await supabase
    .from("vote_sessions")
    .select("*")
    .eq("id", revealedSessionId)
    .single();
  if (!session) return { success: false, error: "Vote session not found" };

  const access = await getYipEventAccess(session.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  // Re-derive the tie from the current tally so the runoff ballot is exactly
  // the tied candidates (no trust in client-supplied ids).
  const { data: votes } = await supabase
    .from("votes")
    .select("vote_value")
    .eq("agenda_item_id", session.agenda_item_id)
    .eq("vote_type", session.vote_type);
  const tallyMap: Record<string, number> = {};
  (votes ?? []).forEach((v) => {
    tallyMap[v.vote_value] = (tallyMap[v.vote_value] || 0) + 1;
  });
  const tallies: VoteTally[] = Object.entries(tallyMap)
    .map(([vote_value, count]) => ({ vote_value, count }))
    .sort((a, b) => b.count - a.count);
  const outcome = computeElectionOutcome(session.vote_type, tallies);
  if (!outcome.tie || outcome.tie.tiedCandidateIds.length < 2) {
    return { success: false, error: "No tie to run off — nothing to do." };
  }

  const cfg = (session.config ?? {}) as { partyId?: string };
  return openVote(session.event_id, session.agenda_item_id, session.vote_type as
    | "speaker_election"
    | "bill_vote"
    | "party_leader", {
    candidateIds: outcome.tie.tiedCandidateIds,
    partyId: cfg.partyId,
    isRunoff: true,
    runoffOf: revealedSessionId,
  });
}
