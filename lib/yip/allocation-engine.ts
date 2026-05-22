/**
 * Smart Allocation Engine — Pure function, no side effects, no database calls.
 *
 * Given a list of participants, assigns:
 *   1. Party (ruling / opposition) based on school distribution
 *   2. Parliament Role (Speaker candidates, PM, LoP, Ministers, Shadow Ministers, MPs)
 *   3. Constituency (Lok Sabha, not from student's home state)
 *   4. Committee (distributed across 5 committees)
 */

import { MINISTRIES, COMMITTEES } from "@/lib/yip/constants";
import { CONSTITUENCIES } from "@/lib/yip/data/constituencies";

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

  if (sortedSchools.length === 1) {
    // Only 1 school — random 50/50 split
    const shuffled = shuffle(sortedSchools[0][1]);
    const halfPoint = Math.ceil(shuffled.length * 0.55);
    for (let i = 0; i < shuffled.length; i++) {
      get(shuffled[i].id).party_side = i < halfPoint ? "ruling" : "opposition";
    }
  } else {
    // School with most students → Ruling
    // School with 2nd most → Opposition
    // Remaining: alternate to balance

    // Assign first school to ruling
    for (const p of sortedSchools[0][1]) {
      get(p.id).party_side = "ruling";
    }
    // Assign second school to opposition
    for (const p of sortedSchools[1][1]) {
      get(p.id).party_side = "opposition";
    }

    // Track running counts
    let rulingCount = sortedSchools[0][1].length;
    let oppositionCount = sortedSchools[1][1].length;

    // Remaining schools: assign to whichever side is smaller to balance toward ~55/45
    for (let i = 2; i < sortedSchools.length; i++) {
      const schoolStudents = sortedSchools[i][1];
      const totalSoFar = rulingCount + oppositionCount;
      const targetRuling = Math.ceil((totalSoFar + schoolStudents.length) * 0.55);

      if (rulingCount < targetRuling) {
        for (const p of schoolStudents) {
          get(p.id).party_side = "ruling";
        }
        rulingCount += schoolStudents.length;
      } else {
        for (const p of schoolStudents) {
          get(p.id).party_side = "opposition";
        }
        oppositionCount += schoolStudents.length;
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

  // Cabinet Ministers (8 — one per ministry) from ruling
  const ministryKeys = MINISTRIES.map((m) => m.key);
  const numCabinetToAssign = Math.min(ministryKeys.length, rulingAvailable.length);
  for (let i = 0; i < numCabinetToAssign; i++) {
    const p = rulingAvailable[i];
    get(p.id).parliament_role = "cabinet_minister";
    get(p.id).ministry = ministryKeys[i];
    cabinetMinisters.push({ id: p.id, ministry: ministryKeys[i] });
  }
  rulingAvailable = rulingAvailable.slice(numCabinetToAssign);

  // Shadow Ministers (8 — one per ministry) from opposition
  const numShadowToAssign = Math.min(ministryKeys.length, oppositionAvailable.length);
  for (let i = 0; i < numShadowToAssign; i++) {
    const p = oppositionAvailable[i];
    get(p.id).parliament_role = "shadow_minister";
    get(p.id).ministry = ministryKeys[i];
    shadowMinisters.push({ id: p.id, ministry: ministryKeys[i] });
  }
  oppositionAvailable = oppositionAvailable.slice(numShadowToAssign);

  // ── Step 4: Remaining MPs ─────────────────────────────────────────
  // Already defaulted to "mp" — no action needed for remaining participants.

  // ── Step 5: Constituency Assignment ───────────────────────────────

  const shuffledConstituencies = shuffle([...CONSTITUENCIES]);
  const usedConstituencyIndices = new Set<number>();

  for (const p of participants) {
    const assignment = get(p.id);
    const homeState = p.home_state?.trim().toLowerCase() || "";

    // Find a constituency not from participant's home state
    let assigned = false;
    for (let i = 0; i < shuffledConstituencies.length; i++) {
      if (usedConstituencyIndices.has(i)) continue;
      const c = shuffledConstituencies[i];
      if (homeState && c.state.toLowerCase() === homeState) continue;

      assignment.constituency_name = c.name;
      assignment.constituency_state = c.state;
      usedConstituencyIndices.add(i);
      assigned = true;
      break;
    }

    // Fallback: if we ran out of non-home-state constituencies, use any available
    if (!assigned) {
      for (let i = 0; i < shuffledConstituencies.length; i++) {
        if (usedConstituencyIndices.has(i)) continue;
        const c = shuffledConstituencies[i];
        assignment.constituency_name = c.name;
        assignment.constituency_state = c.state;
        usedConstituencyIndices.add(i);
        assigned = true;
        break;
      }
    }

    // Extreme edge case: more participants than constituencies (543)
    if (!assigned) {
      const fallback = CONSTITUENCIES[Math.floor(Math.random() * CONSTITUENCIES.length)];
      assignment.constituency_name = fallback.name;
      assignment.constituency_state = fallback.state;
    }
  }

  // ── Step 6: Committee Assignment ──────────────────────────────────

  // Map ministry keys to committee themes for matching
  const ministryToCommitteeHint: Record<string, number> = {
    // Best-effort mapping of ministry themes to committee indices
    // 0: Youth in Democracy
    // 1: Youth in Entrepreneurship & Economic Growth
    // 2: Youth Role in Environmental Conservation
    // 3: Youth Against Corruption
    // 4: Youth Awareness in Cyber Security
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
  for (let i = 0; i < committeeNames.length; i++) {
    committeeAssignments.set(i, { ruling: [], opposition: [] });
  }

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
      // Find committee with smallest count for this side
      let bestIdx = 0;
      let bestCount = Infinity;
      for (let i = 0; i < committeeNames.length; i++) {
        const totalInCommittee =
          committeeAssignments.get(i)!.ruling.length +
          committeeAssignments.get(i)!.opposition.length;
        if (totalInCommittee < bestCount) {
          bestCount = totalInCommittee;
          bestIdx = i;
        }
      }
      get(p.id).committee_name = committeeNames[bestIdx];
      committeeAssignments.get(bestIdx)![side].push(p.id);
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
