"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";
import { assertCheckedInForVote } from "@/lib/yip/vote-eligibility";
import { validateVoteValue } from "@/lib/yip/vote-validate";
import {
  computeElectionOutcome,
  computeDeputyRunoffOutcome,
  computeMultiSeatOutcome,
  fillDeputiesFromParent,
  type VoteTally,
  type ElectionTie,
  type ElectionOutcome,
} from "@/lib/yip/election-outcome";
import type { Tables, Json } from "@/types/yip/database";

type VoteSession = Tables<{ schema: "yip" }, "vote_sessions">;
type Vote = Tables<{ schema: "yip" }, "votes">;

// ─── Untyped votes access (session_id not in generated types yet) ───
// yip.votes gained `session_id` in migration 20260612100000_yip_votes_session_scope,
// but types/yip/database.ts is not regenerated alongside (the supabase CLI
// appends a version banner that corrupts the generated file). Narrow,
// file-local accessor for the votes table only — the app/yip/actions/chat.ts
// pattern. Every other table in this file stays fully typed.
type VoteRowLite = { id?: string; vote_value: string; participant_id: string | null };
type VotesPgError = { code?: string; message: string };
type VotesTable = {
  select: (cols: string) => VotesTable;
  insert: (row: Record<string, unknown>) => Promise<{ error: VotesPgError | null }>;
  eq: (col: string, val: unknown) => VotesTable;
  is: (col: string, val: unknown) => VotesTable;
  maybeSingle: () => Promise<{ data: VoteRowLite | null; error: VotesPgError | null }>;
  then: Promise<{ data: VoteRowLite[] | null; error: VotesPgError | null }>["then"];
};
function votesTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): VotesTable {
  return (sb as unknown as { from: (t: string) => VotesTable }).from("votes");
}

// Shape of vote_sessions.config relevant to runoffs (stored by openRunoff).
type RunoffConfig = {
  partyId?: string;
  side?: "ruling" | "opposition";
  candidateIds?: string[];
  isRunoff?: boolean;
  runoffOf?: string;
  runoffSeat?:
    | "speaker"
    | "deputy"
    | "party_leader"
    | "prime_minister"
    | "deputy_prime_minister"
    | "leader_of_opposition"
    | "cabinet_minister"
    | "shadow_minister";
  openDeputySeats?: number;
  // Multi-seat (cabinet/shadow): seats to fill in this round.
  seats?: number;
};

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
  // Constituency (assigned at allocation; null before then) — exposed so the
  // nominee pickers can search by constituency name or number, not just name.
  constituency_name: string | null;
  constituency_number: number | null;
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

