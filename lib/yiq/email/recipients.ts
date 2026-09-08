/**
 * Correcting a wrong email address and sending the access codes again.
 *
 * THE PROBLEM (Director ruling, 2026-08-27). A teacher mistypes their email
 * at registration. The codes are queued, sent, and delivered to nobody. There
 * was no way to fix it: the resend machinery existed in queue.ts as a
 * `resendTag`, but nothing in the product ever called it, and nothing anywhere
 * could edit the address. A team could be locked out of the round by one typo
 * with no recovery path at all.
 *
 * The Director chose "the organiser can fix the email and resend" over a bare
 * resend button, for the obvious reason: resending to the same wrong address
 * fixes nothing, and a wrong address is the most likely cause of "the codes
 * never arrived".
 *
 * WHY THE CODES ARE NEVER SHOWN ON SCREEN. The third option was to let the
 * organiser read the codes out. That was rejected: emailing them exists
 * precisely so a whole school's access codes are not sitting on one screen.
 * Nothing in this path returns a code.
 *
 * PURE VALIDATION ONLY. No database, no auth, no sending — those live in
 * app/yiq/actions/email-codes.ts. Everything here is a decision worth
 * testing on its own.
 */

/** The recipient kinds an organiser may correct. */
export type RecipientKind = "teacher" | "student";

export type EmailChangeRefusal =
  | "empty"
  | "too_long"
  | "no_at"
  | "malformed"
  | "unchanged";

export type EmailChangeDecision =
  | { ok: true; email: string; changed: true }
  | { ok: false; reason: EmailChangeRefusal };

/**
 * The longest address worth accepting. RFC 5321 caps a path at 254
 * characters; anything longer is a paste accident, not an address.
 */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Deliberately simple, and deliberately NOT a clever regex.
 *
 * The only question that matters here is "could this plausibly be delivered".
 * A strict RFC 5322 pattern rejects real addresses that real schools use, and
 * the true test of an address is whether mail arrives — which no regex can
 * answer. So this rejects what is obviously unsendable and lets the mail
 * server judge the rest.
 */
function looksSendable(v: string): EmailChangeRefusal | null {
  if (v.length > MAX_EMAIL_LENGTH) return "too_long";

  const at = v.indexOf("@");
  if (at === -1) return "no_at";
  // Exactly one "@", something before it, something after it.
  if (v.indexOf("@", at + 1) !== -1) return "malformed";
  if (at === 0 || at === v.length - 1) return "malformed";

  const domain = v.slice(at + 1);
  // A domain needs a dot with something either side: "a@b" cannot be routed.
  const dot = domain.indexOf(".");
  if (dot <= 0 || dot === domain.length - 1) return "malformed";

  // Whitespace and angle brackets are the usual copy-paste damage
  // ("Name <a@b.com>", or a trailing newline from a spreadsheet cell).
  if (/[\s<>,;"\\]/.test(v)) return "malformed";

  return null;
}

/**
 * Validate a corrected address against the one already on file.
 *
 * Returns `unchanged` when the new address is the same as the old one — there
 * is no point burning a send on it, and an organiser who meant to resend
 * without editing should be told so plainly rather than silently doing
 * nothing.
 */
export function validateEmailChange(
  raw: unknown,
  current: string | null | undefined
): EmailChangeDecision {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };

  const v = raw.trim().toLowerCase();
  if (v === "") return { ok: false, reason: "empty" };

  const problem = looksSendable(v);
  if (problem) return { ok: false, reason: problem };

  if (v === (current ?? "").trim().toLowerCase()) {
    return { ok: false, reason: "unchanged" };
  }

  return { ok: true, email: v, changed: true };
}

/** Plain-English refusals for the organiser's screen. */
export const EMAIL_CHANGE_REFUSAL_TEXT: Record<EmailChangeRefusal, string> = {
  empty: "Type an email address first.",
  too_long: "That address is too long to be a real one — check for a stray paste.",
  no_at: "That does not look like an email address — it has no @ in it.",
  malformed:
    "That does not look like an email address. Check for spaces, a missing full stop in the domain, or a second @.",
  unchanged:
    "That is the address already on file. Change it first, or use resend if you only want to send it again.",
};

/**
 * A resend tag is what makes a second send actually send.
 *
 * `dedupe_key` on yiq.email_queue is UNIQUE and every enqueue is an upsert
 * that ignores duplicates, so re-queuing the same team produces NOTHING
 * without a fresh tag — which is exactly the behaviour that makes a
 * registration safe to retry, and exactly the behaviour that would make a
 * resend button appear to do nothing.
 *
 * The tag is derived from the moment of the resend, so each one is distinct
 * and the audit trail shows how many times a team was sent their codes.
 */
export function resendTagFor(atMs: number): string {
  return `resend-${Math.floor(atMs / 1000)}`;
}
