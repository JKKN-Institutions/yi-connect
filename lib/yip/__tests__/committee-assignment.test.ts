/**
 * Committee-assignment lib tests (tsx harness, same pattern as party-formation).
 * Run: npx tsx lib/yip/__tests__/committee-assignment.test.ts
 *
 * Covers: office-holders excluded (Speaker Panel only), committee sizes balanced
 * (max diff 1), PARTY balance (no committee dominated by one party), the NEW
 * SCHOOL balance (no committee dominated by one school — a school of s never
 * exceeds ceil(s / committees) when parties don't interfere, and stays within
 * +1 of that under joint party+school constraints), blank-school handling, and
 * determinism (same input → identical plan).
 */

import {
  planCommitteeAssignment,
  isCommitteeEligible,
  type CommitteeParticipant,
} from "../committee-assignment";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}
function test(name: string, fn: () => void) {
  console.log(`\n▶ ${name}`);
  fn();
}

const COMMITTEES = (k: number) => Array.from({ length: k }, (_, i) => `C${i + 1}`);

function mk(
  n: number,
  partyOf: (i: number) => string | null,
  schoolOf: (i: number) => string | null,
  roleOf: (i: number) => string | null = () => "mp"
): CommitteeParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    partyId: partyOf(i),
    schoolName: schoolOf(i),
    parliamentRole: roleOf(i),
  }));
}