// ─── Tally helper ───────────────────────────────────────────────
//
// Builds the vote tally for a session. Party-leader elections run one party at
// a time, but the tally must NEVER mix two parties even if they happened to
// share an agenda_item_id: for vote_type === "party_leader" we count ONLY votes
// cast by members of config.partyId. speaker_election / bill_vote tallies are
// unscoped (every checked-in participant is eligible).
async function buildTallies(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  session: Pick<
    VoteSession,
    "id" | "agenda_item_id" | "vote_type" | "event_id" | "config"
  >
): Promise<{ tallies: VoteTally[]; totalVotes: number }> {
  // Votes are scoped to THIS session (migration 20260612100000): a runoff on
  // the same agenda item must never count round-1 ballots.
  const { data: votes } = await votesTable(supabase)
    .select("vote_value, participant_id")
    .eq("session_id", session.id);

  let scoped = votes ?? [];

  // LEGACY fallback: ballots cast before the session_id migration (or rows the
  // backfill could not unambiguously attribute) have session_id NULL. If this
  // session has no scoped ballots at all, fall back to the old agenda-item
  // query restricted to NULL session_id, so previously-revealed historical
  // results don't go blank. Post-migration ballots always carry session_id,
  // so they can never leak into another session through this path.
  if (scoped.length === 0) {
    const { data: legacy } = await votesTable(supabase)
      .select("vote_value, participant_id")
      .eq("agenda_item_id", session.agenda_item_id)
      .eq("vote_type", session.vote_type)
      .is("session_id", null);
    scoped = legacy ?? [];
  }

  if (
    session.vote_type === "party_leader" ||
    session.vote_type === "cabinet_minister" ||
    session.vote_type === "shadow_minister"
  ) {
    const cfg = (session.config ?? {}) as { partyId?: string };
    if (cfg.partyId) {
      // Party-scoped elections (party leader + the party's cabinet/shadow
      // ministers): keep only votes cast by that party's own members. One
      // query, no per-vote round-trips.
      const { data: members } = await supabase
        .from("participants")
        .select("id")
        .eq("event_id", session.event_id)
        .eq("party_id", cfg.partyId);
      const memberIds = new Set((members ?? []).map((m) => m.id));
      scoped = scoped.filter(
        (v) => v.participant_id != null && memberIds.has(v.participant_id)
      );
    }
  }

  // Single-winner bench elections (PM / Deputy PM / Leader of Opposition) are
  // bench-scoped: count ONLY votes cast by members of config.side's bench
  // (party_side). Mirrors the party_leader scoping above, by party_side instead
  // of party_id. The whole governing coalition (every ruling party) votes for
  // PM/Deputy; the whole opposition votes for LoP.
  if (
    session.vote_type === "prime_minister" ||
    session.vote_type === "deputy_prime_minister" ||
    session.vote_type === "leader_of_opposition"
  ) {
    const cfg = (session.config ?? {}) as { side?: "ruling" | "opposition" };
    if (cfg.side) {
      const { data: members } = await supabase
        .from("participants")
        .select("id")
        .eq("event_id", session.event_id)
        .eq("party_side", cfg.side);
      const memberIds = new Set((members ?? []).map((m) => m.id));
      scoped = scoped.filter(
        (v) => v.participant_id != null && memberIds.has(v.participant_id)
      );
    }
  }

  const tallyMap: Record<string, number> = {};
  scoped.forEach((v) => {
    tallyMap[v.vote_value] = (tallyMap[v.vote_value] || 0) + 1;
  });

  const tallies: VoteTally[] = Object.entries(tallyMap)
    .map(([vote_value, count]) => ({ vote_value, count }))
    .sort((a, b) => b.count - a.count);

  return { tallies, totalVotes: scoped.length };
}

// ─── Outcome resolution (runoff-aware) ──────────────────────────
//
// A runoff session re-runs ONE contested seat among only the tied candidates,
// so its tally must not be read with the plain "top 1 = Speaker" rule: a
// deputy-seat runoff's winner takes the open DEPUTY seat (the round-1 Speaker
// stays), and a speaker-seat runoff still owes its remaining deputy seats to
// the round-1 standings. Party-leader runoffs need no special handling —
// "top 1 wins" is already the right reading of a runoff among the tied.
async function resolveOutcome(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  session: VoteSession,
  tallies: VoteTally[]
): Promise<ElectionOutcome> {
  const cfg = (session.config ?? {}) as RunoffConfig;

  // Cabinet / Shadow elections are multi-seat (top-k of the party's members).
  // cfg.seats = seats to fill THIS round: the full quota on round 1, or the
  // remaining open seats on a cutline runoff (openRunoff sets it). winnerIds
  // therefore lists only the seats decided in this round.
  if (
    session.vote_type === "cabinet_minister" ||
    session.vote_type === "shadow_minister"
  ) {
    const seats = Math.max(1, cfg.seats ?? 1);
    const ms = computeMultiSeatOutcome(tallies, seats, session.vote_type);
    return {
      speakerId: null,
      deputyIds: [],
      partyLeaderId: null,
      winnerId: null,
      winnerIds: ms.winnerIds,
      tie: ms.tie,
    };
  }

  if (!cfg.isRunoff || session.vote_type !== "speaker_election") {
    return computeElectionOutcome(session.vote_type, tallies);
  }

  // Parent (round-1) tallies, loaded at most once and only when needed.
  let parentTallies: VoteTally[] | null = null;
  const loadParent = async (): Promise<VoteTally[]> => {
    if (parentTallies) return parentTallies;
    parentTallies = [];
    if (cfg.runoffOf) {
      const { data: parent } = await supabase
        .from("vote_sessions")
        .select("*")
        .eq("id", cfg.runoffOf)
        .maybeSingle();
      if (parent) {
        parentTallies = (await buildTallies(supabase, parent)).tallies;
      }
    }
    return parentTallies;
  };

  // openRunoff stores runoffSeat; for runoff sessions created before this fix,
  // re-derive the contested seat from the parent's tally (the tie surfaced at
  // the parent's reveal).
  let seat = cfg.runoffSeat;
  if (!seat) {
    seat = computeElectionOutcome("speaker_election", await loadParent()).tie
      ?.seat;
  }

  if (seat === "deputy") {
    const openSeats =
      cfg.openDeputySeats ??
      Math.max(
        1,
        2 -
          computeElectionOutcome("speaker_election", await loadParent())
            .deputyIds.length
      );
    const dep = computeDeputyRunoffOutcome(tallies, openSeats);
    return {
      speakerId: null,
      deputyIds: dep.deputyIds,
      partyLeaderId: null,
      winnerId: null,
      winnerIds: [],
      tie: dep.tie,
    };
  }

  // Speaker-seat runoff (or seat underivable — same safe reading: the runoff
  // ranks the previously top-tied, so its winner IS the Speaker). Any deputy
  // seat the runoff ranking leaves open is filled from round-1 standings.
  const out = computeElectionOutcome("speaker_election", tallies);
  if (!out.speakerId) return out; // the runoff itself tied again
  return fillDeputiesFromParent(out, await loadParent(), cfg.candidateIds ?? []);
}

