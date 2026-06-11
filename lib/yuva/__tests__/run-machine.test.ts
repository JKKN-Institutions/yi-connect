/**
 * Run state machine tests (tsx harness, donor: lib/yi-future/__tests__/allocation.test.ts).
 * Run: npx tsx lib/yuva/__tests__/run-machine.test.ts
 */

import {
  canTransitionRun,
  validatePublish,
  runStatusLabel,
  type PublishRunInput,
  type PublishSessionInput,
} from "../run-machine";

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

// ─── canTransitionRun: every LEGAL transition ───────────────────────

test("legal transitions are all allowed", () => {
  assert(canTransitionRun("draft", "published"), "draft → published");
  assert(canTransitionRun("draft", "cancelled"), "draft → cancelled");
  assert(
    canTransitionRun("published", "applications_closed"),
    "published → applications_closed"
  );
  assert(
    canTransitionRun("published", "in_progress"),
    "published → in_progress (composite formCohort compare-and-swap auto-close)"
  );
  assert(canTransitionRun("published", "draft"), "published → draft (unpublish)");
  assert(canTransitionRun("published", "cancelled"), "published → cancelled");
  assert(
    canTransitionRun("applications_closed", "in_progress"),
    "applications_closed → in_progress"
  );
  assert(canTransitionRun("in_progress", "completed"), "in_progress → completed");
  assert(canTransitionRun("completed", "certified"), "completed → certified");
  // Cancel after the cohort has started (decision 2026-06-11): a run can be
  // cancelled from applications_closed and in_progress too — records are kept,
  // students notified, no certificates issued.
  assert(
    canTransitionRun("applications_closed", "cancelled"),
    "applications_closed → cancelled (cancel after applications closed)"
  );
  assert(
    canTransitionRun("in_progress", "cancelled"),
    "in_progress → cancelled (cancel after cohort started)"
  );
});

// ─── canTransitionRun: ILLEGAL transitions ──────────────────────────

test("illegal transitions are rejected", () => {
  assert(!canTransitionRun("draft", "in_progress"), "draft → in_progress rejected");
  assert(!canTransitionRun("draft", "applications_closed"), "draft → applications_closed rejected");
  assert(!canTransitionRun("draft", "certified"), "draft → certified rejected");
  assert(
    !canTransitionRun("applications_closed", "published"),
    "applications_closed → published rejected (no reopen)"
  );
  assert(
    !canTransitionRun("applications_closed", "cancelled"),
    "applications_closed → cancelled rejected (cancel only from draft/published)"
  );
  assert(
    !canTransitionRun("in_progress", "cancelled"),
    "in_progress → cancelled rejected"
  );
  assert(!canTransitionRun("in_progress", "draft"), "in_progress → draft rejected");
  assert(
    !canTransitionRun("completed", "in_progress"),
    "completed → in_progress rejected"
  );
  assert(!canTransitionRun("certified", "completed"), "certified is terminal");
  assert(!canTransitionRun("certified", "draft"), "certified → draft rejected");
  assert(!canTransitionRun("cancelled", "draft"), "cancelled is terminal");
  assert(!canTransitionRun("cancelled", "published"), "cancelled → published rejected");
  assert(!canTransitionRun("draft", "draft"), "self-transition rejected");
});

// ─── validatePublish ────────────────────────────────────────────────

const validRun: PublishRunInput = {
  apply_open_at: "2026-06-01T00:00:00Z",
  apply_close_at: "2026-06-20T23:59:59Z",
  cohort_announce_date: "2026-06-25",
  start_date: "2026-07-01",
  end_date: "2026-09-30",
};

const scheduledSessions: PublishSessionInput[] = [
  { seq: 1, name: "Orientation", scheduled_at: "2026-07-02T10:00:00Z", mentor_person_id: "p1" },
  { seq: 2, name: "Workshop", scheduled_at: "2026-08-10T10:00:00Z", mentor_person_id: "p2" },
];

test("validatePublish: fully valid run passes with no errors or warnings", () => {
  const r = validatePublish(validRun, scheduledSessions);
  assert(r.ok, "ok=true");
  assert(r.errors.length === 0, "no errors");
  assert(r.warnings.length === 0, "no warnings");
});

