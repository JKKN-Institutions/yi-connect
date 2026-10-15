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
 */

import type { AwardState } from "./data";
import type { EvaluatorRow } from "./types";

type State = Pick<AwardState, "award" | "phase" | "completeness" | "sendBacks">;

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
 * May this evaluator see every mark on the recognition (read-only)?
 * `duties` = the viewer's active duties; only those on this recognition count.
 */
export function scoreSight(state: State, duties: Pick<EvaluatorRow, "id" | "award_id" | "layer">[]): Sight {
  const mine = duties.filter((d) => d.award_id === state.award.id);
  if (mine.length === 0) {
    return { sees: false, reason: "You don't score this recognition, so its marks aren't shown to you here." };
  }
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
