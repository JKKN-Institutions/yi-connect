import "server-only";

import { tpService } from "../supabase";
import { istDayStart } from "../ai/schemas";
import {
  PARTNER_AI_DAILY_LIMIT,
  type PartnerAiAllowed,
  type PartnerAiKind,
  type PartnerAiOutput,
  type PartnerAiStatus,
} from "./schemas";

/*
 * The tp_partner_ai_jobs queue (partner briefs, lead follow-ups, sales
 * chasers). Callers MUST pass a gate first: a Catalyst Partner's link token
 * (resolved to a partner id on the server, confirmed + not cancelled), an
 * organiser via requireTpDesk(), or the routine's X-Cron-Secret. Every
 * function here trusts the ids it is given.
 *
 * Every READ helper returns null / [] on a database error instead of
 * throwing, so a page never breaks because this queue is unavailable
 * (for example before its migration is applied): the AI parts just hide.
 */

const TABLE = "tp_partner_ai_jobs";
export const CLAIM_BATCH = 20;
export const STALE_MINUTES = 15;

export type PartnerAiJob = {
  id: string;
  kind: PartnerAiKind;
  partner_id: string;
  subject_delegate_id: string | null;
  input: Record<string, unknown>;
  allowed: PartnerAiAllowed | null;
  output: PartnerAiOutput | null;
  status: PartnerAiStatus;
  error: string | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
};

const JOB_COLS =
  "id, kind, partner_id, subject_delegate_id, input, allowed, output, status, error, created_at, claimed_at, completed_at";

/**
 * Statuses that mean "this already exists, do not queue another".
 * Briefs and follow-ups: one per person unless the last one failed.
 * Sales chasers: one at a time per applicant; a new one after it is ready.
 */
const BLOCKING: Record<PartnerAiKind, PartnerAiStatus[]> = {
  partner_brief: ["pending", "generating", "ready"],
  lead_followup: ["pending", "generating", "ready"],
  sales_chaser: ["pending", "generating"],
};

const LIMIT_MESSAGE: Record<PartnerAiKind, string> = {
  partner_brief: `You can prepare ${PARTNER_AI_DAILY_LIMIT.partner_brief} meeting briefs a day. Try again tomorrow.`,
  lead_followup: `You can draft ${PARTNER_AI_DAILY_LIMIT.lead_followup} follow-ups a day. The rest can be drafted tomorrow.`,
  sales_chaser: `Up to ${PARTNER_AI_DAILY_LIMIT.sales_chaser} chasers a day for one applicant. Try again tomorrow.`,
};
const BUSY_MESSAGE: Record<PartnerAiKind, string> = {
  partner_brief: "A brief for this person is already prepared or on its way.",
  lead_followup: "A follow-up for this person is already drafted or on its way.",
  sales_chaser: "A chaser for this applicant is already being written. Give it a minute.",
};
const ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Jobs of this kind started today (IST) for this partner, or null when unreadable. */
async function usedToday(partnerId: string, kind: PartnerAiKind): Promise<number | null> {
  const { count, error } = await tpService()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("kind", kind)
    .gte("created_at", istDayStart());
  return error ? null : count ?? 0;
}

/** Left today; 0 when unreadable (fail closed). */
export async function remainingToday(partnerId: string, kind: PartnerAiKind): Promise<number> {
  const used = await usedToday(partnerId, kind);
  return used === null ? 0 : Math.max(0, PARTNER_AI_DAILY_LIMIT[kind] - used);
}

export type EnqueueManyResult =
  | { ok: true; queued: number; skipped: number; limited: number; remaining: number }
  | { ok: false; error: string; reason: "limit" | "busy" | "error" };

/**
 * Queue one job per subject (one job with subject null for a sales chaser).
 * Subjects that already have a blocking job are skipped. Only as many as the
 * daily limit allows are inserted. Two requests at once can both pass the
 * first reads, so after the insert both rules are checked again by arrival
 * (created_at, id): rows within the daily limit and the earliest row per
 * subject stay, any extra row is taken back. Every re-check fails CLOSED:
 * if it cannot be read, all new rows are removed.
 */
