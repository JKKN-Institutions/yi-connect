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

/**
 * Derive the committee-level points (each 0–5) + the /60 total from the six
 * raw dimension marks. Pure — shared by the scoring screen and the results
 * engine so the displayed number and the scored number can never diverge.
 */
export function deriveCommitteeLevels(d: CommitteeDimensions): {
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
  const cmteLevel = drafting / 10; // 50 → 5
  const billLevel = d.presentation_defence / 2; // 10 → 5
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
