// Per-DELEGATE scoring for the jury screen (field request 2026-08-10).
//
// Deliberately separate from the team rubric in future.rubrics, for two
// reasons decided with the director:
//
//  1. These scores are for INDIVIDUAL RECOGNITION (best delegate and the like).
//     They do NOT feed the team total, so nothing here can move a team's rank
//     or disturb the stored results model.
//  2. Most team criteria are meaningless about a person — "Feasibility &
//     Scalability" judges an idea, not a delegate. Reusing the 6 team criteria
//     would also put up to 30 extra inputs on screen during a live pitch
//     (teams run to 5 members); 3 keeps it to 15 at worst.
//
// A constant rather than a rubrics row: there is exactly one member rubric,
// nothing in the product edits it, and a row would need an editor UI, a
// migration and a scope value to earn its keep. Move it into future.rubrics
// the day someone needs to vary it per edition.

export type MemberCriterion = {
  key: string;
  label: string;
  max: number;
  description: string;
};

export const MEMBER_CRITERIA: MemberCriterion[] = [
  {
    key: "contribution",
    label: "Contribution",
    max: 10,
    description:
      "Share of the thinking and the work. High (8-10): clearly drove parts of the solution. Mid (4-7): contributed alongside others. Low (0-3): little visible involvement.",
  },
  {
    key: "communication",
    label: "Communication",
    max: 10,
    description:
      "Clarity when speaking. High (8-10): articulate, structured, confident. Mid (4-7): understandable but hesitant or unclear. Low (0-3): hard to follow.",
  },
  {
    key: "subject_command",
    label: "Command of the Subject",
    max: 10,
    description:
      "Depth when questioned. High (8-10): answered probing questions with evidence. Mid (4-7): handled basic questions only. Low (0-3): could not defend the work.",
  },
];

export const MEMBER_TOTAL_MAX = MEMBER_CRITERIA.reduce(
  (sum, c) => sum + c.max,
  0
);

export type MemberScores = Record<string, number>;

/** Sum a member's scores, rejecting anything outside a criterion's range.
 *  Mirrors computeTotal() for the team rubric — a slider cannot produce an
 *  out-of-range value, but a hand-crafted POST can. */
export function computeMemberTotal(scores: MemberScores): number {
  let total = 0;
  for (const c of MEMBER_CRITERIA) {
    const v = scores[c.key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || Number.isNaN(v)) {
      throw new Error(`${c.label}: not a number.`);
    }
    if (v < 0 || v > c.max) {
      throw new Error(`${c.label}: must be between 0 and ${c.max}.`);
    }
    total += v;
  }
  return Math.round(total * 100) / 100;
}

/** True when the jury left this member untouched — nothing is written for
 *  them, so an unscored member is absent rather than a row of zeros. */
export function isMemberUnscored(scores: MemberScores): boolean {
  return MEMBER_CRITERIA.every(
    (c) => scores[c.key] === undefined || scores[c.key] === null
  );
}
