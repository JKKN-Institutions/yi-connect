/**
 * Applying scores to a questionnaire attempt.
 *
 * ─── WHY THIS IS A LIB AND NOT A SERVER ACTION ─────────────────────────────
 * In a `"use server"` file every exported async function is a callable HTTP
 * endpoint. These functions write scores and flip an attempt to "scored" — with
 * no session to gate on, because the caller is the external scoring routine
 * authenticated by a shared secret at the route boundary, not a logged-in user.
 * Exported from an actions file they would let anyone mark any attempt scored,
 * or overwrite a candidate's marks. Living here they are reachable only from
 * the route handler that has already checked X-Cron-Secret.
 *
 * (Same trap as findOrCreatePerson, which sat ungated in app/yip/actions/people.ts
 * until 2026-08-15.)
 */

import "server-only";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { answerScore, attemptTotals, RED_FLAGS } from "@/lib/yip/questionnaire";

type PgErr = { message: string } | null;
type SB = Awaited<ReturnType<typeof createServiceClient>>;

type Q<T> = {
  select: (cols: string) => Q<T>;
  update: (patch: Record<string, unknown>) => Q<T>;
  eq: (col: string, val: unknown) => Q<T>;
  in: (col: string, vals: readonly unknown[]) => Q<T>;
  not: (col: string, op: string, val: unknown) => Q<T>;
  order: (col: string, opts?: { ascending?: boolean }) => Q<T>;
  limit: (n: number) => Q<T>;
  maybeSingle: () => Promise<{ data: T | null; error: PgErr }>;
  then: Promise<{ data: T[] | null; error: PgErr }>["then"];
};

function tbl<T>(sb: SB, name: string): Q<T> {
  return (sb as unknown as { from: (t: string) => Q<T> }).from(name);
}

export type ScoredAnswerInput = {
  position: number;
  grounding: number;
  depth: number;
  voice: number;
  /** POSITIVE 0-3. Subtracted at aggregation — see lib/yip/questionnaire.ts. */
  redFlagPenalty: number;
  flags: string[];
};

function clean(v: unknown, lo: number, hi: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(hi, Math.max(lo, n));
}

/** Only flags the rubric actually defines survive — the model cannot invent new ones. */
function cleanFlags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const allowed = new Set<string>(RED_FLAGS);
  return v.filter((f): f is string => typeof f === "string" && allowed.has(f));
}

/**
 * Write one attempt's per-answer scores and recompute its totals.
 *
 * Everything is clamped to the rubric's own ranges on the way in: the scoring
 * routine is an external caller and its output is not trusted to be in range,
 * and the DB CHECK constraints would otherwise reject the whole batch on one
 * bad number.
 */
export async function applyAttemptScores(
  attemptId: string,
  answers: readonly ScoredAnswerInput[]
): Promise<{ ok: true; total: number; max: number; pct: number } | { ok: false; error: string }> {
  const sb = await createServiceClient();
  const now = new Date().toISOString();

  for (const a of answers) {
    const grounding = clean(a.grounding, 0, 3);
    const depth = clean(a.depth, 0, 4);
    const voice = clean(a.voice, 0, 3);
    const flags = cleanFlags(a.flags);
    // The rubric only deducts when TWO OR MORE flags apply. Enforced here rather
    // than trusted from the caller, so a model that reports one flag and a
    // penalty cannot quietly cost a student three marks.
    const penalty = flags.length >= 2 ? clean(a.redFlagPenalty, 0, 3) : 0;

    const { error } = await tbl(sb, "questionnaire_answers")
      .update({
        grounding,
        depth,
        voice,
        red_flag_penalty: penalty,
        flags,
        score: answerScore({ grounding, depth, voice, redFlagPenalty: penalty }),
        scored_at: now,
        updated_at: now,
      })
      .eq("attempt_id", attemptId)
      .eq("position", a.position);
    if (error) return { ok: false, error: error.message };
  }

  return recomputeAttemptTotals(attemptId);
}

/** Roll per-answer scores up to the attempt and mark it scored. */
export async function recomputeAttemptTotals(
  attemptId: string
): Promise<{ ok: true; total: number; max: number; pct: number } | { ok: false; error: string }> {
  const sb = await createServiceClient();
  const { data: rows } = await tbl<{ score: number | null }>(sb, "questionnaire_answers")
    .select("score")
    .eq("attempt_id", attemptId)
    .limit(100);

  const totals = attemptTotals((rows ?? []).map((r) => r.score ?? 0));
  const now = new Date().toISOString();
  const { error } = await tbl(sb, "questionnaire_attempts")
    .update({
      total_score: totals.total,
      max_score: totals.max,
      pct: totals.pct,
      scoring_status: "scored",
      scored_at: now,
      updated_at: now,
    })
    .eq("id", attemptId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...totals };
}

/** Record a failure without losing the answers — an organiser can re-queue it. */
export async function markAttemptScoringFailed(
  attemptId: string,
  reason: string
): Promise<void> {
  const sb = await createServiceClient();
  await tbl(sb, "questionnaire_attempts")
    .update({
      scoring_status: "failed",
      score_error: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId);
}
