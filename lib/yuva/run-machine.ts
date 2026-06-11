/**
 * Yi Youth Academy — run lifecycle state machine.
 * Donor pattern: lib/yi-future/stage-machine.ts (validated ALLOWED map,
 * NOT raw status writes). Spec: docs/yi-youth-academy-spec.md
 * §"Lifecycle State Machines".
 *
 * Pure module — zero I/O. Action-layer prerequisites NOT encoded here:
 * - in_progress → completed requires ≥1 session with status='completed'
 *   (checked by completeRun against the DB)
 * - completed → certified requires ≥1 certificate issued
 *   (checked by issueCertificates against the DB)
 */

import { RUN_STATUS_LABELS, type RunStatus } from "./constants";

// ─── ALLOWED TRANSITIONS ────────────────────────────────────────────
// published → in_progress is the documented COMPOSITE transition
// (published → applications_closed → in_progress): formCohort claims it
// atomically via compare-and-swap, auto-closing applications.
// published → draft is unpublish (confirmation required at the UI layer).
// cancelled is reachable from draft, published, applications_closed AND
// in_progress (decision 2026-06-11: a chapter/coordinator can cancel a run
// after the cohort has started — records are kept, enrolled students are
// notified, no certificates issue). It is NOT reachable from completed/
// certified — a finished run can't be un-finished.
const ALLOWED: Record<RunStatus, RunStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["applications_closed", "in_progress", "draft", "cancelled"],
  applications_closed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["certified"],
  certified: [],
  cancelled: [],
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

// ─── PUBLISH VALIDATION (draft → published) ─────────────────────────

/** Plain row slice of yuva.runs that publish validation needs. */
export interface PublishRunInput {
  apply_open_at: string | null;
  apply_close_at: string | null;
  /** Date applicants are told decisions arrive and codes go out — required to publish. */
  cohort_announce_date: string | null;
  /** Chapter-entered start date (template Part B "Filled by Chapter"). */
  start_date: string | null;
  /** Chapter-entered end date (template Part B "Filled by Chapter"). */
  end_date: string | null;
}

/** Plain row slice of yuva.run_sessions that publish validation needs. */
export interface PublishSessionInput {
  seq: number;
  name: string;
  scheduled_at: string | null;
  /** Unassigned mentors are ALLOWED at publish ("to be announced"). */
  mentor_person_id?: string | null;
}

export interface PublishValidation {
  ok: boolean;
  /** Blocking problems — publish must not proceed. */
  errors: string[];
  /** Non-blocking notices (e.g. sessions outside the entered start/end range). */
  warnings: string[];
}

/** Date-only (YYYY-MM-DD) portion of a date or timestamp string. */
function dateOnly(value: string): string {
  return value.slice(0, 10);
}

/**
 * Validate draft → published prerequisites.
 * Blocks: unscheduled sessions, missing/invalid apply window, missing
 * cohort announcement date, missing chapter-entered start/end dates.
 * Warns (never blocks): sessions scheduled outside the entered range.
 * Unassigned mentors are allowed — neither error nor warning.
 */
export function validatePublish(
  run: PublishRunInput,
  sessions: PublishSessionInput[]
): PublishValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Every session must be scheduled (fail closed on an empty session list).
  if (sessions.length === 0) {
    errors.push("Run has no sessions to publish");
  }
  for (const session of sessions) {
    if (!session.scheduled_at) {
      errors.push(`Session ${session.seq} "${session.name}" is not scheduled`);
    }
  }

  // Application window must be set and open < close.
  if (!run.apply_open_at) {
    errors.push("Application window open date is not set");
  }
  if (!run.apply_close_at) {
    errors.push("Application window close date is not set");
  }
  if (run.apply_open_at && run.apply_close_at) {
    if (new Date(run.apply_open_at) >= new Date(run.apply_close_at)) {
      errors.push("Application window must open before it closes");
    }
  }

  // Cohort announcement date must be set (shown publicly).
  if (!run.cohort_announce_date) {
    errors.push("Cohort announcement date is not set");
  }

  // Chapter-entered start/end dates must be set.
  if (!run.start_date) {
    errors.push("Run start date is not set");
  }
  if (!run.end_date) {
    errors.push("Run end date is not set");
  }

  // Sessions outside the entered start/end range → WARNING, not a block.
  if (run.start_date && run.end_date) {
    const start = dateOnly(run.start_date);
    const end = dateOnly(run.end_date);
    for (const session of sessions) {
      if (!session.scheduled_at) continue;
      const day = dateOnly(session.scheduled_at);
      if (day < start || day > end) {
        warnings.push(
          `Session ${session.seq} "${session.name}" is scheduled on ${day}, outside the run dates (${start} – ${end})`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ─── LABELS ─────────────────────────────────────────────────────────

export function runStatusLabel(status: RunStatus): string {
  return RUN_STATUS_LABELS[status];
}
