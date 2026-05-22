// ─── Rubric helpers (shared by server + client) ───────────────────
// Lives in src/lib so it can be imported from both "use server" action files
// and "use client" components. No async exports here.
//
// The MP rubric (handbook p.20) has 17 sub-criteria nested inside 5 parent
// criteria. Speaker / Deputy Speaker rubrics are flat. This module papers
// over both shapes with one set of helpers.

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
 */
export function validateScoresAgainstRubric(
  criteria: RubricCriterionShape[],
  scores: Record<string, unknown>
): string | null {
  for (const parent of criteria) {
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

/** Count scorable slots — sub-criteria when present, otherwise the parent. */
export function scorableSlotCount(criteria: RubricCriterionShape[]): number {
  return criteria.reduce(
    (n, c) => n + (hasSubCriteria(c) ? c.sub_criteria.length : 1),
    0
  );
}
