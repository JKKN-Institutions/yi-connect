/**
 * Yi Youth Academy — certificate eligibility engine (pure, zero I/O).
 * Spec: docs/yi-youth-academy-spec.md §"Pure engines".
 *
 * Eligibility = attendance ≥ threshold (default 75%, inclusive). Chapters
 * may override per student, EXCEPT when the run has zero completed
 * sessions — attendance is meaningless then and no certificate may be
 * forced through.
 */

import { CERT_ATTENDANCE_DEFAULT } from "./constants";

/** Plain roster row: enrollment + its precomputed attendance percentage. */
export interface RosterEntry {
  enrollment_id: string;
  status: "active" | "completed" | "dropped";
  /** 0–100, as computed by lib/yuva/progress.ts attendancePct. */
  attendance_pct: number;
}

export interface EligibilityResult {
  /** Enrollment ids meeting the attendance threshold. */
  eligible: string[];
  /**
   * Enrollment ids below the threshold — still issuable via per-student
   * override (subject to canOverrideEligibility).
   */
  ineligible: string[];
}

/**
 * Split a roster into eligible / ineligible by attendance threshold
 * (inclusive: pct === threshold is eligible). Dropped enrollments are
 * excluded from BOTH lists — they are never certified, not even by
 * override.
 */
export function eligibleByAttendance(
  roster: RosterEntry[],
  threshold: number = CERT_ATTENDANCE_DEFAULT
): EligibilityResult {
  const eligible: string[] = [];
  const ineligible: string[] = [];
  for (const entry of roster) {
    if (entry.status === "dropped") continue;
    if (entry.attendance_pct >= threshold) {
      eligible.push(entry.enrollment_id);
    } else {
      ineligible.push(entry.enrollment_id);
    }
  }
  return { eligible, ineligible };
}

export interface OverrideDecision {
  allowed: boolean;
  /** Present when blocked — explicit deny, never silent. */
  reason?: string;
}

/**
 * Per-student eligibility override gate: BLOCKED while the run has zero
 * completed sessions (no delivered content → nothing a certificate could
 * attest to).
 */
export function canOverrideEligibility(
  sessions: Array<{ status: "scheduled" | "completed" | "cancelled" }>
): OverrideDecision {
  const hasCompleted = sessions.some((s) => s.status === "completed");
  if (!hasCompleted) {
    return {
      allowed: false,
      reason:
        "Per-student override is blocked until the run has at least one completed session",
    };
  }
  return { allowed: true };
}
