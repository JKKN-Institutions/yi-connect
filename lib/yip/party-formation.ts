/**
 * Party Formation Engine — Pure function, no side effects, no database calls,
 * NO randomness. Deterministic given input order (unlike allocation-engine's
 * shuffle-based steps, this must be reproducible so the organiser's confirm
 * preview matches what the server writes).
 *
 * Given participants that already carry a BENCH (`party_side` from the
 * allocation engine) and a total party count N (handbook standard 7-8; the
 * Erode 2026 chair locked 5), this plans:
 *   1. How many of the N parties sit on each bench — proportional to bench
 *      sizes, each bench gets at least 1 party (clamped to 1..N-1), with
 *      exact .5 fractions rounded toward the MAJORITY bench.
 *   2. Which party each participant joins — within a bench, party sizes stay
 *      balanced (max difference 1) AND each school is spread as evenly as
 *      possible across that bench's parties (same school-aware round-robin
 *      idea as the committee step in allocation-engine.ts: schools largest
 *      first, each student goes to the party with the fewest of their
 *      schoolmates, tie-broken by the smallest party, then lowest index).
 *
 * The caller (formParties server action) maps benchIndex → a created
 * yip.parties row; this module never touches the database.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type BenchSide = "ruling" | "opposition";

export interface PartyFormationParticipant {
  id: string;
  partySide: BenchSide;
  schoolName: string | null;
}

export interface PartyFormationInput {
  /** Total number of parties across BOTH benches (2-8). */
  partyCount: number;
  participants: PartyFormationParticipant[];
}

export interface PartyFormationAssignment {
  participantId: string;
  side: BenchSide;
  /** 0-based index of the party within its OWN bench. */
  benchIndex: number;
}

export interface PartyFormationPlan {
  /** How many parties sit on each bench (sums to partyCount). */
  benchSplit: { ruling: number; opposition: number };
  assignments: PartyFormationAssignment[];
  /** Member counts per party, indexed by benchIndex, per bench. */
  perPartySizes: { ruling: number[]; opposition: number[] };
  /**
   * Highest number of students from a single school placed inside any one
   * party. Blank/unknown schools are excluded from this metric (they are not
   * "the same school"), though such students are still distributed for size
   * balance.
   */
  maxSameSchoolPerParty: number;
}

// ─── Bench split ────────────────────────────────────────────────────

/**
 * Split `partyCount` parties across the two benches proportionally to bench
 * headcounts. Each bench always gets at least 1 party (clamp 1..partyCount-1),
 * even when a bench is empty — the house model still needs both benches to
 * exist; an empty bench simply ends up with one empty party.
 *
 * Rounding: exact halves (e.g. 4 parties on a 30/50 house → 1.5 ruling) round
 * toward the bench with MORE participants; a dead-equal house breaks the tie
 * toward ruling (deterministic).
 */
export function splitBenchParties(
  partyCount: number,
  rulingCount: number,
  oppositionCount: number
): { ruling: number; opposition: number } {
  if (!Number.isInteger(partyCount) || partyCount < 2) {
    throw new Error(`partyCount must be an integer >= 2 (got ${partyCount})`);
  }
  const total = rulingCount + oppositionCount;
  let ruling: number;
  if (total === 0) {
    // Degenerate (no participants): split as evenly as possible, ruling first.
    ruling = Math.ceil(partyCount / 2);
  } else {
    const exact = (partyCount * rulingCount) / total;
    const floor = Math.floor(exact);
    const frac = exact - floor;
    if (Math.abs(frac - 0.5) < 1e-9) {
      // Round half toward the majority bench.
      ruling = rulingCount >= oppositionCount ? floor + 1 : floor;
    } else {
      ruling = Math.round(exact);
    }
  }
  ruling = Math.min(Math.max(ruling, 1), partyCount - 1);
  return { ruling, opposition: partyCount - ruling };
}

// ─── Within-bench distribution ──────────────────────────────────────

const schoolKeyOf = (p: PartyFormationParticipant) =>
  (p.schoolName ?? "").trim().toLowerCase();

/**
 * Distribute one bench's members across that bench's parties.
 * Invariants (see tests): party sizes differ by at most 1, and a school of
 * size s lands at most ceil(s / partyCount) students in any single party.
 */
