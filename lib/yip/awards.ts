// YIP awards — the award labels the manual-override path accepts.
// computeResults() (app/yip/actions/results.ts) assigns these auto, and the
// manual-override UI + setAwardWinner action validate against these lists. Pure
// module (no "use server") so it can be imported anywhere.
//
// IMPORTANT: these strings MUST match verbatim the labels passed to assignAward()
// in computeResults — they are string-matched by the override final pass. Keep
// them in sync with yip.award_definitions.label (em dashes included).
//
// ROUND LEVEL (2026-08)
// Awards may now be scoped to chapter / regional / national rounds
// (yip.award_definitions.levels — see lib/yip/round-level.ts). The regional set
// is a DIFFERENT set of 15, so a second list exists and isAwardLabel() accepts
// either — otherwise a chair at a regional round could not pin any winner,
// because every regional label would fail validation. Which set a given event
// actually shows comes from the database (getEventAwardLabels), not from here;
// these lists are a validation allowlist, not the resolver.

import { pickByLevel, type RoundLevel } from "@/lib/yip/round-level";

/** The 15 Yi-2026 Evaluation Workbook awards — the CHAPTER set, and the
 *  fallback set for any round with no level-scoped awards of its own. */
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

/** The 15 REGIONAL awards (Director, 2026-08-18). Seeded level-scoped
 *  '{regional}' by supabase/migrations/yip_award_definitions_round_level.sql;
 *  seven share an award_key with a chapter award but carry their own label. */
export const REGIONAL_AWARD_LABELS = [
  "Best Parliamentarian",
  "Best Speaker",
  "Parliamentary Leadership",
  "Best Treasury Bench Member",
  "Best Opposition Member",
  "Outstanding Parliamentary Debater",
  "Political Strategist",
  "Excellence in Parliamentary Conduct",
  "Best Parliamentary Journalist",
  "Best Parliamentary Administrator",
  "Best Private Member's Bill",
  "Best Zero-Hour Parliamentarian",
  "Best Question-Hour Parliamentarian",
  "Best Minister",
  "Outstanding Committee Member",
] as const;

export type AwardLabel =
  | (typeof AWARD_LABELS)[number]
  | (typeof REGIONAL_AWARD_LABELS)[number];

/** Every label the manual-override path accepts, across all round levels. */
export const ALL_AWARD_LABELS: readonly string[] = [
  ...AWARD_LABELS,
  ...REGIONAL_AWARD_LABELS.filter(
    (l) => !(AWARD_LABELS as readonly string[]).includes(l)
  ),
];

export function isAwardLabel(value: string): value is AwardLabel {
  return ALL_AWARD_LABELS.includes(value);
}

// ─── Which awards apply to a round? ──────────────────────────────────────────

/** The subset of a yip.award_definitions row needed to resolve a match. */
export type AwardDefinitionLike = {
  /**
   * Round levels this award applies to (yip.award_definitions.levels).
   * NULL / undefined / empty = every level, which is how every award behaved
   * before the column existed. Optional so a caller that does not read the
   * column keeps the old, global behaviour unchanged.
   */
  levels?: readonly string[] | null;
};

/**
 * Canonical rule for "which awards does this round give out?".
 *
 * Awards resolve as a SET, not row by row: a round that has its own award set
 * uses that set alone, and a round that does not falls back to the global
 * (every-round) set. The two tiers are never merged — a regional round hands out
 * the 15 regional awards, not those 15 plus the 15 chapter ones.
 *
 * FAIL CLOSED: when the round level is unknown (null), only global awards apply
 * — pickByLevel drops every scoped row, so `scoped` is empty and the global set
 * is returned. That is exactly the pre-2026-08 behaviour.
 *
 * Every consumer must resolve through this function so the results engine, the
 * per-event override screen and the manual-override picker cannot drift apart.
 */
export function resolveAwardsForLevel<T extends AwardDefinitionLike>(
  rows: readonly T[],
  level: RoundLevel | null | undefined
): T[] {
  const { scoped, global } = pickByLevel(rows, level);
  return scoped.length > 0 ? scoped : global;
}
