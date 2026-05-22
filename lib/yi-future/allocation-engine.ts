/**
 * Smart Allocation Engine — bipartite (teams ↔ jury / mentor).
 *
 * Pure function, no DB, no side effects. Deterministic given same input
 * (uses seeded shuffle). Based on YIP's allocation-engine but adapted for
 * the Future 6.0 model where jury scores teams rather than assigning roles.
 *
 * Properties:
 * - Every team is covered by at least `minJuryPerTeam` jury (when capacity allows)
 * - No jury exceeds `maxTeamsPerJury`
 * - Archetype diversity prioritized (each team gets ≥2 different archetypes if possible)
 * - Reports `teams_under_covered` when capacity is insufficient (engine doesn't silently fail)
 */

import type { Database } from "@/types/yi-future/database";

export type JuryArchetype = Database["future"]["Enums"]["jury_archetype"];

export interface AllocationJury {
  id: string;
  archetype: JuryArchetype;
  chapter_id?: string;
  /** Optional: any chapters this jury has a CoI with (v2 feature) */
  conflict_chapter_ids?: string[];
}

export interface AllocationTeam {
  id: string;
  chapter_id: string;
  problem_statement_id?: string | null;
}

export interface AllocationInput {
  teams: AllocationTeam[];
  jury: AllocationJury[];
  minJuryPerTeam?: number; // default 3
  maxTeamsPerJury?: number; // default 8
}

export interface AllocationAssignment {
  jury_id: string;
  team_id: string;
}

export interface AllocationSummary {
  teams_covered: number;
  teams_under_covered: string[];
  jury_load: Record<string, number>;
  archetype_coverage: Record<string, JuryArchetype[]>; // teamId → archetypes present
}

export interface AllocationResult {
  assignments: AllocationAssignment[];
  summary: AllocationSummary;
}

// ─── Seeded PRNG (mulberry32) for deterministic shuffle ──────────────
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Main allocation ────────────────────────────────────────────────
export function allocateJury(input: AllocationInput): AllocationResult {
  const minJuryPerTeam = input.minJuryPerTeam ?? 3;
  const maxTeamsPerJury = input.maxTeamsPerJury ?? 8;
  const rnd = mulberry32(
    input.teams.length * 1000 + input.jury.length + 42
  );

  const shuffledJury = shuffle(input.jury, rnd);
  const shuffledTeams = shuffle(input.teams, rnd);

  const juryLoad: Record<string, number> = {};
  const teamCoverage: Record<string, JuryArchetype[]> = {};
  const assignments: AllocationAssignment[] = [];

  for (const j of shuffledJury) juryLoad[j.id] = 0;
  for (const t of shuffledTeams) teamCoverage[t.id] = [];

  // Pass 1: for each team, assign `minJuryPerTeam` jury, prioritizing
  // archetype diversity and jury with least load.
  for (const team of shuffledTeams) {
    while (teamCoverage[team.id].length < minJuryPerTeam) {
      // Pick candidates: not at cap, not already assigned to this team,
      // not CoI with team's chapter
      const candidates = shuffledJury.filter((j) => {
        if (juryLoad[j.id] >= maxTeamsPerJury) return false;
        if (
          assignments.some(
            (a) => a.jury_id === j.id && a.team_id === team.id
          )
        )
          return false;
        if (j.conflict_chapter_ids?.includes(team.chapter_id)) return false;
        return true;
      });

      if (candidates.length === 0) break; // no more jury available for this team

      // Prefer jury whose archetype is NOT yet on this team
      const currentArchetypes = new Set(teamCoverage[team.id]);
      const diverseFirst = candidates.filter(
        (j) => !currentArchetypes.has(j.archetype)
      );
      const pool = diverseFirst.length > 0 ? diverseFirst : candidates;

      // Pick least-loaded
      const pick = pool.reduce((best, j) =>
        juryLoad[j.id] < juryLoad[best.id] ? j : best
      );

      assignments.push({ jury_id: pick.id, team_id: team.id });
      juryLoad[pick.id]++;
      teamCoverage[team.id].push(pick.archetype);
    }
  }

  // Summary
  const teams_covered = shuffledTeams.filter(
    (t) => teamCoverage[t.id].length >= minJuryPerTeam
  ).length;
  const teams_under_covered = shuffledTeams
    .filter((t) => teamCoverage[t.id].length < minJuryPerTeam)
    .map((t) => t.id);

  return {
    assignments,
    summary: {
      teams_covered,
      teams_under_covered,
      jury_load: juryLoad,
      archetype_coverage: teamCoverage,
    },
  };
}

// ─── Mentor allocation: thin wrapper with different knobs ────────────
export interface MentorAllocationInput {
  teams: AllocationTeam[];
  mentors: { id: string; chapter_id?: string; expertise?: string }[];
  minMentorsPerTeam?: number; // default 1
  maxTeamsPerMentor?: number; // default 5
}

export interface MentorAllocationResult {
  assignments: { mentor_id: string; team_id: string }[];
  summary: {
    teams_covered: number;
    teams_under_covered: string[];
    mentor_load: Record<string, number>;
  };
}

export function allocateMentors(
  input: MentorAllocationInput
): MentorAllocationResult {
  const minPer = input.minMentorsPerTeam ?? 1;
  const maxTeams = input.maxTeamsPerMentor ?? 5;
  const rnd = mulberry32(input.teams.length * 1000 + input.mentors.length);
  const teams = shuffle(input.teams, rnd);
  const mentors = shuffle(input.mentors, rnd);

  const load: Record<string, number> = {};
  const cover: Record<string, string[]> = {};
  const assignments: { mentor_id: string; team_id: string }[] = [];
  for (const m of mentors) load[m.id] = 0;
  for (const t of teams) cover[t.id] = [];

  for (const team of teams) {
    while (cover[team.id].length < minPer) {
      const candidates = mentors.filter(
        (m) => load[m.id] < maxTeams && !cover[team.id].includes(m.id)
      );
      if (candidates.length === 0) break;
      const pick = candidates.reduce((best, m) =>
        load[m.id] < load[best.id] ? m : best
      );
      assignments.push({ mentor_id: pick.id, team_id: team.id });
      load[pick.id]++;
      cover[team.id].push(pick.id);
    }
  }

  const teams_under_covered = teams
    .filter((t) => cover[t.id].length < minPer)
    .map((t) => t.id);

  return {
    assignments,
    summary: {
      teams_covered: teams.length - teams_under_covered.length,
      teams_under_covered,
      mentor_load: load,
    },
  };
}
