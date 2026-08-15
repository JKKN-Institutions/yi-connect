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
  is: (col: string, val: unknown) => Q<T>;
  lt: (col: string, val: unknown) => Q<T>;
  not: (col: string, op: string, val: unknown) => Q<T>;
  order: (col: string, opts?: { ascending?: boolean }) => Q<T>;
  limit: (n: number) => Q<T>;
  maybeSingle: () => Promise<{ data: T | null; error: PgErr }>;
  then: Promise<{ data: T[] | null; error: PgErr }>["then"];
};

function tbl<T>(sb: SB, name: string): Q<T> {
  return (sb as unknown as { from: (t: string) => Q<T> }).from(name);
}

/**
 * Hand in every paper whose 30 minutes are up.
 *
 * Before this, the ONLY auto-submit lived in the student's browser and fired
 * when the countdown hit zero WITH THE TAB STILL OPEN. A student who wrote
 * three answers and then closed the app — or whose phone died, or who simply
 * walked off — was never submitted. Scoring skips unsubmitted attempts and so
 * does the organiser's results view, so their work was invisible to everyone,
 * including them. On an event day that is the common case, not the rare one
 * (Director, 2026-08-15: "count them automatically").
 *
 * `submitted_at` is stamped with the attempt's own `expires_at`, NOT `now()`:
 * the paper ended when the clock ran out, not whenever this sweep happened to
 * run. That keeps the handed-in time honest even if the routine is late or was
 * down for an hour.
 *
 * Safe to run repeatedly — it only ever touches attempts that are still
 * unsubmitted and already past their deadline.
 */
export async function finaliseExpiredAttempts(limit = 500): Promise<number> {
  const sb = await createServiceClient();

  const { data: stale } = await tbl<{ id: string; expires_at: string }>(
    sb,
    "questionnaire_attempts"
  )
    .select("id, expires_at")
    .is("submitted_at", null)
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);

  let finalised = 0;
  for (const a of stale ?? []) {
    // Guarded on submitted_at still being null so a student who hits Submit at
    // the same moment wins, and their real submit time stands.
    const { error } = await tbl(sb, "questionnaire_attempts")
      .update({ submitted_at: a.expires_at, updated_at: new Date().toISOString() })
      .eq("id", a.id)
      .is("submitted_at", null);
    if (!error) finalised += 1;
  }
  return finalised;
}

export type ScoringWorkItem = {
  attemptId: string;
  eventId: string;
  post: string;
  answers: { position: number; question: string; answer: string }[];
};

/**
 * Claim the next batch of submitted-but-unscored attempts.
 *
 * Claiming flips them to `scoring` BEFORE returning, so two overlapping drains
 * cannot both score the same attempt and bill twice. An attempt stuck in
 * `scoring` (routine died mid-run) is recoverable — an organiser re-queues it
 * from the results table.
 *
 * The payload carries the student's answer text and nothing that identifies
 * them: no name, no access code, no participant id. The scorer does not need to
 * know whose paper it is, and these are minors.
 */
export async function claimScoringWork(limit = 25): Promise<ScoringWorkItem[]> {
  const sb = await createServiceClient();

  const { data: pending } = await tbl<{
    id: string;
    event_id: string;
    post_key: string;
  }>(sb, "questionnaire_attempts")
    .select("id, event_id, post_key")
    .eq("scoring_status", "pending")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: true })
    .limit(limit);

  const rows = pending ?? [];
  if (rows.length === 0) return [];

  const out: ScoringWorkItem[] = [];
  for (const r of rows) {
    const { error } = await tbl(sb, "questionnaire_attempts")
      .update({ scoring_status: "scoring", updated_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("scoring_status", "pending"); // no-op if another drain got there first
    if (error) continue;

    const { data: answers } = await tbl<{
      position: number;
      question_text: string;
      answer_text: string | null;
    }>(sb, "questionnaire_answers")
      .select("position, question_text, answer_text")
      .eq("attempt_id", r.id)
      .order("position", { ascending: true })
      .limit(100);

    out.push({
      attemptId: r.id,
      eventId: r.event_id,
      post: r.post_key,
      answers: (answers ?? []).map((a) => ({
        position: a.position,
        question: a.question_text,
        answer: a.answer_text ?? "",
      })),
    });
  }
  return out;
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
