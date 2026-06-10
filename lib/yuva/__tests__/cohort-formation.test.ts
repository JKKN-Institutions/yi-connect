/**
 * Cohort formation tests — Phase 9 [TDD] (tsx harness, donor:
 * lib/yuva/__tests__/run-machine.test.ts).
 * Run: npx tsx lib/yuva/__tests__/cohort-formation.test.ts
 *
 * Covers the PURE pieces of formCohort / acceptApplication
 * (lib/yuva/cohort.ts):
 *   (a) generateAccessCode — CSPRNG, 8 chars, 32-char unambiguous alphabet
 *   (b) buildCohortPlan — accepted→enroll, rejected→reject-email,
 *       pending/withdrawn excluded, already-enrolled skipped (idempotent)
 *   (c) acceptanceGuard — run-status gate + duplicate-person warning
 */

import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  generateAccessCode,
  buildCohortPlan,
  acceptanceGuard,
  type PlanApplication,
  type PlanEnrollment,
} from "../cohort";

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

// ═══ (a) generateAccessCode ══════════════════════════════════════════

test("access code alphabet is the 32-char unambiguous set", () => {
  assert(
    ACCESS_CODE_ALPHABET === "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    "alphabet excludes 0/O/1/I and has 32 chars"
  );
  assert(ACCESS_CODE_ALPHABET.length === 32, "alphabet length is exactly 32");
  assert(
    new Set(ACCESS_CODE_ALPHABET).size === 32,
    "alphabet has no duplicate characters"
  );
  assert(ACCESS_CODE_LENGTH === 8, "code length constant is 8");
});

test("generateAccessCode: length 8, alphabet-only", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateAccessCode();
    assert(code.length === 8, `code "${code}" has length 8`);
    for (const ch of code) {
      if (!ACCESS_CODE_ALPHABET.includes(ch)) {
        throw new Error(`char "${ch}" in "${code}" is outside the alphabet`);
      }
    }
    if (i > 0) break; // log the per-code asserts once; loop silently after
  }
  // Silent full sweep (no per-iteration logging noise).
  for (let i = 0; i < 200; i++) {
    const code = generateAccessCode();
    if (code.length !== 8) throw new Error("length drift");
    for (const ch of code) {
      if (!ACCESS_CODE_ALPHABET.includes(ch)) {
        throw new Error("alphabet drift");
      }
    }
  }
  assert(true, "200 codes all length-8 and alphabet-only");
});

test("generateAccessCode: 1000 codes, no duplicates", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(generateAccessCode());
  assert(seen.size === 1000, `1000 generated → ${seen.size} unique`);
});

test("generateAccessCode: statistical spread across the alphabet (CSPRNG proxy)", () => {
  // 4000 codes × 8 chars = 32000 draws; expected 1000 per alphabet char,
  // σ ≈ 31. Bounds [800, 1200] are ±6.4σ — catches a biased modulo, a
  // constant, or a truncated alphabet without ever flaking.
  const counts = new Map<string, number>();
  for (const ch of ACCESS_CODE_ALPHABET) counts.set(ch, 0);
  for (let i = 0; i < 4000; i++) {
    for (const ch of generateAccessCode()) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  }
  for (const [ch, n] of counts) {
    if (n < 800 || n > 1200) {
      throw new Error(`char "${ch}" drawn ${n} times — outside [800,1200]`);
    }
  }
  assert(true, "every alphabet char drawn ~uniformly (all within ±6.4σ)");
  // First chars across many codes must vary (a Math.random clone seeded
  // per-process would still pass; a constant/cyclic generator would not).
  const firsts = new Set<string>();
  for (let i = 0; i < 200; i++) firsts.add(generateAccessCode()[0]);
  assert(firsts.size >= 10, `first chars vary across calls (${firsts.size} distinct)`);
});

// ═══ (b) buildCohortPlan ═════════════════════════════════════════════

const app = (
  id: string,
  status: PlanApplication["status"],
  personId: string | null = null
): PlanApplication => ({
  id,
  status,
  full_name: `Student ${id}`,
  email: `${id}@example.org`,
  person_id: personId,
});

test("buildCohortPlan: accepted apps not yet enrolled → toEnroll", () => {
  const plan = buildCohortPlan(
    [app("a1", "accepted"), app("a2", "accepted")],
    []
  );
  assert(plan.toEnroll.length === 2, "both accepted apps planned for enrollment");
  assert(plan.toReject.length === 0, "nothing to reject");
  assert(plan.alreadyEnrolled.length === 0, "nothing already enrolled");
});

