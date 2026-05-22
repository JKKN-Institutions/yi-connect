/**
 * Email helper for Future 6.0.
 *
 * v2 strategy:
 *   1. Always insert into future.notification_log with status='pending'.
 *   2. If RESEND_API_KEY is set, call Resend immediately and update status.
 *   3. If key is absent, leave row as 'pending' — the drain cron will retry.
 *
 * Handbook refs: [CPB §2, CPB §3, HPB §10, PRD §8]
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";

export type EmailTrigger =
  | "registration_confirmed"
  | "team_invite"
  | "problem_allocated"
  | "session_reminder"
  | "threshold_achieved"
  | "finals_confirmed"
  | "custom";

export interface SendEmailInput {
  to: string;
  triggerType: EmailTrigger;
  subject: string;
  body: string;             // plain-text / markdown
  html?: string;            // optional pre-rendered HTML
  recipientSubjectType?: string;
  recipientSubjectId?: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

// ─── Tiny markdown → HTML converter (~30 lines, no deps) ────────────────────

function markdownToHtml(md: string): string {
  let html = md
    // Escape existing HTML chars first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    // Raw URLs not already in an anchor tag
    .replace(
      /(?<![">])(https?:\/\/[^\s<>"]+)/g,
      '<a href="$1">$1</a>'
    );

  // Paragraphs: split on blank lines
  const paragraphs = html
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">${paragraphs}</body></html>`;
}

// ─── Resend send via fetch (no SDK) ─────────────────────────────────────────

async function sendViaResend(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Future 6.0 <hello@yifuture-platform.vercel.app>",
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
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

// ─── Public sendEmail ─────────────────────────────────────────────────────────

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  if (!input.to || !input.to.includes("@")) {
    return { ok: false, error: "Invalid recipient email address." };
  }

  const svc = await createServiceClient();

  // 1. Insert as 'pending' (audit trail always written first)
  const { data: logRow, error: insertError } = await svc
    .schema("future")
    .from("notification_log" as never)
    .insert({
      trigger_type: input.triggerType,
      recipient_email: input.to.toLowerCase().trim(),
      recipient_subject_type: input.recipientSubjectType ?? null,
      recipient_subject_id: input.recipientSubjectId ?? null,
      subject_line: input.subject,
      body_preview: input.body.slice(0, 500),
      status: "pending",
    } as never)
    .select("id")
    .single() as { data: { id: string } | null; error: unknown };

  if (insertError || !logRow) {
    const msg =
      insertError instanceof Error
        ? insertError.message
        : (insertError as { message?: string })?.message ?? "insert failed";
    console.error("[email] notification_log insert failed:", msg);
    return { ok: false, error: msg };
  }

  const logId: string = logRow.id;

  // 2. If no API key, stay pending — drain cron will pick it up later
  if (!process.env.RESEND_API_KEY) {
    return { ok: true };
  }

  // 3. Send via Resend
  const htmlBody = input.html ?? markdownToHtml(input.body);
  const result = await sendViaResend({
    to: input.to.toLowerCase().trim(),
    subject: input.subject,
    text: input.body,
    html: htmlBody,
  });

  // 4. Update log row with outcome
  if (result.ok) {
    await svc
      .schema("future")
      .from("notification_log" as never)
      .update({ status: "sent", sent_at: new Date().toISOString() } as never)
      .eq("id", logId);
  } else {
    await svc
      .schema("future")
      .from("notification_log" as never)
      .update({ status: "failed", error: result.error } as never)
      .eq("id", logId);
    console.error("[email] Resend failed for", logId, ":", result.error);
    return { ok: false, error: result.error };
  }

  return { ok: true };
}
