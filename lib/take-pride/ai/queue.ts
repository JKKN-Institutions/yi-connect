import "server-only";

import { tpService } from "../supabase";
import {
  AI_DAILY_LIMIT,
  istDayStart,
  istHour,
  type AiAllowed,
  type AiKind,
  type AiOutput,
  type AiStatus,
} from "./schemas";

/*
 * The tp_ai_jobs queue. Callers MUST pass a gate first: a delegate's pass
 * token (resolved to a delegate id on the server) or the routine's
 * X-Cron-Secret. Every function here trusts the delegate id it is given.
 *
 * The app never calls an LLM. It queues, optionally pings the routine's
 * live trigger, and stores what the routine POSTs back.
 */

export const CLAIM_BATCH = 20;
export const STALE_MINUTES = 15;
/** Nightly radar: at most this many refreshes queued per drain. */
export const NIGHTLY_RADAR_CAP = 50;

export type AiJob = {
  id: string;
  kind: AiKind;
  delegate_id: string;
  input: Record<string, unknown>;
  allowed: AiAllowed | null;
  output: AiOutput | null;
  status: AiStatus;
  error: string | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
};

const JOB_COLS = "id, kind, delegate_id, input, allowed, output, status, error, created_at, claimed_at, completed_at";

export type EnqueueResult =
  | { ok: true; jobId: string; remaining: number }
  | { ok: false; error: string; reason: "limit" | "busy" | "error" };

/** How many jobs of this kind the delegate started today (IST). Radar counts on-demand only. */
async function usedToday(delegateId: string, kind: AiKind): Promise<number | null> {
  let q = tpService()
    .from("tp_ai_jobs")
    .select("id", { count: "exact", head: true })
    .eq("delegate_id", delegateId)
    .eq("kind", kind)
    .gte("created_at", istDayStart());
  if (kind === "radar") q = q.eq("input->>trigger", "request");
  const { count, error } = await q;
  return error ? null : count ?? 0;
}

export async function remainingToday(delegateId: string, kind: AiKind): Promise<number> {
  const used = await usedToday(delegateId, kind);
  return used === null ? 0 : Math.max(0, AI_DAILY_LIMIT[kind] - used);
}

const LIMIT_MESSAGE: Record<AiKind, string> = {
  summit_plan: `You can ask for ${AI_DAILY_LIMIT.summit_plan} plans a day. Try again tomorrow.`,
  profile_helper: `You can use the profile helper ${AI_DAILY_LIMIT.profile_helper} times a day. Try again tomorrow.`,
  ask: `You can ask ${AI_DAILY_LIMIT.ask} questions a day. Try again tomorrow, or ask at the help desk.`,
  radar: "Your radar can be refreshed once a day. It also refreshes overnight.",
  why_meet: "Already done today.",
};

/**
 * Queue one job. Counts every row of this kind today regardless of status
 * (a failed job still counts), so the limit cannot be laundered through
 * failures. Two taps at once can both pass the first count, so the count
 * is checked again after the insert and the extra row takes itself back.
 * `oneAtATime`: refuse while another job of this kind is still waiting.
 */
export async function enqueueJob(
  delegateId: string,
  kind: AiKind,
  input: Record<string, unknown>,
  opts: { oneAtATime?: boolean } = {}
): Promise<EnqueueResult> {
  const db = tpService();
  const limit = AI_DAILY_LIMIT[kind];
  const counted = kind !== "radar" || input.trigger === "request";

  if (opts.oneAtATime) {
    const { count, error } = await db
      .from("tp_ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("delegate_id", delegateId)
      .eq("kind", kind)
      .in("status", ["pending", "generating"]);
    if (error) return { ok: false, error: "Something went wrong. Please try again.", reason: "error" };
    if ((count ?? 0) > 0) return { ok: false, error: "Your last request is still being written. Give it a minute.", reason: "busy" };
  }

  if (counted) {
    const used = await usedToday(delegateId, kind);
    if (used === null) return { ok: false, error: "Something went wrong. Please try again.", reason: "error" };
    if (used >= limit) return { ok: false, error: LIMIT_MESSAGE[kind], reason: "limit" };
  }

  const { data, error } = await db
    .from("tp_ai_jobs")
    .insert({ kind, delegate_id: delegateId, input, status: "pending" })
    .select("id, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Something went wrong. Please try again.", reason: "error" };
  const row = data as { id: string; created_at: string };

  if (counted) {
    // Re-check by arrival: rows within the limit stay, any row past it is taken back.
    let q = db
      .from("tp_ai_jobs")
      .select("id")
      .eq("delegate_id", delegateId)
      .eq("kind", kind)
      .gte("created_at", istDayStart())
      .order("created_at")
      .order("id")
      .limit(limit);
    if (kind === "radar") q = q.eq("input->>trigger", "request");
    const { data: first } = await q;
    if (first && !(first as { id: string }[]).some((r) => r.id === row.id)) {
      await db.from("tp_ai_jobs").delete().eq("id", row.id);
      return { ok: false, error: LIMIT_MESSAGE[kind], reason: "limit" };
    }
  }

  const left = counted ? await remainingToday(delegateId, kind) : limit;
  return { ok: true, jobId: row.id, remaining: left };
}

/**
 * Fire-and-forget wake-up for the routine. Accelerator only: when unset or
 * failing, the scheduled run still drains the queue. 5 s timeout, errors
 * swallowed. Call it from next/server `after()` so it never slows a page.
 */
export async function pingLiveTrigger(): Promise<boolean> {
  const url = process.env.YIP_AI_LIVE_TRIGGER_URL;
  if (!url) return false;
  const token = process.env.YIP_AI_LIVE_TRIGGER_TOKEN;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ source: "take-pride" }),
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

