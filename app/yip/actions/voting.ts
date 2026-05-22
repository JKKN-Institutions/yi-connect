"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import type { Tables, Json } from "@/types/yip/database";

type VoteSession = Tables<"vote_sessions">;
type Vote = Tables<"votes">;

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

export interface VoteTally {
  vote_value: string;
  count: number;
}

export interface VoteResults {
  session: VoteSession;
  tallies: VoteTally[];
  totalVotes: number;
  totalParticipants: number;
  winner?: string | null;
}

// ─── Open Vote ──────────────────────────────────────────────────

export async function openVote(
  eventId: string,
  agendaItemId: string,
  voteType: "speaker_election" | "bill_vote",
  config?: { candidateIds?: string[]; billId?: string }
): Promise<ActionResult<{ sessionId: string }>> {
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

  const results: VoteResults = {
    session: { ...session, status: "revealed" },
    tallies,
    totalVotes,
    totalParticipants: totalParticipants ?? 0,
    winner,
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

  if (session.status !== "open") {
    return {
      success: true,
      data: { status: "closed" },
    };
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

  return {
    success: true,
    data: {
      session,
      tallies,
      totalVotes,
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

// ─── Check If Participant Has Voted ─────────────────────────────

export async function hasParticipantVoted(
  agendaItemId: string,
  participantId: string
): Promise<boolean> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("votes")
    .select("id")
    .eq("agenda_item_id", agendaItemId)
    .eq("participant_id", participantId)
    .maybeSingle();

  return !!data;
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
