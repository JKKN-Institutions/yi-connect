/**
 * Rubric helpers — score computation, aggregation, threshold checks.
 * Handbook ref: [HPB §4 Day 2 B — 5 criteria × 20 = 100]
 */

export interface RubricCriterion {
  key: string;
  label: string;
  max: number;
  description?: string;
}

export interface Rubric {
  name: string;
  criteria: RubricCriterion[];
  total_max: number;
  threshold_for_national?: number;
}

export type CriteriaScores = Record<string, number>;

/**
 * Sum criteria scores into a total. Validates each score against max.
 */
export function computeTotal(
  scores: CriteriaScores,
  rubric: Rubric
): number {
  let total = 0;
  for (const c of rubric.criteria) {
    const v = scores[c.key] ?? 0;
    if (v < 0 || v > c.max) {
      throw new Error(
        `Invalid score for ${c.key}: ${v} (expected 0..${c.max})`
      );
    }
    total += v;
  }
  return Number(total.toFixed(2));
}

/**
 * Average multiple jurors' scores for the same team.
 * Returns per-criterion average + total.
 */
export function aggregateEvaluations(
  evaluations: { criteria_scores: CriteriaScores; total_score: number }[]
): { averageCriteria: CriteriaScores; averageTotal: number; count: number } {
  if (evaluations.length === 0) {
    return { averageCriteria: {}, averageTotal: 0, count: 0 };
  }

  const sum: CriteriaScores = {};
  let totalSum = 0;

  for (const e of evaluations) {
    for (const [k, v] of Object.entries(e.criteria_scores)) {
      sum[k] = (sum[k] ?? 0) + v;
    }
    totalSum += e.total_score;
  }

  const averageCriteria: CriteriaScores = {};
  for (const [k, v] of Object.entries(sum)) {
    averageCriteria[k] = Number((v / evaluations.length).toFixed(2));
  }

  return {
    averageCriteria,
    averageTotal: Number((totalSum / evaluations.length).toFixed(2)),
    count: evaluations.length,
  };
}

/**
 * Does this team's average total clear the national threshold?
 */
export function meetsThreshold(average: number, rubric: Rubric): boolean {
  const thr = rubric.threshold_for_national ?? 0;
  return average >= thr;
}

/**
 * Rank teams by total score descending, with tie handling.
 * Returns ordered list with assigned rank (ties share rank).
 */
export function rankTeams<T extends { team_id: string; total: number }>(
  teams: T[]
): (T & { rank: number })[] {
  const sorted = [...teams].sort((a, b) => b.total - a.total);
  const ranked: (T & { rank: number })[] = [];
  let currentRank = 1;
  let prevTotal: number | null = null;
  sorted.forEach((t, idx) => {
    if (prevTotal !== null && t.total < prevTotal) {
      currentRank = idx + 1;
    }
    ranked.push({ ...t, rank: currentRank });
    prevTotal = t.total;
  });
  return ranked;
}
