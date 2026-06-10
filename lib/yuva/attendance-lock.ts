/**
 * Yi Youth Academy — attendance edit lock (Phase 11) [TDD].
 * Tests: lib/yuva/__tests__/attendance-lock.test.ts
 *
 * PURE decision, zero I/O. The IO sides live in
 * app/youth-academy/actions/attendance.ts:
 * - saveSessionAttendance resolves `reopened` from the audit log (an
 *   'attendance_reopened' row for the run within ATTENDANCE_REOPEN_MINUTES)
 *   and calls canEditAttendance before any write.
 * - reopenAttendance (manager-only, audited) is what arms that flag.
 *
 * Rule (spec §Server Actions Inventory, actions/attendance.ts row):
 * - published / applications_closed / in_progress → editable (live cohort)
 * - completed / certified → LOCKED unless an audited reopen is active
 * - draft / cancelled → never editable (no cohort exists; reopen cannot help)
 */

import type { RunStatus } from "./constants";
import { RUN_STATUS_LABELS } from "./constants";

/** How long an audited reopen keeps a completed/certified run editable. */
export const ATTENDANCE_REOPEN_MINUTES = 30;

/** Run statuses with a live cohort — attendance is freely editable. */
const LIVE_STATUSES: ReadonlySet<RunStatus> = new Set([
  "published",
  "applications_closed",
  "in_progress",
]);

/** Run statuses where the audited reopen window applies. */
const LOCKED_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "certified",
]);

export type AttendanceLockVerdict =
  | { editable: true }
  | { editable: false; reason: string };

/**
 * Can attendance be edited for a run in this status?
 *
 * @param runStatus the run's current lifecycle status
 * @param reopened  true when an audited reopen window is currently active
 *                  (reopenAttendance audit row ≤ ATTENDANCE_REOPEN_MINUTES old)
 */
export function canEditAttendance(
  runStatus: RunStatus,
  reopened: boolean
): AttendanceLockVerdict {
  if (LIVE_STATUSES.has(runStatus)) {
    return { editable: true };
  }

  if (LOCKED_STATUSES.has(runStatus)) {
    if (reopened) return { editable: true };
    return {
      editable: false,
      reason: `Attendance is locked — this run is ${RUN_STATUS_LABELS[runStatus].toLowerCase()}. A run manager can reopen editing for ${ATTENDANCE_REOPEN_MINUTES} minutes (audit-logged).`,
    };
  }

  // draft / cancelled — no cohort exists; a reopen cannot help.
  return {
    editable: false,
    reason: `Attendance cannot be edited — this run is ${RUN_STATUS_LABELS[runStatus].toLowerCase()} and has no cohort.`,
  };
}
