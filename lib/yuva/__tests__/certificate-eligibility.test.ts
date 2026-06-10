/**
 * Certificate eligibility engine tests (tsx harness).
 * Run: npx tsx lib/yuva/__tests__/certificate-eligibility.test.ts
 */

import {
  eligibleByAttendance,
  canOverrideEligibility,
  type RosterEntry,
} from "../certificate-eligibility";
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

const roster: RosterEntry[] = [
  { enrollment_id: "e1", status: "active", attendance_pct: 100 },
  { enrollment_id: "e2", status: "active", attendance_pct: 75 }, // exactly at threshold
  { enrollment_id: "e3", status: "active", attendance_pct: 74.9 },
  { enrollment_id: "e4", status: "completed", attendance_pct: 80 },
  { enrollment_id: "e5", status: "dropped", attendance_pct: 100 }, // dropped — never eligible
];

test("eligibleByAttendance: default threshold is CERT_ATTENDANCE_DEFAULT (75), inclusive", () => {
  const r = eligibleByAttendance(roster);
  assert(r.eligible.includes("e1"), "100% eligible");
  assert(r.eligible.includes("e2"), "exactly 75% eligible (≥ threshold)");
  assert(!r.eligible.includes("e3"), "74.9% not eligible");
  assert(r.ineligible.includes("e3"), "74.9% listed as ineligible (overridable)");
  assert(r.eligible.includes("e4"), "completed-status enrollment eligible");
  assert(CERT_ATTENDANCE_DEFAULT === 75, "constant sanity");
});

test("eligibleByAttendance: dropped enrollments appear in NEITHER list", () => {
  const r = eligibleByAttendance(roster);
  assert(!r.eligible.includes("e5"), "dropped not eligible despite 100%");
  assert(!r.ineligible.includes("e5"), "dropped not overridable either");
});

test("eligibleByAttendance: custom threshold", () => {
  const r = eligibleByAttendance(roster, 90);
  assert(r.eligible.length === 1 && r.eligible[0] === "e1", "only 100% passes at 90");
  assert(r.ineligible.includes("e2"), "75% ineligible at threshold 90");
});

test("eligibleByAttendance: empty roster returns empty lists (no NaN, no throw)", () => {
  const r = eligibleByAttendance([]);
  assert(r.eligible.length === 0, "no eligible");
  assert(r.ineligible.length === 0, "no ineligible");
});

// ─── per-student override gate ──────────────────────────────────────

test("canOverrideEligibility: BLOCKED when the run has zero completed sessions", () => {
  const r = canOverrideEligibility([
    { status: "scheduled" },
    { status: "cancelled" },
  ]);
  assert(!r.allowed, "override blocked");
  assert(typeof r.reason === "string" && r.reason.length > 0, "explicit reason given");
  const rEmpty = canOverrideEligibility([]);
  assert(!rEmpty.allowed, "override blocked with no sessions at all");
});

test("canOverrideEligibility: allowed once at least one session is completed", () => {
  const r = canOverrideEligibility([
    { status: "completed" },
    { status: "scheduled" },
  ]);
  assert(r.allowed, "override allowed with ≥1 completed session");
});

console.log("\nDone.");
