/**
 * YIQ event-admin rules — pure decision functions, NO I/O.
 *
 * Two Director rulings (2026-08-25) live here:
 *
 * 1. THE QUALIFYING LINE MOVES ONLY BEFORE THE ROUND OPENS.
 *    `yiq.chapter_events.qualifying_team_count` decides how many teams per
 *    category go through to the chapter finals. A chapter organiser may set
 *    it while the round has not started — draft, registration_open,
 *    registration_closed. The moment the online round goes live the
 *    organiser's control CLOSES, because from then on a chapter could see its
 *    own scores and then move its own qualifying line.
 *    YIQ national may change it at ANY status: the person who moves the line
 *    is never the person whose chapter it decides.
 *
 * 2. A TEAM MAY BE DISQUALIFIED, WITH A REASON.
 *    The reason is required and recorded with who and when, so a disqualified
 *    team is always explainable months later. It must also be undoable — an
 *    organiser who picks the wrong row has to be able to put it back.
 *
 * FAIL CLOSED. An unrecognised status denies BOTH tiers rather than guessing
 * which side of the round it sits on — a status this file has never heard of
 * is a schema change, and a human should look at it before the qualifying
 * line moves. Every valid status is enumerated in lib/yiq/constants.ts.
 *
 * Pure by design so the rules are testable without a database:
 *   npx tsx lib/yiq/__tests__/event-admin.check.ts
 */

import {
  CHAPTER_EVENT_STATUSES,
  STATUS_LABELS,
  type ChapterEventStatus,
} from "./constants";

/** Mirrors the DB CHECK: qualifying_team_count between 2 and 50. */
export const QUALIFYING_COUNT_MIN = 2;
export const QUALIFYING_COUNT_MAX = 50;

/** A reason has to be a sentence, not a keystroke. */
export const DISQUALIFY_REASON_MIN = 6;
export const DISQUALIFY_REASON_MAX = 500;

/**
 * The statuses in which a CHAPTER ORGANISER may still move the line — every
 * rung before the online round opens. Anything at or past online_round_live
 * is national-only.
 */
export const ORGANISER_EDITABLE_STATUSES: readonly ChapterEventStatus[] = [
  "draft",
  "registration_open",
  "registration_closed",
];

export type QualifyingLockReason =
  /** National tier: allowed whatever the status says. */
  | "national_override"
  /** Organiser, and the round has not opened yet. */
  | "before_online_round"
  /** Organiser, and the round is live or past — denied. */
  | "round_already_open"
  /** Status not in CHAPTER_EVENT_STATUSES — denied for everyone. */
  | "unknown_status";

export type QualifyingLock = {
  allowed: boolean;
  /** Machine-readable — for logs, audit rows and tests. */
  reason: QualifyingLockReason;
  /** One sentence a non-technical organiser can act on. */
  message: string;
};

export function isChapterEventStatus(v: unknown): v is ChapterEventStatus {
  return (
    typeof v === "string" &&
    (CHAPTER_EVENT_STATUSES as readonly string[]).includes(v)
  );
}

/**
 * May this viewer change the qualifying team count right now?
 *
 * @param status      the chapter event's raw status (DB `text`, so untrusted)
 * @param isNational  true only for a verified YIQ national / platform admin
 */
