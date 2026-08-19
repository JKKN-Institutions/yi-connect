// Role-dependent scoring criteria — the vocabulary, the resolution rule, and
// the denominator rule. PURE and client-safe (no imports with side effects), so
// the admin editor, the jury screen, the submit validator and the results engine
// all share ONE implementation and cannot drift apart. That is the same lesson
// as lib/yip/session-config-resolution.ts (#955): when the juror's side and the
// engine's side each re-implement a rule, they eventually disagree and a human's
// marks are weighted against a sheet they never saw.
//
// WHY THIS FILE EXISTS
// A session's published criteria list spans BOTH sides of the House, but any one
// student is only marked on the subset that matches their role. Director,
// 2026-08:
//
//   "The idea is to have 10 points for each session for a student… why we have
//    16 or 18 because, I have included ruling and opp points. Meaning Presenter
//    gets 6/8, Opp gets 6/8 and common for both 2/4."
//
// Worked example — Government Bills, 16 points published:
//
//   Quality of Bill & Defense to questions   6   the presenter   -> ["side:ruling"]
//   Parliamentary Presentation               4   both           -> (untagged)
//   Question & Critic of the Bill            6   the opposition -> ["side:opposition"]
//
// The presenter is marked out of 6 + 4 = 10. The opposition member out of
// 6 + 4 = 10. NOBODY is ever marked out of 16 — and the results engine must
// divide by 10, not 16, or every presenter is silently under-scored by 37%.
//
// NOT EVERY SESSION SPLITS. Best Parliamentarian Debate (18) applies all three
// criteria to everyone — it is an open-floor debate with no two sides, and it is
// deliberately weighted heavier because the top award comes from it. Zero Hour
// (18) is treated the same way. All 13 sheets in production today are of that
// second kind: no criterion carries a role tag, so every function here returns
// exactly what the pre-role code returned. That is the zero-behaviour-change
// guarantee, and it is structural rather than a claim — see isRoleSplitSheet().
//
// WHAT WAS ALREADY HERE
// lib/yip/rubric.ts already had `criteriaForRole()` and
// RubricCriterionShape.roles, and components/yip/scoring/score-form.tsx already
// called it — but nothing could ever SET a role tag (the admin editor has no
// field for it, and getSessionScoringParams dropped the property), so the
// mechanism was dark: zero rows in yip.rubrics and zero rows in
// yip.session_parameters carry a tag. This file keeps that vocabulary
// (parliament-role slugs) and adds the one axis it could not express — which
// BENCH a student sits on — because "the presenter" and "the opposition" in a
// Government Bill are benches, not parliament roles: a ruling MP and an
// opposition MP both have parliament_role = 'mp'.

import { ROLE_LABELS } from "@/lib/yip/constants";

// ─── Vocabulary ───────────────────────────────────────────────────
//
// A role slug is EITHER a parliament_role value ('mp', 'cabinet_minister', …)
// or a bench pseudo-slug. Bench slugs are namespaced with a colon, which no
// parliament_role enum value contains, so the two spaces can never collide and
// every criterion tagged only with parliament roles resolves exactly as it did
// before benches were expressible.

export const SIDE_SLUG_PREFIX = "side:";
export const SIDE_RULING = "side:ruling";
export const SIDE_OPPOSITION = "side:opposition";

export const SIDE_SLUGS = [SIDE_RULING, SIDE_OPPOSITION] as const;

export type SideSlug = (typeof SIDE_SLUGS)[number];

/** Human label for any role slug — bench slugs included. */
export function roleSlugLabel(slug: string): string {
  if (slug === SIDE_RULING) return "Treasury bench (ruling)";
  if (slug === SIDE_OPPOSITION) return "Opposition bench";
  return ROLE_LABELS[slug] ?? slug;
}

/** Is this a bench pseudo-slug rather than a parliament_role value? */
export function isSideSlug(slug: string): slug is SideSlug {
  return slug.startsWith(SIDE_SLUG_PREFIX);
}

/**
 * The tagging choices offered in the admin editor, benches first because those
 * are the ones a split sheet almost always uses.
 */
export function roleSlugOptions(): { slug: string; label: string }[] {
  return [
    ...SIDE_SLUGS.map((s) => ({ slug: s as string, label: roleSlugLabel(s) })),
    ...Object.keys(ROLE_LABELS).map((s) => ({ slug: s, label: ROLE_LABELS[s] })),
  ];
}

// ─── The shapes this module operates on ───────────────────────────

