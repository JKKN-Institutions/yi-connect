/**
 * Online House Formation — email types + pure render helpers.
 *
 * Plain module (NO "use server"): the server-action file
 * (app/yip/actions/formation-emails.ts) may export ONLY async functions, so
 * every type it needs lives here — mirroring lib/yip/email-codes-types.ts.
 *
 * The email RENDERERS also live here (pure functions, zero server deps)
 * because the cron drain (app/yip/api/cron/formation-drain-emails/route.ts)
 * must re-render the exact same email from the participant row at send time —
 * access codes are NEVER stored in the yip.formation_emails log, so both the
 * action and the cron rebuild the message from live data through this one
 * template. Duplicating the template in two files would drift.
 */

// ─── Types ─────────────────────────────────────────────────────────

/** Matches the yip.formation_emails `kind` check constraint. */
export type FormationEmailKind = "invite" | "reminder" | "reissue";

/** One participant as shown in the "who will receive an invite" preview. */
export type FormationEmailRecipient = {
  participantId: string;
  serialNo: number | null;
  fullName: string;
  /** "ma****@gmail.com" style; null when the participant has no usable email. */
  emailMasked: string | null;
  /** True iff the participant has a valid email AND an access code on file. */
  hasEmail: boolean;
};

/** The full invite plan: counts + ordered recipient list for the confirm screen. */
export type FormationEmailSendPlan = {
  /** All participants in the event. */
  total: number;
  /** Participants with a valid email address + access code. */
  withEmail: number;
  /** Ordered by serialNo. */
  recipients: FormationEmailRecipient[];
};

/** Per-participant outcome of one send batch. */
export type FormationEmailBatchItemResult = {
  participantId: string;
  fullName: string;
  success: boolean;
  error?: string;
};

/**
 * Result of the pre-flight quota check every formation send action runs
 * before touching Resend. Exists because a Resend monthly-quota outage in
 * July 2026 silently killed all Yi-Future email — sends must REFUSE up
 * front, loudly, instead of failing one by one.
 */
export type FormationQuotaCheck = {
  ok: boolean;
  reason?: string;
  plannedCount: number;
  sentToday: number;
  dailyCap: number;
};

// ─── Shared constants ──────────────────────────────────────────────

/** Participant deep-link login route (Lane D): /yip/f/{ACCESS_CODE}. */
export const FORMATION_DEEP_LINK_BASE =
  "https://yi-connect-app.vercel.app/yip/f";

/** Fallback type-the-code login page. */
export const FORMATION_JOIN_URL = "https://yi-connect-app.vercel.app/yip/join";

// ─── Small pure helpers (shared by action file + cron) ─────────────

/**
 * Pragmatic email check — not RFC-perfect, just "has a local part, an @, and
 * a dotted domain" (the email-codes.ts rule) so blanks/garbage are skipped
 * before handing to Resend.
 */
export function isValidFormationEmail(
  raw: string | null | undefined
): raw is string {
  if (!raw) return false;
  const e = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

/** Mask to "ma****@domain" for previews. Null when there's no usable email. */
export function maskFormationEmail(
  raw: string | null | undefined
): string | null {
  if (!isValidFormationEmail(raw)) return null;
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

/** "12 Aug 2026, 5:30 pm IST" — deadlines are always shown in event-local IST. */
function formatDeadlineIST(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

// ─── Email renderer ────────────────────────────────────────────────

export type FormationEmailInput = {
  kind: FormationEmailKind;
  fullName: string;
  accessCode: string;
  eventName: string;
  /** ISO timestamp the current ballot window closes (reminders). */
  deadline?: string | null;
};

/**
 * YIP-branded formation email (inline styles only — email clients strip
 * <style>). Mirrors renderCodeEmail in app/yip/actions/email-codes.ts:
 * saffron header band, green accent rule, big code box, CTA, do-not-share
 * warning. The CTA deep-links to /yip/f/{code} so one tap lands the student
 * on their ballot; the plain code + join URL are the fallback path.
 */
export function renderFormationEmail(input: FormationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(input.fullName);
  const code = escapeHtml(input.accessCode);
  const eventName = escapeHtml(input.eventName);
  const deepLink = `${FORMATION_DEEP_LINK_BASE}/${encodeURIComponent(
    input.accessCode
  )}`;
  const deadlineText = input.deadline ? formatDeadlineIST(input.deadline) : "";

  let subject: string;
  let introText: string;
  let ctaLabel: string;
  switch (input.kind) {
    case "reminder":
      subject = `Reminder: cast your vote — ${input.eventName}`;
      introText =
        "Voting is OPEN in your Parliament's Online House Formation and your ballot has not been cast yet. Use your personal code below to sign in and vote." +
        (deadlineText ? ` Voting closes at ${deadlineText}.` : "");
      ctaLabel = "Cast my vote";
      break;
    case "reissue":
      subject = `Your new YIP login code — ${input.eventName}`;
      introText =
        "Your Young Indians Parliament login code has been re-issued. Your OLD code no longer works — use the new code below from now on.";
      ctaLabel = "Sign in to YIP";
      break;
    case "invite":
    default:
      subject = `Your Young Indians Parliament voting link — ${input.eventName}`;
      introText =
        "Your Parliament's Online House Formation is starting: before the event, you will vote online for the Speaker and other leadership positions. Use your personal code below to sign in and cast your votes when each ballot opens.";
      ctaLabel = "Open my ballot";
      break;
  }

  const text = `Young Indians Parliament 2026
${input.eventName}

Hi ${input.fullName},

${introText}

Your YIP login code is: ${input.accessCode}

One-tap sign-in: ${deepLink}
Or open ${FORMATION_JOIN_URL} and enter your code.

IMPORTANT: This code is yours alone. Do NOT share it with anyone — not classmates, friends or family. Anyone who has your code can sign in and vote as you.

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
      <p style="margin:0 0 8px">${escapeHtml(introText)}</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:18px 24px;margin:20px 0;text-align:center">
        <span style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#c2410c">${code}</span>
      </div>
      <p style="margin:28px 0 8px"><a href="${deepLink}" style="display:inline-block;background:#138808;color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">${escapeHtml(ctaLabel)}</a></p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px">Or open <a href="${FORMATION_JOIN_URL}" style="color:#138808">${FORMATION_JOIN_URL}</a> and enter your code.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:0 0 4px">
        <p style="margin:0;color:#b91c1c;font-size:13px;font-weight:600">Do NOT share this code with anyone — not classmates, friends or family. Anyone who has your code can sign in and vote as you.</p>
      </div>
      <p style="margin:12px 0 0;color:#9ca3af;font-size:12px">If you did not expect this email, you can ignore it.</p>
    </div>
    <p style="text-align:center;color:#8a93a3;font-size:12px;margin:18px 0 0">Young Indians &middot; CII</p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
