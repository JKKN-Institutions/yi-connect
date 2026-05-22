/**
 * Minimal self-test harness for the allocation engine.
 * Run ad-hoc: tsx src/lib/__tests__/allocation.test.ts
 * (Not a full test suite; formal test runner added in Phase 18.)
 */

import { allocateJury, allocateMentors } from "../allocation-engine";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function test(name: string, fn: () => void) {
  console.log(`\n▶ ${name}`);
  try {
    fn();
    console.log(`  PASS`);
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

test("allocate 5 teams × 6 jury, min 3 per team — all covered", () => {
  const teams = Array.from({ length: 5 }, (_, i) => ({
    id: `t${i}`,
    chapter_id: "c1",
  }));
  const jury = Array.from({ length: 6 }, (_, i) => ({
    id: `j${i}`,
    archetype: (["policy", "industry", "senior_yi", "academic"] as const)[
      i % 4
    ],
  }));
  const result = allocateJury({ teams, jury, minJuryPerTeam: 3 });
  assert(result.summary.teams_covered === 5, "all 5 teams covered");
  assert(
    result.summary.teams_under_covered.length === 0,
    "no under-covered teams"
  );
  assert(
    result.assignments.length === 15,
    "15 total assignments (5 teams × 3)"
  );
});

test("allocate 10 teams × 3 jury — some teams under-covered (reports gap)", () => {
  const teams = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    chapter_id: "c1",
  }));
  const jury = Array.from({ length: 3 }, (_, i) => ({
    id: `j${i}`,
    archetype: "policy" as const,
  }));
  const result = allocateJury({
    teams,
    jury,
    minJuryPerTeam: 3,
    maxTeamsPerJury: 8,
  });
  assert(
    result.summary.teams_under_covered.length > 0,
    "under-covered reported when capacity is insufficient"
  );
});

test("archetype diversity: each team gets multiple archetypes when available", () => {
  const teams = Array.from({ length: 3 }, (_, i) => ({
    id: `t${i}`,
    chapter_id: "c1",
  }));
  const jury = [
    { id: "j1", archetype: "policy" as const },
    { id: "j2", archetype: "industry" as const },
    { id: "j3", archetype: "academic" as const },
    { id: "j4", archetype: "senior_yi" as const },
  ];
  const result = allocateJury({ teams, jury, minJuryPerTeam: 3 });
  for (const team of teams) {
    const archetypes = new Set(result.summary.archetype_coverage[team.id]);
    assert(archetypes.size >= 2, `team ${team.id} has ≥2 archetypes`);
  }
});

test("determinism: same input → same assignments", () => {
  const teams = [
    { id: "t1", chapter_id: "c1" },
    { id: "t2", chapter_id: "c1" },
  ];
  const jury = [
    { id: "j1", archetype: "policy" as const },
    { id: "j2", archetype: "industry" as const },
    { id: "j3", archetype: "academic" as const },
  ];
  const r1 = allocateJury({ teams, jury, minJuryPerTeam: 2 });
  const r2 = allocateJury({ teams, jury, minJuryPerTeam: 2 });
  assert(
    JSON.stringify(r1.assignments.sort()) ===
      JSON.stringify(r2.assignments.sort()),
    "deterministic output"
  );
});

test("mentor allocation: 1 mentor per team, max 5 teams per mentor", () => {
  const teams = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    chapter_id: "c1",
  }));
  const mentors = Array.from({ length: 3 }, (_, i) => ({ id: `m${i}` }));
  const result = allocateMentors({ teams, mentors });
  assert(result.summary.teams_covered === 10, "all 10 teams have a mentor");
  for (const [mid, load] of Object.entries(result.summary.mentor_load)) {
    assert(load <= 5, `mentor ${mid} load ${load} ≤ 5`);
  }
});

console.log("\n═════════════════════════════════════");
console.log("Allocation Engine Test Suite — Complete");
console.log("═════════════════════════════════════\n");
