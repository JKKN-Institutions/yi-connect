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
  // Deputy seat; "party_leader" = tie for a party's leader; the bench seats
  // (prime_minister / deputy_prime_minister / leader_of_opposition) are
  // single-winner elections scoped to one bench — a top-count tie reports here.
  seat:
    | "speaker"
    | "deputy"
    | "party_leader"
    | "prime_minister"
    | "deputy_prime_minister"
    | "leader_of_opposition"
    | "cabinet_minister"
    | "shadow_minister";
  tiedCandidateIds: string[];
  tiedCount: number;
}

export interface ElectionOutcome {
  speakerId: string | null;
  deputyIds: string[];
  partyLeaderId: string | null;
  // Generic single-winner for the bench seats (prime_minister /
  // deputy_prime_minister / leader_of_opposition) — the winning participant id.
  winnerId: string | null;
  // Multi-seat winners (cabinet_minister / shadow_minister) — the top-k elected
  // participant ids for a party's ministerial quota.
  winnerIds: string[];
  tie: ElectionTie | null;
}

// Single-winner bench elections: one seat, electorate scoped to one bench
// (party_side). Reuse the party-leader reading — top-1 wins, a top-count tie
// goes to a runoff among the tied.
export const SINGLE_WINNER_BENCH_SEATS = [
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
] as const;

// Multi-seat per-party elections: a party elects its quota of ministers from
// its own members (top-k win). Electorate scoped to the party (party_id).
export const MULTI_SEAT_PARTY_ELECTIONS = [
  "cabinet_minister",
  "shadow_minister",
] as const;

export function computeElectionOutcome(
  voteType: string,
  tallies: VoteTally[]
): ElectionOutcome {
  const out: ElectionOutcome = {
    speakerId: null,
    deputyIds: [],
    partyLeaderId: null,
    winnerId: null,
    winnerIds: [],
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

  // Single-winner bench seats (PM / Deputy PM / Leader of Opposition): same
  // reading as party_leader — top-1 wins, a top-count tie goes to a runoff.
  if (
    voteType === "prime_minister" ||
    voteType === "deputy_prime_minister" ||
    voteType === "leader_of_opposition"
  ) {
    if (tallies.length >= 2 && tallies[1].count === topCount) {
      out.tie = {
        seat: voteType,
        tiedCount: topCount,
        tiedCandidateIds: tallies
          .filter((t) => t.count === topCount)
          .map((t) => t.vote_value),
      };
    } else {
      out.winnerId = tallies[0].vote_value;
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

// ─── Multi-seat (Cabinet / Shadow) ──────────────────────────────
//
// A party elects its quota of ministers from its own members: the top `seats`
// candidates win. A tie across the LAST open seat (rank `seats` vs `seats+1`)
// awards only the clearly-ahead and reports the rest for a runoff among the
// tied — identical cutline logic to computeDeputyRunoffOutcome, but the winners
// land in `winnerIds` and the tie carries the seat label (cabinet/shadow).

export function computeMultiSeatOutcome(
  tallies: VoteTally[],
  seats: number,
  seat: "cabinet_minister" | "shadow_minister"
): { winnerIds: string[]; tie: ElectionTie | null } {
  if (tallies.length === 0 || seats <= 0) return { winnerIds: [], tie: null };
  if (tallies.length <= seats) {
    // Everyone fits — uncontested.
    return { winnerIds: tallies.map((t) => t.vote_value), tie: null };
  }
  const boundary = tallies[seats - 1].count;
  if (tallies[seats].count === boundary) {
    // Tied across the last open seat: award the clearly-ahead, runoff the rest.
    return {
      winnerIds: tallies.filter((t) => t.count > boundary).map((t) => t.vote_value),
      tie: {
        seat,
        tiedCount: boundary,
        tiedCandidateIds: tallies
          .filter((t) => t.count === boundary)
          .map((t) => t.vote_value),
      },
    };
  }
  return {
    winnerIds: tallies.slice(0, seats).map((t) => t.vote_value),
    tie: null,
  };
}

// ─── Coalition cabinet-seat quota ───────────────────────────────
//
// Distribute `totalSeats` ministerial seats across the coalition's parties so
// portfolios are SHARED (no single party sweeps): each party is guaranteed at
// least one seat, and the remainder is allotted proportional to party size via
// the largest-remainder (Hamilton) method. If there are more parties than
// seats, the largest parties take the available seats (one each). Deterministic:
// ties in size/remainder break toward the party listed first (caller orders by
// party_number).

export interface PartySeatInput {
  partyId: string;
  members: number;
}

export function distributeSeats(
  parties: PartySeatInput[],
  totalSeats: number
): { partyId: string; seats: number }[] {
  const n = parties.length;
  if (n === 0 || totalSeats <= 0) {
    return parties.map((p) => ({ partyId: p.partyId, seats: 0 }));
  }
  // Fewer seats than parties: the largest parties get one seat each.
  if (totalSeats < n) {
    const ranked = parties
      .map((p, i) => ({ ...p, i }))
      .sort((a, b) => b.members - a.members || a.i - b.i)
      .slice(0, totalSeats);
    const winners = new Set(ranked.map((p) => p.partyId));
    return parties.map((p) => ({ partyId: p.partyId, seats: winners.has(p.partyId) ? 1 : 0 }));
  }
  // Each party gets 1; share the rest by largest remainder on member counts.
  const base = parties.map((p) => ({ partyId: p.partyId, seats: 1 }));
  let remaining = totalSeats - n;
  const totalMembers = parties.reduce((s, p) => s + p.members, 0);
  if (remaining > 0 && totalMembers > 0) {
    const quota = parties.map((p, i) => {
      const exact = (remaining * p.members) / totalMembers;
      const floor = Math.floor(exact);
      return { i, floor, rem: exact - floor };
    });
    quota.forEach((q) => (base[q.i].seats += q.floor));
    let allotted = quota.reduce((s, q) => s + q.floor, 0);
    const byRem = [...quota].sort((a, b) => b.rem - a.rem || a.i - b.i);
    let k = 0;
    while (allotted < remaining && k < byRem.length) {
      base[byRem[k].i].seats += 1;
      allotted++;
      k++;
    }
    remaining = 0;
  } else if (remaining > 0) {
    // No member data — hand leftover seats to the first parties, one at a time.
    let k = 0;
    while (remaining > 0) {
      base[k % n].seats += 1;
      remaining--;
      k++;
    }
  }
  return base;
}