test("validatePublish: unscheduled session blocks publish", () => {
  const r = validatePublish(validRun, [
    scheduledSessions[0],
    { seq: 2, name: "Workshop", scheduled_at: null },
  ]);
  assert(!r.ok, "ok=false");
  assert(
    r.errors.some((e) => e.includes("Workshop")),
    "error names the unscheduled session"
  );
});

test("validatePublish: zero sessions blocks publish", () => {
  const r = validatePublish(validRun, []);
  assert(!r.ok, "ok=false with no sessions");
  assert(r.errors.length > 0, "error reported");
});

test("validatePublish: missing apply window blocks publish", () => {
  const r1 = validatePublish({ ...validRun, apply_open_at: null }, scheduledSessions);
  assert(!r1.ok, "missing apply_open_at blocks");
  const r2 = validatePublish({ ...validRun, apply_close_at: null }, scheduledSessions);
  assert(!r2.ok, "missing apply_close_at blocks");
});

test("validatePublish: apply window open must be before close", () => {
  const r = validatePublish(
    {
      ...validRun,
      apply_open_at: "2026-06-20T00:00:00Z",
      apply_close_at: "2026-06-01T00:00:00Z",
    },
    scheduledSessions
  );
  assert(!r.ok, "open >= close blocks");
  const r2 = validatePublish(
    {
      ...validRun,
      apply_open_at: "2026-06-01T00:00:00Z",
      apply_close_at: "2026-06-01T00:00:00Z",
    },
    scheduledSessions
  );
  assert(!r2.ok, "open === close blocks");
});

test("validatePublish: missing cohort_announce_date blocks publish", () => {
  const r = validatePublish({ ...validRun, cohort_announce_date: null }, scheduledSessions);
  assert(!r.ok, "ok=false");
  assert(
    r.errors.some((e) => e.toLowerCase().includes("announce")),
    "error mentions announcement date"
  );
});

test("validatePublish: missing chapter-entered start/end dates block publish", () => {
  const r1 = validatePublish({ ...validRun, start_date: null }, scheduledSessions);
  assert(!r1.ok, "missing start_date blocks");
  const r2 = validatePublish({ ...validRun, end_date: null }, scheduledSessions);
  assert(!r2.ok, "missing end_date blocks");
});

test("validatePublish: session outside start/end range is a WARNING, not a block", () => {
  const r = validatePublish(validRun, [
    scheduledSessions[0],
    { seq: 2, name: "Late Finale", scheduled_at: "2026-10-15T10:00:00Z" }, // after end_date
  ]);
  assert(r.ok, "ok=true despite out-of-range session");
  assert(r.errors.length === 0, "no errors");
  assert(
    r.warnings.some((w) => w.includes("Late Finale")),
    "warning names the out-of-range session"
  );
  const r2 = validatePublish(validRun, [
    { seq: 1, name: "Early Kickoff", scheduled_at: "2026-06-15T10:00:00Z" }, // before start_date
  ]);
  assert(r2.ok, "ok=true for before-range session");
  assert(r2.warnings.length === 1, "before-range session warned");
});

test("validatePublish: unassigned mentors are allowed (no error, no warning)", () => {
  const r = validatePublish(validRun, [
    { seq: 1, name: "Orientation", scheduled_at: "2026-07-02T10:00:00Z", mentor_person_id: null },
    { seq: 2, name: "Workshop", scheduled_at: "2026-08-10T10:00:00Z" },
  ]);
  assert(r.ok, "ok=true with unassigned mentors");
  assert(r.errors.length === 0 && r.warnings.length === 0, "no errors or warnings");
});

// ─── runStatusLabel ─────────────────────────────────────────────────

test("runStatusLabel returns human labels", () => {
  assert(runStatusLabel("draft") === "Draft", "draft → Draft");
  assert(runStatusLabel("in_progress") === "In progress", "in_progress → In progress");
  assert(
    runStatusLabel("applications_closed") === "Applications closed",
    "applications_closed → Applications closed"
  );
  assert(runStatusLabel("certified") === "Certified", "certified → Certified");
});

console.log("\nDone.");