// ─── Open Vote ──────────────────────────────────────────────────

export async function openVote(
  eventId: string,
  agendaItemId: string,
  voteType:
    | "speaker_election"
    | "bill_vote"
    | "party_leader"
    | "prime_minister"
    | "deputy_prime_minister"
    | "leader_of_opposition"
    | "cabinet_minister"
    | "shadow_minister",
  config?: {
    candidateIds?: string[];
    billId?: string;
    // party_leader AND cabinet/shadow elections: the party whose seat(s) are
    // being filled. Voting is restricted to that party's own members.
    partyId?: string;
    // Cabinet/shadow multi-seat elections: how many ministers this party elects
    // (its coalition quota; the runoff round carries the remaining open seats).
    seats?: number;
    // Bench seats (prime_minister / deputy_prime_minister / leader_of_opposition)
    // only: the bench whose seat is being filled. Voting is restricted to that
    // bench's members (party_side). PM/Deputy → 'ruling'; LoP → 'opposition'.
    side?: "ruling" | "opposition";
    // Marks a session opened as a tie runoff (set by openRunoff).
    isRunoff?: boolean;
    runoffOf?: string;
    // Which seat the runoff contests — reveal logic depends on it (a deputy
    // runoff must never crown a Speaker).
    runoffSeat?:
      | "speaker"
      | "deputy"
      | "party_leader"
      | "prime_minister"
      | "deputy_prime_minister"
      | "leader_of_opposition"
      | "cabinet_minister"
      | "shadow_minister";
    // Deputy runoffs only: how many deputy seats are still open (1 or 2).
    openDeputySeats?: number;
  }
): Promise<ActionResult<{ sessionId: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Finalised events are frozen: once scores are locked or results are published,
  // no new nomination/vote may open (re-opening a settled seat would corrupt the
  // standings). Mirrors the agenda re-open guard. allocation_locked is NOT checked
  // — elections are run AFTER allocation is locked, so that lock must not block here.
  const { data: lockState, error: lockErr } = await supabase
    .from("events")
    .select("scores_locked, results_published_at")
    .eq("id", eventId)
    .single();
  if (lockErr || !lockState) return { success: false, error: "Event not found" };
  if (lockState.results_published_at) {
    return { success: false, error: "Results are published — opening a vote is disabled." };
  }
  if (lockState.scores_locked) {
    return { success: false, error: "Scores are locked — unlock scores before opening a vote." };
  }

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

  // Get tallies (party-leader tallies are scoped to the party's own members).
  const { tallies, totalVotes } = await buildTallies(supabase, session);
  const tallyMap: Record<string, number> = Object.fromEntries(
    tallies.map((t) => [t.vote_value, t.count])
  );

  // Count total participants for this event
  const { count: totalParticipants } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", session.event_id)
    .eq("checked_in", true);

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

  // Motion floor vote (No-Confidence OR Impeach the Speaker): write the counted
  // tally + outcome onto the motion (the organiser-control reveal path; the
  // presiding-officer reveal in speaker.ts does the same). config.motionId
  // identifies the motion. For a PASSED motion, DEPOSE the sitting leader to
  // their "Ex-" variant (no_confidence → ex_prime_minister; impeach_speaker →
  // ex_speaker / ex_deputy_speaker) so they keep their leadership points; the
  // organiser then runs a fresh election for the replacement, who also scores.
  if (
    session.vote_type === "no_confidence" ||
    session.vote_type === "impeach_speaker"
  ) {
    const cfg = (session.config ?? {}) as { motionId?: string };
    if (cfg.motionId) {
      const votesFor = tallyMap["aye"] || 0;
      const votesAgainst = tallyMap["nay"] || 0;
      const votesAbstain = tallyMap["abstain"] || 0;
      const motionOutcome = votesFor > votesAgainst ? "passed" : "rejected";
      await supabase
        .from("motions")
        .update({
          votes_for: votesFor,
          votes_against: votesAgainst,
          votes_abstain: votesAbstain,
          outcome: motionOutcome,
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", cfg.motionId)
        .eq("event_id", session.event_id);

      if (motionOutcome === "passed") {
        // A carried removal motion DEPOSES the sitting leader to their "Ex-"
        // variant — they KEEP their leadership points; the newly elected
        // replacement also earns them. We do NOT auto-open the replacement
        // election here (the organiser runs a fresh nomination, so the new
        // leader is a real choice rather than a re-vote on the deposed person —
        // which would also revert the Ex- status). Demotion is scoped per role
        // so the rest of the bench is untouched.
        if (session.vote_type === "no_confidence") {
          await supabase
            .from("participants")
            .update({ parliament_role: "ex_prime_minister" })
            .eq("event_id", session.event_id)
            .eq("parliament_role", "prime_minister");
        } else if (session.vote_type === "impeach_speaker") {
          await supabase
            .from("participants")
            .update({ parliament_role: "ex_speaker" })
            .eq("event_id", session.event_id)
            .eq("parliament_role", "speaker");
          await supabase
            .from("participants")
            .update({ parliament_role: "ex_deputy_speaker" })
            .eq("event_id", session.event_id)
            .eq("parliament_role", "deputy_speaker");
        }
      }
    }
  }

  // Designate seats from the tally and persist what is unambiguously decided.
  // Runoff sessions resolve against the seat they contest (config.runoffSeat).
  const outcome = await resolveOutcome(supabase, session, tallies);

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

  // Deputy-seat runoff: the Speaker (and any clearly-won deputies) were
  // written at the round-1 reveal — add only the runoff-won deputy seat(s),
  // with NO role reset. (Only a deputy-runoff outcome has a null speakerId
  // with non-empty deputyIds.)
  if (
    session.vote_type === "speaker_election" &&
    !outcome.speakerId &&
    outcome.deputyIds.length > 0
  ) {
    await supabase
      .from("participants")
      .update({ parliament_role: "deputy_speaker" })
      .in("id", outcome.deputyIds);
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

  // Single-winner bench seats: vacate the current holder of THIS role (scoped
  // to the one role so other leadership seats are untouched), then seat the
  // winner. winnerId is set only when the seat was decided (no tie).
  if (
    (session.vote_type === "prime_minister" ||
      session.vote_type === "deputy_prime_minister" ||
      session.vote_type === "leader_of_opposition") &&
    outcome.winnerId
  ) {
    await supabase
      .from("participants")
      .update({ parliament_role: "mp" })
      .eq("event_id", session.event_id)
      .eq("parliament_role", session.vote_type);
    await supabase
      .from("participants")
      .update({ parliament_role: session.vote_type })
      .eq("id", outcome.winnerId);
  }

  // Cabinet / Shadow ministers (multi-seat, per-party): seat the top-k winners.
  // First round vacates this party's prior ministers of the same role (scoped
  // to the party so the OTHER coalition parties' ministers are untouched), then
  // seats the winners; a cutline RUNOFF only ADDS its winners (no reset, like
  // the deputy-seat runoff).
  if (
    (session.vote_type === "cabinet_minister" ||
      session.vote_type === "shadow_minister") &&
    outcome.winnerIds.length > 0
  ) {
    const mscfg = (session.config ?? {}) as { partyId?: string; isRunoff?: boolean };
    if (!mscfg.isRunoff && mscfg.partyId) {
      await supabase
        .from("participants")
        .update({ parliament_role: "mp" })
        .eq("event_id", session.event_id)
        .eq("party_id", mscfg.partyId)
        .eq("parliament_role", session.vote_type);
    }
    await supabase
      .from("participants")
      .update({ parliament_role: session.vote_type })
      .in("id", outcome.winnerIds);
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

  // Only students checked in for this vote's day may cast (interview 2026-06-14).
  const elig = await assertCheckedInForVote(
    supabase,
    participantId,
    session.agenda_item_id
  );
  if (!elig.ok) return { success: false, error: elig.error };

  // Reject junk / non-candidate values before they pollute the tally.
  const valid = validateVoteValue(session, voteValue);
  if (!valid.ok) return { success: false, error: valid.error };

  // Party-scoped elections (party leader + the party's cabinet/shadow ministers):
  // only members of that party may vote. (Each party elects its own leader, and
  // — in a coalition — its own slice of the cabinet/shadow bench.)
  if (
    session.vote_type === "party_leader" ||
    session.vote_type === "cabinet_minister" ||
    session.vote_type === "shadow_minister"
  ) {
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
          error: "Only members of this party can vote in this election",
        };
      }
    }
  }

  // Bench seats (PM / Deputy PM / Leader of Opposition) are bench-scoped: only
  // members of config.side's bench may vote (the governing coalition elects the
  // PM/Deputy; the opposition elects the LoP). Rejected at cast time.
  if (
    session.vote_type === "prime_minister" ||
    session.vote_type === "deputy_prime_minister" ||
    session.vote_type === "leader_of_opposition"
  ) {
    const cfg = (session.config ?? {}) as { side?: "ruling" | "opposition" };
    if (cfg.side) {
      const { data: voter } = await supabase
        .from("participants")
        .select("party_side")
        .eq("id", participantId)
        .single();
      if (!voter || voter.party_side !== cfg.side) {
        return {
          success: false,
          error: `Only members of the ${cfg.side} bench can vote in this election`,
        };
      }
    }
  }

  // Check if already voted — in THIS session. A round-1 voter must be able to
  // vote again in a runoff session on the same agenda item.
  const { data: existingVote } = await votesTable(supabase)
    .select("id")
    .eq("session_id", session.id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingVote) {
    return {
      success: true,
      data: { status: "already_voted" },
    };
  }

  // Cast the vote, stamped with its session.
  const { error } = await votesTable(supabase).insert({
    event_id: session.event_id,
    agenda_item_id: session.agenda_item_id,
    session_id: session.id,
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

  // Get tallies (party-leader tallies are scoped to the party's own members).
  const { tallies, totalVotes } = await buildTallies(supabase, session);

  const { count: totalParticipants } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", session.event_id)
    .eq("checked_in", true);

  const winner = tallies.length > 0 ? tallies[0].vote_value : null;
  const outcome = await resolveOutcome(supabase, session, tallies);

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

  // Include deposed Speakers/Deputy Speakers: an ex_speaker may be re-nominated
  // and run again, so the role-based ballot fallback must surface them too.
  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, party_side, parliament_role, constituency_name, constituency_number"
    )
    .eq("event_id", eventId)
    .in("parliament_role", ["speaker", "ex_speaker", "ex_deputy_speaker"]);

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
    party_side: string | null;
    committee_name: string | null;
    status: string | null;
  }>
> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bills")
    .select("id, title, objective, party_side, committee_name, status")
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
    .select("id, agenda_item_id, vote_type")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { success: false, error: "Session not found" };
  }

  // Session-scoped live count, with the same legacy NULL-session fallback as
  // buildTallies (this also powers reads on pre-migration sessions).
  const { data: scopedVotes } = await votesTable(supabase)
    .select("vote_value")
    .eq("session_id", session.id);

  let votes = scopedVotes ?? [];
  if (votes.length === 0) {
    const { data: legacy } = await votesTable(supabase)
      .select("vote_value")
      .eq("agenda_item_id", session.agenda_item_id)
      .eq("vote_type", session.vote_type)
      .is("session_id", null);
    votes = legacy ?? [];
  }

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
    .select("event_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { success: false, error: "Vote session not found" };

  // Verify the caller owns this participant identity for this event.
  const sess = await requireParticipantSession(participantId, session.event_id);
  if (!sess.ok) return { success: false, error: sess.error };

  // Scoped to THIS session: a round-1 vote must not read as "voted" in a
  // runoff session on the same agenda item.
  const { data: existing } = await votesTable(supabase)
    .select("id")
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .maybeSingle();

  return { success: true, data: { hasVoted: Boolean(existing) } };
}

// ─── Parties (for Party-Leader elections) ───────────────────────

export interface PartyLite {
  id: string;
  name: string;
  side: string | null;
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
    .select(
      "id, full_name, school_name, party_side, parliament_role, constituency_name, constituency_number"
    )
    .eq("event_id", eventId)
    .eq("party_id", partyId)
    .order("full_name");
  if (error || !data) return [];
  return data;
}

// ─── Vote candidates by id (ballot rendering) ───────────────────
// Returns the specific candidate participants on a ballot, given the session's
// config.candidateIds. Used by the participant ballot for party-leader (and any
// candidate ballot) so it shows exactly the nominees the organiser picked —
// not a whole party roster.
export async function getVoteCandidates(
  candidateIds: string[]
): Promise<VoteCandidate[]> {
  const ids = candidateIds.filter((x) => typeof x === "string" && x.length > 0);
  if (ids.length === 0) return [];
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, party_side, parliament_role, constituency_name, constituency_number"
    )
    .in("id", ids)
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
  // the tied candidates (no trust in client-supplied ids). Party-leader tallies
  // are scoped to the party's own members; runoff sessions resolve against the
  // seat they contest (so a re-runoff of a deputy runoff stays a deputy runoff).
  const { tallies } = await buildTallies(supabase, session);
  const outcome = await resolveOutcome(supabase, session, tallies);
  if (!outcome.tie || outcome.tie.tiedCandidateIds.length < 2) {
    return { success: false, error: "No tie to run off — nothing to do." };
  }

  const cfg = (session.config ?? {}) as RunoffConfig;

  // Deputy runoffs need to know how many deputy seats are still open. The
  // already-decided deputies counted here depend on what kind of session the
  // tie surfaced in: a deputy-runoff outcome lists only its newly-won seats
  // (subtract from its own open count); every other outcome lists all of them.
  const openDeputySeats =
    outcome.tie.seat !== "deputy"
      ? undefined
      : cfg.isRunoff && cfg.runoffSeat === "deputy"
        ? Math.max(1, (cfg.openDeputySeats ?? 1) - outcome.deputyIds.length)
        : Math.max(1, 2 - outcome.deputyIds.length);

  // Cabinet/shadow multi-seat tie: the runoff fills the seats left open at the
  // cutline (this round's seats minus the clearly-ahead already awarded).
  const isMultiSeat =
    outcome.tie.seat === "cabinet_minister" ||
    outcome.tie.seat === "shadow_minister";
  const seats = isMultiSeat
    ? Math.max(1, (cfg.seats ?? 1) - outcome.winnerIds.length)
    : undefined;

  return openVote(session.event_id, session.agenda_item_id, session.vote_type as
    | "speaker_election"
    | "bill_vote"
    | "party_leader"
    | "prime_minister"
    | "deputy_prime_minister"
    | "leader_of_opposition"
    | "cabinet_minister"
    | "shadow_minister", {
    candidateIds: outcome.tie.tiedCandidateIds,
    partyId: cfg.partyId,
    // Carry the bench through so a bench-seat (PM/Deputy/LoP) runoff stays
    // bench-scoped at cast + tally — without this the runoff round would be
    // open to the whole house.
    side: cfg.side,
    seats,
    isRunoff: true,
    runoffOf: revealedSessionId,
    runoffSeat: outcome.tie.seat,
    openDeputySeats,
  });
}