export function canEditQualifyingCount(
  status: string,
  isNational: boolean
): QualifyingLock {
  if (!isChapterEventStatus(status)) {
    return {
      allowed: false,
      reason: "unknown_status",
      message: `This event's status ("${status}") is not one YIQ recognises, so the qualifying count is locked. Ask a YIQ national admin to look at it.`,
    };
  }

  if (isNational) {
    return {
      allowed: true,
      reason: "national_override",
      message:
        "You are a YIQ national admin, so you can change the qualifying count at any stage.",
    };
  }

  if (ORGANISER_EDITABLE_STATUSES.includes(status)) {
    return {
      allowed: true,
      reason: "before_online_round",
      message:
        "The online round has not opened yet, so you can still set how many teams qualify.",
    };
  }

  return {
    allowed: false,
    reason: "round_already_open",
    message: `The online round is already at "${STATUS_LABELS[status]}", so the qualifying count is locked. Ask a YIQ national admin if it genuinely has to change.`,
  };
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Validate the qualifying team count server-side so the user gets a sentence
 * instead of a Postgres constraint violation. Accepts `unknown` because it is
 * fed straight from a form.
 */
export function validateQualifyingCount(input: unknown): Validated<number> {
  const n = typeof input === "string" ? Number(input.trim()) : input;

  if (typeof n !== "number" || !Number.isFinite(n)) {
    return { ok: false, error: "Enter a number of qualifying teams." };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: "The qualifying count must be a whole number." };
  }
  if (n < QUALIFYING_COUNT_MIN || n > QUALIFYING_COUNT_MAX) {
    return {
      ok: false,
      error: `Choose between ${QUALIFYING_COUNT_MIN} and ${QUALIFYING_COUNT_MAX} qualifying teams per category.`,
    };
  }
  return { ok: true, value: n };
}

/**
 * Validate a disqualification (or reinstatement) reason. It is written to the
 * audit log and shown back to the organiser, so an empty or one-character
 * reason is refused.
 */
export function validateDisqualifyReason(input: unknown): Validated<string> {
  if (typeof input !== "string") {
    return { ok: false, error: "Type a reason before continuing." };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Type a reason before continuing." };
  }
  if (trimmed.length < DISQUALIFY_REASON_MIN) {
    return {
      ok: false,
      error: `Write a real reason — at least ${DISQUALIFY_REASON_MIN} characters. It is recorded against this team permanently.`,
    };
  }
  if (trimmed.length > DISQUALIFY_REASON_MAX) {
    return {
      ok: false,
      error: `Keep the reason under ${DISQUALIFY_REASON_MAX} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

/**
 * Where a reinstated team goes back to. The status it held before it was
 * disqualified when we recorded one; otherwise "registered", the door the
 * team came in through. Never guesses "qualified" — putting a team back into
 * the qualifying set is a decision for the standings computation, not for an
 * undo button.
 */
/**
 * Every team status an undo may restore — i.e. every legal team status except
 * "disqualified" itself. "withdrawn" is deliberately included: if a team had
 * already withdrawn before it was disqualified, the honest undo puts it back
 * to withdrawn rather than silently un-withdrawing it.
 */
export const TEAM_RESTORE_STATUSES = [
  "registered",
  "confirmed",
  "withdrawn",
  "qualified",
  "eliminated",
  "runner_up",
  "champion",
] as const;

export type TeamRestoreStatus = (typeof TEAM_RESTORE_STATUSES)[number];

/**
 * The read model the admin panel renders. Lives here rather than in the
 * action file because a "use server" module may export ONLY async functions.
 */
export type EventAdminTeam = {
  id: string;
  name: string;
  teamCode: string;
  category: "junior" | "senior";
  status: string;
  schoolName: string | null;
  onlineRank: number | null;
  onlineTotalScore: number | null;
  disqualifiedReason: string | null;
  disqualifiedAt: string | null;
};

export type EventAdminState = {
  eventId: string;
  chapterName: string | null;
  status: string;
  statusLabel: string;
  qualifyingCount: number;
  isNational: boolean;
  /** Whether the viewer may disqualify / reinstate at all. */
  canManage: boolean;
  lock: QualifyingLock;
  teams: EventAdminTeam[];
};

export function reinstatementStatus(previousStatus: unknown): TeamRestoreStatus {
  if (
    typeof previousStatus === "string" &&
    (TEAM_RESTORE_STATUSES as readonly string[]).includes(previousStatus)
  ) {
    return previousStatus as TeamRestoreStatus;
  }
  return "registered";
}
