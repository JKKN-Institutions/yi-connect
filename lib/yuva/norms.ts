/**
 * Yi Youth Academy — usage-norm metrics (pure engine, zero I/O).
 * Spec: docs/yi-youth-academy-spec.md §"Pure engines" + §"Metrics derivations".
 *
 * Sessions ARE the engagements — one-off events do not exist for this
 * program, so all norms are computed entirely from COMPLETED run sessions.
 * National usage norm: ≥3 engagements/month (one each Entrepreneurship /
 * Innovation / Learning) AND ≥30 active days/year.
 */

import type { ProgramCategory } from "./constants";

// Norm thresholds (national usage norms, Director 2026-06-10)
export const NORM_MIN_ENGAGEMENTS_PER_MONTH = 3;
export const NORM_MIN_ACTIVE_DAYS_PER_YEAR = 30;
/** The monthly mix must include one each of these categories. */
export const NORM_REQUIRED_CATEGORIES: readonly ProgramCategory[] = [
  "entrepreneurship",
  "innovation",
  "learning",
];

/**
 * Plain row: a run session joined to its program's category
 * (run_sessions has no category column — the caller joins run → program).
 */
export interface NormSession {
  status: "scheduled" | "completed" | "cancelled";
  scheduled_at: string | null;
  category: ProgramCategory;
}

export type NormRag = "red" | "amber" | "green";

/** Completed sessions with a date, as [YYYY-MM-DD, category] pairs. */
function completedDatedSessions(
  sessions: NormSession[]
): Array<{ date: string; category: ProgramCategory }> {
  return sessions
    .filter((s) => s.status === "completed" && s.scheduled_at)
    .map((s) => ({
      date: (s.scheduled_at as string).slice(0, 10),
      category: s.category,
    }));
}

/**
 * Completed sessions grouped by month ("YYYY-MM") × category.
 * Scheduled/cancelled sessions and sessions without a date are skipped.
 */
export function engagementsByMonth(
  sessions: NormSession[]
): Record<string, Partial<Record<ProgramCategory, number>>> {
  const grouped: Record<string, Partial<Record<ProgramCategory, number>>> = {};
  for (const { date, category } of completedDatedSessions(sessions)) {
    const month = date.slice(0, 7);
    const bucket = (grouped[month] ??= {});
    bucket[category] = (bucket[category] ?? 0) + 1;
  }
  return grouped;
}

/** Distinct dates with at least one completed session in the given year. */
export function activeDaysYTD(
  sessions: NormSession[],
  year: number = new Date().getFullYear()
): number {
  const prefix = `${year}-`;
  const days = new Set(
    completedDatedSessions(sessions)
      .map((s) => s.date)
      .filter((date) => date.startsWith(prefix))
  );
  return days.size;
}

/**
 * RAG status for an academy against the usage norms, for a given month
 * ("YYYY-MM"; its year drives the active-days YTD check):
 * - monthly criterion: ≥3 completed sessions in the month INCLUDING one
 *   each of Entrepreneurship / Innovation / Learning
 * - yearly criterion: ≥30 distinct active days in the month's year
 * green = both met · amber = exactly one met · red = neither.
 */
export function normRag(sessions: NormSession[], month: string): NormRag {
  const year = Number(month.slice(0, 4));
  const monthBucket = engagementsByMonth(sessions)[month] ?? {};

  const monthTotal = Object.values(monthBucket).reduce(
    (sum, n) => sum + (n ?? 0),
    0
  );
  const hasRequiredMix = NORM_REQUIRED_CATEGORIES.every(
    (cat) => (monthBucket[cat] ?? 0) >= 1
  );
  const monthOk = monthTotal >= NORM_MIN_ENGAGEMENTS_PER_MONTH && hasRequiredMix;

  const daysOk = activeDaysYTD(sessions, year) >= NORM_MIN_ACTIVE_DAYS_PER_YEAR;

  if (monthOk && daysOk) return "green";
  if (monthOk || daysOk) return "amber";
  return "red";
}