/** Any criterion that can carry a role scope. */
export type RoleScopedCriterion = {
  key: string;
  label: string;
  max_score: number;
  /** Role slugs this criterion applies to. Absent/null/empty = EVERYONE. */
  roles?: readonly string[] | null;
};

/** The subset of a yip.participants row needed to derive a role. */
export type RoleBearingParticipant = {
  parliament_role?: string | null;
  party_side?: string | null;
};

/** How the role attached to a score was arrived at. */
export const SCORED_ROLE_SOURCES = ["auto", "override"] as const;
export type ScoredRoleSource = (typeof SCORED_ROLE_SOURCES)[number];

// ─── Storage normalisation ────────────────────────────────────────

/**
 * Canonical storage form for a criterion's role scope.
 *
 * Returns null for "applies to everyone", so null and [] cannot become two
 * spellings of the same thing. Non-string and blank entries are dropped and
 * duplicates removed. Mirrors normaliseRoundLevels() in lib/yip/round-level.ts.
 */
export function normaliseRoleSlugs(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s) seen.add(s);
  }
  if (seen.size === 0) return null;
  return Array.from(seen);
}

// ─── Deriving a student's role ────────────────────────────────────

/**
 * The role slugs a participant carries, derived from data the app already
 * holds: their parliament_role and which bench they sit on.
 *
 * Both are optional in production — 1,801 participants have parliament_role
 * 'mp' with NO party_side (chapter rounds that never ran party formation), and
 * of the 1,546 participants who have actually been scored, 335 (22%) have no
 * bench. So an empty result is a NORMAL state, not a corruption, and callers
 * must handle it visibly rather than guessing a side.
 */
export function deriveRoleSlugs(p: RoleBearingParticipant): string[] {
  const out: string[] = [];
  const role = typeof p.parliament_role === "string" ? p.parliament_role.trim() : "";
  if (role) out.push(role);
  if (p.party_side === "ruling") out.push(SIDE_RULING);
  else if (p.party_side === "opposition") out.push(SIDE_OPPOSITION);
  return out;
}

// ─── Matching ─────────────────────────────────────────────────────

/** Does this criterion apply to a student holding `slugs`? */
export function criterionAppliesTo(
  criterion: RoleScopedCriterion,
  slugs: readonly string[]
): boolean {
  const roles = criterion.roles;
  // Untagged = applies to everyone. This is the shape of every criterion in
  // production today, which is why nothing below changes any existing answer.
  if (!Array.isArray(roles) || roles.length === 0) return true;
  return roles.some((r) => slugs.includes(r));
}

/**
 * Is this sheet role-split — does ANY criterion restrict itself to a role?
 *
 * The single most load-bearing predicate here. When it is false the sheet
 * behaves exactly as it did before role scoping existed: every criterion
 * applies to everyone, the denominator is the sheet's published total, and no
 * role needs to be known, chosen, or stored. All 13 production sheets are
 * false.
 */
export function isRoleSplitSheet(criteria: readonly RoleScopedCriterion[]): boolean {
  return criteria.some((c) => Array.isArray(c.roles) && c.roles.length > 0);
}

/** The criteria a student holding `slugs` is marked on. */
export function applicableCriteria<T extends RoleScopedCriterion>(
  criteria: readonly T[],
  slugs: readonly string[]
): T[] {
  return criteria.filter((c) => criterionAppliesTo(c, slugs));
}

/**
 * THE DENOMINATOR RULE.
 *
 * A student's maximum for a session is the sum of max_score over the criteria
 * that apply to THEM — not the sheet's published total_max.
 *
 * On an unsplit sheet every criterion applies, so this returns Σ max_score over
 * all criteria, which is precisely how yip.session_parameters.total_max is
 * computed (normaliseParameters in app/yip/actions/session-parameters.ts). The
 * two are therefore equal by construction on every existing sheet, whatever
 * `slugs` is — including the empty set.
 */
export function applicableMax(
  criteria: readonly RoleScopedCriterion[],
  slugs: readonly string[]
): number {
  let sum = 0;
  for (const c of criteria) {
    if (!criterionAppliesTo(c, slugs)) continue;
    const n = Number(c.max_score);
    if (Number.isFinite(n)) sum += n;
  }
  return sum;
}