export async function enqueuePartnerJobs(
  partnerId: string,
  kind: PartnerAiKind,
  items: { subject: string | null; input: Record<string, unknown> }[]
): Promise<EnqueueManyResult> {
  const db = tpService();
  const limit = PARTNER_AI_DAILY_LIMIT[kind];
  const blocking = BLOCKING[kind];
  if (!items.length) return { ok: false, error: BUSY_MESSAGE[kind], reason: "busy" };

  // 1. Who already has a job that blocks a new one.
  const { data: open, error: oErr } = await db
    .from(TABLE)
    .select("subject_delegate_id")
    .eq("partner_id", partnerId)
    .eq("kind", kind)
    .in("status", blocking)
    .limit(5000);
  if (oErr) return { ok: false, error: ERROR_MESSAGE, reason: "error" };
  const taken = new Set(((open ?? []) as { subject_delegate_id: string | null }[]).map((r) => r.subject_delegate_id ?? "-"));
  const seen = new Set<string>();
  const fresh = items.filter((it) => {
    const k = it.subject ?? "-";
    if (taken.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const skipped = items.length - fresh.length;
  if (!fresh.length) return { ok: false, error: BUSY_MESSAGE[kind], reason: "busy" };

  // 2. Daily limit.
  const used = await usedToday(partnerId, kind);
  if (used === null) return { ok: false, error: ERROR_MESSAGE, reason: "error" };
  const room = Math.max(0, limit - used);
  if (room === 0) return { ok: false, error: LIMIT_MESSAGE[kind], reason: "limit" };
  const batch = fresh.slice(0, room);
  const limited = fresh.length - batch.length;

  // 3. Insert.
  const { data: ins, error: iErr } = await db
    .from(TABLE)
    .insert(batch.map((it) => ({ kind, partner_id: partnerId, subject_delegate_id: it.subject, input: it.input, status: "pending" })))
    .select("id");
  if (iErr || !ins) return { ok: false, error: ERROR_MESSAGE, reason: "error" };
  const mine = new Set((ins as { id: string }[]).map((r) => r.id));
  // These rows were inserted by THIS request a moment ago, so they are
  // removed whatever their status: a drain that already claimed one gets a
  // 404 on its POST and moves on, and the limit / one-per-person rules hold.
  const takeBack = async (ids: string[]) => {
    if (ids.length) await db.from(TABLE).delete().in("id", ids);
  };

  // 4a. Re-check the daily limit by arrival.
  const { data: first, error: fErr } = await db
    .from(TABLE)
    .select("id")
    .eq("partner_id", partnerId)
    .eq("kind", kind)
    .gte("created_at", istDayStart())
    .order("created_at")
    .order("id")
    .limit(limit);
  if (fErr || !first) {
    await takeBack([...mine]);
    return { ok: false, error: ERROR_MESSAGE, reason: "error" };
  }
  const within = new Set((first as { id: string }[]).map((r) => r.id));
  const overLimit = [...mine].filter((id) => !within.has(id));

  // 4b. Re-check one blocking job per subject by arrival.
  const { data: rows, error: rErr } = await db
    .from(TABLE)
    .select("id, subject_delegate_id")
    .eq("partner_id", partnerId)
    .eq("kind", kind)
    .in("status", blocking)
    .order("created_at")
    .order("id")
    .limit(5000);
  if (rErr || !rows) {
    await takeBack([...mine]);
    return { ok: false, error: ERROR_MESSAGE, reason: "error" };
  }
  const earliest = new Map<string, string>();
  for (const r of rows as { id: string; subject_delegate_id: string | null }[]) {
    const k = r.subject_delegate_id ?? "-";
    if (!earliest.has(k)) earliest.set(k, r.id);
  }
  const dupes = [...mine].filter((id) => ![...earliest.values()].includes(id));
  const drop = [...new Set([...overLimit, ...dupes])];
  await takeBack(drop);

  const queued = mine.size - drop.length;
  if (queued <= 0) {
    return overLimit.length
      ? { ok: false, error: LIMIT_MESSAGE[kind], reason: "limit" }
      : { ok: false, error: BUSY_MESSAGE[kind], reason: "busy" };
  }
  return {
    ok: true,
    queued,
    skipped: skipped + dupes.filter((id) => !overLimit.includes(id)).length,
    limited: limited + overLimit.length,
    remaining: await remainingToday(partnerId, kind),
  };
}

/**
 * Latest job per subject for this partner and kind. null = the queue could
 * not be read (hide the AI parts); an empty map = nothing yet.
 */
export async function latestBySubject(partnerId: string, kind: PartnerAiKind): Promise<Map<string, PartnerAiJob> | null> {
  const { data, error } = await tpService()
    .from(TABLE)
    .select(JOB_COLS)
    .eq("partner_id", partnerId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return null;
  const out = new Map<string, PartnerAiJob>();
  for (const j of (data ?? []) as PartnerAiJob[]) {
    const k = j.subject_delegate_id ?? "-";
    if (!out.has(k)) out.set(k, j);
  }
  return out;
}

/** Latest sales chaser per applicant. null when the queue cannot be read. */
export async function latestChasers(partnerIds: string[]): Promise<Map<string, PartnerAiJob> | null> {
  const out = new Map<string, PartnerAiJob>();
  if (!partnerIds.length) {
    // Still probe the table so a missing queue hides the buttons.
    const { error } = await tpService().from(TABLE).select("id", { head: true, count: "exact" }).limit(1);
    return error ? null : out;
  }
  const { data, error } = await tpService()
    .from(TABLE)
    .select(JOB_COLS)
    .eq("kind", "sales_chaser")
    .in("partner_id", partnerIds)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return null;
  for (const j of (data ?? []) as PartnerAiJob[]) if (!out.has(j.partner_id)) out.set(j.partner_id, j);
  return out;
}

/**
 * Fire-and-forget wake-up for the routine (same live trigger as the delegate
 * queue). Accelerator only; call it from next/server `after()`.
 */
export { pingLiveTrigger } from "../ai/queue";

// ---------------------------------------------------------------- routine ----

/** Jobs stuck in 'generating' longer than STALE_MINUTES go back to 'pending'. */
export async function resetStalePartnerJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await tpService()
    .from(TABLE)
    .update({ status: "pending", claimed_at: null })
    .eq("status", "generating")
    .lt("claimed_at", cutoff)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

/**
 * Claim up to CLAIM_BATCH pending jobs, oldest first. Guarded by
 * status='pending', so two drains at once never hand out the same row.
 */
export async function claimPartnerJobs(): Promise<PartnerAiJob[]> {
  const db = tpService();
  const { data: ids, error } = await db.from(TABLE).select("id").eq("status", "pending").order("created_at").limit(CLAIM_BATCH);
  if (error || !ids?.length) return [];
  const { data, error: uErr } = await db
    .from(TABLE)
    .update({ status: "generating", claimed_at: new Date().toISOString() })
    .in(
      "id",
      (ids as { id: string }[]).map((r) => r.id)
    )
    .eq("status", "pending")
    .select(JOB_COLS);
  if (uErr) return [];
  return ((data ?? []) as PartnerAiJob[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function pinPartnerAllowed(jobId: string, allowed: PartnerAiAllowed): Promise<boolean> {
  const { data, error } = await tpService().from(TABLE).update({ allowed }).eq("id", jobId).eq("status", "generating").select("id");
  return !error && (data ?? []).length === 1;
}

export async function getPartnerJobForRoutine(jobId: string): Promise<PartnerAiJob | null> {
  const { data, error } = await tpService().from(TABLE).select(JOB_COLS).eq("id", jobId).maybeSingle();
  if (error) return null;
  return (data as PartnerAiJob | null) ?? null;
}

/** generating -> ready. False when the job was not (still) claimed. */
export async function completePartnerJob(jobId: string, output: PartnerAiOutput): Promise<boolean> {
  const { data, error } = await tpService()
    .from(TABLE)
    .update({ status: "ready", output, error: null, completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}

/** generating -> failed, with a short reason. */
export async function failPartnerJob(jobId: string, reason: string): Promise<boolean> {
  const { data, error } = await tpService()
    .from(TABLE)
    .update({ status: "failed", error: reason.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}
