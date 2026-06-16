// YIP awards — single source of truth for the 15 Yi-2026 Evaluation Workbook
// award labels. computeResults() (app/yip/actions/results.ts) assigns these
// auto, and the manual-override UI + setAwardWinner action validate against this
// list. Pure module (no "use server") so it can be imported anywhere.
//
// IMPORTANT: these strings MUST match verbatim the labels passed to assignAward()
// in computeResults — they are string-matched by the override final pass. Keep
// the two in sync (em dashes included).

export const AWARD_LABELS = [
  "Best Parliamentarian",
  "Best Debater",
  "Best Research & Presentation",
  "Most Valuable Participant (MVP)",
  "Best Constituency Representative",
  "Exemplary Parliamentary Decorum",
  "Team Spirit",
  "Innovative Ideas",
  "Community Impact",
  "Best Speaker",
  "Leadership Excellence",
  "Best Member — Ruling Bench",
  "Best Member — Opposition Bench",
  "Most Persuasive Policy Advocate",
  "Independent Voice of the House",
] as const;

export type AwardLabel = (typeof AWARD_LABELS)[number];

export function isAwardLabel(value: string): value is AwardLabel {
  return (AWARD_LABELS as readonly string[]).includes(value);
}
