"use server";

/**
 * YIP WhatsApp Access-Code distribution — server actions.
 *
 * Lets an event organiser DM each participant their 6-char access code over
 * WhatsApp via the existing Railway bridge (@/lib/whatsapp/api-client), instead
 * of reading codes out one by one. Every action is gated on canManage for the
 * event — the same per-chapter authority model the rest of app/yip/actions uses.
 *
 * CRITICAL: a "use server" file may export ONLY async functions. All types live
 * in @/lib/yip/whatsapp-codes-types (non-async exports here break the build).
 */

import {
  isServiceConfigured,
  connectWhatsAppAPI,
  getWhatsAppStatusAPI,
  sendBulkMessagesAPI,
} from "@/lib/whatsapp/api-client";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { createServiceClient } from "@/lib/yip/supabase/server";
import type {
  YipWaState,
  YipCodeSendPlan,
  YipCodeRecipient,
  YipBatchItemResult,
} from "@/lib/yip/whatsapp-codes-types";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Phone normalisation (module-private) ─────────────────────────
// Not exported: a "use server" file can only export async functions, and this
// is a pure sync helper. WhatsApp needs a country-coded MSISDN with no '+'/
// spaces. We assume India when a bare 10-digit local number is given (the common
// case for student/parent numbers), and accept numbers that already carry a
// country code (11–15 digits). Returns null when the input can't be made valid.
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  digits = digits.replace(/^0+/, ""); // strip a leading trunk '0'
  if (digits.length === 10) digits = `91${digits}`; // assume India for bare local
  const valid =
    (digits.length === 12 && digits.startsWith("91")) || // Indian, country-coded
    (digits.length >= 11 && digits.length <= 15); // other country codes already present
  return valid ? digits : null;
}

// Mask to "<first2>******<last2>" of the local part so the preview confirms the
// right number without exposing it in full. null when there's no usable phone.
function maskPhone(normalized: string | null): string | null {
  if (!normalized) return null;
  // Drop the country code (assume 2-digit for the India-default case) so the
  // shown "first 2 / last 2" are local-part digits the organiser recognises.
  const local = normalized.startsWith("91") ? normalized.slice(2) : normalized;
  if (local.length < 4) return `${local}******`;
  return `${local.slice(0, 2)}******${local.slice(-2)}`;
}