function distributeBench(
  members: PartyFormationParticipant[],
  partyCount: number
): {
  perParty: string[][]; // participant ids per benchIndex
  schoolCounts: Array<Map<string, number>>; // per benchIndex: school → count
} {
  const sizes: number[] = new Array(partyCount).fill(0);
  const schoolCounts: Array<Map<string, number>> = Array.from(
    { length: partyCount },
    () => new Map<string, number>()
  );
  const perParty: string[][] = Array.from({ length: partyCount }, () => []);

  // Group by school, preserving input order within each school.
  const schoolMap = new Map<string, PartyFormationParticipant[]>();
  for (const m of members) {
    const key = schoolKeyOf(m);
    if (!schoolMap.has(key)) schoolMap.set(key, []);
    schoolMap.get(key)!.push(m);
  }

  // Largest schools first (stable sort → first-seen order breaks ties).
  const sortedSchools = [...schoolMap.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [key, students] of sortedSchools) {
    for (const s of students) {
      // Party with the fewest of this student's schoolmates; tie-break the
      // smallest party overall; tie-break lowest index.
      let bestIdx = 0;
      let bestSchoolCount = Infinity;
      let bestSize = Infinity;
      for (let i = 0; i < partyCount; i++) {
        const sc = schoolCounts[i].get(key) ?? 0;
        if (sc < bestSchoolCount || (sc === bestSchoolCount && sizes[i] < bestSize)) {
          bestIdx = i;
          bestSchoolCount = sc;
          bestSize = sizes[i];
        }
      }
      perParty[bestIdx].push(s.id);
      sizes[bestIdx] += 1;
      schoolCounts[bestIdx].set(key, (schoolCounts[bestIdx].get(key) ?? 0) + 1);
    }
  }

  return { perParty, schoolCounts };
}

// ─── Main planner ───────────────────────────────────────────────────

export function planPartyFormation(input: PartyFormationInput): PartyFormationPlan {
  const { partyCount, participants } = input;
  if (!Number.isInteger(partyCount) || partyCount < 2 || partyCount > 8) {
    throw new Error(`partyCount must be an integer between 2 and 8 (got ${partyCount})`);
  }

  const rulingMembers = participants.filter((p) => p.partySide === "ruling");
  const oppositionMembers = participants.filter((p) => p.partySide === "opposition");

  const benchSplit = splitBenchParties(
    partyCount,
    rulingMembers.length,
    oppositionMembers.length
  );

  const rulingDist = distributeBench(rulingMembers, benchSplit.ruling);
  const oppositionDist = distributeBench(oppositionMembers, benchSplit.opposition);

  const assignments: PartyFormationAssignment[] = [];
  for (let i = 0; i < benchSplit.ruling; i++) {
    for (const id of rulingDist.perParty[i]) {
      assignments.push({ participantId: id, side: "ruling", benchIndex: i });
    }
  }
  for (let i = 0; i < benchSplit.opposition; i++) {
    for (const id of oppositionDist.perParty[i]) {
      assignments.push({ participantId: id, side: "opposition", benchIndex: i });
    }
  }

  // Max same-school concentration across every party on both benches.
  // The blank key ("") groups students with no recorded school — skip it.
  let maxSameSchoolPerParty = 0;
  for (const dist of [rulingDist, oppositionDist]) {
    for (const counts of dist.schoolCounts) {
      for (const [key, n] of counts) {
        if (key === "") continue;
        if (n > maxSameSchoolPerParty) maxSameSchoolPerParty = n;
      }
    }
  }

  return {
    benchSplit,
    assignments,
    perPartySizes: {
      ruling: rulingDist.perParty.map((ids) => ids.length),
      opposition: oppositionDist.perParty.map((ids) => ids.length),
    },
    maxSameSchoolPerParty,
  };
}

// ─── Fill EXISTING parties ──────────────────────────────────────────

export interface PartyFillAssignment {
  participantId: string;
  side: BenchSide;
  /** 0-based index of the party within its OWN bench (order by party_number). */
  benchIndex: number;
}

/**
 * Distribute participants who ALREADY carry a bench (`partySide`) into a FIXED
 * number of parties per bench. Unlike planPartyFormation (which decides how many
 * parties each bench gets and is paired with creating party rows), this is for
 * when the chapter's parties already EXIST: allocation only needs to assign
 * membership (party_id), reusing the existing party rows — so nothing is created
 * or deleted (YUVA desks / manifestos survive). Within each bench, party sizes
 * stay balanced and schools are spread out (same `distributeBench` as formation).
 *
 * Participants whose bench has zero parties get NO assignment (the caller must
 * detect that and surface it — e.g. "opposition students but no opposition
 * party"). The caller maps (side, benchIndex) → an existing party row, where
 * benchIndex 0 is that bench's lowest party_number.
 */
export function planPartyFill(
  participants: PartyFormationParticipant[],
  rulingPartyCount: number,
  oppositionPartyCount: number
): PartyFillAssignment[] {
  const out: PartyFillAssignment[] = [];

  if (rulingPartyCount > 0) {
    const ruling = participants.filter((p) => p.partySide === "ruling");
    const dist = distributeBench(ruling, rulingPartyCount);
    for (let i = 0; i < rulingPartyCount; i++) {
      for (const id of dist.perParty[i]) {
        out.push({ participantId: id, side: "ruling", benchIndex: i });
      }
    }
  }

  if (oppositionPartyCount > 0) {
    const opposition = participants.filter((p) => p.partySide === "opposition");
    const dist = distributeBench(opposition, oppositionPartyCount);
    for (let i = 0; i < oppositionPartyCount; i++) {
      for (const id of dist.perParty[i]) {
        out.push({ participantId: id, side: "opposition", benchIndex: i });
      }
    }
  }

  return out;
}