/** Latest job of a kind for one delegate, or null. */
export async function latestJob(delegateId: string, kind: AiKind): Promise<AiJob | null> {
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .select(JOB_COLS)
    .eq("delegate_id", delegateId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as AiJob | null) ?? null;
}

/** Latest READY job of a kind for one delegate, or null. */
export async function latestReadyJob(delegateId: string, kind: AiKind): Promise<AiJob | null> {
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .select(JOB_COLS)
    .eq("delegate_id", delegateId)
    .eq("kind", kind)
    .eq("status", "ready")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as AiJob | null) ?? null;
}

export async function listJobs(delegateId: string, kind: AiKind, limit = 20): Promise<AiJob[]> {
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .select(JOB_COLS)
    .eq("delegate_id", delegateId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AiJob[];
}

/** One job owned by this delegate, or null. */
export async function getOwnJob(delegateId: string, jobId: string): Promise<AiJob | null> {
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .select(JOB_COLS)
    .eq("id", jobId)
    .eq("delegate_id", delegateId)
    .maybeSingle();
  if (error) return null;
  return (data as AiJob | null) ?? null;
}

// ---------------------------------------------------------------- routine ----

/** Jobs stuck in 'generating' longer than STALE_MINUTES go back to 'pending'. */
export async function resetStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .update({ status: "pending", claimed_at: null })
    .eq("status", "generating")
    .lt("claimed_at", cutoff)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

/**
 * Claim up to CLAIM_BATCH pending jobs, oldest first. The update is guarded
 * by status='pending', so two drains at once never hand out the same row:
 * only rows this call actually flipped come back.
 */
export async function claimJobs(): Promise<AiJob[]> {
  const db = tpService();
  const { data: ids, error } = await db
    .from("tp_ai_jobs")
    .select("id")
    .eq("status", "pending")
    .order("created_at")
    .limit(CLAIM_BATCH);
  if (error || !ids?.length) return [];
  const { data, error: uErr } = await db
    .from("tp_ai_jobs")
    .update({ status: "generating", claimed_at: new Date().toISOString() })
    .in(
      "id",
      (ids as { id: string }[]).map((r) => r.id)
    )
    .eq("status", "pending")
    .select(JOB_COLS);
  if (uErr) return [];
  return ((data ?? []) as AiJob[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Pin the ids the routine is shown for this job (validated against on POST). */
export async function pinAllowed(jobId: string, allowed: AiAllowed): Promise<boolean> {
  const { error } = await tpService().from("tp_ai_jobs").update({ allowed }).eq("id", jobId).eq("status", "generating");
  return !error;
}

export async function getJobForRoutine(jobId: string): Promise<AiJob | null> {
  const { data, error } = await tpService().from("tp_ai_jobs").select(JOB_COLS).eq("id", jobId).maybeSingle();
  if (error) return null;
  return (data as AiJob | null) ?? null;
}

/** generating -> ready. Returns false when the job was not (still) claimed. */
export async function completeJob(jobId: string, output: AiOutput): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .update({ status: "ready", output, error: null, completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}

/** generating -> failed, with a short reason. */
export async function failJob(jobId: string, reason: string): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_ai_jobs")
    .update({ status: "failed", error: reason.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}

/**
 * Nightly radar (India night, 00:00-05:59 IST): refresh the radar of
 * delegates who have used it before and whose last radar is over 20 hours
 * old. Delegates who never opened the radar are not fanned out to. Capped
 * per drain; the next run picks up the rest. Best effort.
 */
export async function queueNightlyRadar(now: Date = new Date()): Promise<number> {
  if (istHour(now) >= 6) return 0;
  const db = tpService();
  const { data, error } = await db
    .from("tp_ai_jobs")
    .select("delegate_id, created_at")
    .eq("kind", "radar")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error || !data) return 0;
  const latest = new Map<string, string>();
  for (const r of data as { delegate_id: string; created_at: string }[]) {
    if (!latest.has(r.delegate_id)) latest.set(r.delegate_id, r.created_at);
  }
  const cutoff = new Date(now.getTime() - 20 * 3600 * 1000).toISOString();
  const due = [...latest.entries()].filter(([, at]) => at < cutoff).map(([id]) => id).slice(0, NIGHTLY_RADAR_CAP);
  if (!due.length) return 0;
  const { error: iErr } = await db
    .from("tp_ai_jobs")
    .insert(due.map((delegate_id) => ({ kind: "radar", delegate_id, input: { trigger: "nightly" }, status: "pending" })));
  return iErr ? 0 : due.length;
}
