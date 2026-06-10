/**
 * Progress engine tests (tsx harness).
 * Run: npx tsx lib/yuva/__tests__/progress.test.ts
 */

import {
  attendancePct,
  submissionCompletionPct,
  overallProgress,
  type ProgressEnrollment,
  type ProgressSession,
  type AttendanceRow,
  type SubmissionRow,
} from "../progress";

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

const enrollments: ProgressEnrollment[] = [
  { id: "e1", status: "active" },
  { id: "e2", status: "active" },
];

const sessions: ProgressSession[] = [
  { id: "s1", status: "completed", expects_submission: true },
  { id: "s2", status: "completed", expects_submission: false },
  { id: "s3", status: "scheduled", expects_submission: true }, // not yet held
];

// ─── attendancePct ──────────────────────────────────────────────────

test("attendancePct: present marks over completed sessions only", () => {
  const attendance: AttendanceRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", present: true },
    { enrollment_id: "e1", run_session_id: "s2", present: true },
    { enrollment_id: "e2", run_session_id: "s1", present: true },
    { enrollment_id: "e2", run_session_id: "s2", present: false },
    // attendance against a non-completed session must be ignored
    { enrollment_id: "e1", run_session_id: "s3", present: true },
  ];
  // 2 enrollments × 2 completed sessions = 4; present in completed = 3
  const pct = attendancePct(enrollments, sessions, attendance);
  assert(pct === 75, `3/4 = 75 (got ${pct})`);
});

test("attendancePct: dropped enrollments excluded from numerator and denominator", () => {
  const withDropped: ProgressEnrollment[] = [
    ...enrollments,
    { id: "e3", status: "dropped" },
  ];
  const attendance: AttendanceRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", present: true },
    { enrollment_id: "e1", run_session_id: "s2", present: true },
    { enrollment_id: "e2", run_session_id: "s1", present: true },
    { enrollment_id: "e2", run_session_id: "s2", present: false },
    { enrollment_id: "e3", run_session_id: "s1", present: true }, // dropped — ignored
    { enrollment_id: "e3", run_session_id: "s2", present: true }, // dropped — ignored
  ];
  const pct = attendancePct(withDropped, sessions, attendance);
  assert(pct === 75, `dropped rows ignored, still 75 (got ${pct})`);
});

test("attendancePct: single enrollment slice gives per-student pct", () => {
  const attendance: AttendanceRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", present: true },
    { enrollment_id: "e1", run_session_id: "s2", present: false },
  ];
  const pct = attendancePct([enrollments[0]], sessions, attendance);
  assert(pct === 50, `1/2 = 50 (got ${pct})`);
});

test("attendancePct: ZERO completed sessions returns 0, never NaN", () => {
  const noCompleted: ProgressSession[] = [
    { id: "s1", status: "scheduled", expects_submission: false },
  ];
  const pct = attendancePct(enrollments, noCompleted, []);
  assert(!Number.isNaN(pct), "not NaN");
  assert(pct === 0, `returns 0 (got ${pct})`);
});

test("attendancePct: zero sessions at all returns 0, never NaN", () => {
  const pct = attendancePct(enrollments, [], []);
  assert(!Number.isNaN(pct), "not NaN");
  assert(pct === 0, `returns 0 (got ${pct})`);
});

test("attendancePct: zero (non-dropped) enrollments returns 0, never NaN", () => {
  const pct = attendancePct([{ id: "e3", status: "dropped" }], sessions, []);
  assert(!Number.isNaN(pct), "not NaN");
  assert(pct === 0, `returns 0 (got ${pct})`);
});

// ─── submissionCompletionPct ────────────────────────────────────────

test("submissionCompletionPct: denominator counts ONLY expects_submission=true sessions", () => {
  const subs: SubmissionRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", status: "submitted" },
    { enrollment_id: "e1", run_session_id: "s3", status: "reviewed" },
    { enrollment_id: "e2", run_session_id: "s1", status: "draft" }, // draft ≠ complete
    // submission against a session that does NOT expect work — ignored
    { enrollment_id: "e2", run_session_id: "s2", status: "submitted" },
  ];
  // expecting sessions: s1, s3 → 2 enrollments × 2 = 4; complete = 2 (e1/s1, e1/s3)
  const pct = submissionCompletionPct(enrollments, sessions, subs);
  assert(pct === 50, `2/4 = 50 (got ${pct})`);
});

