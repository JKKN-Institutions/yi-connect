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
