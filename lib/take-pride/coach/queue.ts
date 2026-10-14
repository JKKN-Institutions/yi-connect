import "server-only";

import { tpService } from "../supabase";
import { COACH_DUE, type CoachAllowed, type CoachMood, type CoachNote, type CoachStatus, type CoachStep } from "./schemas";

/*
 * The tp_coach_checkins queue. Callers MUST pass a gate first: a delegate's
 * pass token (resolved to a delegate id on the server) or the routine's
 * X-Cron-Secret. Every function here trusts the delegate id it is given.
 *
 * One row per (delegate, step), created when the delegate submits. A
 * submitted step is locked; only a 'failed' one can be sent again. The
 * app never calls an LLM: it queues, optionally pings the routine's live
 * trigger (ai/queue.ts pingLiveTrigger), and stores what the routine POSTs.
 */

export const COACH_CLAIM_BATCH = 20;
export const COACH_STALE_MINUTES = 15;

export type CoachCheckin = {
  id: string;
  delegate_id: string;
  step: CoachStep;
  due_on: string;
  update_text: string | null;
  mood: CoachMood | null;
  status: CoachStatus;
  coach_note: CoachNote | null;
  allowed: CoachAllowed | null;
  error: string | null;
  created_at: string;
  submitted_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
};

const COLS =
  "id, delegate_id, step, due_on, update_text, mood, status, coach_note, allowed, error, created_at, submitted_at, claimed_at, completed_at";

/**
 * A delegate's check-ins. `ok: false` when they could not be read (for
 * example before the table exists): pages show a note instead of failing.
 */
export async function listMyCheckins(delegateId: string): Promise<{ ok: true; rows: CoachCheckin[] } | { ok: false }> {
  const { data, error } = await tpService()
    .from("tp_coach_checkins")
    .select(COLS)
    .eq("delegate_id", delegateId)
    .order("step");
  if (error) return { ok: false };
  return { ok: true, rows: (data ?? []) as CoachCheckin[] };
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

const LOCKED = "You have already sent this check-in.";
const FAILED = "Something went wrong. Please try again.";

/**
 * Submit one check-in. Inserts a 'pending' row; if the step already has a
 * row, only a 'failed' one is replaced (guarded by status), so a sent or
 * answered check-in can never be overwritten.
 */
export async function submitCheckin(
  delegateId: string,
  step: CoachStep,
  updateText: string,
  mood: CoachMood
): Promise<SubmitResult> {
  const db = tpService();
  const now = new Date().toISOString();
  const row = {
    update_text: updateText,
    mood,
    status: "pending" as const,
    submitted_at: now,
    coach_note: null,
    allowed: null,
    error: null,
    claimed_at: null,
    completed_at: null,
  };
  const { error } = await db.from("tp_coach_checkins").insert({ delegate_id: delegateId, step, due_on: COACH_DUE[step], ...row });
  if (!error) return { ok: true };
  if (error.code !== "23505") return { ok: false, error: FAILED };
  const { data, error: uErr } = await db
    .from("tp_coach_checkins")
    .update(row)
    .eq("delegate_id", delegateId)
    .eq("step", step)
    .in("status", ["failed", "open"])
    .select("id");
  if (uErr) return { ok: false, error: FAILED };
  return data?.length ? { ok: true } : { ok: false, error: LOCKED };
}

// ---------------------------------------------------------------- routine ----

/** Check-ins stuck in 'generating' longer than COACH_STALE_MINUTES go back to 'pending'. */
export async function resetStaleCheckins(): Promise<number> {
  const cutoff = new Date(Date.now() - COACH_STALE_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await tpService()
    .from("tp_coach_checkins")
    .update({ status: "pending", claimed_at: null })
    .eq("status", "generating")
    .lt("claimed_at", cutoff)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

/**
 * Claim up to COACH_CLAIM_BATCH pending check-ins, oldest first. The update
 * is guarded by status='pending', so two drains at once never hand out the
 * same row: only rows this call actually flipped come back.
 */
export async function claimCheckins(): Promise<CoachCheckin[]> {
  const db = tpService();
  const { data: ids, error } = await db
    .from("tp_coach_checkins")
    .select("id")
    .eq("status", "pending")
    .order("submitted_at")
    .limit(COACH_CLAIM_BATCH);
  if (error || !ids?.length) return [];
  const { data, error: uErr } = await db
    .from("tp_coach_checkins")
    .update({ status: "generating", claimed_at: new Date().toISOString() })
    .in(
      "id",
      (ids as { id: string }[]).map((r) => r.id)
    )
    .eq("status", "pending")
    .select(COLS);
  if (uErr) return [];
  return ((data ?? []) as CoachCheckin[]).sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
}

/** Pin the person ids the routine is shown for this check-in (checked on POST). */
export async function pinCheckinAllowed(id: string, allowed: CoachAllowed): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_coach_checkins")
    .update({ allowed })
    .eq("id", id)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}

export async function getCheckinForRoutine(id: string): Promise<CoachCheckin | null> {
  const { data, error } = await tpService().from("tp_coach_checkins").select(COLS).eq("id", id).maybeSingle();
  if (error) return null;
  return (data as CoachCheckin | null) ?? null;
}

/** generating -> ready. False when the row was not (still) claimed. */
export async function completeCheckin(id: string, note: CoachNote): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_coach_checkins")
    .update({ status: "ready", coach_note: note, error: null, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}

/** generating -> failed, with a short reason. */
export async function failCheckin(id: string, reason: string): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_coach_checkins")
    .update({ status: "failed", error: reason.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}
