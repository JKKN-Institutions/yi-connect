/**
 * Yi Recognitions — who may see other evaluators' marks, and when the
 * Regional Mentors are re-scoring after a send-back (recognitions_05).
 * Pure: no I/O. Callers pass the AwardState they already loaded.
 *
 * Piyush, 15 Oct 2026: "blind until YOU submit".
 *   - A Regional Mentor scores only their own region's chapters and sees no
 *     one else's marks. Once they have submitted EVERY sheet they hold for a
 *     recognition, they get a read-only view of every mark on it (all
 *     regions, all evaluators). They can change nothing.
 *   - The NMT the same: an NMT member sees the Mentors' marks only after
 *     submitting their own sheets for that recognition.
 *   - From Stage 2 on, every evaluator of the recognition sees the round-1
 *     leaderboard (the joint call), EXCEPT a Mentor whose sheet the NMT
 *     leader has sent back and who has not resubmitted it yet.
 *   - A duty with nothing on its sheet has submitted nothing: fail closed,
 *     it stays blind until Stage 2.
 *
 * recognitions_08 (Director, 14 Nov 2026): the super admin's switch
 * recognition_cycles.nmt_sees_rm_marks. ON (default) = everything above,
 * unchanged. OFF = an NMT member who is NOT the NMT leader never sees the
 * other evaluators' marks on that recognition: not after submitting, not in
 * Stage 2, not later. All or nothing, because every Stage 2 figure (Part A,
 * the RM points, the total) is built from the Mentors' marks. The NMT leader
 * always sees everything (they build the final ranking). A Regional Mentor
 * keeps the rule above; so does anyone who also holds the leader duty or an
 * RM duty on that recognition.
 */

import type { AwardState } from "./data";
import type { CycleRow, EvaluatorRow } from "./types";

type State = Pick<AwardState, "award" | "phase" | "completeness" | "sendBacks"> & {
  cycle: Pick<CycleRow, "nmt_sees_rm_marks">;
};
type Duty = Pick<EvaluatorRow, "id" | "award_id" | "layer" | "is_nmt_leader">;

const BEFORE_STAGE2 = new Set(["setup", "nominations", "stage1"]);

/** This duty has a sheet and every chapter on it is submitted. */
export function dutySubmittedAll(state: Pick<AwardState, "completeness">, dutyId: string): boolean {
  const p = state.completeness.perDuty.find((d) => d.evaluatorId === dutyId);
  return !!p && p.required > 0 && p.submitted >= p.required;
}

/**
 * The NMT leader sent this recognition back to its Regional Mentors and at
 * least one Mentor mark is still not resubmitted. Only while scoring or
 * moderation is under way (a submitted moderation ends it).
 */
export function mentorRescoreOpen(state: State): boolean {
  return (
    state.sendBacks.length > 0 &&
    (state.phase === "stage1" || state.phase === "stage2") &&
    state.completeness.rm.submitted < state.completeness.rm.required
  );
}

export type Sight = { sees: true; why: "submitted" | "stage2" } | { sees: false; reason: string };

/**
 * recognitions_08: the super admin's switch. Only an explicit false turns it
 * off. Undefined (the column not added yet) reads as ON, today's rule: the
 * switch cannot have been turned off before the column exists.
 */
export function nmtSeesRmMarks(cycle: Pick<CycleRow, "nmt_sees_rm_marks">): boolean {
  return cycle.nmt_sees_rm_marks !== false;
}

/**
 * The switch is OFF and every duty this viewer holds on the recognition is a
 * plain NMT seat (not the leader, no RM duty there): the marks stay hidden.
 */
export function marksHiddenFrom(state: Pick<State, "award" | "cycle">, duties: Duty[]): boolean {
  if (nmtSeesRmMarks(state.cycle)) return false;
  const mine = duties.filter((d) => d.award_id === state.award.id);
  return mine.length > 0 && mine.every((d) => d.layer === "nmt" && !d.is_nmt_leader);
}

export const MARKS_HIDDEN_REASON =
  "The Recognitions super admin has kept the other evaluators' marks, the Regional Mentors' included, hidden from NMT members who are not the NMT leader. You see only your own sheet, even after you submit. The NMT leader sees every mark and enters the final ranking.";

/** The "Your marks are private" line on the scoring sheets, true whichever way the switch is set. */
export function marksPrivacyText(hidden: boolean): string {
  return hidden
    ? "Your marks are private. Other evaluators can't see them until they have submitted their own sheet. The Recognitions super admin has kept the marks hidden from NMT members who are not the NMT leader: on such a recognition you see only your own sheet, even after you submit."
    : "Your marks are private. Other evaluators can't see them, and you see theirs only after you submit every chapter on your sheet.";
}

/**
 * May this evaluator see every mark on the recognition (read-only)?
 * `duties` = the viewer's active duties; only those on this recognition count.
 * `oversight`: the viewer is also super admin or National Leadership and is on
 * the review page. Their oversight right stands, so the recognitions_08 switch
 * does not apply; only "blind until you submit" does.
 */
export function scoreSight(state: State, duties: Duty[], opts?: { oversight?: boolean }): Sight {
  const mine = duties.filter((d) => d.award_id === state.award.id);
  if (mine.length === 0) {
    return { sees: false, reason: "You don't score this recognition, so its marks aren't shown to you here." };
  }
  if (!opts?.oversight && marksHiddenFrom(state, mine)) return { sees: false, reason: MARKS_HIDDEN_REASON };
  if (mine.every((d) => dutySubmittedAll(state, d.id))) return { sees: true, why: "submitted" };

  const sentBackToMe =
    mentorRescoreOpen(state) && mine.some((d) => d.layer === "rm" && !dutySubmittedAll(state, d.id));
  if (!BEFORE_STAGE2.has(state.phase) && !sentBackToMe) return { sees: true, why: "stage2" };

  return {
    sees: false,
    reason: sentBackToMe
      ? "The NMT leader sent this recognition back to the Regional Mentors. You see every mark again once you resubmit your sheet."
      : "Marks stay blind until you have submitted every chapter on your sheet for this recognition. Then you can see every evaluator's marks here, read-only.",
  };
}
