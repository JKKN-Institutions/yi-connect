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
  /**
   * Participants IN SCOPE — i.e. the ones currently shown on the Participants
   * tab. Equal to `eventTotal` when no filter is applied.
   */
  total: number;
  /** In-scope participants with a valid email address. */
  withEmail: number;
  /** Ordered by serialNo. */
  recipients: YipEmailRecipient[];
  /**
   * Everyone in the event, filter or no filter. Lets the dialog say plainly
   * "12 of the 30 students shown (of 200 in this event)" so an organiser can
   * never mistake a filtered send for an everyone send — or the reverse.
   */
  eventTotal: number;
  /** True when a filter is narrowing the send below the whole event. */
  filtered: boolean;
};

/** Per-participant outcome of one send batch. */
export type YipEmailBatchItemResult = {
  participantId: string;
  fullName: string;
  success: boolean;
  error?: string;
};
