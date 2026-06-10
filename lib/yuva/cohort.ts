/**
 * Yi Youth Academy — cohort formation PURE pieces (Phase 9) [TDD].
 * Tests: lib/yuva/__tests__/cohort-formation.test.ts
 *
 * The IO orchestration (compare-and-swap claim, resolvePerson, enrollment
 * inserts, email enqueues) lives in app/youth-academy/actions/applications.ts;
 * everything decidable without I/O lives here.
 *
 * generateAccessCode: CSPRNG (crypto.randomBytes), 8 chars from the 32-char
 * unambiguous alphabet. The yi-future donor (lib/yi-future/access-code.ts)
 * has the alphabet but uses Math.random + 6 chars — deliberately NOT cloned
 * (spec: codes are login credentials, not display tokens).
 */

import { randomBytes } from "crypto";
import type { RunStatus } from "./constants";
import { RUN_STATUS_LABELS } from "./constants";

// ─── Access codes ─────────────────────────────────────────────────────────

/** 32-char unambiguous alphabet (no 0/O/1/I). 256 % 32 === 0 ⇒ unbiased. */
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_LENGTH = 8;

/** CSPRNG 8-char access code. 32^8 ≈ 1.1e12 — collisions handled at insert. */
export function generateAccessCode(): string {
  const bytes = randomBytes(ACCESS_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[bytes[i] % ACCESS_CODE_ALPHABET.length];
  }
  return code;
}

// ─── Cohort plan (pure — feeds formCohort after the CAS claim) ────────────

export type PlanApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn";

/** Slice of yuva.applications the planner needs. */
export type PlanApplication = {
  id: string;
  status: PlanApplicationStatus;
  full_name: string;
  email: string;
  person_id: string | null;
};

/** Slice of yuva.enrollments the planner needs. */
export type PlanEnrollment = {
  application_id: string | null;
  person_id: string;
};

export type CohortPlan = {
  /** Accepted applications with no enrollment yet — enroll these. */
  toEnroll: PlanApplication[];
  /** Rejected applications — enqueue rejection emails for these. */
  toReject: PlanApplication[];
  /** Accepted but already enrolled (by application OR person) — skip. */
  alreadyEnrolled: PlanApplication[];
};

/**
 * Decide what cohort formation must do. Idempotent by construction: an
 * application already enrolled (matched by application_id, or by an already
 * resolved person_id) lands in `alreadyEnrolled`, so a re-click after a
 * partial failure only processes the remainder. Pending and withdrawn
 * applications are excluded entirely — they stay reviewable afterwards
 * (late acceptance is an explicit separate action).
 */
export function buildCohortPlan(
  applications: PlanApplication[],
  existingEnrollments: PlanEnrollment[]
): CohortPlan {
  const enrolledApplicationIds = new Set(
    existingEnrollments
      .map((e) => e.application_id)
      .filter((id): id is string => !!id)
  );
  const enrolledPersonIds = new Set(
    existingEnrollments.map((e) => e.person_id)
  );

  const toEnroll: PlanApplication[] = [];
  const toReject: PlanApplication[] = [];
  const alreadyEnrolled: PlanApplication[] = [];

  for (const application of applications) {
    if (application.status === "rejected") {
      toReject.push(application);
      continue;
    }
    if (application.status !== "accepted") continue; // pending / withdrawn

    const enrolled =
      enrolledApplicationIds.has(application.id) ||
      (application.person_id !== null &&
        enrolledPersonIds.has(application.person_id));
    if (enrolled) {
      alreadyEnrolled.push(application);
    } else {
      toEnroll.push(application);
    }
  }

  return { toEnroll, toReject, alreadyEnrolled };
}

// ─── Acceptance guard (pure — gates accept / late-accept) ─────────────────

/** Run statuses in which applications may be reviewed (accept/reject). */
export const REVIEWABLE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  "published",
  "applications_closed",
  "in_progress",
]);

export type AcceptanceGuardResult = {
  allowed: boolean;
  /** Set when allowed but the chapter should see a heads-up (duplicate). */
  warn?: boolean;
  reason?: string;
};

/**
 * Pure decision for acceptApplication / addLateAcceptance.
 *
 * @param run                          slice with the current run status
 * @param application                  slice with the application status
 * @param resolvedPersonExistingInRun  true when the resolved person already
 *                                     has an accepted application or an
 *                                     enrollment in this run (duplicate) —
 *                                     warns, never blocks (spec).
 */
export function acceptanceGuard(
  run: { status: RunStatus },
  application: { status: PlanApplicationStatus },
  resolvedPersonExistingInRun: boolean
): AcceptanceGuardResult {
  if (!REVIEWABLE_RUN_STATUSES.has(run.status)) {
    return {
      allowed: false,
      reason: `Applications can only be accepted while the run is published, applications-closed or in progress — this run is ${RUN_STATUS_LABELS[run.status].toLowerCase()}.`,
    };
  }
  if (application.status === "withdrawn") {
    return {
      allowed: false,
      reason: "This application was withdrawn by the applicant.",
    };
  }
  if (resolvedPersonExistingInRun) {
    return {
      allowed: true,
      warn: true,
      reason:
        "This person already has an accepted application or enrollment in this run — accepting again will not create a second seat.",
    };
  }
  return { allowed: true };
}
