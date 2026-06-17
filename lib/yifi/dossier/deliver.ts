/**
 * YiFi Dossier Engine — gated, manual WhatsApp delivery.
 *
 * Plain module (NOT "use server"). Sends ONE dossier-ready message to ONE
 * registrant and, on success, marks the dossier delivered.
 *
 * GATED + MANUAL: this is only ever invoked from an explicit admin button click
 * (one registrant at a time, or an explicit "deliver all ready" the admin must
 * click). There is NO automatic / scheduled / bulk-blast path anywhere.
 *
 * Delivery is delegated to the repo's existing WhatsApp send path
 * (sendWhatsAppMessage in app/actions/whatsapp.ts) — the serverless-safe
 * function that returns a structured { success, error } result and never
 * throws. We do NOT touch lib/whatsapp/** here.
 */

import { sendWhatsAppMessage } from "@/app/actions/whatsapp";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import type { DeliverResult } from "./types";

// NOTE: formatPhoneNumber is exported from lib/whatsapp/send-message.ts, whose
// module-top import of ./client does `require('whatsapp-web.js')`. Statically
// importing it would drag whatsapp-web.js (native Puppeteer deps) into the
// Vercel serverless bundle — the exact failure app/actions/whatsapp.ts avoids
// via dynamic imports. We follow that same discipline: dynamic-import the
// repo's own formatPhoneNumber inside the async path so it never loads at
// module init. We do NOT modify lib/whatsapp/**.

/**
 * Deliver a single dossier over WhatsApp, then mark it delivered.
 *
 * @param dossierId  the yifi.dossiers row id (marked delivered on success)
 * @param phone      the registrant's phone (any format; normalised here)
 * @param fullName   the registrant's name (for the greeting)
 * @param dossierUrl absolute or relative URL the member opens after login
 */
export async function deliverDossierWhatsApp(
  dossierId: string,
  phone: string | null,
  fullName: string | null,
  dossierUrl: string
): Promise<DeliverResult> {
  const trimmedPhone = (phone ?? "").trim();
  if (!trimmedPhone) {
    return { ok: false, error: "No phone number on file for this registrant." };
  }

  // Normalise the number the same way the send path does. formatPhoneNumber
  // returns a WhatsApp chat id (…@c.us); the send function re-normalises
  // internally, so passing the raw digits is fine — we validate format here.
  // Dynamic import keeps whatsapp-web.js out of the static serverless bundle.
  let chatId = "";
  try {
    const { formatPhoneNumber } = await import("@/lib/whatsapp/send-message");
    chatId = formatPhoneNumber(trimmedPhone);
  } catch {
    // If the module can't load (serverless without the package), fall back to
    // a minimal digit check so delivery can still proceed via the API path.
    const digits = trimmedPhone.replace(/\D/g, "");
    chatId = digits.length >= 10 ? `${digits}@c.us` : "";
  }
  if (!chatId || chatId === "@c.us") {
    return { ok: false, error: `Invalid phone number: ${trimmedPhone}` };
  }

  const name = (fullName ?? "").trim() || "there";
  const message = `Hi ${name}, your personalised YiFi dossier is ready: ${dossierUrl}`;

  // Send exactly one message via the repo's WhatsApp path.
  let sendResult: { success: boolean; error?: string };
  try {
    sendResult = await sendWhatsAppMessage(trimmedPhone, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "WhatsApp send failed";
    return { ok: false, error: msg };
  }

  if (!sendResult.success) {
    return {
      ok: false,
      error: sendResult.error || "WhatsApp client not ready — message not sent.",
    };
  }

  // Mark delivered only after a confirmed send.
  try {
    const svc = await createServiceClient();
    const { error } = await svc.rpc("yifi_admin_mark_dossier_delivered", {
      p_dossier_id: dossierId,
    });
    if (error) {
      // The message went out but the status update failed — surface it so the
      // admin knows the board may be stale, without claiming a hard failure.
      return { ok: false, error: `Sent, but status update failed: ${error.message}` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Status update failed";
    return { ok: false, error: `Sent, but status update failed: ${msg}` };
  }

  return { ok: true };
}