// Read the bridge's own `lastError` off the /status payload. The bridge added
// this field after lib/whatsapp/api-client.ts's StatusResponse type was frozen,
// so it isn't declared there — but getWhatsAppStatusAPI returns the parsed JSON
// verbatim, so the value is present at runtime. We read it through a narrow,
// local cast (NOT by editing the shared client, which other modules depend on)
// and coerce anything non-string to null.
function readBridgeLastError(status: unknown): string | null {
  if (status && typeof status === "object" && "lastError" in status) {
    const v = (status as { lastError?: unknown }).lastError;
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

// The v2 bridge (whatsapp-service/src) reports the connection state under
// `state`; lib/whatsapp/api-client.ts's frozen StatusResponse type still says
// `status`, so reading `.status` yields undefined and the dialog sits on
// "Waiting for the WhatsApp bridge…" forever even while the bridge is at
// qr_ready with a live QR. The value union is identical on both sides
// (whatsapp-service/src/whatsapp.ts ConnectionState) — only the key moved.
// Read `state` first with a `status` fallback through the same narrow local
// cast as readBridgeLastError; anything unrecognised maps to "disconnected".
const BRIDGE_STATES = new Set<YipWaState["status"]>([
  "disconnected",
  "connecting",
  "qr_ready",
  "authenticated",
  "ready",
]);

function readBridgeStatus(status: unknown): YipWaState["status"] {
  if (status && typeof status === "object") {
    const v =
      (status as { state?: unknown }).state ??
      (status as { status?: unknown }).status;
    if (typeof v === "string" && BRIDGE_STATES.has(v as YipWaState["status"])) {
      return v as YipWaState["status"];
    }
  }
  return "disconnected";
}

// ─── 1. Bridge state ──────────────────────────────────────────────
// Mirrors the Railway status into our YipWaState. When the service isn't
// configured we report a benign "not configured" state (success:true) so the UI
// can show a setup hint instead of an error.
export async function getYipWhatsAppState(
  eventId: string
): Promise<ActionResult<YipWaState>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (!isServiceConfigured()) {
    return {
      success: true,
      data: {
        configured: false,
        status: "disconnected",
        qrCode: null,
        error: "Service not configured",
        lastError: null,
      },
    };
  }

  try {
    const status = await getWhatsAppStatusAPI();
    return {
      success: true,
      data: {
        configured: true,
        status: readBridgeStatus(status),
        qrCode: status.qrCode,
        error: status.error,
        lastError: readBridgeLastError(status),
      },
    };
  } catch (e) {
    // The bridge is a separate Railway service — surface a human-readable reason
    // (unreachable / not configured) rather than a raw fetch stack.
    return {
      success: false,
      error: e instanceof Error ? e.message : "WhatsApp service error",
    };
  }
}

// ─── 2. Connect ───────────────────────────────────────────────────
// Kicks off a connection (which makes the bridge emit a QR), then reads back the
// freshly-updated status so the caller gets the QR in one round-trip.
export async function connectYipWhatsApp(
  eventId: string
): Promise<ActionResult<YipWaState>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (!isServiceConfigured()) {
    return {
      success: true,
      data: {
        configured: false,
        status: "disconnected",
        qrCode: null,
        error: "Service not configured",
        lastError: null,
      },
    };
  }

  try {
    await connectWhatsAppAPI();
    const status = await getWhatsAppStatusAPI();
    return {
      success: true,
      data: {
        configured: true,
        status: readBridgeStatus(status),
        qrCode: status.qrCode,
        error: status.error,
        lastError: readBridgeLastError(status),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "WhatsApp service error",
    };
  }
}

// ─── 3. Send plan (preview) ───────────────────────────────────────
// Builds the "who will get a code" confirmation: every participant, whether they
// have a sendable phone, and whether a code was already sent for this event.
export async function getYipCodeSendPlan(
  eventId: string
): Promise<ActionResult<YipCodeSendPlan>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();

  const { data: participants, error } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, phone, access_code")
    .eq("event_id", eventId)
    .order("serial_no");

  if (error) {
    return { success: false, error: error.message };
  }

  // Which participants already received a 'sent' access_code message for THIS
  // event. Best-effort: the log lives in the yi_connect schema (cross-schema),
  // and a missing/erroring log must never block the preview — treat as "none
  // sent" so the organiser can still proceed.
  const alreadySentIds = new Set<string>();
  try {
    // Cast: yi_connect schema is not in the yip-pinned generated types. Same
    // pattern as the yi_directory cross-schema reads in admin-team.ts.
    const svcConn = supabase.schema("yi_connect" as never) as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              contains: (
                k: string,
                v: Record<string, unknown>
              ) => Promise<{
                data: Array<{ recipient_id: string | null }> | null;
              }>;
            };
          };
        };
      };
    };
    const { data: logs } = await svcConn
      .from("whatsapp_message_logs")
      .select("recipient_id")
      .eq("recipient_type", "yip_participant")
      .eq("status", "sent")
      .contains("metadata", { event_id: eventId, kind: "access_code" });
    for (const row of logs ?? []) {
      if (row.recipient_id) alreadySentIds.add(row.recipient_id);
    }
  } catch {
    // Logging table unavailable — leave alreadySentIds empty (fail-open on the
    // preview only; the send action still records its own audit attempts).
  }

  const recipients: YipCodeRecipient[] = (participants ?? []).map((p) => {
    const normalized = normalizePhone(p.phone);
    return {
      participantId: p.id,
      serialNo: p.serial_no,
      fullName: p.full_name,
      phoneMasked: maskPhone(normalized),
      hasPhone: normalized !== null,
      alreadySent: alreadySentIds.has(p.id),
    };
  });

  return {
    success: true,
    data: {
      total: recipients.length,
      withPhone: recipients.filter((r) => r.hasPhone).length,
      alreadySent: recipients.filter((r) => r.alreadySent).length,
      recipients,
    },
  };
}

