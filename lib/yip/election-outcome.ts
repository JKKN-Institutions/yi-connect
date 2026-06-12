// Pure election-outcome logic — no DB, no "use server" — so it can be unit
// tested and imported by the voting server actions. Decides who wins which seat
// from a sorted tally, returning ONLY what is unambiguously decided; anything
// still tied at a seat boundary is reported in `tie` and left for a runoff
// (Director ruling 2026-06-11: a 60-second runoff between only the tied).
//
// vote_value holds the chosen candidate's participant id.

export interface VoteTally {
  vote_value: string;
  count: number;
}

export interface ElectionTie {
  // "speaker" = tie for the single Speaker seat; "deputy" = tie for the last
  // Deputy seat; "party_leader" = tie for a party's leader.
  seat: "speaker" | "deputy" | "party_leader";
  tiedCandidateIds: string[];
  tiedCount: number;
}

export interface ElectionOutcome {
  speakerId: string | null;
  deputyIds: string[];
  partyLeaderId: string | null;
  tie: ElectionTie | null;
}

export function computeElectionOutcome(
  voteType: string,
  tallies: VoteTally[]
): ElectionOutcome {
  const out: ElectionOutcome = {
    speakerId: null,
    deputyIds: [],
    partyLeaderId: null,
    tie: null,
  };
  if (tallies.length === 0) return out;
  const topCount = tallies[0].count;

  if (voteType === "party_leader") {
    if (tallies.length >= 2 && tallies[1].count === topCount) {
      out.tie = {
        seat: "party_leader",
        tiedCount: topCount,
        tiedCandidateIds: tallies.filter((t) => t.count === topCount).map((t) => t.vote_value),
      };
    } else {
      out.partyLeaderId = tallies[0].vote_value;
    }
    return out;
  }

  if (voteType === "speaker_election") {
    // Tie for the single Speaker seat → no Speaker until a runoff settles it.
    if (tallies.length >= 2 && tallies[1].count === topCount) {
      out.tie = {
        seat: "speaker",
        tiedCount: topCount,
        tiedCandidateIds: tallies.filter((t) => t.count === topCount).map((t) => t.vote_value),
      };
      return out;
    }
    out.speakerId = tallies[0].vote_value;

    // Deputy Speakers = the next two. With <=2 candidates left, both (or the
    // one) are deputies uncontested.
    const rest = tallies.slice(1);
    if (rest.length <= 2) {
      out.deputyIds = rest.map((t) => t.vote_value);
      return out;
    }
    // 3+ remain for 2 seats. The 2nd Deputy seat is contested when rank-3's
    // count equals rank-4's. Award the clearly-ahead deputies now; runoff the rest.
    if (rest[1].count === rest[2].count) {
      const contested = rest[1].count;
      out.deputyIds = rest.filter((t) => t.count > contested).map((t) => t.vote_value);
      out.tie = {
        seat: "deputy",
        tiedCount: contested,
        tiedCandidateIds: rest.filter((t) => t.count === contested).map((t) => t.vote_value),
      };
      return out;
    }
    out.deputyIds = [rest[0].vote_value, rest[1].vote_value];
    return out;
  }

  return out; // bill_vote / unknown — no seat designation
}

// ─── Runoff-seat helpers ────────────────────────────────────────
//
// A runoff session re-runs ONE contested seat among only the tied candidates
// (Director ruling 2026-06-11). Its tally must therefore NOT be interpreted
// with the plain "top 1 = Speaker" rule: a deputy-seat runoff's winner takes
// the open DEPUTY seat, and a speaker-seat runoff still owes its deputies to
// the round-1 standings. These pure helpers encode that.

/**
 * Outcome of a runoff for the open deputy seat(s).
 * Takes the top `openSeats` candidates from the runoff tally; a tie across the
 * last open seat is reported (and only the clearly-ahead are awarded).
 * Never designates a Speaker — the Speaker was settled in round 1.
 */
export function computeDeputyRunoffOutcome(
  runoffTallies: VoteTally[],
  openSeats: number
): { deputyIds: string[]; tie: ElectionTie | null } {
  if (runoffTallies.length === 0 || openSeats <= 0) {
    return { deputyIds: [], tie: null };
  }
  if (runoffTallies.length <= openSeats) {
    // Everyone fits — uncontested.
    return { deputyIds: runoffTallies.map((t) => t.vote_value), tie: null };
  }
  const boundary = runoffTallies[openSeats - 1].count;
  if (runoffTallies[openSeats].count === boundary) {
    // Still tied across the last open seat: award the clearly-ahead, re-runoff the rest.
    return {
      deputyIds: runoffTallies
        .filter((t) => t.count > boundary)
        .map((t) => t.vote_value),
      tie: {
        seat: "deputy",
        tiedCount: boundary,
        tiedCandidateIds: runoffTallies
          .filter((t) => t.count === boundary)
          .map((t) => t.vote_value),
      },
    };
  }
  return {
    deputyIds: runoffTallies.slice(0, openSeats).map((t) => t.vote_value),
    tie: null,
  };
}

/**
 * After a SPEAKER-seat runoff designates the Speaker (and ranks the other
 * previously-tied candidates as deputies), fill any deputy seat still open
 * from the round-1 standings — excluding the runoff candidates, who were
 * already ranked by the runoff itself. A tie at the fill boundary (within the
 * round-1 list, where counts are comparable) is reported for another runoff.
 */
export function fillDeputiesFromParent(
  outcome: ElectionOutcome,
  parentTallies: VoteTally[],
  runoffCandidateIds: string[]
): ElectionOutcome {
  // Nothing to fill while the speaker seat itself is unresolved or a deputy
  // tie inside the runoff already occupies the boundary.
  if (!outcome.speakerId || outcome.tie) return outcome;
  const need = 2 - outcome.deputyIds.length;
  if (need <= 0) return outcome;

  const exclude = new Set(runoffCandidateIds);
  const rest = parentTallies.filter((t) => !exclude.has(t.vote_value));
  if (rest.length === 0) return outcome;

  if (rest.length <= need) {
    return { ...outcome, deputyIds: [...outcome.deputyIds, ...rest.map((t) => t.vote_value)] };
  }
  const boundary = rest[need - 1].count;
  if (rest[need].count === boundary) {
    return {
      ...outcome,
      deputyIds: [
        ...outcome.deputyIds,
        ...rest.filter((t) => t.count > boundary).map((t) => t.vote_value),
      ],
      tie: {
        seat: "deputy",
        tiedCount: boundary,
        tiedCandidateIds: rest
          .filter((t) => t.count === boundary)
          .map((t) => t.vote_value),
      },
    };
  }
  return {
    ...outcome,
    deputyIds: [...outcome.deputyIds, ...rest.slice(0, need).map((t) => t.vote_value)],
  };
}
