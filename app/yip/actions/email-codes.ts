"use server";

/**
 * YIP access-code distribution by EMAIL — server actions.
 *
 * The reliable counterpart to app/yip/actions/whatsapp-codes.ts: it emails each
 * participant their 6-char login code + the join link via Resend (already
 * configured + sending in prod; see lib/email). Every Erode participant has an
 * email on file, and email avoids the WhatsApp bridge's flaky headless-Chrome
 * session, so this is the primary channel for getting codes to students.
 *
 * Auth: every action is gated on getYipEventAccess(eventId).canManage — the same
 * per-chapter authority model as the rest of app/yip/actions. Students are
 * minors: an email carries only the recipient's OWN name + code, sent only to
 * their own registered address; codes are never logged to any client-visible
 * surface.
 *
 * CRITICAL: a "use server" file may export ONLY async functions. All types live
 * in @/lib/yip/email-codes-types.
 */

import { Resend } from "resend";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { createServiceClient } from "@/lib/yip/supabase/server";
import type {
  YipEmailSendPlan,
  YipEmailRecipient,
  YipEmailBatchItemResult,
} from "@/lib/yip/email-codes-types";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// Max participants per send call. Resend's batch endpoint accepts up to 100 in
// one API request (one request → no per-message rate-limit churn); we stay well
// under that and let the client iterate batches so the dialog can show progress.
const EMAIL_BATCH_MAX = 50;

const JOIN_URL = "https://yi-connect-app.vercel.app/yip/join";

