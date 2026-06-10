/**
 * Certificate issue-plan builder tests (tsx harness) — Phase 14 [TDD].
 * Run: npx tsx lib/yuva/__tests__/issue-plan.test.ts
 *
 * Contract under test (PUBLISHED FACTS — highest care):
 *   buildIssuePlan(roster, threshold, overrides) → { toIssue,
 *   skippedAlreadyCertified, excluded }
 *   - already-certified enrollments are ALWAYS skipped (idempotency: a
 *     double-click burns no certificate numbers, orphans no PDFs) — even a
 *     chapter override cannot re-issue through this path.
 *   - dropped enrollments are ALWAYS excluded — never certifiable, not even
 *     by override (matches eligibleByAttendance semantics).
 *   - overrides can include a below-threshold student or exclude an
 *     above-threshold student.
 *   - completed-status enrollments are issuable.
 */

import { buildIssuePlan, type IssuePlanEntry } from "../issue-plan";
import { CERT_ATTENDANCE_DEFAULT } from "../constants";

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

function excludedIds(plan: ReturnType<typeof buildIssuePlan>): string[] {
  return plan.excluded.map((x) => x.enrollment_id);
}

const roster: IssuePlanEntry[] = [
  // above threshold, active, no cert → default issue
  { enrollment_id: "e1", attendance_pct: 100, certificate_id: null, enrollment_status: "active" },
  // exactly at threshold (inclusive) → default issue
  { enrollment_id: "e2", attendance_pct: 75, certificate_id: null, enrollment_status: "active" },
  // below threshold → default excluded (overridable)
  { enrollment_id: "e3", attendance_pct: 60, certificate_id: null, enrollment_status: "active" },
  // completed enrollment status → issuable
  { enrollment_id: "e4", attendance_pct: 90, certificate_id: null, enrollment_status: "completed" },
  // already certified → ALWAYS skipped
  { enrollment_id: "e5", attendance_pct: 100, certificate_id: "cert-5", enrollment_status: "completed" },
  // dropped → ALWAYS excluded (even at 100%)
  { enrollment_id: "e6", attendance_pct: 100, certificate_id: null, enrollment_status: "dropped" },
];

test("defaults: ≥threshold issues (inclusive), below excludes with reason", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, []);
  assert(plan.toIssue.includes("e1"), "100% → toIssue");
  assert(plan.toIssue.includes("e2"), "exactly 75% → toIssue (inclusive)");
  assert(!plan.toIssue.includes("e3"), "60% NOT in toIssue by default");
  assert(excludedIds(plan).includes("e3"), "60% excluded");
  const e3 = plan.excluded.find((x) => x.enrollment_id === "e3");
  assert(
    typeof e3?.reason === "string" && e3.reason.length > 0,
    "exclusion carries an explicit reason"
  );
});

test("completed-status enrollments are issuable", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, []);
  assert(plan.toIssue.includes("e4"), "completed enrollment at 90% → toIssue");
});

test("already-certified is ALWAYS skipped — even with an include override", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, [
    { enrollment_id: "e5", include: true },
  ]);
  assert(
    plan.skippedAlreadyCertified.includes("e5"),
    "certified enrollment lands in skippedAlreadyCertified"
  );
  assert(!plan.toIssue.includes("e5"), "certified enrollment NEVER in toIssue");
  assert(
    !excludedIds(plan).includes("e5"),
    "certified enrollment not double-counted in excluded"
  );
});

test("idempotency: re-running the same plan after issuance issues nothing", () => {
  // Simulate the post-issue state: everyone in toIssue now has a cert id.
  const first = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, []);
  const after: IssuePlanEntry[] = roster.map((r) =>
    first.toIssue.includes(r.enrollment_id)
      ? { ...r, certificate_id: `cert-${r.enrollment_id}` }
      : r
  );
  const second = buildIssuePlan(after, CERT_ATTENDANCE_DEFAULT, []);
  assert(second.toIssue.length === 0, "second pass issues zero certificates");
  assert(
    first.toIssue.every((id) => second.skippedAlreadyCertified.includes(id)),
    "everyone issued in pass 1 is skipped in pass 2"
  );
});

test("dropped is ALWAYS excluded — include override is ignored", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, [
    { enrollment_id: "e6", include: true },
  ]);
  assert(!plan.toIssue.includes("e6"), "dropped never in toIssue");
  assert(excludedIds(plan).includes("e6"), "dropped excluded");
});

test("override INCLUDE pulls a below-threshold student into toIssue", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, [
    { enrollment_id: "e3", include: true },
  ]);
  assert(plan.toIssue.includes("e3"), "60% with include:true → toIssue");
  assert(!excludedIds(plan).includes("e3"), "no longer excluded");
});

test("override EXCLUDE removes an above-threshold student", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, [
    { enrollment_id: "e1", include: false },
  ]);
  assert(!plan.toIssue.includes("e1"), "100% with include:false NOT issued");
  assert(excludedIds(plan).includes("e1"), "explicitly excluded");
});

test("overrides for unknown enrollment ids are ignored (no phantom rows)", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, [
    { enrollment_id: "ghost", include: true },
  ]);
  const all = [
    ...plan.toIssue,
    ...plan.skippedAlreadyCertified,
    ...excludedIds(plan),
  ];
  assert(!all.includes("ghost"), "ghost id appears nowhere");
  assert(all.length === roster.length, "every roster row accounted exactly once");
});

test("every roster row lands in exactly ONE bucket", () => {
  const plan = buildIssuePlan(roster, CERT_ATTENDANCE_DEFAULT, [
    { enrollment_id: "e1", include: false },
    { enrollment_id: "e3", include: true },
  ]);
  const all = [
    ...plan.toIssue,
    ...plan.skippedAlreadyCertified,
    ...excludedIds(plan),
  ];
  assert(all.length === roster.length, "bucket sizes sum to roster size");
  assert(new Set(all).size === all.length, "no enrollment in two buckets");
});

test("custom threshold respected", () => {
  const plan = buildIssuePlan(roster, 90, []);
  assert(plan.toIssue.includes("e1"), "100% passes at 90");
  assert(plan.toIssue.includes("e4"), "90% passes at 90 (inclusive)");
  assert(!plan.toIssue.includes("e2"), "75% fails at 90");
});

test("empty roster → empty plan (no throw)", () => {
  const plan = buildIssuePlan([], CERT_ATTENDANCE_DEFAULT, []);
  assert(plan.toIssue.length === 0, "no toIssue");
  assert(plan.skippedAlreadyCertified.length === 0, "no skipped");
  assert(plan.excluded.length === 0, "no excluded");
});

console.log("\nDone.");
