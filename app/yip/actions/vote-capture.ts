"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireVolunteerSession } from "@/lib/yip/auth/yip-session";
import { assertCheckedInForVote } from "@/lib/yip/vote-eligibility";
import { validateVoteValue } from "@/lib/yip/vote-validate";
import { matchesDesk, type DeskAssignment } from "@/lib/yip/yuva-desk";
import { voteScopeKind, benchSideForType } from "@/lib/yip/vote-scope";

/**
 * Floor-voting kiosk capture actions.
 *
 * YUVA volunteers carry a device around the house during an OPEN vote session.
 * They surface the list of students who have not yet voted, hand the device to
 * a student, and relay that student's self-cast vote — stamping provenance
 * (entry_method: "volunteer_kiosk", recorded_by_volunteer_id).
 *
 * Every export is gated by requireVolunteerSession(eventId): the underlying
 * yip.votes table has INSERT policies open to `public`, so the server action is
 * the only authorization layer. Votes are FINAL — these actions INSERT only and
 * never UPDATE an existing vote (mirrors the house castVote finality).
 */

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Untyped votes access (session_id not in generated types yet) ───
// yip.votes gained `session_id` in migration 20260612100000 but the generated
// DB types are not regenerated alongside (CLI banner corruption). File-local
// narrow accessor — the app/yip/actions/chat.ts pattern.
type VotesPgError = { code?: string; message: string };
type VotesTable = {
  select: (cols: string) => VotesTable;
  insert: (row: Record<string, unknown>) => Promise<{ error: VotesPgError | null }>;
  eq: (col: string, val: unknown) => VotesTable;
  then: Promise<{
    data: Record<string, unknown>[] | null;
    error: VotesPgError | null;
  }>["then"];
};
function votesTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): VotesTable {
  return (sb as unknown as { from: (t: string) => VotesTable }).from("votes");
}

// yuva_assignments is not in the generated types — narrow accessor (file-local).
type RawAssignmentRow = {
  party_id: string | null;
  committee_name: string | null;
};
type YuvaAssignTable = {
  select: (cols: string) => YuvaAssignTable;
  eq: (col: string, val: unknown) => YuvaAssignTable;
  then: Promise<{
    data: RawAssignmentRow[] | null;
    error: VotesPgError | null;
  }>["then"];
};
function yuvaAssignTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): YuvaAssignTable {
  return (sb as unknown as { from: (t: string) => YuvaAssignTable }).from(
    "yuva_assignments"
  );
}

/** The caller volunteer's desk assignments (parties + committees) for an event. */
async function callerDeskAssignments(
  sb: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  volunteerId: string
): Promise<DeskAssignment[]> {
  const { data } = await yuvaAssignTable(sb)
    .select("party_id, committee_name")
    .eq("event_id", eventId)
    .eq("volunteer_id", volunteerId);
  return (data ?? []) as DeskAssignment[];
}

interface KioskOption {
  value: string;
  label: string;
}

interface KioskActive {
  sessionId: string;
  voteType: string;
  title: string;
  options: KioskOption[];
}

interface KioskPendingVoter {
  participantId: string;
  constituencyNumber: number | null;
  fullName: string;
  constituencyName: string | null;
}

interface KioskTurnout {
  cast: number;
  eligible: number;
}

interface KioskState {
  active: KioskActive | null;
  pending: KioskPendingVoter[];
  turnout: KioskTurnout;
}

// ─── Get Kiosk State ────────────────────────────────────────────

