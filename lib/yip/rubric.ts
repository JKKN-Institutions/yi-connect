// ─── Rubric helpers (shared by server + client) ───────────────────
// Lives in src/lib so it can be imported from both "use server" action files
// and "use client" components. No async exports here.
//
// The MP rubric (handbook p.20) has 17 sub-criteria nested inside 5 parent
// criteria. Speaker / Deputy Speaker rubrics are flat. This module papers
// over both shapes with one set of helpers.

import { criterionAppliesTo } from "@/lib/yip/scoring-roles";
import { pickByLevel, type RoundLevel } from "@/lib/yip/round-level";

export interface SubCriterion {
  key: string; // dotted, e.g. "content.relevance"
  label: string;
  max_score: number;
}

export interface RubricCriterionShape {
  key: string;
  label: string;
  max_score: number;
  description?: string | null;
  sub_criteria?: SubCriterion[] | null;
  /**
   * Parliament role slugs (ROLE_LABELS keys) this criterion applies to.
   * Absent / null / empty = applies to everyone (the legacy shape).
   */
  roles?: string[] | null;
}

/**
 * Filter a rubric down to the criteria that apply to one participant's role.
 * A criterion with no `roles` restriction applies to everyone; an unknown or
 * null role sees ONLY the unrestricted criteria (fail closed — a restricted
 * criterion is never shown to a role it wasn't scoped to).
 *
 * A participant may hold SEVERAL role slugs at once — their parliament_role and
 * the bench they sit on (see lib/yip/scoring-roles.ts) — so this accepts either
 * one slug or a list, and matches if ANY of them is named. Passing a single
 * slug is the original signature and returns the original answer: with one slug
 * `slugs.includes(r)` over `[slug]` is `r === slug`. The match itself is
 * delegated to criterionAppliesTo() so there is exactly ONE implementation of
 * "does this criterion apply", shared with the jury screen, the submit
 * validator and the results engine.
 */
export function criteriaForRole<T extends { roles?: string[] | null }>(
  criteria: T[],
  roleSlug: string | readonly string[] | null | undefined
): T[] {
  const slugs =
    roleSlug == null ? [] : typeof roleSlug === "string" ? [roleSlug] : roleSlug;
  return criteria.filter((c) =>
    criterionAppliesTo({ key: "", label: "", max_score: 0, roles: c.roles }, slugs)
  );
}

// ─── Round-level resolution ───────────────────────────────────────
//
// A role rubric is the fallback sheet a juror marks against when the session
// itself has no configured criteria. Until 2026-08 there was exactly ONE rubric
// per role, shared by chapter, regional and national rounds, so a regional round
// could not be marked out of a different total without editing the shared row —
// which silently re-scores rounds that already finished, because results are
// recomputed on demand. yip.rubrics.levels closes that, following the four-step
// recipe at the top of lib/yip/round-level.ts.

/** The subset of a yip.rubrics row needed to resolve a match. */
export type RubricLike = {
  target_role: string;
  is_default?: boolean | null;
  is_active?: boolean | null;
  /**
   * Round levels this rubric applies to (yip.rubrics.levels).
   * NULL / undefined / empty = every level, which is how all three production
   * rubrics behave today. Optional so callers that do not read the column keep
   * the old, global behaviour unchanged.
   */
  levels?: readonly string[] | null;
};

/**
 * Resolve the role rubric for one event's round level.
 *
 * The rule, in order:
 *   1. Only rubrics for this `targetRole` are candidates.
 *   2. A rubric scoped to THIS level beats the shared one, and a rubric scoped
 *      to a DIFFERENT level is never returned (fail closed).
 *   3. Within the scoped tier, only ACTIVE rubrics resolve. The database allows
 *      at most one active rubric per (role, scope), so no tie-breaker is needed;
 *      `id` order is applied anyway so the answer is deterministic even against
 *      data written before that index existed.
 *   4. The global tier is EXACTLY the pre-existing rule, deliberately unchanged:
 *      the one row flagged `is_default`, with no is_active filter, and nothing
 *      when zero or several match. That mirrors
 *      `app/yip/actions/scoring.ts#getRubricForRole`, whose
 *      `.eq(is_default,true).single()` also returns nothing when the row count
 *      is not exactly one. Tightening it to require is_active would be a
 *      behaviour change and belongs to whoever owns that file.
 *
 * Passing `level` as null or omitting it is FAIL CLOSED: only global rubrics are
 * considered, which is precisely how every rubric behaved before the column
 * existed. That is why adding this argument changes nothing until a super-admin
 * scopes a rubric to a level.
 *
 * Returns null when nothing resolves — same as today's "no rubric found".
 */
