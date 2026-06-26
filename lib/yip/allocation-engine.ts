/**
 * Smart Allocation Engine — Pure function, no side effects, no database calls.
 *
 * Given a list of participants, assigns:
 *   1. Party (ruling / opposition) based on school distribution
 *   2. Parliament Role (Speaker candidates, PM, LoP, Ministers, Shadow Ministers, MPs)
 *   3. Constituency (Lok Sabha, not from student's home state)
 *   4. Committee (distributed across 5 committees)
 */

import { COMMITTEES } from "@/lib/yip/constants";
import { effectiveMinistries, effectiveCabinetCount } from "@/lib/yip/cabinet";
import {
  CONSTITUENCIES,
  PROMINENT_CONSTITUENCIES,
} from "@/lib/yip/data/constituencies";

// ─── Types ──────────────────────────────────────────────────────────

export interface AllocationParticipant {
  id: string;
  full_name: string;
  school_name: string;
  class: number;
  home_state: string | null;
}

export interface AllocationInput {
  participants: AllocationParticipant[];
  committees?: string[]; // custom committee names, defaults to COMMITTEES
  // The event's host/chapter state (e.g. "Tamil Nadu" for an Erode event).
  // Constituencies from this state are excluded from the pool entirely, so the
  // rule generalises across chapters: Erode excludes TN, Mizoram excludes
  // Mizoram, etc. Optional — when absent, only each student's home_state is
  // avoided (legacy behaviour).
  excludeState?: string;
  // Per-event cabinet override: the ministry portfolios and how many cabinet
  // (and shadow) seats to seat. When absent, falls back to the MINISTRIES
  // constant (8). Mirrors events.cabinet_ministries / cabinet_ministry_count.
  cabinetMinistries?: { key: string; label: string }[];
  cabinetCount?: number;
}

export interface ParticipantAssignment {
  participantId: string;
  party_side: "ruling" | "opposition";
  parliament_role: string;
  ministry: string | null;
  constituency_name: string;
  constituency_state: string;
  committee_name: string;
}

export interface AllocationSummary {
  ruling_count: number;
  opposition_count: number;
  speaker_candidates: string[];
  pm: string | null;
  lop: string | null;
  cabinet_ministers: Array<{ id: string; ministry: string }>;
  shadow_ministers: Array<{ id: string; ministry: string }>;
  committees: Array<{ name: string; count: number }>;
}

export interface AllocationResult {
  assignments: ParticipantAssignment[];
  summary: AllocationSummary;
}

// ─── Fisher-Yates Shuffle ───────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Main Allocation Function ───────────────────────────────────────