export async function getKioskState(
  eventId: string
): Promise<ActionResult<KioskState>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  // Desk scope: this volunteer only sees/serves their OWN party / committee
  // students (product-owner decision 2026-06-13). A volunteer with no desk
  // assignment therefore sees an empty list and cannot relay any votes.
  const assignments = await callerDeskAssignments(
    supabase,
    eventId,
    session.volunteerId
  );

  // Desk roster — party_id/party_side + committee_name apply the scope.
  const { data: rosterAll } = await supabase
    .from("participants")
    .select(
      "id, full_name, serial_no, constituency_number, constituency_name, party_id, party_side, committee_name"
    )
    .eq("event_id", eventId)
    .order("serial_no", { ascending: true, nullsFirst: false });

  const deskRoster = (rosterAll ?? []).filter((p) =>
    matchesDesk(
      { party_id: p.party_id, committee_name: p.committee_name },
      assignments
    )
  );

  // Several party-leader elections can run in PARALLEL, so the kiosk picks the
  // open session that belongs to THIS desk's party (House-wide votes apply to
  // every desk; bench votes apply to the desk's bench).
  const deskPartyIds = new Set(
    deskRoster.map((p) => p.party_id).filter((x): x is string => !!x)
  );
  const deskSides = new Set(
    deskRoster
      .map((p) => p.party_side)
      .filter(
        (x): x is "ruling" | "opposition" =>
          x === "ruling" || x === "opposition"
      )
  );

  const { data: openSessions } = await supabase
    .from("vote_sessions")
    .select("id, agenda_item_id, vote_type, bill_id, config, status")
    .eq("event_id", eventId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(100);

  const voteSession =
    (openSessions ?? []).find((s) => {
      const kind = voteScopeKind(s.vote_type);
      if (kind === "house") return true;
      const cfg = (s.config ?? {}) as { partyId?: string; side?: string };
      if (kind === "party")
        return !!cfg.partyId && deskPartyIds.has(cfg.partyId);
      const side =
        cfg.side === "ruling" || cfg.side === "opposition"
          ? cfg.side
          : benchSideForType(s.vote_type);
      return !!side && deskSides.has(side);
    }) ?? null;

  // No open session → nothing to vote on; turnout is zero against the desk.
  if (!voteSession) {
    return {
      success: true,
      data: {
        active: null,
        pending: [],
        turnout: { cast: 0, eligible: deskRoster.length },
      },
    };
  }

  // Build the option set for the active session.
  let title = "";
  let options: KioskOption[] = [];

  if (voteSession.vote_type === "bill_vote") {
    title = "Bill Vote";
    if (voteSession.bill_id) {
      const { data: bill } = await supabase
        .from("bills")
        .select("title")
        .eq("id", voteSession.bill_id)
        .maybeSingle();
      if (bill?.title) title = bill.title;
    }
    // Mirror the self-cast bill vote_value strings (app/yip/me/vote/page.tsx):
    // "aye" / "nay" / "abstain". The house revealResults only counts these,
    // so kiosk votes MUST use the same strings to be tallied.
    options = [
      { value: "aye", label: "AYE" },
      { value: "nay", label: "NO" },
      { value: "abstain", label: "ABSTAIN" },
    ];
  } else if (voteSession.vote_type === "speaker_election") {
    title = "Speaker Election";
    const config = (voteSession.config ?? {}) as { candidateIds?: unknown };
    const candidateIds = Array.isArray(config.candidateIds)
      ? config.candidateIds.filter((c): c is string => typeof c === "string")
      : [];

    if (candidateIds.length > 0) {
      const { data: candidates } = await supabase
        .from("participants")
        .select("id, full_name, constituency_number")
        .eq("event_id", eventId)
        .in("id", candidateIds);

      const byId = new Map(
        (candidates ?? []).map((c) => [c.id, c])
      );
      // Preserve the config-declared candidate order.
      options = candidateIds
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({
          value: c.id,
          label: `#${c.constituency_number ?? "—"} · ${c.full_name}`,
        }));
    }
  } else if (voteSession.vote_type === "no_confidence") {
    const cfg = (voteSession.config ?? {}) as { motionSubject?: unknown };
    title =
      typeof cfg.motionSubject === "string" ? cfg.motionSubject : "No-Confidence Motion";
    // Same aye/nay/abstain strings the House self-cast uses, so kiosk-relayed
    // ballots are tallied identically.
    options = [
      { value: "aye", label: "AYE" },
      { value: "nay", label: "NO" },
      { value: "abstain", label: "ABSTAIN" },
    ];
  } else {
    title = "Vote";
  }

  // Ids that have already voted in THIS session. Session-scoped — never
  // agenda-item-scoped — so a runoff's pending list starts clean instead of
  // treating every round-1 voter as already done.
  const { data: castVotes } = await votesTable(supabase)
    .select("participant_id")
    .eq("session_id", voteSession.id);

  const votedIds = new Set(
    (castVotes ?? []).map((v) => v.participant_id as string)
  );

  // Pending + turnout are scoped to THIS volunteer's desk.
  const pending: KioskPendingVoter[] = deskRoster
    .filter((p) => !votedIds.has(p.id))
    .map((p) => ({
      participantId: p.id,
      constituencyNumber: p.constituency_number,
      fullName: p.full_name,
      constituencyName: p.constituency_name,
    }));

  const deskCast = deskRoster.filter((p) => votedIds.has(p.id)).length;

  return {
    success: true,
    data: {
      active: {
        sessionId: voteSession.id,
        voteType: voteSession.vote_type,
        title,
        options,
      },
      pending,
      turnout: {
        cast: deskCast,
        eligible: deskRoster.length,
      },
    },
  };
}

