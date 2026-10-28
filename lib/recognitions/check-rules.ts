/**
 * Yi Recognitions — the nomination CHECK step (recognitions_02). Pure: no
 * I/O and no server-only imports, so pages, actions and client components
 * all apply the same rules.
 *
 * Piyush's 2026 deck: "Regional Chairs + Regional Mentors validate
 * nominations for eligibility and completeness." Director, 2026-10-10:
 *   - BOTH the Regional Chair of the region AND a Regional Mentor on the
 *     award for that region must pass a nomination. Either may send it back.
 *   - A sent-back nomination can be fixed and resubmitted until the cycle's
 *     fix deadline; still sent back after that = out of the race.
 *   - Only a nomination both checkers passed ('checked') is scored.
 *   - Checks close at the cycle's check deadline.
 *
 * National Leadership ADDED nominations (recognitions_03, origin
 * 'nl_added'): they arrive after the check deadline, during re-evaluation.
 * Their checks AND their fixes (by National Leadership, not the chapter)
 * stay open until the cycle's REEVALUATION deadline instead. Every rule
 * below picks the deadline through checkDeadlineFor / fixDeadlineFor.
 *
 * Exclusion is decided at READ time from the deadlines (no cron): the stored
 * status stays 'returned' / 'submitted', the effective status is 'excluded'.
 *
 * 2026 (Director, 2026-10-15): THE CHECK STEP IS NOT USED. With
 * CHECK_STEP_ENABLED false a submitted nomination is in the race straight
 * away and is never excluded for missing checks; only an old sent-back
 * ('returned') one still drops out once its fix deadline passes. Hidden, not
 * deleted: flip the flag to restore the two-checker rules below.
 */

import { CHECK_STEP_ENABLED } from "./constants";
import { isPast } from "./phase";
import type { CycleRow, NominationOrigin, NominationRow, NominationStatus } from "./types";

type Deadlines = Pick<CycleRow, "fix_deadline" | "check_deadline" | "reevaluation_deadline"> &
  Partial<Pick<CycleRow, "stage1_deadline">>;

/**
 * A nomination as the check rules need it. `origin` is optional on purpose:
 * before migration 03 is applied the column does not exist at runtime, and a
 * missing origin means a chapter filed it.
 */
type Nom = Pick<NominationRow, "status"> & {
  origin?: NominationOrigin | null;
  /** recognitions_05: absent before migration 05 is applied. */
  approved_at?: string | null;
};

/** True only for a nomination National Leadership added (recognitions_03). */
export function isNlAdded(n: { origin?: NominationOrigin | null } | null | undefined): boolean {
  return n?.origin === "nl_added";
}

/**
 * recognitions_05: a Regional Mentor ('rm_added') or an NMT member
 * ('nmt_added') put forward a chapter that did not apply. Neither goes
 * through the Regional Chair + RM check; an rm_added one needs an NMT
 * member's approval before it is scored.
 */
export function isEvaluatorAdded(n: { origin?: NominationOrigin | null } | null | undefined): boolean {
  return n?.origin === "rm_added" || n?.origin === "nmt_added";
}

/** Someone other than the chapter added it (NL, a Mentor or the NMT): it has a reason, not a form. */
export function isAddedForChapter(n: { origin?: NominationOrigin | null } | null | undefined): boolean {
  return isNlAdded(n) || isEvaluatorAdded(n);
}

/** A Regional Mentor's added chapter still waiting for an NMT member's approval (recognitions_05). */
export function awaitingNmtApproval(
  n: Pick<NominationRow, "status"> & { origin?: NominationOrigin | null; approved_at?: string | null }
): boolean {
  return n.origin === "rm_added" && n.status === "submitted" && !n.approved_at;
}

/** Who added it, for labels: "National Leadership", "a Regional Mentor", "the NMT". */
export const ADDED_BY_LABEL: Record<Exclude<NominationOrigin, "chapter">, string> = {
  nl_added: "National Leadership",
  rm_added: "a Regional Mentor",
  nmt_added: "an NMT member",
};

