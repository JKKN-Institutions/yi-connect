/**
 * Restart rules — pure, no I/O, no imports of anything that touches a
 * database. Everything the organiser action and the student's resume path
 * decide is decided HERE so it can be tested without a server.
 *
 * WHAT A RESTART IS (Director, 2026-08-25). A chapter organiser may grant
 * ONE restart per student. It is a RESUME, not a re-sit: same paper, same
 * question order, answers already saved stay saved, and the student gets
 * back only the time that was left when their paper actually stopped.
 *
 * WHAT "THE TIME THAT WAS LEFT" MEANS. `expires_at` is the authoritative
 * deadline, written once at start. `submitted_at` is when the attempt
 * actually stopped. The gap between them is what the student never got to
 * use, and is all they get back. A student whose clock simply ran out has
 * a gap of zero and gets NOTHING — that refusal is the rule working, not a
 * bug. (See computeRemainingMs for exactly which clock is which.)
 *
 * FAIL CLOSED EVERYWHERE. Missing or unparseable timestamps, a deadline
 * before the start, a submission before the start — every one of them
 * REFUSES. This decides whether a student in a scored national competition
 * gets a second sitting, so a malformed row must never be read as a yes.
 */

/** The longest paper this platform can build is 240 minutes (generatePaper). */
export const MAX_RESTART_MS = 240 * 60 * 1000;

/** Statuses an attempt can hold, per yiq.attempts' CHECK constraint. */
export type AttemptStatus =
  | "in_progress"
  | "submitted"
  | "auto_submitted"
  | "disqualified";

/** The only fields the restart decision is allowed to look at. */
export type RestartAttempt = {
  id: string;
  isMock: boolean;
  status: AttemptStatus | string;
  startedAt: string | null | undefined;
  expiresAt: string | null | undefined;
  submittedAt: string | null | undefined;
};

/** Machine-readable refusals. The UI maps these to sentences; logs keep these. */
export type RestartRefusal =
  | "mock_attempt"
  | "not_finished"
  | "submitted_deliberately"
  | "disqualified"
  | "unknown_status"
  | "already_restarted"
  | "malformed_timestamps"
  | "no_time_left";

export type RestartDecision =
  | {
      ok: true;
      /** Milliseconds to hand back. Whole seconds, clamped, always > 0. */
      grantedMs: number;
      /** Milliseconds of the paper the student DID use. Never negative. */
      usedMs: number;
      /** Full paper length, from the original attempt. */
      durationMs: number;
    }
  | { ok: false; reason: RestartRefusal };

