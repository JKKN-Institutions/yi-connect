/**
 * Yi Youth Academy — per-session submission rules (Phase 13) [TDD].
 * Tests: lib/yuva/__tests__/submission-rules.test.ts
 *
 * PURE decisions, zero I/O. The IO sides live in
 * app/youth-academy/actions/submissions.ts:
 * - saveSubmissionDraft uses nextVersion + canStudentTouch to decide whether
 *   the current draft is overwritten in place or a NEW version row is born.
 * - submitSubmission stamps is_late via isLateSubmission against the
 *   session's scheduled_at.
 * - reviewSubmission gates on canMentorReview (only 'submitted' work).
 *
 * Rule (spec §Server Actions Inventory, actions/submissions.ts row):
 * - late = submitted strictly AFTER the session's scheduled date +
 *   SUBMISSION_GRACE_DAYS (7) grace window; no scheduled date → never late
 * - a draft overwrites in place; resubmit after submitted/reviewed bumps
 *   the version (unique (run_session_id, enrollment_id, version))
 * - only ACTIVE enrollments write; submitted/reviewed rows are read-only
 *   to the student — resubmission creates a new version instead
 */

import { SUBMISSION_GRACE_DAYS } from "./constants";

export type SubmissionStatus = "draft" | "submitted" | "reviewed";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is a submission late? Late = submitted strictly after the session's
 * scheduled date + `graceDays` (default SUBMISSION_GRACE_DAYS = 7).
 * A session with no scheduled date (null) can never produce a late
 * submission; unparseable dates also resolve to "not late" (fail soft —
 * the late flag is informational, never a gate).
 */
export function isLateSubmission(
  sessionScheduledAt: string | Date | null,
  submittedAt: string | Date,
  graceDays: number = SUBMISSION_GRACE_DAYS
): boolean {
  if (!sessionScheduledAt) return false;

  const scheduledMs = new Date(sessionScheduledAt).getTime();
  const submittedMs = new Date(submittedAt).getTime();
  if (!Number.isFinite(scheduledMs) || !Number.isFinite(submittedMs)) {
    return false;
  }

  return submittedMs > scheduledMs + graceDays * DAY_MS;
}

/**
 * Which version should a student's save land on?
 * - no rows yet → 1
 * - highest version is a draft → that SAME version (overwrite in place)
 * - highest version is submitted/reviewed → highest + 1 (a new row;
 *   submitted/reviewed rows are immutable history)
 * Input order does not matter — the decision keys off the highest version.
 */
export function nextVersion(
  existing: { version: number; status: SubmissionStatus }[]
): number {
  if (existing.length === 0) return 1;

  let latest = existing[0];
  for (const row of existing) {
    if (row.version > latest.version) latest = row;
  }

  return latest.status === "draft" ? latest.version : latest.version + 1;
}

export type StudentTouchVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * May the student write to this submission slot / row in place?
 * - non-active enrollment (completed/dropped) → never
 * - no submission yet, or a draft → yes
 * - submitted/reviewed → no (immutable to the student; resubmission
 *   creates a NEW version via nextVersion instead)
 */
export function canStudentTouch(
  enrollment: { status: "active" | "completed" | "dropped" },
  submission?: { status: SubmissionStatus }
): StudentTouchVerdict {
  if (enrollment.status !== "active") {
    return {
      allowed: false,
      reason: `Your enrollment is ${enrollment.status} — submissions are read-only.`,
    };
  }

  if (submission && submission.status !== "draft") {
    return {
      allowed: false,
      reason:
        submission.status === "reviewed"
          ? "This work has been reviewed and is read-only — save a new draft to resubmit as a new version."
          : "This work is already submitted — save a new draft to resubmit as a new version.",
    };
  }

  return { allowed: true };
}

export type MentorReviewVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * May a mentor/manager review this submission? Only 'submitted' work is
 * reviewable — drafts have not been handed in, reviewed work is done.
 */
export function canMentorReview(submission: {
  status: SubmissionStatus;
}): MentorReviewVerdict {
  if (submission.status === "submitted") {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      submission.status === "draft"
        ? "This work is still a draft — the student has not submitted it yet."
        : "This work has already been reviewed.",
  };
}