export function resolveRubricForLevel<T extends RubricLike>(
  rubrics: readonly T[],
  targetRole: string,
  level?: RoundLevel | null
): T | null {
  const forRole = rubrics.filter((r) => r.target_role === targetRole);
  const { scoped, global } = pickByLevel(forRole, level);

  const activeScoped = scoped.filter((r) => r.is_active !== false);
  if (activeScoped.length > 0) {
    return activeScoped.reduce((best, r) =>
      rubricSortKey(r) < rubricSortKey(best) ? r : best
    );
  }

  const defaults = global.filter((r) => r.is_default === true);
  return defaults.length === 1 ? defaults[0] : null;
}

/** Stable ordering handle — `id` when present, otherwise the role. */
function rubricSortKey(r: RubricLike): string {
  return (r as { id?: unknown }).id === undefined
    ? r.target_role
    : String((r as { id?: unknown }).id);
}

/** Does this criterion expose sub-criteria? */
export function hasSubCriteria(
  c: RubricCriterionShape
): c is RubricCriterionShape & { sub_criteria: SubCriterion[] } {
  return Array.isArray(c.sub_criteria) && c.sub_criteria.length > 0;
}

/**
 * Sum the score for one parent criterion given the flat criteria_scores map.
 * If the parent has sub_criteria, sum its children.
 * Otherwise fall back to the flat value at the parent key (legacy shape).
 */
export function parentScore(
  breakdown: Record<string, number> | null | undefined,
  parent: RubricCriterionShape
): number {
  if (!breakdown) return 0;
  if (hasSubCriteria(parent)) {
    return parent.sub_criteria.reduce(
      (sum, sc) => sum + (Number(breakdown[sc.key]) || 0),
      0
    );
  }
  return Number(breakdown[parent.key]) || 0;
}

/**
 * Sum by parent key only — used when the rubric isn't handy but we know
 * the parent family. Matches any dotted child key AND the flat parent key.
 */
export function parentScoreByKey(
  breakdown: Record<string, number> | null | undefined,
  parentKey: string
): number {
  if (!breakdown) return 0;
  let total = 0;
  const prefix = `${parentKey}.`;
  for (const [k, v] of Object.entries(breakdown)) {
    if (k === parentKey || k.startsWith(prefix)) {
      total += Number(v) || 0;
    }
  }
  return total;
}

/**
 * Compute total from a criteria_scores map given the rubric's shape.
 * Handles flat + nested seamlessly.
 */
export function computeTotal(
  criteria: RubricCriterionShape[],
  scores: Record<string, number>
): number {
  return criteria.reduce((sum, c) => sum + parentScore(scores, c), 0);
}

/**
 * Validate that a criteria_scores map conforms to a rubric shape:
 *   - every value is a non-negative integer ≤ its declared max
 *   - no key exceeds the max of its declared slot
 * Accepts both flat and nested shapes. Returns an error message or null.
 * When `roleSlug` is provided (a string OR null), only the criteria that apply
 * to that role are validated (see criteriaForRole); omit it to keep the legacy
 * validate-everything behaviour.
 */
export function validateScoresAgainstRubric(
  criteria: RubricCriterionShape[],
  scores: Record<string, unknown>,
  roleSlug?: string | readonly string[] | null
): string | null {
  const applicable =
    roleSlug === undefined ? criteria : criteriaForRole(criteria, roleSlug);
  for (const parent of applicable) {
    if (hasSubCriteria(parent)) {
      for (const sc of parent.sub_criteria) {
        const raw = scores[sc.key];
        if (raw === undefined || raw === null) continue; // missing keys default to 0
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          return `Score for "${sc.label}" must be a non-negative number`;
        }
        if (n > sc.max_score) {
          return `Score for "${sc.label}" (${n}) exceeds max ${sc.max_score}`;
        }
      }
    } else {
      const raw = scores[parent.key];
      if (raw === undefined || raw === null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return `Score for "${parent.label}" must be a non-negative number`;
      }
      if (n > parent.max_score) {
        return `Score for "${parent.label}" (${n}) exceeds max ${parent.max_score}`;
      }
    }
  }
  return null;
}

/** Flatten a rubric's sub-criteria into a single ordered list (for display). */
export function allSubCriteria(criteria: RubricCriterionShape[]): SubCriterion[] {
  const out: SubCriterion[] = [];
  for (const c of criteria) {
    if (hasSubCriteria(c)) {
      for (const sc of c.sub_criteria) out.push(sc);
    }
  }
  return out;
}

/**
 * Count scorable slots — sub-criteria when present, otherwise the parent.
 * When `roleSlug` is provided (a string OR null), only the criteria that apply
 * to that role are counted; omit it to count everything (legacy behaviour).
 */
export function scorableSlotCount(
  criteria: RubricCriterionShape[],
  roleSlug?: string | readonly string[] | null
): number {
  const applicable =
    roleSlug === undefined ? criteria : criteriaForRole(criteria, roleSlug);
  return applicable.reduce(
    (n, c) => n + (hasSubCriteria(c) ? c.sub_criteria.length : 1),
    0
  );
}