/**
 * THE DENOMINATOR THE RESULTS ENGINE DIVIDES BY, for one stored mark.
 *
 * Three cases, and the third is the one that bites:
 *
 *   1. UNSPLIT sheet -> the sheet's published total. Every criterion applied to
 *      everyone. This is every session in production today.
 *   2. SPLIT sheet, mark carries a role -> that role's own subset. The whole
 *      point: a presenter marked out of 10 is divided by 10, not by the 16 the
 *      sheet publishes.
 *   3. SPLIT sheet, mark carries NO role -> the published total, NOT the
 *      untagged subset. A role-less mark on a split sheet means the mark was
 *      taken BEFORE the sheet was split (results are recomputed on demand, so a
 *      sheet edited today re-scores rounds that finished months ago — the trap
 *      #957 was written about). That juror marked against the WHOLE list, so
 *      the whole list is their denominator. Falling through to applicableMax()
 *      here would divide a 16-scale mark by the 4 points of untagged criteria
 *      and report 400%.
 *
 * `publishedTotal` is yip.session_parameters.total_max, i.e. Σ max_score over
 * every criterion as stored when the sheet was saved.
 */
export function denominatorFor(
  criteria: readonly RoleScopedCriterion[],
  slugs: readonly string[],
  publishedTotal: number
): number {
  const published = Number.isFinite(publishedTotal) && publishedTotal > 0 ? publishedTotal : 0;
  if (!isRoleSplitSheet(criteria)) return published;
  if (slugs.length === 0) return published;
  return applicableMax(criteria, slugs);
}

/** Every distinct role slug this sheet restricts a criterion to. */
export function sheetRoleSlugs(criteria: readonly RoleScopedCriterion[]): string[] {
  const seen = new Set<string>();
  for (const c of criteria) {
    if (!Array.isArray(c.roles)) continue;
    for (const r of c.roles) if (typeof r === "string" && r) seen.add(r);
  }
  return Array.from(seen);
}

// ─── Resolution, including the fail-visible case ──────────────────

export type RoleResolution = {
  /** The slugs to mark and score this student against. */
  slugs: string[];
  /** How they were arrived at. */
  source: ScoredRoleSource;
  /**
   * True when the sheet splits by role but this student matches NO restricted
   * criterion, so we cannot tell which side they are on. The judge MUST choose.
   * Never guess — a guessed side silently changes the denominator.
   */
  needsChoice: boolean;
  /** The choices to offer when needsChoice — the slugs this sheet actually uses. */
  choices: { slug: string; label: string }[];
};

/**
 * Work out which role a student is being marked in, for one session sheet.
 *
 * FAIL VISIBLE, never fail quiet. When the sheet is split and the derived role
 * matches none of its restricted criteria, this returns needsChoice=true rather
 * than defaulting to a side. Defaulting would hand the student only the
 * criteria common to both sides, quietly shrinking their denominator and
 * inflating their percentage — the exact class of silent mis-scoring #955 was
 * about.
 *
 * `override` is a slug the judge picked on the scoring screen. It is ADDED to
 * the derived slugs rather than replacing them, so choosing "Opposition bench"
 * for an MP still matches any criterion tagged 'mp'.
 */
export function resolveRoleForSheet(
  participant: RoleBearingParticipant,
  criteria: readonly RoleScopedCriterion[],
  override?: string | null
): RoleResolution {
  const derived = deriveRoleSlugs(participant);
  const chosen = typeof override === "string" && override.trim() ? override.trim() : null;
  const slugs = chosen && !derived.includes(chosen) ? [...derived, chosen] : derived;
  const source: ScoredRoleSource = chosen ? "override" : "auto";

  // Unsplit sheet: nothing to decide, and the answer is identical to the
  // pre-role behaviour whatever the student's role is.
  if (!isRoleSplitSheet(criteria)) {
    return { slugs, source, needsChoice: false, choices: [] };
  }

  const matchesARestrictedCriterion = criteria.some(
    (c) =>
      Array.isArray(c.roles) &&
      c.roles.length > 0 &&
      c.roles.some((r) => slugs.includes(r))
  );

  return {
    slugs,
    source,
    needsChoice: !matchesARestrictedCriterion,
    choices: sheetRoleSlugs(criteria).map((slug) => ({
      slug,
      label: roleSlugLabel(slug),
    })),
  };
}

/**
 * The slugs a stored score was marked under.
 *
 * NULL / empty on the row means the score predates role scoping (every one of
 * the 5,557 submitted scores in production today) OR was taken on an unsplit
 * sheet. Both mean the same thing to the engine: no role restriction was in
 * force, so every criterion applied. Returning [] makes applicableMax() fall
 * through to Σ over all criteria — the sheet's total_max — which is the old
 * denominator exactly.
 */
export function storedRoleSlugs(raw: unknown): string[] {
  return normaliseRoleSlugs(raw) ?? [];
}
