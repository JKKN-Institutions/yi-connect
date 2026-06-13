/**
 * YIP access-code email distribution — shared types.
 *
 * Plain types module (NO "use server"): the server-action file
 * (app/yip/actions/email-codes.ts) may export ONLY async functions, so every
 * type it needs lives here. Mirrors lib/yip/whatsapp-codes-types.ts — the email
 * channel is the reliable alternative to the WhatsApp bridge (every Erode
 * participant has an email; the bridge's headless-Chrome session is flaky).
 */

/** One participant as shown in the "who will receive a code" preview. */
export type YipEmailRecipient = {
  participantId: string;
  serialNo: number | null;
  fullName: string;
  /** "ma****@gmail.com" style; null when the participant has no usable email. */
  emailMasked: string | null;
  /** True iff the participant has a syntactically valid, sendable email. */
  hasEmail: boolean;
};

/** The full send plan: counts + ordered recipient list for the confirm screen. */
export type YipEmailSendPlan = {
  /** All participants in the event. */
  total: number;
  /** Participants with a valid email address. */
  withEmail: number;
  /** Ordered by serialNo. */
  recipients: YipEmailRecipient[];
};

/** Per-participant outcome of one send batch. */
export type YipEmailBatchItemResult = {
  participantId: string;
  fullName: string;
  success: boolean;
  error?: string;
};