/** When this nomination's checks close: the check deadline, or re-evaluation's for an NL-added one. */
export function checkDeadlineFor(n: Nom, cycle: Deadlines): string | null {
  return isNlAdded(n) ? cycle.reevaluation_deadline : cycle.check_deadline;
}

/** Until when a sent-back nomination can be fixed: the fix deadline, or re-evaluation's for an NL-added one. */
export function fixDeadlineFor(n: Nom, cycle: Deadlines): string | null {
  return isNlAdded(n) ? cycle.reevaluation_deadline : cycle.fix_deadline;
}

/** What the stored status means right now, with the deadlines applied. */
export function effectiveStatus(n: Nom, cycle: Deadlines, now: Date = new Date()): NominationStatus {
  // recognitions_05: a Mentor- or NMT-added chapter skips the check step. An
  // rm_added one the NMT never approved drops out when scoring closes.
  if (isEvaluatorAdded(n)) {
    return awaitingNmtApproval(n) && isPast(cycle.stage1_deadline ?? null, now) ? "excluded" : n.status;
  }
  // Sent back and not fixed in time.
  if (n.status === "returned" && isPast(fixDeadlineFor(n, cycle), now)) return "excluded";
  // Filed but the two checks never both happened before checks closed.
  // Only while the check step is in use: in 2026 a submitted one is in the race.
  if (CHECK_STEP_ENABLED && n.status === "submitted" && isPast(checkDeadlineFor(n, cycle), now)) return "excluded";
  return n.status;
}

/**
 * In the race: the ONLY gate for scoring, ranking, moderation and reports.
 * 2026: every submitted nomination ('checked' is kept for any row a checker
 * passed before the step was dropped). With the check step on: only
 * 'checked' (both checkers passed it). A Regional Mentor's added chapter is
 * never in the race until an NMT member approves it (recognitions_05).
 */
export function inRace(
  n: Pick<NominationRow, "status"> & { origin?: NominationOrigin | null; approved_at?: string | null }
): boolean {
  if (awaitingNmtApproval(n)) return false;
  if (n.status === "checked") return true;
  return !CHECK_STEP_ENABLED && n.status === "submitted";
}

/**
 * Still on its way into the race: it may yet enter it, so it holds Stage 2
 * shut. 2026: only an old sent-back nomination still inside its fix window.
 * With the check step on: also one awaiting its checks.
 */
export function stillInCheck(n: Nom, cycle: Deadlines, now: Date = new Date()): boolean {
  const s = effectiveStatus(n, cycle, now);
  if (s === "returned") return true;
  return CHECK_STEP_ENABLED && s === "submitted";
}

/**
 * Checks on CHAPTER nominations are open until the check deadline. A missing
 * deadline never locks (same rule as isPast). For one nomination use
 * checksOpenFor, which knows the NL-added deadline.
 */
export function checksOpen(cycle: Deadlines, now: Date = new Date()): boolean {
  return !isPast(cycle.check_deadline, now);
}

/** Checks on THIS nomination are open (an NL-added one until the re-evaluation deadline). */
export function checksOpenFor(n: Nom, cycle: Deadlines, now: Date = new Date()): boolean {
  return !isPast(checkDeadlineFor(n, cycle), now);
}

/**
 * A sent-back nomination may be fixed and resubmitted until its fix deadline:
 * by the chapter for its own, by National Leadership for an NL-added one.
 */
export function canFix(n: Nom, cycle: Deadlines, now: Date = new Date()): boolean {
  return n.status === "returned" && !isPast(fixDeadlineFor(n, cycle), now);
}

export const NOMINATION_STATUS_LABEL: Record<NominationStatus, string> = CHECK_STEP_ENABLED
  ? {
      draft: "Draft",
      submitted: "Awaiting checks",
      returned: "Sent back",
      checked: "Passed checks",
      excluded: "Not taken forward",
    }
  : {
      draft: "Draft",
      submitted: "Submitted",
      returned: "Sent back",
      checked: "Submitted",
      excluded: "Not taken forward",
    };

export type CheckSeat = "rc" | "rm";

export const SEAT_LABEL: Record<CheckSeat, string> = { rc: "Regional Chair", rm: "Regional Mentor" };

