/**
 * GET /api/cron/drain-emails
 *
 * Vercel Cron endpoint (every 5 min). Sweeps up to 50 'pending' rows from
 * future.notification_log created in the last 24 hours and attempts delivery
 * via Resend. Updates each row to 'sent' or 'failed'.
 *
 * Auth: requires header X-Cron-Secret matching process.env.CRON_SECRET.
 *
 * Returns JSON: { drained: N, sent: M, failed: K }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

type LogRow = {
  id: string;
  recipient_email: string;
  subject_line: string | null;
  body_preview: string | null;
};

async function sendViaResend(row: LogRow): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const subject = row.subject_line ?? "(no subject)";
  const text = row.body_preview ?? "";

  // body_preview is plain text; wrap in minimal HTML for Resend
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px"><p>${text.replace(/\n/g, "<br>")}</p></body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Future 6.0 <hello@yifuture-platform.vercel.app>",
        to: [row.recipient_email],
        subject,
        text,
        html,
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

  if (!cronSecret || incomingSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch pending rows ────────────────────────────────────────────────────
  const svc = await createServiceClient();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: fetchError } = await svc
    .schema("future")
    .from("notification_log" as never)
    .select("id, recipient_email, subject_line, body_preview")
    .eq("status", "pending")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50) as { data: LogRow[] | null; error: unknown };

  if (fetchError) {
    const msg =
      fetchError instanceof Error
        ? fetchError.message
        : (fetchError as { message?: string })?.message ?? "fetch error";
    console.error("[drain-emails] fetch failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const pending = rows ?? [];
  let sent = 0;
  let failed = 0;

  // ── Process each row ──────────────────────────────────────────────────────
  for (const row of pending) {
    const result = await sendViaResend(row);

    if (result.ok) {
      await svc
        .schema("future")
        .from("notification_log" as never)
        .update({ status: "sent", sent_at: new Date().toISOString() } as never)
        .eq("id", row.id);
      sent++;
    } else {
      await svc
        .schema("future")
        .from("notification_log" as never)
        .update({ status: "failed", error: result.error } as never)
        .eq("id", row.id);
      failed++;
      console.error("[drain-emails] failed row", row.id, ":", result.error);
    }
  }

  return NextResponse.json({ drained: pending.length, sent, failed });
}
