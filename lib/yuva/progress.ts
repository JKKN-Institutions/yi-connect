/**
 * Yi Youth Academy — progress metrics (pure engine, zero I/O).
 * Spec: docs/yi-youth-academy-spec.md §"Pure engines".
 *
 * Rules baked in:
 * - Dropped enrollments are excluded from ALL numerators and denominators.
 * - attendancePct counts only sessions with status='completed' (you cannot
 *   be marked present at a session that was never held).
 * - submissionCompletionPct's denominator counts ONLY sessions with
 *   expects_submission=true (cancelled sessions cannot expect work).
 * - ALL denominators guard zero — return 0, never NaN.
 *
 * Per-student values: pass a single-enrollment array.
 */

export interface ProgressEnrollment {
  id: string;
  status: "active" | "completed" | "dropped";
}

export interface ProgressSession {
  id: string;
  status: "scheduled" | "completed" | "cancelled";
  expects_submission: boolean;
}

export interface AttendanceRow {
  enrollment_id: string;
  run_session_id: string;
  present: boolean;
}

export interface SubmissionRow {
  enrollment_id: string;
  run_session_id: string;
  status: "draft" | "submitted" | "reviewed";
}

/** Round to 1 decimal place, clamped to [0, 100]. */
function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  const value = (numerator / denominator) * 100;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function activeEnrollmentIds(enrollments: ProgressEnrollment[]): Set<string> {
  return new Set(
    enrollments.filter((e) => e.status !== "dropped").map((e) => e.id)
  );
}

/**
 * Attendance percentage: present marks / (non-dropped enrollments ×
 * completed sessions). 0–100; returns 0 when there is nothing to count.
 */
export function attendancePct(
  enrollments: ProgressEnrollment[],
  sessions: ProgressSession[],
  attendance: AttendanceRow[]
): number {
  const enrolled = activeEnrollmentIds(enrollments);
  const completedSessionIds = new Set(
    sessions.filter((s) => s.status === "completed").map((s) => s.id)
  );

  const denominator = enrolled.size * completedSessionIds.size;
  const numerator = attendance.filter(
    (row) =>
      row.present &&
      enrolled.has(row.enrollment_id) &&
      completedSessionIds.has(row.run_session_id)
  ).length;

  return pct(numerator, denominator);
}

/**
 * Submission completion percentage: submitted/reviewed work /
 * (non-dropped enrollments × sessions expecting work). Drafts do not
 * count as complete. 0–100; returns 0 when no session expects work.
 */
export function submissionCompletionPct(
  enrollments: ProgressEnrollment[],
  sessions: ProgressSession[],
  submissions: SubmissionRow[]
): number {
  const enrolled = activeEnrollmentIds(enrollments);
  const expectingSessionIds = new Set(
    sessions
      .filter((s) => s.expects_submission && s.status !== "cancelled")
      .map((s) => s.id)
  );

  const denominator = enrolled.size * expectingSessionIds.size;
  const numerator = submissions.filter(
    (row) =>
      (row.status === "submitted" || row.status === "reviewed") &&
      enrolled.has(row.enrollment_id) &&
      expectingSessionIds.has(row.run_session_id)
  ).length;

  return pct(numerator, denominator);
}

/**
 * Overall progress: attendance units + submission units over their
 * combined opportunity count — each (enrollment × completed session) is
 * one attendance unit; each (enrollment × expecting session) is one
 * submission unit. Degrades gracefully: with no expecting sessions it
 * equals attendancePct. Bounded 0–100; returns 0 when nothing to count.
 */
export function overallProgress(
  enrollments: ProgressEnrollment[],
  sessions: ProgressSession[],
  attendance: AttendanceRow[],
  submissions: SubmissionRow[]
): number {
  const enrolled = activeEnrollmentIds(enrollments);
  const completedSessionIds = new Set(
    sessions.filter((s) => s.status === "completed").map((s) => s.id)
  );
  const expectingSessionIds = new Set(
    sessions
      .filter((s) => s.expects_submission && s.status !== "cancelled")
      .map((s) => s.id)
  );

  const denominator =
    enrolled.size * completedSessionIds.size +
    enrolled.size * expectingSessionIds.size;

  const attended = attendance.filter(
    (row) =>
      row.present &&
      enrolled.has(row.enrollment_id) &&
      completedSessionIds.has(row.run_session_id)
  ).length;
  const submitted = submissions.filter(
    (row) =>
      (row.status === "submitted" || row.status === "reviewed") &&
      enrolled.has(row.enrollment_id) &&
      expectingSessionIds.has(row.run_session_id)
  ).length;

  return pct(attended + submitted, denominator);
}
