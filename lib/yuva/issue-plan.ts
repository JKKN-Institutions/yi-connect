/**
 * Yi Youth Academy — certificate ISSUE PLAN builder (pure, zero I/O).
 * Phase 14. Spec: docs/yi-youth-academy-spec.md §"Phase 14" +
 * actions inventory row `actions/certificates.ts`.
 *
 * Sits on top of the Phase 3 eligibility engine
 * (lib/yuva/certificate-eligibility.ts): given the live roster state, the
 * attendance threshold and the chapter's per-student overrides, decide
 * EXACTLY which enrollments get a certificate in this batch.
 *
 * Hard rules (PUBLISHED FACTS — certificate numbers are permanent):
 *   1. Already-certified enrollments (certificate_id set) are ALWAYS
 *      skipped — idempotency: a double-click burns no numbers and orphans
 *      no PDFs. Not even an include-override can re-issue through here
 *      (reissueCertificate is the sanctioned regeneration path).
 *   2. Dropped enrollments are ALWAYS excluded — never certifiable, not
 *      even by override (same semantics as eligibleByAttendance).
 *   3. Overrides may include a below-threshold student or exclude an
 *      above-threshold one. The action layer separately enforces
 *      canOverrideEligibility (no overrides while zero completed sessions).
 *   4. Both 'active' and 'completed' enrollment statuses are issuable.
 *   5. Every roster row lands in exactly ONE bucket; overrides referencing
 *      unknown enrollment ids are ignored.
 */

export interface IssuePlanEntry {
  enrollment_id: string;
  /** Live attendance percentage (lib/yuva/progress.ts attendancePct), 0–100. */
  attendance_pct: number;
  /** Non-null ⇒ a certificate already exists for this enrollment. */
  certificate_id: string | null;
  enrollment_status: "active" | "completed" | "dropped";
}

export interface IssueOverride {
  enrollment_id: string;
  /** true = issue even below threshold; false = withhold even above it. */
  include: boolean;
}

export interface IssuePlan {
  /** Enrollment ids to issue a certificate for, in roster order. */
  toIssue: string[];
  /** Already-certified enrollment ids — skipped before any number burns. */
  skippedAlreadyCertified: string[];
  /** Everyone else, each with an explicit human-readable reason. */
  excluded: { enrollment_id: string; reason: string }[];
}

export function buildIssuePlan(
  roster: IssuePlanEntry[],
  threshold: number,
  overrides: IssueOverride[]
): IssuePlan {
  const overrideById = new Map<string, boolean>();
  for (const o of overrides) {
    overrideById.set(o.enrollment_id, o.include);
  }

  const toIssue: string[] = [];
  const skippedAlreadyCertified: string[] = [];
  const excluded: { enrollment_id: string; reason: string }[] = [];

  for (const entry of roster) {
    // 1. Idempotency FIRST — an existing certificate beats everything.
    if (entry.certificate_id !== null) {
      skippedAlreadyCertified.push(entry.enrollment_id);
      continue;
    }

    // 2. Dropped — never certifiable, override ignored.
    if (entry.enrollment_status === "dropped") {
      excluded.push({
        enrollment_id: entry.enrollment_id,
        reason: "Dropped from the cohort — never certifiable",
      });
      continue;
    }

    // 3. Chapter override (include below threshold / exclude above it).
    const override = overrideById.get(entry.enrollment_id);
    if (override === false) {
      excluded.push({
        enrollment_id: entry.enrollment_id,
        reason: "Excluded by chapter override",
      });
      continue;
    }
    if (override === true) {
      toIssue.push(entry.enrollment_id);
      continue;
    }

    // 4. Default: attendance threshold, inclusive.
    if (entry.attendance_pct >= threshold) {
      toIssue.push(entry.enrollment_id);
    } else {
      excluded.push({
        enrollment_id: entry.enrollment_id,
        reason: `Below ${threshold}% attendance (${entry.attendance_pct}%)`,
      });
    }
  }

  return { toIssue, skippedAlreadyCertified, excluded };
}