/** Parse strictly. Anything that is not a finite epoch is `null`, never NaN. */
function ms(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Whole seconds only — a fraction of a second is zero on a student's clock. */
function floorToSecond(msValue: number): number {
  return Math.floor(msValue / 1000) * 1000;
}

/**
 * How much of the paper the student never got to use.
 *
 *     remaining = expires_at - submitted_at
 *
 * `submitted_at` is when the attempt ACTUALLY stopped, whether the student
 * pressed submit, the round closed under them, or the sweeper closed an
 * abandoned paper. If it stopped at or after the deadline the student used
 * their whole clock and the answer is 0.
 *
 * `now` is deliberately NOT an input: this is a historical fact about a
 * finished attempt, and reading it against the wall clock would quietly
 * hand a stranded paper more time the longer nobody looked at it.
 *
 * Returns `null` — not 0 — when the row cannot be trusted, so callers must
 * distinguish "nothing left" from "cannot tell". Both refuse; only one is a
 * data problem worth logging.
 */
export function computeRemainingMs(attempt: RestartAttempt): number | null {
  const started = ms(attempt.startedAt);
  const expires = ms(attempt.expiresAt);
  if (started === null || expires === null) return null;
  // A deadline at or before the start is not a paper anyone sat.
  if (expires <= started) return null;

  // A finished attempt with no stopping point is a corrupt row. There is no
  // safe default here, so refuse rather than guess with the wall clock.
  const stopped = ms(attempt.submittedAt);
  if (stopped === null) return null;
  // Stopping before you started is a corrupt row, not a full paper of credit.
  if (stopped < started) return null;

  const remaining = expires - stopped;
  return remaining <= 0 ? 0 : floorToSecond(remaining);
}

/** Full length of the paper as it was actually issued to this student. */
export function computeDurationMs(attempt: RestartAttempt): number | null {
  const started = ms(attempt.startedAt);
  const expires = ms(attempt.expiresAt);
  if (started === null || expires === null || expires <= started) return null;
  return expires - started;
}

/**
 * Clamp the time handed back. Belt and braces against a bad row: never more
 * than was left, never more than the paper itself was, never more than the
 * longest paper this platform can build.
 */
export function clampGrantedMs(remainingMs: number, durationMs: number): number {
  const capped = Math.min(remainingMs, durationMs, MAX_RESTART_MS);
  return capped <= 0 ? 0 : floorToSecond(capped);
}

/**
 * The single eligibility decision. Every caller — the organiser's grant, the
 * list of candidates, and the student's resume — asks THIS.
 *
 * `alreadyRestarted` is the caller's read of yiq.attempt_restarts. It is
 * belt to the database's braces: the unique index on (student_id) is what
 * actually makes "one restart, ever" true under two simultaneous clicks.
 */
export function canRestart(
  attempt: RestartAttempt,
  opts: { alreadyRestarted: boolean }
): RestartDecision {
  // Practice papers are unlimited already — there is nothing to grant.
  if (attempt.isMock) return { ok: false, reason: "mock_attempt" };

  if (opts.alreadyRestarted) return { ok: false, reason: "already_restarted" };

  switch (attempt.status) {
    case "auto_submitted":
      break; // the only restartable state: the paper stopped ON the student
    case "in_progress":
      // Still open (or waiting for the sweeper). Nothing has been taken away
      // yet, and reopening a live paper would hand out free time.
      return { ok: false, reason: "not_finished" };
    case "submitted":
      // A student who pressed submit has finished. Never resurrect that.
      return { ok: false, reason: "submitted_deliberately" };
    case "disqualified":
      return { ok: false, reason: "disqualified" };
    default:
      // An unrecognised status is a schema change we have not read yet.
      return { ok: false, reason: "unknown_status" };
  }

  const durationMs = computeDurationMs(attempt);
  const remainingMs = computeRemainingMs(attempt);
  if (durationMs === null || remainingMs === null) {
    return { ok: false, reason: "malformed_timestamps" };
  }

  const grantedMs = clampGrantedMs(remainingMs, durationMs);
  if (grantedMs <= 0) return { ok: false, reason: "no_time_left" };

  return {
    ok: true,
    grantedMs,
    usedMs: Math.max(0, durationMs - remainingMs),
    durationMs,
  };
}

/**
 * The two timestamps to write when the student ACTUALLY returns.
 *
 * `expiresAt` is the easy half: now + the time they were given.
 *
 * `startedAt` is the half that is easy to get wrong. `time_taken_seconds`
 * is computed at finalise as (submitted_at - started_at), and it is the
 * TEAM TIE-BREAK (lib/yiq/scoring.ts: faster team wins a tie). If the
 * original start were left in place, the hours a dead phone spent on a
 * charger would be counted as time this student spent answering, and their
 * team would lose every tie. So the start is shifted forward by exactly the
 * gap, which keeps (new expiry - new start) equal to the original paper
 * length and keeps the recorded time honest.
 */
export function restartTimestamps(
  decision: Extract<RestartDecision, { ok: true }>,
  nowMs: number = Date.now()
): { startedAt: string; expiresAt: string } {
  return {
    startedAt: new Date(nowMs - decision.usedMs).toISOString(),
    expiresAt: new Date(nowMs + decision.grantedMs).toISOString(),
  };
}

/** Plain-English refusals for the organiser's screen. */
export const REFUSAL_TEXT: Record<RestartRefusal, string> = {
  mock_attempt: "Practice papers can be retaken any number of times already.",
  not_finished: "This paper is still open — there is nothing to restart yet.",
  submitted_deliberately:
    "This student submitted their paper. A finished paper is never reopened.",
  disqualified: "This attempt was disqualified.",
  unknown_status: "This attempt is in a state this screen does not recognise.",
  already_restarted: "This student has already been given their one restart.",
  malformed_timestamps:
    "This attempt's timings do not add up, so no time can be handed back safely.",
  no_time_left:
    "This student used their full time, so a restart would hand back nothing.",
};

/** "8 min 20 sec" — for the organiser, who is deciding, not debugging. */
export function formatDuration(msValue: number): string {
  const total = Math.max(0, Math.floor(msValue / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

/** Reason text the audit trail can stand on. Returns null when acceptable. */
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function validateReason(reason: string): string | null {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < REASON_MIN) {
    return `Write at least ${REASON_MIN} characters saying what happened — this has to be defensible later.`;
  }
  if (trimmed.length > REASON_MAX) {
    return `Keep the reason under ${REASON_MAX} characters.`;
  }
  return null;
}
