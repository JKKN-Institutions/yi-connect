/**
 * Attendance lock tests (Phase 11 [TDD]) — pure decision, zero I/O.
 * Run: npx tsx lib/yuva/__tests__/attendance-lock.test.ts
 *
 * Rule under test (spec §actions/attendance.ts inventory row):
 * - editable while the run is published / applications_closed / in_progress
 * - LOCKED once completed / certified — unless an audited reopen window
 *   (reopenAttendance → 'attendance_reopened' audit row ≤30 min old) is active
 * - draft / cancelled → never editable (no cohort exists)
 */

import {
  canEditAttendance,
  ATTENDANCE_REOPEN_MINUTES,
} from "../attendance-lock";

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

// ─── Editable statuses (live cohort) ────────────────────────────────

test("attendance is editable while the cohort is live", () => {
  assert(
    canEditAttendance("published", false).editable,
    "published → editable"
  );
  assert(
    canEditAttendance("applications_closed", false).editable,
    "applications_closed → editable"
  );
  assert(
    canEditAttendance("in_progress", false).editable,
    "in_progress → editable"
  );
});

test("the reopen flag is irrelevant while the cohort is live", () => {
  assert(
    canEditAttendance("in_progress", true).editable,
    "in_progress + reopened → still editable"
  );
});

// ─── Locked after completion (unless reopened) ──────────────────────

test("completed run locks attendance", () => {
  const verdict = canEditAttendance("completed", false);
  assert(!verdict.editable, "completed → locked");
  assert(
    !verdict.editable && verdict.reason.length > 0,
    "locked verdict carries a human-readable reason"
  );
  assert(
    !verdict.editable && /reopen/i.test(verdict.reason),
    "reason tells the manager about the reopen path"
  );
});

test("certified run locks attendance", () => {
  const verdict = canEditAttendance("certified", false);
  assert(!verdict.editable, "certified → locked");
  assert(
    !verdict.editable && verdict.reason.length > 0,
    "locked verdict carries a reason"
  );
});

test("an active audited reopen unlocks completed/certified", () => {
  assert(
    canEditAttendance("completed", true).editable,
    "completed + reopened → editable"
  );
  assert(
    canEditAttendance("certified", true).editable,
    "certified + reopened → editable"
  );
});

// ─── No cohort → never editable, reopen cannot help ─────────────────

test("draft run has no cohort — not editable, even 'reopened'", () => {
  const plain = canEditAttendance("draft", false);
  assert(!plain.editable, "draft → locked");
  assert(
    !plain.editable && /cohort/i.test(plain.reason),
    "draft reason explains there is no cohort"
  );
  assert(
    !canEditAttendance("draft", true).editable,
    "draft + reopened → still locked (reopen applies only after completion)"
  );
});

test("cancelled run has no cohort — not editable, even 'reopened'", () => {
  assert(!canEditAttendance("cancelled", false).editable, "cancelled → locked");
  assert(
    !canEditAttendance("cancelled", true).editable,
    "cancelled + reopened → still locked"
  );
});

// ─── Reopen window constant ─────────────────────────────────────────

test("reopen window is 30 minutes", () => {
  assert(
    ATTENDANCE_REOPEN_MINUTES === 30,
    `ATTENDANCE_REOPEN_MINUTES === 30 (got ${ATTENDANCE_REOPEN_MINUTES})`
  );
});

console.log("\nattendance-lock tests complete.");