// ─── 4. Send a batch ──────────────────────────────────────────────
// Sends access codes to up to 5 participants per call. The 5-cap keeps each
// serverless invocation well inside its time limit (each send is spaced 2s
// apart); the client iterates batches to cover a full event.
export async function sendYipAccessCodesBatch(
  eventId: string,
  participantIds: string[]
): Promise<ActionResult<{ results: YipBatchItemResult[] }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (participantIds.length > 5) {
    return { success: false, error: "Batch too large (max 5)" };
  }

  const supabase = await createServiceClient();

  // Event name (for the message) + chapter id (for the audit-log FK, NOT NULL).
  const { data: event } = await supabase
    .from("events")
    .select("name, yi_chapter_id")
    .eq("id", eventId)
    .single();
  const eventName = event?.name ?? "Young Indians Parliament";

  const { data: participants, error } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, phone, access_code")
    .eq("event_id", eventId)
    .in("id", participantIds);

  if (error) {
    return { success: false, error: error.message };
  }

  type Sendable = {
    id: string;
    fullName: string;
    serialNo: number | null;
    phone: string;
    accessCode: string;
    message: string;
  };

  const sendable: Sendable[] = [];
  const results: YipBatchItemResult[] = [];

  for (const p of participants ?? []) {
    const normalized = normalizePhone(p.phone);
    // Need both a sendable phone and an access code to deliver anything.
    if (!normalized || !p.access_code) {
      results.push({
        participantId: p.id,
        fullName: p.full_name,
        success: false,
        error: "No valid phone",
      });
      continue;
    }

    // Exact template — keep formatting/whitespace intact; WhatsApp renders the
    // *asterisks* as bold.
    const message = `🇮🇳 *Young Indians Parliament 2026*
${eventName}

Hi ${p.full_name}!
Your YIP login code is: *${p.access_code}*

Login here: https://yi-connect-app.vercel.app/yip/join
Open the link and enter your code to join.

⚠️ *Do NOT share this code with anyone* — not classmates, friends or family. Anyone who has your code can sign in and act as you at the event.`;

    sendable.push({
      id: p.id,
      fullName: p.full_name,
      serialNo: p.serial_no,
      phone: normalized,
      accessCode: p.access_code,
      message,
    });
  }

  // Nothing deliverable — return the skip results without calling the bridge.
  if (sendable.length === 0) {
    return { success: true, data: { results } };
  }

  // 2s spacing between sends — WhatsApp throttles rapid automated bursts.
  let bulk;
  try {
    bulk = await sendBulkMessagesAPI(
      sendable.map((s) => ({ phone: s.phone, message: s.message })),
      2000
    );
  } catch (e) {
    // Whole batch failed to reach the bridge — mark every attempted send failed
    // with a human-readable reason rather than throwing.
    const reason = e instanceof Error ? e.message : "WhatsApp service error";
    for (const s of sendable) {
      results.push({
        participantId: s.id,
        fullName: s.fullName,
        success: false,
        error: reason,
      });
    }
    return { success: true, data: { results } };
  }

  // Map the bridge's per-phone outcomes back onto participants by phone number.
  const outcomeByPhone = new Map<
    string,
    { success: boolean; error?: string }
  >();
  for (const r of bulk.results) {
    outcomeByPhone.set(r.phone, { success: r.success, error: r.error });
  }

  for (const s of sendable) {
    const outcome = outcomeByPhone.get(s.phone) ?? {
      success: false,
      error: "No delivery result",
    };
    results.push({
      participantId: s.id,
      fullName: s.fullName,
      success: outcome.success,
      error: outcome.success ? undefined : outcome.error ?? "Send failed",
    });
  }

  // Best-effort audit trail: one row per attempted send into the cross-schema
  // yi_connect.whatsapp_message_logs. Wrapped so a logging failure NEVER fails
  // the send — the messages already went out; the log is secondary. Skipped
  // entirely when yi_chapter_id is null (the table's chapter_id is NOT NULL).
  if (event?.yi_chapter_id) {
    try {
      const sentAt = new Date().toISOString();
      const rows = sendable.map((s) => {
        const outcome = outcomeByPhone.get(s.phone);
        const ok = outcome?.success ?? false;
        return {
          chapter_id: event.yi_chapter_id,
          recipient_type: "yip_participant",
          recipient_id: s.id,
          recipient_name: s.fullName,
          message_content: s.message,
          status: ok ? "sent" : "failed",
          error_message: ok ? null : outcome?.error ?? "Send failed",
          sent_at: sentAt,
          metadata: {
            event_id: eventId,
            kind: "access_code",
            serial_no: s.serialNo,
          },
        };
      });
      // Cast: yi_connect schema is not in the yip-pinned generated types (same
      // pattern as admin-team.ts). The payload carries the "yip_participant"
      // recipient_type and our access_code metadata shape, neither of which the
      // yip Database type knows about.
      const svcConn = supabase.schema("yi_connect" as never) as unknown as {
        from: (t: string) => {
          insert: (rows: Record<string, unknown>[]) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
      await svcConn.from("whatsapp_message_logs").insert(rows);
    } catch {
      // Audit log is best-effort — swallow and move on.
    }
  }

  return { success: true, data: { results } };
}