test("buildCohortPlan: pending and withdrawn are excluded entirely", () => {
  const plan = buildCohortPlan(
    [app("a1", "pending"), app("a2", "withdrawn"), app("a3", "accepted")],
    []
  );
  assert(plan.toEnroll.length === 1, "only the accepted app is enrolled");
  assert(plan.toEnroll[0].id === "a3", "the accepted app is a3");
  assert(plan.toReject.length === 0, "pending/withdrawn are NOT rejected");
  assert(plan.alreadyEnrolled.length === 0, "nothing already enrolled");
});

test("buildCohortPlan: rejected apps → toReject (rejection email plan)", () => {
  const plan = buildCohortPlan(
    [app("a1", "rejected"), app("a2", "accepted")],
    []
  );
  assert(plan.toReject.length === 1 && plan.toReject[0].id === "a1", "rejected app planned for rejection email");
  assert(plan.toEnroll.length === 1 && plan.toEnroll[0].id === "a2", "accepted app planned for enrollment");
});

test("buildCohortPlan: already-enrolled (by application_id) skipped — idempotent re-click", () => {
  const existing: PlanEnrollment[] = [
    { application_id: "a1", person_id: "p1" },
  ];
  const plan = buildCohortPlan(
    [app("a1", "accepted"), app("a2", "accepted")],
    existing
  );
  assert(plan.toEnroll.length === 1 && plan.toEnroll[0].id === "a2", "only the un-enrolled accepted app is planned");
  assert(
    plan.alreadyEnrolled.length === 1 && plan.alreadyEnrolled[0].id === "a1",
    "the enrolled app lands in alreadyEnrolled"
  );
});

test("buildCohortPlan: already-enrolled (by person_id) skipped even with a different application", () => {
  const existing: PlanEnrollment[] = [
    { application_id: null, person_id: "p9" },
  ];
  const plan = buildCohortPlan([app("a1", "accepted", "p9")], existing);
  assert(plan.toEnroll.length === 0, "person already in cohort → no second enrollment");
  assert(plan.alreadyEnrolled.length === 1, "flagged as already enrolled");
});

test("buildCohortPlan: fully-enrolled re-run is a complete no-op", () => {
  const apps = [app("a1", "accepted", "p1"), app("a2", "accepted", "p2")];
  const existing: PlanEnrollment[] = [
    { application_id: "a1", person_id: "p1" },
    { application_id: "a2", person_id: "p2" },
  ];
  const plan = buildCohortPlan(apps, existing);
  assert(plan.toEnroll.length === 0, "no new enrollments");
  assert(plan.alreadyEnrolled.length === 2, "both flagged already enrolled");
});

test("buildCohortPlan: empty inputs → empty plan", () => {
  const plan = buildCohortPlan([], []);
  assert(
    plan.toEnroll.length === 0 &&
      plan.toReject.length === 0 &&
      plan.alreadyEnrolled.length === 0,
    "all plan buckets empty"
  );
});

// ═══ (c) acceptanceGuard ═════════════════════════════════════════════

test("acceptanceGuard: allowed only while run is published / applications_closed / in_progress", () => {
  for (const status of ["published", "applications_closed", "in_progress"] as const) {
    const g = acceptanceGuard({ status }, { status: "pending" }, false);
    assert(g.allowed, `run ${status} → accept allowed`);
    assert(!g.warn, `run ${status} → no warning`);
  }
  for (const status of ["draft", "completed", "certified", "cancelled"] as const) {
    const g = acceptanceGuard({ status }, { status: "pending" }, false);
    assert(!g.allowed, `run ${status} → accept DENIED`);
    assert(typeof g.reason === "string" && g.reason.length > 0, `run ${status} → denial carries a reason`);
  }
});

test("acceptanceGuard: withdrawn application cannot be accepted", () => {
  const g = acceptanceGuard(
    { status: "published" },
    { status: "withdrawn" },
    false
  );
  assert(!g.allowed, "withdrawn → denied");
  assert(
    (g.reason ?? "").toLowerCase().includes("withdrawn"),
    "reason names the withdrawal"
  );
});

test("acceptanceGuard: duplicate person in run → allowed WITH warning", () => {
  const g = acceptanceGuard(
    { status: "in_progress" },
    { status: "pending" },
    true
  );
  assert(g.allowed, "duplicate person does not block");
  assert(g.warn === true, "warn flag set");
  assert(
    typeof g.reason === "string" && g.reason.length > 0,
    "warning carries a reason"
  );
});

test("acceptanceGuard: run-status denial wins over duplicate warning", () => {
  const g = acceptanceGuard(
    { status: "cancelled" },
    { status: "pending" },
    true
  );
  assert(!g.allowed, "cancelled run denies even with duplicate person");
});

console.log("\nDone.");
