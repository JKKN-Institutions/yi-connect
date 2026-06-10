/**
 * GET /youth-academy/api/cron/drain-emails
 *
 * Vercel Cron endpoint (every 5 min — registered in vercel.json under
 * version control). Clone of the yi-future donor
 * (app/yi-future/api/cron/drain-emails/route.tsx) for the `yuva` schema:
 *
 *   1. Sweeps up to 50 'pending' rows from yuva.notification_log (oldest
 *      first) and attempts delivery via the shared Resend wrapper
 *      (lib/email — the same path sendYuvaEmail's immediate attempt takes).
 *      success → status 'sent' + sent_at; failure → attempts+1 + last_error,
 *      and status 'failed' once attempts reach MAX_ATTEMPTS (5). Below the
 *      cap the row stays 'pending' so the next run retries it.
 *      RESEND_API_KEY unset is recorded distinctly (donor semantics:
 *      last_error "RESEND_API_KEY not set") — it is never a silent success.
 *   2. Housekeeping in the same run (spec: prune duties):
 *      - DELETE yuva.login_attempts older than 24 h (throttle window is
 *        15 min; day-old rows are dead weight).
 *      - DELETE yuva.login_otps older than 24 h (OTP validity is 10 min, so
 *        every day-old row is consumed or expired).
 *
 * Auth: header X-Cron-Secret matching process.env.CRON_SECRET (donor
 * contract), OR `Authorization: Bearer <CRON_SECRET>` — the header Vercel
 * Cron itself sends when CRON_SECRET is configured.
 *
 * Returns JSON counts:
 *   { drained, sent, failed, retrying, pruned_login_attempts, pruned_login_otps }
 */

import { NextResponse, type NextRequest } from "next/server";
import { sendEmail as sendViaResend } from "@/lib/email";
import { createServiceClient } from "@/lib/yuva/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Terminal-failure threshold: after 5 attempts a row is marked 'failed'. */
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

type LogRow = {
  id: string;
  recipient: string;
  subject: string;
  payload: { html?: string; text?: string } | null;
  attempts: number;
};

async function attemptSend(row: LogRow): Promise<{ ok: boolean; error?: string }> {
  // Donor semantics: a missing key is recorded distinctly as a row failure
  // (last_error "RESEND_API_KEY not set"), never reported as success.
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const html = row.payload?.html;
  if (!html) {
    return { ok: false, error: "payload.html missing" };
  }

  const result = await sendViaResend({
    to: row.recipient,
    subject: row.subject || "(no subject)",
    html,
    text: row.payload?.text,
  });

  return result.success
    ? { ok: true }
    : { ok: false, error: result.error ?? "unknown send failure" };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");

  const authorized =
    !!cronSecret &&
    (incomingSecret === cronSecret || bearer === `Bearer ${cronSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();

  // ── Fetch pending rows (oldest first) ─────────────────────────────────────
  const { data: rows, error: fetchError } = await svc
    .from("notification_log")
    .select("id, recipient, subject, payload, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[yuva drain-emails] fetch failed:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const pending: LogRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    recipient: r.recipient,
    subject: r.subject,
    payload: (r.payload ?? null) as LogRow["payload"],
    attempts: r.attempts,
  }));

  let sent = 0;
  let failed = 0; // reached MAX_ATTEMPTS → terminal 'failed'
  let retrying = 0; // failed this run but still 'pending' for the next sweep

  // ── Process each row ──────────────────────────────────────────────────────
  for (const row of pending) {
    const result = await attemptSend(row);
    const attempts = row.attempts + 1;

    if (result.ok) {
      await svc
        .from("notification_log")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts,
          last_error: null,
        })
        .eq("id", row.id);
      sent++;
    } else {
      const terminal = attempts >= MAX_ATTEMPTS;
      await svc
        .from("notification_log")
        .update({
          // Below the cap the row STAYS 'pending' so the next run retries it.
          status: terminal ? "failed" : "pending",
          attempts,
          last_error: result.error ?? "unknown send failure",
        })
        .eq("id", row.id);
      if (terminal) failed++;
      else retrying++;
      console.error(
        `[yuva drain-emails] row ${row.id} attempt ${attempts}/${MAX_ATTEMPTS} failed:`,
        result.error
      );
    }
  }

  // ── Housekeeping (same run; spec prune duties) ────────────────────────────
  const pruneCutoff = new Date(Date.now() - PRUNE_AGE_MS).toISOString();

  const { count: prunedAttempts, error: pruneAttemptsError } = await svc
    .from("login_attempts")
    .delete({ count: "exact" })
    .lt("attempted_at", pruneCutoff);
  if (pruneAttemptsError) {
    console.error(
      "[yuva drain-emails] login_attempts prune failed:",
      pruneAttemptsError.message
    );
  }

  // OTP validity is 10 minutes — any row created >24 h ago is consumed or
  // expired by definition, so age alone is the prune predicate.
  const { count: prunedOtps, error: pruneOtpsError } = await svc
    .from("login_otps")
    .delete({ count: "exact" })
    .lt("created_at", pruneCutoff);
  if (pruneOtpsError) {
    console.error(
      "[yuva drain-emails] login_otps prune failed:",
      pruneOtpsError.message
    );
  }

  return NextResponse.json({
    drained: pending.length,
    sent,
    failed,
    retrying,
    pruned_login_attempts: prunedAttempts ?? 0,
    pruned_login_otps: prunedOtps ?? 0,
  });
}
