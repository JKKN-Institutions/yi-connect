/**
 * Submission rules tests (Phase 13 [TDD]) — pure decisions, zero I/O.
 * Run: npx tsx lib/yuva/__tests__/submission-rules.test.ts
 *
 * Rules under test (spec §actions/submissions.ts inventory row + Phase 13):
 * - isLateSubmission: late iff submitted strictly after the session's
 *   scheduled date + SUBMISSION_GRACE_DAYS (7) grace window; a session with
 *   no scheduled date can never produce a late submission.
 * - nextVersion: a draft overwrites in place (same version); resubmitting
 *   after 'submitted' or 'reviewed' bumps to a NEW version.
 * - canStudentTouch: only an ACTIVE enrollment may write; submitted and
 *   reviewed rows are read-only to the student (resubmission creates a new
 *   version instead of mutating them).
 * - canMentorReview: review applies only to 'submitted' work — drafts are
 *   not reviewable, reviewed work is not re-reviewable.
 */

import { SUBMISSION_GRACE_DAYS } from "../constants";
import {
  canMentorReview,
  canStudentTouch,
  isLateSubmission,
  nextVersion,
} from "../submission-rules";

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

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULED = "2026-06-01T10:00:00.000Z";
const SCHEDULED_MS = new Date(SCHEDULED).getTime();

// ─── isLateSubmission ───────────────────────────────────────────────

test("on-time: submitted before the session date is never late", () => {
  assert(
    !isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS - DAY_MS)),
    "1 day before the session → not late"
  );
});

test("grace window: within scheduled_at + 7 days is not late", () => {
  assert(
    !isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS + 3 * DAY_MS)),
    "3 days after the session → not late (inside grace)"
  );
  assert(
    !isLateSubmission(
      SCHEDULED,
      new Date(SCHEDULED_MS + SUBMISSION_GRACE_DAYS * DAY_MS)
    ),
    "exactly at the grace boundary → not late (late is strictly after)"
  );
});

test("late: strictly after scheduled_at + grace days", () => {
  assert(
    isLateSubmission(
      SCHEDULED,
      new Date(SCHEDULED_MS + SUBMISSION_GRACE_DAYS * DAY_MS + 1)
    ),
    "1 ms past the grace boundary → late"
  );
  assert(
    isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS + 30 * DAY_MS)),
    "30 days after the session → late"
  );
});

test("grace days parameter is honoured", () => {
  assert(
    isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS + 2 * DAY_MS), 1),
    "graceDays=1, submitted +2 days → late"
  );
  assert(
    !isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS + 2 * DAY_MS), 3),
    "graceDays=3, submitted +2 days → not late"
  );
});

test("default grace window is SUBMISSION_GRACE_DAYS (7)", () => {
  assert(SUBMISSION_GRACE_DAYS === 7, "constant is 7");
  // +7d is fine by default, +8d is late — proves the default wires to 7.
  assert(
    !isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS + 7 * DAY_MS)),
    "+7 days with default grace → not late"
  );
  assert(
    isLateSubmission(SCHEDULED, new Date(SCHEDULED_MS + 8 * DAY_MS)),
    "+8 days with default grace → late"
  );
});

test("a session with no scheduled date never yields a late submission", () => {
  assert(
    !isLateSubmission(null, new Date("2030-01-01T00:00:00.000Z")),
    "scheduled_at=null → never late"
  );
});

test("string timestamps are accepted for submittedAt", () => {
  assert(
    isLateSubmission(SCHEDULED, "2026-07-15T10:00:00.000Z"),
    "ISO string far past grace → late"
  );
});

// ─── nextVersion ────────────────────────────────────────────────────

test("first submission starts at version 1", () => {
  assert(nextVersion([]) === 1, "no existing rows → version 1");
});

test("a draft overwrites in place (same version)", () => {
  assert(
    nextVersion([{ version: 1, status: "draft" }]) === 1,
    "latest is a v1 draft → stays v1"
  );
  assert(
    nextVersion([
      { version: 1, status: "reviewed" },
      { version: 2, status: "draft" },
    ]) === 2,
    "latest is a v2 draft after a reviewed v1 → stays v2"
  );
});

test("resubmit after 'submitted' bumps the version", () => {
  assert(
    nextVersion([{ version: 1, status: "submitted" }]) === 2,
    "v1 submitted → next is v2"
  );
});

test("resubmit after 'reviewed' bumps the version", () => {
  assert(
    nextVersion([{ version: 1, status: "reviewed" }]) === 2,
    "v1 reviewed → next is v2"
  );
  assert(
    nextVersion([
      { version: 1, status: "reviewed" },
      { version: 2, status: "reviewed" },
    ]) === 3,
    "v1+v2 reviewed → next is v3"
  );
});

test("nextVersion keys off the HIGHEST version, regardless of order", () => {
  assert(
    nextVersion([
      { version: 2, status: "submitted" },
      { version: 1, status: "reviewed" },
    ]) === 3,
    "unsorted input, max version submitted → bumps to 3"
  );
});

// ─── canStudentTouch ────────────────────────────────────────────────

test("an active enrollment may start fresh work", () => {
  assert(
    canStudentTouch({ status: "active" }).allowed,
    "active + no submission → allowed"
  );
});

test("an active enrollment may keep editing its own draft", () => {
  assert(
    canStudentTouch({ status: "active" }, { status: "draft" }).allowed,
    "active + draft → allowed"
  );
});

test("non-active enrollments are read-only", () => {
  const completed = canStudentTouch({ status: "completed" });
  assert(!completed.allowed, "completed enrollment → denied");
  assert(
    !completed.allowed && completed.reason.length > 0,
    "denial carries a human-readable reason"
  );
  assert(
    !canStudentTouch({ status: "dropped" }).allowed,
    "dropped enrollment → denied"
  );
  assert(
    !canStudentTouch({ status: "dropped" }, { status: "draft" }).allowed,
    "dropped enrollment → denied even with a draft in flight"
  );
});

test("submitted work is locked to the student (new version instead)", () => {
  const verdict = canStudentTouch(
    { status: "active" },
    { status: "submitted" }
  );
  assert(!verdict.allowed, "active + submitted → denied in-place edit");
  assert(
    !verdict.allowed && /version/i.test(verdict.reason),
    "reason points at the new-version path"
  );
});

test("reviewed work is read-only to the student (new version instead)", () => {
  const verdict = canStudentTouch({ status: "active" }, { status: "reviewed" });
  assert(!verdict.allowed, "active + reviewed → denied in-place edit");
  assert(
    !verdict.allowed && /version/i.test(verdict.reason),
    "reason points at the new-version path"
  );
});

// ─── canMentorReview ────────────────────────────────────────────────

test("mentor review applies only to submitted work", () => {
  assert(
    canMentorReview({ status: "submitted" }).allowed,
    "submitted → reviewable"
  );
});

test("drafts are not reviewable", () => {
  const verdict = canMentorReview({ status: "draft" });
  assert(!verdict.allowed, "draft → not reviewable");
  assert(
    !verdict.allowed && verdict.reason.length > 0,
    "denial carries a reason"
  );
});

test("reviewed work is not re-reviewable", () => {
  assert(
    !canMentorReview({ status: "reviewed" }).allowed,
    "reviewed → not re-reviewable"
  );
});

console.log("\nsubmission-rules tests complete.");