export type SeatVerdict = { ok: true; seat: CheckSeat } | { ok: false; error: string };

/**
 * Which check seat this person fills for this nomination, or why they can't
 * act. ONE function for the Check desk (to show or hide the buttons) and the
 * server actions (the real gate), so they never disagree.
 *
 *   action 'pass'    takes the person's first EMPTY seat (Regional Chair
 *                    first). The same person can never fill both seats.
 *   action 'return'  any eligible checker may send it back while it awaits
 *                    checks, including one who already passed it.
 */
export function decideSeat(input: {
  action: "pass" | "return";
  personId: string;
  asRegionalChair: boolean;
  hasRmDuty: boolean;
  /** The person holds a directory role in the nominating chapter (or declared one on the RM duty). */
  conflicted: boolean;
  nomination: Pick<NominationRow, "status" | "rc_checked_by" | "rm_checked_by"> & { origin?: NominationOrigin | null };
  cycle: Deadlines;
  /** Formats a deadline for the message (the app's formatWhen). */
  when: (iso: string | null) => string;
  now?: Date;
}): SeatVerdict {
  const { nomination: n, cycle } = input;
  const now = input.now ?? new Date();
  if (!input.asRegionalChair && !input.hasRmDuty) {
    return {
      ok: false,
      error:
        "You can only check nominations from a region you are Regional Chair of, or a region you are Regional Mentor for on this recognition.",
    };
  }
  if (isEvaluatorAdded(n)) {
    return { ok: false, error: "A Regional Mentor or the NMT added this chapter, so it isn't checked here." };
  }
  if (input.conflicted) {
    return { ok: false, error: "You hold a role in this chapter, so you can't check its nomination. Another checker must." };
  }
  if (!checksOpenFor(n, cycle, now)) {
    return { ok: false, error: `Checks on this nomination closed on ${input.when(checkDeadlineFor(n, cycle))}.` };
  }
  if (n.status === "draft") return { ok: false, error: "The chapter hasn't submitted this nomination yet." };
  if (n.status === "returned") {
    return {
      ok: false,
      error: isNlAdded(n)
        ? "This nomination was sent back and is waiting for National Leadership to fix it."
        : "This nomination was sent back and is waiting for the chapter to fix it.",
    };
  }
  if (n.status === "checked") return { ok: false, error: "Both checkers have already passed this nomination." };
  if (n.status !== "submitted") return { ok: false, error: "This nomination is out of the race." };

  if (input.action === "return") return { ok: true, seat: input.asRegionalChair ? "rc" : "rm" };

  if (n.rc_checked_by === input.personId || n.rm_checked_by === input.personId) {
    return { ok: false, error: "You have already passed this nomination. It now needs the other checker." };
  }
  if (input.asRegionalChair && !n.rc_checked_by) return { ok: true, seat: "rc" };
  if (input.hasRmDuty && !n.rm_checked_by) return { ok: true, seat: "rm" };
  return {
    ok: false,
    error: input.asRegionalChair
      ? "A Regional Chair has already passed this nomination. It now needs a Regional Mentor."
      : "A Regional Mentor has already passed this nomination. It now needs the Regional Chair.",
  };
}

/** Plain-English reason a nomination is out of the race, or null if it isn't. */
export function exclusionReason(n: Nom, cycle: Deadlines, now: Date = new Date()): string | null {
  if (effectiveStatus(n, cycle, now) !== "excluded") return null;
  if (isEvaluatorAdded(n)) {
    if (n.origin === "rm_added" && n.status === "excluded") {
      return n.approved_at ? "The Recognitions super admin did not take it forward." : "An NMT member declined it.";
    }
    if (awaitingNmtApproval(n)) return "No NMT member approved it before scoring closed.";
  }
  if (n.status === "returned") {
    return isNlAdded(n)
      ? "It was sent back and National Leadership did not resubmit it before re-evaluation closed."
      : "It was sent back and not resubmitted before the fix deadline.";
  }
  if (n.status === "submitted") {
    return isNlAdded(n)
      ? "It did not pass both checks before re-evaluation closed."
      : "It did not pass both checks before checks closed.";
  }
  return "The Recognitions super admin did not take it forward.";
}
