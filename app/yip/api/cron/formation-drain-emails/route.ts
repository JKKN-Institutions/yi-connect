/**
 * GET /yip/api/cron/formation-drain-emails
 *
 * Vercel Cron endpoint (every 5 min — registered in vercel.json). Sweeps up
 * to 50 'pending' rows from yip.formation_emails created in the last 24
 * hours and attempts delivery via Resend. Updates each row to 'sent' or
 * 'failed' and bumps attempts. Ports the yi-future drain pattern
 * (app/yi-future/api/cron/drain-emails/route.tsx) into yip.
 *
 * SECURITY-CRITICAL DIFFERENCE from the yi-future drain: the access code is
 * NEVER stored in the log row. Every email is RE-RENDERED from the live
 * participant row at send time (lib/yip/formation-email-types
 * renderFormationEmail — the same template the send actions use), so a
 * re-issued code is always the one delivered and the log leaks nothing.
 *
 * Auth: requires header X-Cron-Secret matching process.env.CRON_SECRET, or
 * `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron itself sends).
 *
 * Returns JSON: { drained: N, sent: M, failed: K }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  renderFormationEmail,
  isValidFormationEmail,
  type FormationEmailKind,
} from "@/lib/yip/formation-email-types";

// ─── Untyped table access (formation_emails / formation_steps) ────
// Both tables arrive in migration 20260812090000_yip_online_formation.sql and
// are NOT in types/yip/database.ts (never regenerated). Narrow, file-local
// accessors — the votesTable pattern from app/yip/actions/voting.ts lines
// 36–63. The participants/events reads below stay fully typed.

type PgErrLite = { message: string };

type PendingEmailRow = {
  id: string;
  event_id: string;
  participant_id: string | null;
  step_id: string | null;
  kind: string;
  recipient_email: string;
  attempts: number;
};
type FormationEmailsTable = {
  select: (cols: string) => FormationEmailsTable;
  update: (row: Record<string, unknown>) => FormationEmailsTable;
  eq: (col: string, val: unknown) => FormationEmailsTable;
  gte: (col: string, val: unknown) => FormationEmailsTable;
  order: (col: string, opts?: { ascending?: boolean }) => FormationEmailsTable;
  limit: (n: number) => FormationEmailsTable;
  then: Promise<{
    data: PendingEmailRow[] | null;
    error: PgErrLite | null;
  }>["then"];
};
function formationEmailsTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): FormationEmailsTable {
  return (sb as unknown as { from: (t: string) => FormationEmailsTable }).from(
    "formation_emails"
  );
}

type StepRowLite = { id: string; closes_at: string | null };
type FormationStepsTable = {
  select: (cols: string) => FormationStepsTable;
  eq: (col: string, val: unknown) => FormationStepsTable;
  maybeSingle: () => Promise<{
    data: StepRowLite | null;
    error: PgErrLite | null;
  }>;
};
function formationStepsTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): FormationStepsTable {
  return (sb as unknown as { from: (t: string) => FormationStepsTable }).from(
    "formation_steps"
  );
}

function asKind(raw: string): FormationEmailKind {
  return raw === "reminder" || raw === "reissue" ? raw : "invite";
}

async function sendViaResend(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };
  const fromEmail =
    process.env.FROM_EMAIL || "Yi Connect <noreply@yi-connect.org>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => String(res.status));
      return { ok: false, error: `Resend ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");
  if (
    !cronSecret ||
    (incomingSecret !== cronSecret && bearer !== `Bearer ${cronSecret}`)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch pending rows ────────────────────────────────────────────────────
  const svc = await createServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: fetchError } = await formationEmailsTable(svc)
    .select("id, event_id, participant_id, step_id, kind, recipient_email, attempts")
    .eq("status", "pending")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);
  if (fetchError) {
    console.error("[formation-drain-emails] fetch failed:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const pending = rows ?? [];
  let sent = 0;
  let failed = 0;

  // Per-run caches — many rows share an event / step.
  const eventNameCache = new Map<string, string>();
  const stepDeadlineCache = new Map<string, string | null>();

  const markRow = async (
    row: PendingEmailRow,
    outcome: { ok: boolean; error?: string }
  ) => {
    if (outcome.ok) {
      await formationEmailsTable(svc)
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: row.attempts + 1,
        })
        .eq("id", row.id);
      sent++;
    } else {
      await formationEmailsTable(svc)
        .update({
          status: "failed",
          error: outcome.error ?? "unknown error",
          attempts: row.attempts + 1,
        })
        .eq("id", row.id);
      failed++;
      console.error(
        "[formation-drain-emails] failed row",
        row.id,
        ":",
        outcome.error
      );
    }
  };

  // ── Process each row ──────────────────────────────────────────────────────
  for (const row of pending) {
    // Re-render from the LIVE participant row (never from the log).
    if (!row.participant_id) {
      await markRow(row, { ok: false, error: "No participant on log row" });
      continue;
    }
    const { data: participant } = await svc
      .from("participants")
      .select("id, full_name, email, access_code")
      .eq("id", row.participant_id)
      .maybeSingle();
    if (!participant || !participant.access_code) {
      await markRow(row, {
        ok: false,
        error: !participant
          ? "Participant no longer exists"
          : "Participant has no access code",
      });
      continue;
    }

    // Prefer the participant's CURRENT email (it may have been corrected
    // since enqueue); fall back to the address recorded at enqueue time.
    const to = isValidFormationEmail(participant.email)
      ? participant.email.trim()
      : row.recipient_email;
    if (!isValidFormationEmail(to)) {
      await markRow(row, { ok: false, error: "No valid recipient email" });
      continue;
    }

    let eventName = eventNameCache.get(row.event_id);
    if (eventName === undefined) {
      const { data: event } = await svc
        .from("events")
        .select("name")
        .eq("id", row.event_id)
        .maybeSingle();
      eventName = event?.name ?? "Young Indians Parliament";
      eventNameCache.set(row.event_id, eventName);
    }

    // Reminders show the ballot deadline when the step still has one.
    let deadline: string | null = null;
    const kind = asKind(row.kind);
    if (kind === "reminder" && row.step_id) {
      if (stepDeadlineCache.has(row.step_id)) {
        deadline = stepDeadlineCache.get(row.step_id) ?? null;
      } else {
        const { data: step } = await formationStepsTable(svc)
          .select("id, closes_at")
          .eq("id", row.step_id)
          .maybeSingle();
        deadline = step?.closes_at ?? null;
        stepDeadlineCache.set(row.step_id, deadline);
      }
    }

    const email = renderFormationEmail({
      kind,
      fullName: participant.full_name,
      accessCode: participant.access_code,
      eventName,
      deadline,
    });

    const result = await sendViaResend({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    await markRow(row, result);
  }

  return NextResponse.json({ drained: pending.length, sent, failed });
}
