"use server";

/**
 * Yi Future — WhatsApp Outreach actions (platform-admin only).
 *
 * Thin yi-future surface over the SHARED BYOW WhatsApp stack
 * (`@/app/actions/whatsapp`). A single connected WhatsApp number is used
 * as the "from" — whoever scanned the QR at the dashboard connect page owns
 * it. We never send if the service is not ready (no silent no-op).
 *
 * Credentials note: passwords are NOT stored, so "send login details" never
 * contains a plaintext password. Instead we send the dashboard URL + an
 * instruction to use the password-reset flow.
 */

import {
  sendWhatsAppMessage,
  sendBulkWhatsAppMessages,
  getWhatsAppStatus,
  logWhatsAppMessage,
} from "@/app/actions/whatsapp";
import { requirePlatformAdmin } from "@/app/yi-future/actions/national-admins";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";
const RESET_URL = `${APP_URL}/yi-future/access/forgot-password`;
const DASHBOARD_URL = `${APP_URL}/yi-future/chapter`;

/** Normalize an Indian mobile to E.164 digits with the 91 country code. */
function normalizePhone(mobile: string): string {
  return "91" + mobile.replace(/[^\d]/g, "").replace(/^0+/, "");
}

/**
 * Login/credentials message. NEVER contains a password — passwords are not
 * stored. The chair sets their own password via the reset flow.
 */
export async function credentialsMessage(
  chairName: string,
  chapterName: string
): Promise<string> {
  const first = chairName?.trim().split(/\s+/)[0] || "Chair";
  return (
    `Hi ${first}, here are your Yi Future 6.0 login details for the ` +
    `${chapterName} chapter dashboard.\n\n` +
    `Login email: your registered Yi email address.\n` +
    `Set or reset your password here: ${RESET_URL}\n` +
    `Then sign in at your dashboard: ${DASHBOARD_URL}\n\n` +
    `For security we don't store or send passwords — use the link above to ` +
    `set your own.\n\n— Yi National`
  );
}

/** Status probe for the outreach UI. Platform-admin gated. */
export async function whatsappStatusForOutreach() {
  await requirePlatformAdmin();
  return getWhatsAppStatus();
}

/** Send a single nudge to one chapter chair. */
export async function sendChapterNudge(
  chapterId: string,
  chairMobile: string,
  chairName: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();

  const status = await getWhatsAppStatus();
  if (!status.isReady) {
    return { ok: false, error: "WhatsApp not connected — scan the QR first." };
  }

  const phone = normalizePhone(chairMobile);
  const result = await sendWhatsAppMessage(phone, message);

  // Best-effort logging — never let a log failure block the send.
  try {
    await logWhatsAppMessage({
      chapter_id: chapterId,
      recipient_type: "individual",
      recipient_name: chairName,
      message_content: message,
      status: result.success ? "sent" : "failed",
    });
  } catch {
    // ignore
  }

  return { ok: result.success, error: result.error };
}

export type BulkNudgeRow = {
  chapterId: string;
  mobile: string;
  name: string;
  message: string;
};

export type BulkNudgeSummary = {
  total: number;
  sent: number;
  failed: number;
  error?: string;
};

/** Send nudges to many chapters at once (capped at 100). */
export async function sendBulkNudges(
  rows: BulkNudgeRow[]
): Promise<BulkNudgeSummary> {
  await requirePlatformAdmin();

  const status = await getWhatsAppStatus();
  if (!status.isReady) {
    return {
      total: rows.length,
      sent: 0,
      failed: rows.length,
      error: "WhatsApp not connected — scan the QR first.",
    };
  }

  const capped = rows.slice(0, 100);
  const recipients = capped.map((r) => ({
    phoneNumber: normalizePhone(r.mobile),
    message: r.message,
  }));

  const result = await sendBulkWhatsAppMessages(recipients, 1500);

  // Best-effort per-row logging. Match each row to its send result by index.
  await Promise.all(
    capped.map(async (r, i) => {
      const sent = result.results[i]?.success ?? false;
      try {
        await logWhatsAppMessage({
          chapter_id: r.chapterId,
          recipient_type: "individual",
          recipient_name: r.name,
          message_content: r.message,
          status: sent ? "sent" : "failed",
        });
      } catch {
        // ignore
      }
    })
  );

  return {
    total: result.total,
    sent: result.sent,
    failed: result.failed,
  };
}
