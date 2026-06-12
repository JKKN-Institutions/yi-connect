/**
 * Party-formation lib tests (tsx harness, same pattern as election-outcome).
 * Run: npx tsx lib/yip/__tests__/party-formation.test.ts
 *
 * Covers the bench-split rule (proportional, ≥1 party per bench, clamp
 * 1..N-1, exact halves round toward the majority bench), within-bench size
 * balance (max diff 1), school spread (a school of s never exceeds
 * ceil(s / partiesOnBench) in one party), the 2 and 8 party-count edges, a
 * bench with fewer participants than parties (empty parties allowed), and
 * determinism (same input → identical plan).
 */

import {
  planPartyFormation,
  splitBenchParties,
  type PartyFormationParticipant,
} from "../party-formation";

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

/** Build n participants on a side, cycling through the given schools. */
function bench(
  side: "ruling" | "opposition",
  n: number,
  schools: string[],
  idPrefix: string
): PartyFormationParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${idPrefix}${i + 1}`,
    partySide: side,
    schoolName: schools[i % schools.length],
  }));
}

function maxDiff(sizes: number[]): number {
  return Math.max(...sizes) - Math.min(...sizes);
}

// ─── splitBenchParties ──────────────────────────────────────────

test("bench split: 5 parties on 77/63 (Erode) → 3 ruling / 2 opposition", () => {
  const s = splitBenchParties(5, 77, 63);
  assert(s.ruling === 3 && s.opposition === 2, "5×(77/140)=2.75 rounds to 3/2");
});

test("bench split: exact half rounds toward the majority bench", () => {
  const oppMajority = splitBenchParties(4, 30, 50); // 4×(30/80) = 1.5
  assert(
    oppMajority.ruling === 1 && oppMajority.opposition === 3,
    "1.5 ruling with an opposition majority → 1/3"
  );
  const rulMajority = splitBenchParties(4, 50, 30); // 4×(50/80) = 2.5
  assert(
    rulMajority.ruling === 3 && rulMajority.opposition === 1,
    "2.5 ruling with a ruling majority → 3/1"
  );
  const deadEqual = splitBenchParties(5, 70, 70); // 2.5, equal house
  assert(
    deadEqual.ruling === 3 && deadEqual.opposition === 2,
    "dead-equal house breaks the half toward ruling (3/2)"
  );
});

test("bench split: clamp keeps every bench at >= 1 party", () => {
  const lopsided = splitBenchParties(5, 100, 2); // 5×(100/102) ≈ 4.9 → 5 → clamp 4
  assert(
    lopsided.ruling === 4 && lopsided.opposition === 1,
    "near-total ruling majority still leaves opposition 1 party"
  );
  const emptyOpp = splitBenchParties(5, 100, 0);
  assert(
    emptyOpp.ruling === 4 && emptyOpp.opposition === 1,
    "an empty bench still gets 1 (empty) party"
  );
});

// ─── planPartyFormation: Erode shape ────────────────────────────

test("5 parties on 77/63 → 3/2 split, every party size within max-diff-1", () => {
  const participants = [
    ...bench("ruling", 77, ["School A", "School B", "School C", "School D", "School E"], "r"),
    ...bench("opposition", 63, ["School F", "School G", "School H", "School I"], "o"),
  ];
  const plan = planPartyFormation({ partyCount: 5, participants });

  assert(
    plan.benchSplit.ruling === 3 && plan.benchSplit.opposition === 2,
    "bench split is 3 ruling / 2 opposition"
  );
  assert(plan.assignments.length === 140, "all 140 participants assigned");
  assert(
    plan.perPartySizes.ruling.reduce((a, b) => a + b, 0) === 77 &&
      plan.perPartySizes.opposition.reduce((a, b) => a + b, 0) === 63,
    "per-party sizes sum back to the bench headcounts"
  );
  assert(
    maxDiff(plan.perPartySizes.ruling) <= 1,
    `ruling party sizes balanced (got ${plan.perPartySizes.ruling.join("/")})`
  );
  assert(
    maxDiff(plan.perPartySizes.opposition) <= 1,
    `opposition party sizes balanced (got ${plan.perPartySizes.opposition.join("/")})`
  );
  // Every assignment points at a real bench party.
  assert(
    plan.assignments.every(
      (a) =>
        a.benchIndex >= 0 &&
        a.benchIndex < (a.side === "ruling" ? 3 : 2)
    ),
    "every benchIndex is in range for its side"
  );
});

// ─── School spread ──────────────────────────────────────────────

test("a school of 9 on one bench spreads to at most ceil(9/parties) per party", () => {
  // Ruling: 9 from Big School + 21 from 7 other schools (30 total).
  // Opposition: 30 across 5 schools. partyCount 5 → 3 ruling / 2 opposition.
  const bigSchool: PartyFormationParticipant[] = Array.from({ length: 9 }, (_, i) => ({
    id: `big${i + 1}`,
    partySide: "ruling",
    schoolName: "Big School",
  }));
  const participants = [
    ...bigSchool,
    ...bench("ruling", 21, ["S1", "S2", "S3", "S4", "S5", "S6", "S7"], "r"),
    ...bench("opposition", 30, ["T1", "T2", "T3", "T4", "T5"], "o"),
  ];
  const plan = planPartyFormation({ partyCount: 5, participants });
  assert(plan.benchSplit.ruling === 3, "3 ruling parties (9 spreads across 3)");

  const perPartyBig = new Array(plan.benchSplit.ruling).fill(0);
  for (const a of plan.assignments) {
    if (a.side === "ruling" && a.participantId.startsWith("big")) {
      perPartyBig[a.benchIndex] += 1;
    }
  }
  assert(
    perPartyBig.every((n) => n === 3),
    `Big School (9) lands exactly 3 per ruling party (got ${perPartyBig.join("/")})`
  );
  assert(
    Math.max(...perPartyBig) <= Math.ceil(9 / 3),
    "max same-school-per-party <= ceil(9/3)"
  );
  assert(
    plan.maxSameSchoolPerParty >= 3,
    "maxSameSchoolPerParty reports at least the Big School concentration"
  );
});

// ─── Party-count edges ──────────────────────────────────────────

test("partyCount 2 edge: one party per bench, sizes = bench headcounts", () => {
  const participants = [
    ...bench("ruling", 77, ["A", "B"], "r"),
    ...bench("opposition", 63, ["C", "D"], "o"),
  ];
  const plan = planPartyFormation({ partyCount: 2, participants });
  assert(
    plan.benchSplit.ruling === 1 && plan.benchSplit.opposition === 1,
    "2 parties → 1 per bench (clamp floor)"
  );
  assert(
    plan.perPartySizes.ruling[0] === 77 && plan.perPartySizes.opposition[0] === 63,
    "each bench's single party holds the whole bench"
  );
});

test("partyCount 8 edge: 4/4 on 77/63, sizes balanced on both benches", () => {
  const participants = [
    ...bench("ruling", 77, ["A", "B", "C"], "r"),
    ...bench("opposition", 63, ["D", "E", "F"], "o"),
  ];
  const plan = planPartyFormation({ partyCount: 8, participants });
  assert(
    plan.benchSplit.ruling === 4 && plan.benchSplit.opposition === 4,
    "8×(77/140)=4.4 rounds to 4/4"
  );
  assert(
    maxDiff(plan.perPartySizes.ruling) <= 1 && maxDiff(plan.perPartySizes.opposition) <= 1,
    "all 8 party sizes within max-diff-1"
  );
});

test("partyCount outside 2..8 throws", () => {
  const participants = bench("ruling", 4, ["A"], "r");
  for (const bad of [1, 9, 2.5, 0, -3]) {
    let threw = false;
    try {
      planPartyFormation({ partyCount: bad, participants });
    } catch {
      threw = true;
    }
    assert(threw, `partyCount ${bad} is rejected`);
  }
});

// ─── Bench smaller than its party count ─────────────────────────

test("bench with fewer participants than parties still gets every party (some empty)", () => {
  // 3/3 house with 8 parties → 4 parties per bench, only 3 members each.
  const participants = [
    ...bench("ruling", 3, ["A", "B", "C"], "r"),
    ...bench("opposition", 3, ["D", "E", "F"], "o"),
  ];
  const plan = planPartyFormation({ partyCount: 8, participants });
  assert(
    plan.perPartySizes.ruling.length === 4 && plan.perPartySizes.opposition.length === 4,
    "both benches keep all 4 planned parties"
  );
  assert(
    plan.perPartySizes.ruling.every((n) => n === 0 || n === 1),
    `ruling sizes are 0/1 only (got ${plan.perPartySizes.ruling.join("/")})`
  );
  assert(
    plan.assignments.length === 6,
    "every participant is still assigned somewhere"
  );
  assert(
    maxDiff(plan.perPartySizes.ruling) <= 1,
    "max-diff-1 holds even with empty parties"
  );
});

// ─── Determinism ────────────────────────────────────────────────

test("deterministic: identical input produces an identical plan", () => {
  const participants = [
    ...bench("ruling", 41, ["A", "B", "C", "D"], "r"),
    ...bench("opposition", 37, ["E", "F", "G"], "o"),
  ];
  const a = planPartyFormation({ partyCount: 5, participants });
  const b = planPartyFormation({ partyCount: 5, participants });
  assert(JSON.stringify(a) === JSON.stringify(b), "two runs are byte-identical");
});

console.log("\nDone.");