// Pragmatic email check (module-private — a "use server" file can only export
// async functions). Not RFC-perfect, just "has a local part, an @, and a
// dotted domain" — enough to skip blanks/garbage before handing to Resend.
function isValidEmail(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  const e = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

// Mask to "ma****@domain" so the preview confirms the right address without
// exposing it in full. null when there's no usable email.
function maskEmail(raw: string | null | undefined): string | null {
  if (!isValidEmail(raw)) return null;
  const [local, domain] = raw.trim().split("@");
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// YIP-branded code email (inline styles only — email clients strip <style>).
// Saffron header band with dark text (legible), green accent rule, big code box,
// join CTA. Mirrors the WhatsApp message content so both channels say the same.
function renderCodeEmail(input: {
  fullName: string;
  accessCode: string;
  eventName: string;
}): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.fullName);
  const code = escapeHtml(input.accessCode);
  const eventName = escapeHtml(input.eventName);
  const subject = `Your Young Indians Parliament login code — ${input.eventName}`;
  const text = `Young Indians Parliament 2026
${input.eventName}

Hi ${input.fullName},

Your YIP login code is: ${input.accessCode}

Sign in here: ${JOIN_URL}
Enter your code to join. Keep this code private — it is your identity at the event.

Young Indians · CII`;
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px">
    <div style="background:#FF9933;border-radius:8px 8px 0 0;padding:20px 28px;border-bottom:4px solid #138808">
      <span style="color:#1a1f3a;font-size:18px;font-weight:bold;letter-spacing:0.3px">Young Indians Parliament</span>
      <span style="color:#3a2a10;font-size:13px;font-weight:normal"> &middot; 2026</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px;line-height:1.6;color:#1f2a3d;font-size:15px">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px">${eventName}</p>
      <h2 style="margin:0 0 16px;color:#1a1f3a;font-size:20px">Hi ${name},</h2>
      <p style="margin:0 0 8px">Here is your personal login code for the Young Indians Parliament. You will use it to sign in as a participant.</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:18px 24px;margin:20px 0;text-align:center">
        <span style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#c2410c">${code}</span>
      </div>
      <p style="margin:28px 0"><a href="${JOIN_URL}" style="display:inline-block;background:#138808;color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Sign in to YIP</a></p>
      <p style="margin:0;color:#6b7280;font-size:13px">Keep this code private — it is your identity at the event. If you did not expect this email, you can ignore it.</p>
    </div>
    <p style="text-align:center;color:#8a93a3;font-size:12px;margin:18px 0 0">Young Indians &middot; CII</p>
  </div>
</body>
</html>`;
  return { subject, html, text };
}

// ─── 1. Send plan (preview) ───────────────────────────────────────
// Builds the "who will get a code" confirmation: every participant and whether
// they have a sendable email.
export async function getYipEmailCodePlan(
  eventId: string
): Promise<ActionResult<YipEmailSendPlan>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { data: participants, error } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, email, access_code")
    .eq("event_id", eventId)
    .order("serial_no");

  if (error) return { success: false, error: error.message };

  const recipients: YipEmailRecipient[] = (participants ?? []).map((p) => {
    const ok = isValidEmail(p.email) && !!p.access_code;
    return {
      participantId: p.id,
      serialNo: p.serial_no,
      fullName: p.full_name,
      emailMasked: maskEmail(p.email),
      hasEmail: ok,
    };
  });

  return {
    success: true,
    data: {
      total: recipients.length,
      withEmail: recipients.filter((r) => r.hasEmail).length,
      recipients,
    },
  };
}

// ─── 2. Send a batch ──────────────────────────────────────────────
// Emails access codes to up to EMAIL_BATCH_MAX participants in ONE Resend batch
// request. The client iterates batches to cover a full event and show progress.
export async function sendYipAccessCodeEmailsBatch(
  eventId: string,
  participantIds: string[]
): Promise<ActionResult<{ results: YipEmailBatchItemResult[] }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (participantIds.length === 0) {
    return { success: true, data: { results: [] } };
  }
  if (participantIds.length > EMAIL_BATCH_MAX) {
    return { success: false, error: `Batch too large (max ${EMAIL_BATCH_MAX})` };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "Yi Connect <noreply@yi-connect.org>";
  if (!apiKey) {
    return { success: false, error: "Email service is not configured." };
  }

  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single();
  const eventName = event?.name ?? "Young Indians Parliament";

  const { data: participants, error } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, email, access_code")
    .eq("event_id", eventId)
    .in("id", participantIds);

  if (error) return { success: false, error: error.message };

  const results: YipEmailBatchItemResult[] = [];
  type Sendable = {
    id: string;
    fullName: string;
    email: string;
    payload: { from: string; to: string[]; subject: string; html: string; text: string };
  };
  const sendable: Sendable[] = [];

  for (const p of participants ?? []) {
    if (!isValidEmail(p.email) || !p.access_code) {
      results.push({
        participantId: p.id,
        fullName: p.full_name,
        success: false,
        error: !p.access_code ? "No access code" : "No valid email",
      });
      continue;
    }
    const { subject, html, text } = renderCodeEmail({
      fullName: p.full_name,
      accessCode: p.access_code,
      eventName,
    });
    sendable.push({
      id: p.id,
      fullName: p.full_name,
      email: p.email.trim(),
      payload: { from: fromEmail, to: [p.email.trim()], subject, html, text },
    });
  }

  if (sendable.length === 0) {
    return { success: true, data: { results } };
  }

  // One batch request for all valid recipients — sidesteps the per-message
  // rate limit a sequential loop would hit. A batch-level failure marks every
  // attempted send failed with the reason (the organiser can retry); it never
  // throws past this action.
  try {
    const resend = new Resend(apiKey);
    const { error: batchError } = await resend.batch.send(
      sendable.map((s) => s.payload)
    );
    if (batchError) {
      for (const s of sendable) {
        results.push({
          participantId: s.id,
          fullName: s.fullName,
          success: false,
          error: batchError.message || "Email send failed",
        });
      }
      return { success: true, data: { results } };
    }
    for (const s of sendable) {
      results.push({
        participantId: s.id,
        fullName: s.fullName,
        success: true,
      });
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Email service error";
    for (const s of sendable) {
      results.push({
        participantId: s.id,
        fullName: s.fullName,
        success: false,
        error: reason,
      });
    }
  }

  return { success: true, data: { results } };
}
