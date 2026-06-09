/**
 * YIP WhatsApp Access-Code distribution — shared types.
 *
 * Plain types module (NO "use server"): the server action file
 * (app/yip/actions/whatsapp-codes.ts) may export ONLY async functions, so every
 * type/constant it needs lives here. Importing non-async exports from a
 * "use server" file breaks the Vercel build — that exact mistake has bitten this
 * repo before.
 */

/** Live state of the WhatsApp bridge, mapped from the Railway service status. */
export type YipWaState = {
  /** False when WHATSAPP_SERVICE_URL/API_KEY are unset — feature is dormant. */
  configured: boolean;
  status: "disconnected" | "connecting" | "qr_ready" | "authenticated" | "ready";
  /** data-URL QR image when status === "qr_ready", else null. */
  qrCode: string | null;
  error: string | null;
  /**
   * Last failure reported by the bridge itself (e.g. auth failure, session
   * conflict), surfaced so the organiser can see WHY it isn't connecting.
   * Distinct from `error`, which is THIS app's reason for not getting a status
   * back. null when the bridge has reported no error.
   */
  lastError: string | null;
};

/** One participant as shown in the "who will receive a code" preview. */
export type YipCodeRecipient = {
  participantId: string;
  serialNo: number | null;
  fullName: string;
  /** "98******58" style; null when the participant has no usable phone. */
  phoneMasked: string | null;
  /** True iff the phone normalises to a sendable WhatsApp number. */
  hasPhone: boolean;
  /** True iff a 'sent' access_code log already exists for this event. */
  alreadySent: boolean;
};

/** The full send plan: counts + ordered recipient list for the confirm screen. */
export type YipCodeSendPlan = {
  /** All participants in the event. */
  total: number;
  /** Participants with a valid, normalisable phone. */
  withPhone: number;
  /** Participants who already have a 'sent' access_code log for this event. */
  alreadySent: number;
  /** Ordered by serialNo. */
  recipients: YipCodeRecipient[];
};

/** Per-participant outcome of one send batch. */
export type YipBatchItemResult = {
  participantId: string;
  fullName: string;
  success: boolean;
  error?: string;
};