test("submissionCompletionPct: dropped enrollments excluded", () => {
  const withDropped: ProgressEnrollment[] = [
    ...enrollments,
    { id: "e3", status: "dropped" },
  ];
  const subs: SubmissionRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", status: "submitted" },
    { enrollment_id: "e1", run_session_id: "s3", status: "submitted" },
    { enrollment_id: "e2", run_session_id: "s1", status: "submitted" },
    { enrollment_id: "e2", run_session_id: "s3", status: "submitted" },
    { enrollment_id: "e3", run_session_id: "s1", status: "submitted" }, // ignored
  ];
  const pct = submissionCompletionPct(withDropped, sessions, subs);
  assert(pct === 100, `dropped ignored: 4/4 = 100 (got ${pct})`);
});

test("submissionCompletionPct: ZERO expecting sessions returns 0, never NaN", () => {
  const noExpecting: ProgressSession[] = [
    { id: "s1", status: "completed", expects_submission: false },
  ];
  const pct = submissionCompletionPct(enrollments, noExpecting, []);
  assert(!Number.isNaN(pct), "not NaN");
  assert(pct === 0, `returns 0 (got ${pct})`);
});

test("submissionCompletionPct: zero sessions returns 0, never NaN", () => {
  const pct = submissionCompletionPct(enrollments, [], []);
  assert(!Number.isNaN(pct), "not NaN");
  assert(pct === 0, `returns 0 (got ${pct})`);
});

// ─── overallProgress ────────────────────────────────────────────────

test("overallProgress: 100 when fully attended and fully submitted", () => {
  const attendance: AttendanceRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", present: true },
    { enrollment_id: "e1", run_session_id: "s2", present: true },
    { enrollment_id: "e2", run_session_id: "s1", present: true },
    { enrollment_id: "e2", run_session_id: "s2", present: true },
  ];
  const subs: SubmissionRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", status: "submitted" },
    { enrollment_id: "e1", run_session_id: "s3", status: "reviewed" },
    { enrollment_id: "e2", run_session_id: "s1", status: "submitted" },
    { enrollment_id: "e2", run_session_id: "s3", status: "submitted" },
  ];
  const pct = overallProgress(enrollments, sessions, attendance, subs);
  assert(pct === 100, `full marks = 100 (got ${pct})`);
});

test("overallProgress: 0 when nothing attended or submitted", () => {
  const pct = overallProgress(enrollments, sessions, [], []);
  assert(pct === 0, `empty = 0 (got ${pct})`);
});

test("overallProgress: bounded 0–100 on partial data", () => {
  const attendance: AttendanceRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", present: true },
  ];
  const subs: SubmissionRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", status: "submitted" },
  ];
  const pct = overallProgress(enrollments, sessions, attendance, subs);
  assert(pct > 0 && pct < 100, `partial is strictly between 0 and 100 (got ${pct})`);
  assert(!Number.isNaN(pct), "not NaN");
});

test("overallProgress: equals attendancePct when no session expects work", () => {
  const attendanceOnly: ProgressSession[] = [
    { id: "s1", status: "completed", expects_submission: false },
    { id: "s2", status: "completed", expects_submission: false },
  ];
  const attendance: AttendanceRow[] = [
    { enrollment_id: "e1", run_session_id: "s1", present: true },
    { enrollment_id: "e1", run_session_id: "s2", present: true },
    { enrollment_id: "e2", run_session_id: "s1", present: true },
    { enrollment_id: "e2", run_session_id: "s2", present: false },
  ];
  const overall = overallProgress(enrollments, attendanceOnly, attendance, []);
  const att = attendancePct(enrollments, attendanceOnly, attendance);
  assert(overall === att, `overall (${overall}) === attendance (${att})`);
});

test("overallProgress: ZERO sessions returns 0, never NaN", () => {
  const pct = overallProgress(enrollments, [], [], []);
  assert(!Number.isNaN(pct), "not NaN");
  assert(pct === 0, `returns 0 (got ${pct})`);
});

console.log("\nDone.");