// ─── Cast Kiosk Vote ────────────────────────────────────────────

export async function castKioskVote(
  eventId: string,
  sessionId: string,
  participantId: string,
  voteValue: string
): Promise<ActionResult<{ status: "success" | "already_voted" | "closed" }>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  // Re-fetch the session server-side — never trust the client's claim that it
  // is open or belongs to this event.
  const { data: voteSession } = await supabase
    .from("vote_sessions")
    .select("id, event_id, agenda_item_id, vote_type, status, config")
    .eq("id", sessionId)
    .maybeSingle();

  if (!voteSession || voteSession.event_id !== eventId) {
    return { success: false, error: "Vote session not found" };
  }

  if (voteSession.status !== "open") {
    return { success: true, data: { status: "closed" } };
  }

  // Reject junk / non-candidate values before they pollute the tally.
  const valid = validateVoteValue(voteSession, voteValue);
  if (!valid.ok) return { success: false, error: valid.error };

  // Verify the participant belongs to this event AND is in THIS volunteer's
  // desk before recording on their behalf. The kiosk list is already filtered
  // to the desk, but the server is the real gate (yip.votes INSERT is open to
  // public, so a forged participantId must be rejected here).
  const { data: participant } = await supabase
    .from("participants")
    .select("id, party_id, committee_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!participant) {
    return { success: false, error: "Student not found for this event" };
  }

  const assignments = await callerDeskAssignments(
    supabase,
    eventId,
    session.volunteerId
  );
  if (
    !matchesDesk(
      {
        party_id: participant.party_id,
        committee_name: participant.committee_name,
      },
      assignments
    )
  ) {
    return { success: false, error: "That student is not at your desk." };
  }

  // Only students checked in for this vote's day may cast — same rule as the
  // self path (interview 2026-06-14). Check the student in first if needed.
  const elig = await assertCheckedInForVote(
    supabase,
    participantId,
    voteSession.agenda_item_id
  );
  if (!elig.ok) return { success: false, error: elig.error };

  // INSERT-ONLY. A repeat in the SAME session is mapped to already_voted via
  // the per-session unique index (votes_session_participant_key); we never
  // update an existing vote. A round-1 vote never blocks a runoff cast.
  const { error } = await votesTable(supabase).insert({
    event_id: eventId,
    agenda_item_id: voteSession.agenda_item_id,
    session_id: voteSession.id,
    participant_id: participantId,
    vote_type: voteSession.vote_type,
    vote_value: voteValue,
    entry_method: "volunteer_kiosk",
    recorded_by_volunteer_id: session.volunteerId,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: true, data: { status: "already_voted" } };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: { status: "success" } };
}