/** Per-committee tallies of a key (party or school) for the eligible members. */
function tallies(
  assignments: { participantId: string; committeeNumber: number | null }[],
  keyById: Map<string, string>,
  committees: number
): Map<string, number>[] {
  const per: Map<string, number>[] = Array.from({ length: committees }, () => new Map());
  for (const a of assignments) {
    if (a.committeeNumber == null) continue;
    const key = keyById.get(a.participantId) ?? "";
    if (!key) continue; // blank key not counted as "same"
    const m = per[a.committeeNumber - 1];
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return per;
}
const maxOf = (m: Map<string, number>) =>
  [...m.values()].reduce((mx, v) => Math.max(mx, v), 0);

// ── 1. Office-holders (Speaker Panel) get NO committee; everyone else does ──
test("Speaker + Deputy Speaker excluded, all other roles assigned", () => {
  assert(!isCommitteeEligible("speaker"), "speaker is not committee-eligible");
  assert(!isCommitteeEligible("deputy_speaker"), "deputy_speaker not eligible");
  assert(isCommitteeEligible("prime_minister"), "PM IS committee-eligible");
  assert(isCommitteeEligible("cabinet_minister"), "minister IS eligible");
  assert(isCommitteeEligible("mp"), "plain MP IS eligible");

  const parts = mk(
    10,
    () => "A",
    (i) => `S${i % 3}`,
    (i) => (i === 0 ? "speaker" : i === 1 ? "deputy_speaker" : "mp")
  );
  const out = planCommitteeAssignment(parts, COMMITTEES(3));
  const byId = new Map(out.map((a) => [a.participantId, a]));
  assert(byId.get("p0")!.committeeNumber === null, "speaker → no committee");
  assert(byId.get("p1")!.committeeNumber === null, "deputy_speaker → no committee");
  for (let i = 2; i < 10; i++)
    assert(byId.get(`p${i}`)!.committeeNumber !== null, `MP p${i} → a committee`);
});

// ── 2. Committee sizes balanced (max diff 1) ──
test("committee sizes differ by at most 1", () => {
  const C = 5;
  const parts = mk(38, (i) => `P${i % 4}`, (i) => `S${i % 6}`);
  const out = planCommitteeAssignment(parts, COMMITTEES(C));
  const sizes = new Array(C).fill(0);
  for (const a of out) if (a.committeeNumber != null) sizes[a.committeeNumber - 1]++;
  assert(Math.max(...sizes) - Math.min(...sizes) <= 1, `sizes balanced: ${sizes}`);
});

// ── 3. PARTY balance preserved (single school region → pure party spread) ──
test("party balance: 4 parties × 8 over 4 committees → 2 each, no domination", () => {
  const C = 4;
  const parts = mk(32, (i) => `P${i % 4}`, () => null); // blank schools
  const out = planCommitteeAssignment(parts, COMMITTEES(C));
  const partyById = new Map(parts.map((p) => [p.id, p.partyId ?? ""]));
  const per = tallies(out, partyById, C);
  for (const m of per)
    assert(maxOf(m) <= 2, `no committee has >2 of any party (got ${maxOf(m)})`);
});

// ── 4. SCHOOL balance (single party → pure school spread, exact ceil) ──
test("school balance: 3 schools × 12 over 4 committees → exactly 3 each", () => {
  const C = 4;
  // one party so party never interferes; 36 students, 3 schools of 12
  const parts = mk(36, () => "A", (i) => `S${Math.floor(i / 12)}`);
  const out = planCommitteeAssignment(parts, COMMITTEES(C));
  const schoolById = new Map(parts.map((p) => [p.id, (p.schoolName ?? "").toLowerCase()]));
  const per = tallies(out, schoolById, C);
  for (const m of per)
    assert(maxOf(m) <= 3, `no committee has >ceil(12/4)=3 of any school (got ${maxOf(m)})`);
});

// ── 5. JOINT party+school balance on a realistic mix ──
test("joint balance: 4 parties, 6 schools, 5 committees — both within ceil+1", () => {
  const C = 5;
  // 60 students: school sizes 8..12, parties round-robin so each school spans parties
  const schoolSizes = [12, 11, 10, 9, 9, 9]; // sum 60
  const parts: CommitteeParticipant[] = [];
  let id = 0;
  schoolSizes.forEach((s, sIdx) => {
    for (let k = 0; k < s; k++) {
      parts.push({
        id: `p${id}`,
        partyId: `P${id % 4}`,
        schoolName: `School ${sIdx}`,
        parliamentRole: "mp",
      });
      id++;
    }
  });
  const out = planCommitteeAssignment(parts, COMMITTEES(C));

  const schoolById = new Map(parts.map((p) => [p.id, (p.schoolName ?? "").toLowerCase()]));
  const partyById = new Map(parts.map((p) => [p.id, p.partyId ?? ""]));
  const perSchool = tallies(out, schoolById, C);
  const perParty = tallies(out, partyById, C);

  // largest school is 12 → ceil(12/5)=3; allow +1 slack for joint constraint
  for (const m of perSchool)
    assert(maxOf(m) <= 4, `school spread within ceil(12/5)+1=4 (got ${maxOf(m)})`);
  // each party is 15 → ceil(15/5)=3; allow +1 slack
  for (const m of perParty)
    assert(maxOf(m) <= 4, `party spread within ceil(15/5)+1=4 (got ${maxOf(m)})`);

  // and sizes stay balanced
  const sizes = new Array(C).fill(0);
  for (const a of out) if (a.committeeNumber != null) sizes[a.committeeNumber - 1]++;
  assert(Math.max(...sizes) - Math.min(...sizes) <= 1, `sizes balanced: ${sizes}`);
});

// ── 6. Blank/unknown schools still assigned, never block balance ──
test("blank schools are distributed for size, not treated as the same school", () => {
  const C = 3;
  const parts = mk(9, () => "A", () => null);
  const out = planCommitteeAssignment(parts, COMMITTEES(C));
  const sizes = new Array(C).fill(0);
  for (const a of out) {
    assert(a.committeeNumber !== null, "blank-school MP still gets a committee");
    if (a.committeeNumber != null) sizes[a.committeeNumber - 1]++;
  }
  assert(sizes.every((s) => s === 3), `blank-school students size-balanced: ${sizes}`);
});

// ── 7. Determinism ──
test("same input → identical plan", () => {
  const parts = mk(40, (i) => `P${i % 3}`, (i) => `S${i % 5}`);
  const a = JSON.stringify(planCommitteeAssignment(parts, COMMITTEES(6)));
  const b = JSON.stringify(planCommitteeAssignment(parts, COMMITTEES(6)));
  assert(a === b, "deterministic across runs");
});

console.log("\n✅ committee-assignment: all tests passed");
