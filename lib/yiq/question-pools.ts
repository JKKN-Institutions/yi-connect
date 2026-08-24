/**
 * Which questions may a given paper draw from?
 *
 * Pure functions, no I/O. The data half of this rule is
 * `yiq.questions.pool` (see supabase/migrations/yiq_04_question_bank.sql);
 * this file is the decision half.
 *
 * THE RULE, and why it exists
 * ---------------------------
 * Before the pool column, the MOCK paper and the REAL online-round paper
 * were built from the same 33 questions, so a student who practised had
 * already sat the real paper. In a national competition that is fatal: it
 * hands an advantage to whoever practised most, not to whoever knows most.
 *
 *   mock paper        -> practice + either
 *   scored paper      -> competition + either      (NEVER practice)
 *
 * `either` is the shared middle: a question nobody has been shown, safe in
 * both. `practice` is for questions that are already public — the 33 from
 * the Director's deck — where being known does no harm.
 *
 * FAIL CLOSED. An unknown paper kind, an unknown pool value, or a missing
 * `pool` field yields NO eligible pools rather than a permissive default.
 * A paper that then cannot be built is a loud, visible failure; a paper
 * quietly built from practice questions is a silent, invisible one.
 */

export type QuestionPool = "practice" | "competition" | "either";

export const QUESTION_POOLS: readonly QuestionPool[] = [
  "practice",
  "competition",
  "either",
] as const;

/** Mirrors the `paper_kind` check constraint on yiq.papers. */
export type PaperKind = "mock" | "online_round" | "national_semifinal";

export const PAPER_KINDS: readonly PaperKind[] = [
  "mock",
  "online_round",
  "national_semifinal",
] as const;

/**
 * Paper kinds whose score decides who advances. Everything that is not a
 * mock is scored — stated this way round so that a paper kind added later
 * is treated as scored (the safe assumption) the moment it is added to
 * PAPER_KINDS.
 */
const SCORED_KINDS: readonly PaperKind[] = PAPER_KINDS.filter((k) => k !== "mock");

const ELIGIBLE: Record<PaperKind, readonly QuestionPool[]> = {
  mock: ["practice", "either"],
  online_round: ["competition", "either"],
  national_semifinal: ["competition", "either"],
};

export function isPaperKind(value: unknown): value is PaperKind {
  return typeof value === "string" && (PAPER_KINDS as readonly string[]).includes(value);
}

export function isQuestionPool(value: unknown): value is QuestionPool {
  return typeof value === "string" && (QUESTION_POOLS as readonly string[]).includes(value);
}

/** True for a paper whose result counts. Unknown kinds are treated as scored. */
export function isScoredPaper(kind: unknown): boolean {
  if (!isPaperKind(kind)) return true;
  return (SCORED_KINDS as readonly string[]).includes(kind);
}

/**
 * The pools a paper of this kind may draw from.
 * Returns an EMPTY array for an unknown kind — callers must treat that as
 * "build nothing", never as "build from everything".
 */
export function eligiblePools(kind: unknown): QuestionPool[] {
  if (!isPaperKind(kind)) return [];
  return [...ELIGIBLE[kind]];
}

/** May a paper of this kind use a question sitting in this pool? */
export function isPoolEligible(kind: unknown, pool: unknown): boolean {
  if (!isQuestionPool(pool)) return false;
  return eligiblePools(kind).includes(pool);
}

/**
 * Guard for a paper build. Returns `null` when the draw is safe, or a
 * human-readable error string explaining what would leak.
 *
 * Every non-safe case returns an error, not just the leak: an unknown kind,
 * an unrecognised pool value and an empty pool list are all refusals.
 */
export function assertPoolSafe(kind: unknown, pools: readonly unknown[]): string | null {
  if (!isPaperKind(kind)) {
    return `Unknown paper kind "${String(kind)}" — refusing to choose questions for it.`;
  }
  if (pools.length === 0) {
    return `No question pool was given for the ${kind} paper.`;
  }

  const unknown = pools.filter((p) => !isQuestionPool(p));
  if (unknown.length > 0) {
    return `Unrecognised question pool ${unknown
      .map((p) => `"${String(p)}"`)
      .join(", ")} — refusing to build the ${kind} paper.`;
  }

  const allowed = eligiblePools(kind);
  const offending = (pools as QuestionPool[]).filter((p) => !allowed.includes(p));
  if (offending.length === 0) return null;

  if (isScoredPaper(kind) && offending.includes("practice")) {
    return `A ${kind} paper must not draw from the practice pool — students have already seen those questions. Allowed pools: ${allowed.join(", ")}.`;
  }
  return `A ${kind} paper may not draw from ${offending.join(", ")}. Allowed pools: ${allowed.join(", ")}.`;
}

/**
 * Keep only the rows a paper of this kind may use.
 * A row whose `pool` is missing or unrecognised is DROPPED, so a query that
 * forgot to select the column starves the build instead of leaking.
 */
export function filterEligible<T extends { pool?: unknown }>(
  kind: unknown,
  rows: readonly T[]
): T[] {
  const allowed = eligiblePools(kind);
  if (allowed.length === 0) return [];
  return rows.filter((r) => isQuestionPool(r.pool) && allowed.includes(r.pool));
}

export const POOL_LABELS: Record<QuestionPool, string> = {
  practice: "Practice only",
  competition: "Competition only",
  either: "Practice or competition",
};
