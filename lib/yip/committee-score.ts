// Committee-level scoring (Yi 2026 Workbook "Committee Evaluation" /60).
// A committee is scored ONCE on 6 dimensions × 10 = /60. That /60 maps to the
// two committee-level criteria carried inside the per-session components:
//   • Committee Discussions & Bill Drafting → cmte.committee_level (max 5)
//   • Bill Presentation & Defence           → bill.committee_level (max 5)
// The five "drafting/committee work" dimensions (/50) drive the Committee
// committee-level; the single Presentation & Defence dimension (/10) drives the
// Bill committee-level. Both are applied equally to EVERY member of the
// committee (the workbook scores the committee, not the individual, here).

export type CommitteeDimensions = {
  bill_draft_quality: number;
  policy_relevance: number;
  innovation: number;
  feasibility: number;
  team_collaboration: number;
  presentation_defence: number;
};

export const COMMITTEE_DIMENSIONS: { key: keyof CommitteeDimensions; label: string }[] = [
  { key: "bill_draft_quality", label: "Bill Draft Quality" },
  { key: "policy_relevance", label: "Policy Relevance" },
  { key: "innovation", label: "Innovation" },
  { key: "feasibility", label: "Feasibility" },
  { key: "team_collaboration", label: "Team Collaboration" },
  { key: "presentation_defence", label: "Presentation & Defence" },
];

// The criterion keys these committee-level values are spliced into, per the
// session_parameters config for the two affected components.
export const CMTE_LEVEL_CRITERION = "cmte.committee_level"; // committee_bill_drafting
export const BILL_LEVEL_CRITERION = "bill.committee_level"; // bill_presentation_voting

// One labelled committee dimension (admin-renamable). Keys are FIXED — they map
// 1:1 to the committee_scores columns — only the labels are editable.
export type CommitteeDimensionLabel = { key: keyof CommitteeDimensions; label: string };

// The two divisors that convert the /60 committee marks into the two /5
// committee-level points. Admin-editable (yip.committee_dimensions_config);
// the default reproduces the Yi 2026 Workbook (drafting/50 → /5, presentation/10 → /5).
export type CommitteeDivisors = {
  draftingDivisor: number; // sum of the 5 drafting dims ÷ this → cmte level (default 10)
  presentationDivisor: number; // presentation_defence ÷ this → bill level (default 2)
};
export const DEFAULT_COMMITTEE_DIVISORS: CommitteeDivisors = {
  draftingDivisor: 10,
  presentationDivisor: 2,
};

// Full committee-dimensions config (labels + divisors) — the editable shape.
export type CommitteeDimensionsConfig = {
  dimensions: CommitteeDimensionLabel[];
  draftingDivisor: number;
  presentationDivisor: number;
};

/**
 * Derive the committee-level points (each 0–5) + the /60 total from the six
 * raw dimension marks. Pure — shared by the scoring screen and the results
 * engine so the displayed number and the scored number can never diverge.
 *
 * `divisors` is admin-configurable; it defaults to the Yi 2026 Workbook values
 * (10 and 2), so every existing caller that omits it behaves identically.
 * Note `total60` is independent of the divisors.
 */
export function deriveCommitteeLevels(
  d: CommitteeDimensions,
  divisors: CommitteeDivisors = DEFAULT_COMMITTEE_DIVISORS
): {
  cmteLevel: number; // 0–5, → cmte.committee_level
  billLevel: number; // 0–5, → bill.committee_level
  total60: number; // 0–60
} {
  const drafting =
    d.bill_draft_quality +
    d.policy_relevance +
    d.innovation +
    d.feasibility +
    d.team_collaboration; // 0–50
  const cmteLevel = drafting / divisors.draftingDivisor; // 50 → 5 by default
  const billLevel = d.presentation_defence / divisors.presentationDivisor; // 10 → 5 by default
  return { cmteLevel, billLevel, total60: drafting + d.presentation_defence };
}

export const ZERO_COMMITTEE_DIMENSIONS: CommitteeDimensions = {
  bill_draft_quality: 0,
  policy_relevance: 0,
  innovation: 0,
  feasibility: 0,
  team_collaboration: 0,
  presentation_defence: 0,
};

/**
 * Average a set of per-judge committee marks into one set of dimensions.
 * Multiple judges each score a committee /60; the results engine and the
 * scoring screen average them (the agreed committee mark). Returns fractional
 * values — deriveCommitteeLevels already produces fractional levels, so the
 * displayed total and the scored total stay identical. Empty input → zeros.
 */
export function averageDimensions(rows: CommitteeDimensions[]): CommitteeDimensions {
  if (rows.length === 0) return { ...ZERO_COMMITTEE_DIMENSIONS };
  const sum = { ...ZERO_COMMITTEE_DIMENSIONS };
  for (const r of rows) {
    sum.bill_draft_quality += r.bill_draft_quality;
    sum.policy_relevance += r.policy_relevance;
    sum.innovation += r.innovation;
    sum.feasibility += r.feasibility;
    sum.team_collaboration += r.team_collaboration;
    sum.presentation_defence += r.presentation_defence;
  }
  const n = rows.length;
  return {
    bill_draft_quality: sum.bill_draft_quality / n,
    policy_relevance: sum.policy_relevance / n,
    innovation: sum.innovation / n,
    feasibility: sum.feasibility / n,
    team_collaboration: sum.team_collaboration / n,
    presentation_defence: sum.presentation_defence / n,
  };
}
