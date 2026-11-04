/**
 * Stage 2 final-ranking rules, shared by the NMT leader's form and the
 * server action so both refuse exactly the same rankings. Pure, no imports:
 * safe on the client, the server and in a plain node script.
 */

/** Final ranks 1..5 always need a reason (Piyush's Stage 2 sketch, 30 Oct 2026). */
export const REASON_ALWAYS_UP_TO = 5;

/**
 * Did the final rank move from the matrix rank? Chapters tied in the matrix
 * may take any place in their tie band [matrixRank, matrixRank + tieSize - 1]
 * without counting as a move, so ordering a tie needs no reason.
 */
export function rankMoved(finalRank: number, matrixRank: number, tieSize: number): boolean {
  return finalRank < matrixRank || finalRank > matrixRank + Math.max(1, tieSize) - 1;
}

/** A reason is required for final ranks 1-5, and wherever the rank moved. */
export function reasonRequired(finalRank: number, matrixRank: number, tieSize: number): boolean {
  return finalRank <= REASON_ALWAYS_UP_TO || rankMoved(finalRank, matrixRank, tieSize);
}

export type RankingRuleRow = {
  name: string;
  finalRank: number | null;
  reason: string;
  matrixRank: number;
  tieSize: number;
};

/**
 * The first problem with one category's final ranking, or null. `tab` is the
 * category label; every message starts with it. Checks, in order: every
 * chapter has a rank; no rank is used twice (naming the chapters); a reason
 * wherever reasonRequired says so (by final rank).
 */
export function categoryRankingProblem(tab: string, rows: RankingRuleRow[]): string | null {
  const blank = rows.find((r) => r.finalRank === null);
  if (blank) return `${tab}: choose a final rank for ${blank.name}.`;
  const byRank = new Map<number, string[]>();
  for (const r of rows) byRank.set(r.finalRank!, [...(byRank.get(r.finalRank!) ?? []), r.name]);
  for (const [rank, names] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    if (names.length > 1) {
      return `${tab}: ${joinNames(names)} all have final rank ${rank}. Each rank can be used once.`;
    }
  }
  const sorted = [...rows].sort((a, b) => a.finalRank! - b.finalRank!);
  for (const r of sorted) {
    const k = r.finalRank!;
    if (r.reason.trim() !== "" || !reasonRequired(k, r.matrixRank, r.tieSize)) continue;
    if (rankMoved(k, r.matrixRank, r.tieSize)) {
      const from = r.tieSize > 1 ? `tied rank ${r.matrixRank}` : `rank ${r.matrixRank}`;
      return `${tab}: ${r.name} moves from ${from} to ${k}. Write the reason for the change.`;
    }
    return `${tab}: give a reason for ${r.name} (final rank ${k}).`;
  }
  return null;
}

function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A Stage 2 table column the leader can sort by. */
export type StandingSortKey = "partA" | "rm" | "nmt" | "total" | "rank";

export type SortableStanding = {
  chapterName: string;
  partAPoints: number;
  rmPoints: number;
  nmtPoints: number;
  total: number;
  matrixRank: number;
};

const SORT_VALUE: Record<StandingSortKey, (r: SortableStanding) => number> = {
  partA: (r) => r.partAPoints,
  rm: (r) => r.rmPoints,
  nmt: (r) => r.nmtPoints,
  total: (r) => r.total,
  rank: (r) => r.matrixRank,
};

/**
 * The Stage 2 table's order: scores descending, Rank ascending. Equal values
 * fall back to the matrix rank, then the chapter name, so the order is stable.
 */
export function sortStandings<T extends SortableStanding>(rows: T[], key: StandingSortKey): T[] {
  return [...rows].sort((a, b) => {
    const d = SORT_VALUE[key](b) - SORT_VALUE[key](a);
    return (key === "rank" ? -d : d) || a.matrixRank - b.matrixRank || a.chapterName.localeCompare(b.chapterName);
  });
}