export function runAllocation(input: AllocationInput): AllocationResult {
  const { participants } = input;

  if (participants.length === 0) {
    return {
      assignments: [],
      summary: {
        ruling_count: 0,
        opposition_count: 0,
        speaker_candidates: [],
        pm: null,
        lop: null,
        cabinet_ministers: [],
        shadow_ministers: [],
        committees: [],
      },
    };
  }

  const committeeNames = input.committees && input.committees.length > 0
    ? input.committees
    : [...COMMITTEES];

  // Build a mutable map: participantId → assignment (filled incrementally)
  const assignmentMap = new Map<string, ParticipantAssignment>();
  for (const p of participants) {
    assignmentMap.set(p.id, {
      participantId: p.id,
      party_side: "ruling",
      parliament_role: "mp",
      ministry: null,
      constituency_name: "",
      constituency_state: "",
      committee_name: "",
    });
  }

  // Helper to get assignment
  const get = (id: string) => assignmentMap.get(id)!;

  // ── Step 1: Party Formation (school-based) ────────────────────────

  // Group by school
  const schoolMap = new Map<string, AllocationParticipant[]>();
  for (const p of participants) {
    const key = p.school_name.trim().toLowerCase();
    if (!schoolMap.has(key)) schoolMap.set(key, []);
    schoolMap.get(key)!.push(p);
  }

  // Sort schools by student count descending
  const sortedSchools = [...schoolMap.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  // Spread each school ACROSS both benches instead of assigning a whole school
  // to one side. Previously the largest school went entirely to Ruling, the 2nd
  // to Opposition, etc. — so classmates never debated each other and one school
  // could dominate a bench. Now we walk students school-by-school (largest
  // school first) and place each one on whichever bench keeps the house closest
  // to the ~55% Ruling target. Because the balance is re-evaluated per student,
  // a big school's members alternate between benches and end up split ~55/45.
  const RULING_TARGET = 0.55;
  let rulingCount = 0;
  let oppositionCount = 0;
  for (const [, schoolStudents] of sortedSchools) {
    for (const p of shuffle(schoolStudents)) {
      const projectedTotal = rulingCount + oppositionCount + 1;
      if (rulingCount < Math.round(projectedTotal * RULING_TARGET)) {
        get(p.id).party_side = "ruling";
        rulingCount += 1;
      } else {
        get(p.id).party_side = "opposition";
        oppositionCount += 1;
      }
    }
  }

  // Collect party members
  const rulingIds = participants.filter((p) => get(p.id).party_side === "ruling");
  const oppositionIds = participants.filter((p) => get(p.id).party_side === "opposition");

  // ── Step 2: Speaker Candidates (6 total, 3 per side) ──────────────

  const speakerCandidateIds: string[] = [];

  function pickSpeakerCandidates(
    pool: AllocationParticipant[],
    count: number
  ): string[] {
    // Prefer class 11-12 students
    const senior = pool.filter((p) => p.class >= 11);
    const source = senior.length >= count ? senior : pool;
    const picked = shuffle(source).slice(0, count);
    return picked.map((p) => p.id);
  }

  const rulingSpeakers = pickSpeakerCandidates(rulingIds, Math.min(3, rulingIds.length));
  const oppositionSpeakers = pickSpeakerCandidates(oppositionIds, Math.min(3, oppositionIds.length));

  for (const id of [...rulingSpeakers, ...oppositionSpeakers]) {
    get(id).parliament_role = "speaker";
    speakerCandidateIds.push(id);
  }

  // ── Step 3: Leadership Roles ──────────────────────────────────────

  // Remaining ruling/opposition members (exclude speaker candidates)
  const speakerSet = new Set(speakerCandidateIds);
  let rulingAvailable = shuffle(
    rulingIds.filter((p) => !speakerSet.has(p.id))
  );
  let oppositionAvailable = shuffle(
    oppositionIds.filter((p) => !speakerSet.has(p.id))
  );

  // Sort by class descending for leadership selection (highest class first)
  rulingAvailable.sort((a, b) => b.class - a.class);
  oppositionAvailable.sort((a, b) => b.class - a.class);

  let pmId: string | null = null;
  let lopId: string | null = null;
  const cabinetMinisters: Array<{ id: string; ministry: string }> = [];
  const shadowMinisters: Array<{ id: string; ministry: string }> = [];

  // PM from ruling
  if (rulingAvailable.length > 0) {
    pmId = rulingAvailable[0].id;
    get(pmId).parliament_role = "prime_minister";
    rulingAvailable = rulingAvailable.slice(1);
  }

  // LoP from opposition
  if (oppositionAvailable.length > 0) {
    lopId = oppositionAvailable[0].id;
    get(lopId).parliament_role = "leader_of_opposition";
    oppositionAvailable = oppositionAvailable.slice(1);
  }

  // Cabinet Ministers (one per ministry) from ruling. The ministry list + how
  // many seats come from the event's per-event cabinet config when set, else
  // the MINISTRIES constant (8). When the count exceeds the named portfolios we
  // pad with generic keys so every seat still gets a distinct ministry tag.
  const ministries = effectiveMinistries(input.cabinetMinistries);
  const cabinetSeats = effectiveCabinetCount(
    input.cabinetCount,
    input.cabinetMinistries
  );
  const ministryKeyAt = (i: number) => ministries[i]?.key ?? `ministry_${i + 1}`;
  const numCabinetToAssign = Math.min(cabinetSeats, rulingAvailable.length);
  for (let i = 0; i < numCabinetToAssign; i++) {
    const p = rulingAvailable[i];
    get(p.id).parliament_role = "cabinet_minister";
    get(p.id).ministry = ministryKeyAt(i);
    cabinetMinisters.push({ id: p.id, ministry: ministryKeyAt(i) });
  }
  rulingAvailable = rulingAvailable.slice(numCabinetToAssign);

  // Shadow Ministers (one per ministry) from opposition
  const numShadowToAssign = Math.min(cabinetSeats, oppositionAvailable.length);
  for (let i = 0; i < numShadowToAssign; i++) {
    const p = oppositionAvailable[i];
    get(p.id).parliament_role = "shadow_minister";
    get(p.id).ministry = ministryKeyAt(i);
    shadowMinisters.push({ id: p.id, ministry: ministryKeyAt(i) });
  }
  oppositionAvailable = oppositionAvailable.slice(numShadowToAssign);

  // ── Step 4: Remaining MPs ─────────────────────────────────────────
  // Already defaulted to "mp" — no action needed for remaining participants.

  // ── Step 5: Constituency Assignment ───────────────────────────────

  // Build the candidate pool. PROMINENT constituencies (well-known cities across
  // regions) come first so MPs get recognisable seats for debate; the rest of
  // CONSTITUENCIES follows as fallback. The event's host state (excludeState) is
  // dropped from the pool entirely — this generalises "exclude Tamil Nadu" to
  // whatever chapter is hosting. Duplicates (a prominent seat also in the full
  // list) are de-duplicated by name+state.
  const excludeState = input.excludeState?.trim().toLowerCase() || "";
  const keepState = (c: { state: string }) =>
    !excludeState || c.state.toLowerCase() !== excludeState;
  const seenSeat = new Set<string>();
  const orderedPool: { name: string; state: string }[] = [];
  for (const c of [
    ...shuffle(PROMINENT_CONSTITUENCIES.filter(keepState)),
    ...shuffle(CONSTITUENCIES.filter(keepState)),
  ]) {
    const seatKey = `${c.name}|${c.state}`;
    if (seenSeat.has(seatKey)) continue;
    seenSeat.add(seatKey);
    orderedPool.push(c);
  }
  const usedConstituencyIndices = new Set<number>();

  for (const p of participants) {
    const assignment = get(p.id);
    const homeState = p.home_state?.trim().toLowerCase() || "";

    // Pass 1: a seat not from the participant's own home state, from the pool
    // (prominent first). The host-state exclusion is already baked into the pool.
    let assigned = false;
    for (let i = 0; i < orderedPool.length; i++) {
      if (usedConstituencyIndices.has(i)) continue;
      const c = orderedPool[i];
      if (homeState && c.state.toLowerCase() === homeState) continue;
      assignment.constituency_name = c.name;
      assignment.constituency_state = c.state;
      usedConstituencyIndices.add(i);
      assigned = true;
      break;
    }

    // Pass 2: ran out of non-home-state seats — take any remaining pool seat.
    if (!assigned) {
      for (let i = 0; i < orderedPool.length; i++) {
        if (usedConstituencyIndices.has(i)) continue;
        const c = orderedPool[i];
        assignment.constituency_name = c.name;
        assignment.constituency_state = c.state;
        usedConstituencyIndices.add(i);
        assigned = true;
        break;
      }
    }

    // Pass 3: more participants than the available pool (e.g. tiny single-state
    // pool after exclusion). Reuse a random seat from the full list so everyone
    // still gets a constituency.
    if (!assigned) {
      const fallbackPool = CONSTITUENCIES.filter(keepState);
      const source = fallbackPool.length > 0 ? fallbackPool : CONSTITUENCIES;
      const fallback = source[Math.floor(Math.random() * source.length)];
      assignment.constituency_name = fallback.name;
      assignment.constituency_state = fallback.state;
    }
  }

  // ── Step 6: Committee Assignment ──────────────────────────────────

  // Map ministry keys to committee themes for matching
  const ministryToCommitteeHint: Record<string, number> = {
    // Best-effort mapping of ministry themes to committee indices
    // 0: Ministry of Education
    // 1: Ministry of Finance
    // 2: Ministry of Health & Family Welfare
    // 3: Ministry of Environment
    // 4: Ministry of Electronics & IT
    home: 3,                // Home Affairs → Corruption
    finance: 1,             // Finance → Entrepreneurship
    education: 0,           // Education → Democracy
    health: 2,              // Health → Environmental Conservation
    women_child: 0,         // Women & Child → Democracy
    disaster_management: 2, // Disaster → Environmental Conservation
    youth_sports: 1,        // Youth & Sports → Entrepreneurship
    it_digital: 4,          // IT & Digital → Cyber Security
  };

  // Track committee assignments for balance
  const committeeAssignments: Map<number, { ruling: string[]; opposition: string[] }> = new Map();
  // Per-committee headcount of each school, so we can spread schools across
  // committees (not just keep committee sizes even).
  const committeeSchoolCount: Map<number, Map<string, number>> = new Map();
  for (let i = 0; i < committeeNames.length; i++) {
    committeeAssignments.set(i, { ruling: [], opposition: [] });
    committeeSchoolCount.set(i, new Map());
  }
  const schoolKeyOf = new Map(
    participants.map((p) => [p.id, p.school_name.trim().toLowerCase()])
  );
  const bumpSchool = (committeeIdx: number, pid: string) => {
    const sk = schoolKeyOf.get(pid) ?? "";
    const m = committeeSchoolCount.get(committeeIdx)!;
    m.set(sk, (m.get(sk) ?? 0) + 1);
  };

  // First: assign ministers to their matching committee if possible
  const alreadyAssignedToCommittee = new Set<string>();

  for (const p of participants) {
    const assignment = get(p.id);
    if (!assignment.ministry) continue;

    // Only use default committee hints if using default committees
    if (input.committees && input.committees.length > 0) continue;

    const hintIdx = ministryToCommitteeHint[assignment.ministry];
    if (hintIdx !== undefined && hintIdx < committeeNames.length) {
      assignment.committee_name = committeeNames[hintIdx];
      const side = assignment.party_side;
      committeeAssignments.get(hintIdx)![side].push(p.id);
      bumpSchool(hintIdx, p.id);
      alreadyAssignedToCommittee.add(p.id);
    }
  }

  // Round-robin remaining participants across committees, ensuring both parties are present
  const remaining = shuffle(
    participants.filter((p) => !alreadyAssignedToCommittee.has(p.id))
  );

  // Separate remaining by party for interleaved assignment
  const remainingRuling = remaining.filter((p) => get(p.id).party_side === "ruling");
  const remainingOpposition = remaining.filter((p) => get(p.id).party_side === "opposition");

  function assignToSmallestCommittee(
    pool: AllocationParticipant[],
    side: "ruling" | "opposition"
  ) {
    for (const p of pool) {
      const sk = schoolKeyOf.get(p.id) ?? "";
      // Pick the committee that (1) has the fewest students from THIS student's
      // school, then (2) is smallest overall. This spreads each school across
      // committees while keeping committee sizes even.
      let bestIdx = 0;
      let bestSchoolCount = Infinity;
      let bestTotal = Infinity;
      for (let i = 0; i < committeeNames.length; i++) {
        const schoolCount = committeeSchoolCount.get(i)!.get(sk) ?? 0;
        const totalInCommittee =
          committeeAssignments.get(i)!.ruling.length +
          committeeAssignments.get(i)!.opposition.length;
        if (
          schoolCount < bestSchoolCount ||
          (schoolCount === bestSchoolCount && totalInCommittee < bestTotal)
        ) {
          bestSchoolCount = schoolCount;
          bestTotal = totalInCommittee;
          bestIdx = i;
        }
      }
      get(p.id).committee_name = committeeNames[bestIdx];
      committeeAssignments.get(bestIdx)![side].push(p.id);
      bumpSchool(bestIdx, p.id);
    }
  }

  assignToSmallestCommittee(remainingRuling, "ruling");
  assignToSmallestCommittee(remainingOpposition, "opposition");

  // ── Build Result ──────────────────────────────────────────────────

  const assignments = participants.map((p) => get(p.id));

  const committeeSummary = committeeNames.map((name, i) => {
    const data = committeeAssignments.get(i)!;
    return { name, count: data.ruling.length + data.opposition.length };
  });

  return {
    assignments,
    summary: {
      ruling_count: rulingIds.length,
      opposition_count: oppositionIds.length,
      speaker_candidates: speakerCandidateIds,
      pm: pmId,
      lop: lopId,
      cabinet_ministers: cabinetMinisters,
      shadow_ministers: shadowMinisters,
      committees: committeeSummary,
    },
  };
}
