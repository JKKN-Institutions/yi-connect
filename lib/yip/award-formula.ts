// Award formula vocabulary — the editable rules the results engine interprets.
// Lives in lib (NOT a "use server" action file) so both the server action and
// the admin console UI can import these constants/types.

export const AWARD_ELIGIBILITIES = [
  "all",
  "speaker",
  "leadership",
  "ruling",
  "opposition",
  "independent",
  "no_disciplinary",
] as const;
export type AwardEligibility = (typeof AWARD_ELIGIBILITIES)[number];

export const AWARD_RANK_MODES = [
  "family_sum",
  "overall_total",
  "base_score",
  "consistency",
  "committee_level",
  "leadership_blend",
] as const;
export type AwardRankMode = (typeof AWARD_RANK_MODES)[number];

// Friendly labels for the console dropdowns.
export const ELIGIBILITY_LABELS: Record<string, string> = {
  all: "Everyone",
  speaker: "Speaker only",
  leadership: "Leadership roles",
  ruling: "Ruling bench",
  opposition: "Opposition bench",
  independent: "Independent MPs",
  no_disciplinary: "No disciplinary flag",
};
export const RANK_MODE_LABELS: Record<string, string> = {
  family_sum: "Sum of criteria / families (uses the keys below)",
  overall_total: "Overall total /100",
  base_score: "Participation base /90",
  consistency: "Most consistent (MVP basis)",
  committee_level: "Committee level (team award)",
  leadership_blend: "Leadership blend (role points + base)",
};
