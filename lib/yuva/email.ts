/**
 * Yi Youth Academy email helper — durable queue (clone of lib/yi-future/email.ts).
 *
 * Strategy:
 *   1. ALWAYS insert into yuva.notification_log with status='pending' first
 *      (durable audit trail; the drain cron at
 *      app/youth-academy/api/cron/drain-emails picks up stuck rows).
 *   2. dedupe_key (UNIQUE) makes double-enqueue impossible — e.g.
 *      'acceptance:{run_id}:{person_id}'. A duplicate insert is treated as
 *      success (the email is already queued/sent), not an error.
 *   3. If RESEND_API_KEY is set, attempt immediate delivery via the shared
 *      Resend wrapper (lib/email/index.ts) and update the row to
 *      'sent'/'failed'. If the key is absent, the row stays 'pending'.
 *
 * Failed rows are surfaced on the national/chapter dashboards
 * ("email pending/failed" indicator) and recovered via the resend action —
 * the cron retries only 'pending' rows (donor semantics).
 */
import { sendEmail as sendViaResend } from "@/lib/email";
import { createServiceClient } from "@/lib/yuva/supabase/service";

/** The notification triggers (spec → Third-Party Services / Resend). */
export type YuvaEmailType =
  | "application_confirmation"
  | "acceptance"
  | "rejection"
  | "otp"
  | "certificate"
  | "schedule_change"
  | "mentor_invite"
  | "coordinator_invite"
  | "run_cancelled";

export interface SendYuvaEmailInput {
  to: string;
  emailType: YuvaEmailType;
  subject: string;
  html: string;
  /** Plain-text alternative; derived from nothing — pass when available. */
  text?: string;
  /**
   * Idempotency key (UNIQUE in yuva.notification_log). Supply for any email
   * that a retried/double-clicked action could enqueue twice.
   */
  dedupeKey?: string;
  /** Extra context persisted alongside the rendered html in `payload`. */
  meta?: Record<string, unknown>;
}

export interface SendYuvaEmailResult {
  ok: boolean;
  /** True when the dedupe_key already existed — nothing new was enqueued. */
  deduped?: boolean;
  error?: string;
}

export async function sendYuvaEmail(
  input: SendYuvaEmailInput
): Promise<SendYuvaEmailResult> {
  const recipient = input.to.toLowerCase().trim();
  if (!recipient || !recipient.includes("@")) {
    return { ok: false, error: "Invalid recipient email address." };
  }

  const svc = await createServiceClient();

  // 1. Enqueue as 'pending' (audit trail always written first).
  const { data: logRow, error: insertError } = await svc
    .from("notification_log")
    .insert({
      recipient,
      email_type: input.emailType,
      subject: input.subject,
      payload: {
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.meta ?? {}),
      } as never,
      status: "pending",
      dedupe_key: input.dedupeKey ?? null,
    })
    .select("id")
    .single();

  if (insertError || !logRow) {
    // UNIQUE violation on dedupe_key ⇒ this email was already enqueued by a
    // previous attempt. That is the idempotency contract working — succeed.
    if ((insertError as { code?: string } | null)?.code === "23505") {
      return { ok: true, deduped: true };
    }
    const msg = insertError?.message ?? "notification_log insert failed";
    console.error("[yuva-email] notification_log insert failed:", msg);
    return { ok: false, error: msg };
  }

  const logId: string = logRow.id;

  // 2. No API key → stay 'pending'; the drain cron will deliver later.
  if (!process.env.RESEND_API_KEY) {
    return { ok: true };
  }

  // 3. Immediate delivery attempt via the shared Resend wrapper.
  const result = await sendViaResend({
    to: recipient,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  // 4. Record the outcome (best-effort — the row exists either way).
  if (result.success) {
    await svc
      .from("notification_log")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq("id", logId);
    return { ok: true };
  }

  await svc
    .from("notification_log")
    .update({
      status: "failed",
      attempts: 1,
      last_error: result.error ?? "unknown send failure",
    })
    .eq("id", logId);
  console.error("[yuva-email] Resend failed for", logId, ":", result.error);
  return { ok: false, error: result.error };
}
