/**
 * Yi Youth Academy email templates — real branded HTML for the 8 trigger
 * types (spec → Third-Party Services / Resend). Phase 16 replaces the
 * Phase 2 stub bodies; the shapes (inputs → { subject, html, text }) are
 * UNCHANGED — the actions code in Phases 7–14 builds against them.
 *
 * Branding: navy (#0f2557) header band "Yi Youth Academy · Yi YUVA",
 * button-style CTAs, footer "Young Indians · CII". Inline styles only
 * (email clients strip <style> blocks).
 *
 * Plain lib/ module — NO "use server" (non-async exports).
 */
import type { YuvaEmailType } from "@/lib/yuva/email";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAVY = "#0f2557";

/** Button-style CTA link. */
function cta(href: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:${NAVY};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">${escapeHtml(label)}</a></p>`;
}

/** Big code box (access code / OTP). */
function codeBox(code: string): string {
  return `<div style="background:#f1f5f9;border:1px solid #dbe2ea;border-radius:8px;padding:18px 24px;margin:20px 0;text-align:center"><span style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:bold;letter-spacing:6px;color:${NAVY}">${escapeHtml(code)}</span></div>`;
}

/**
 * Branded shared shell: navy header band, white body card, Yi/CII footer.
 */
function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px">
    <div style="background:${NAVY};border-radius:8px 8px 0 0;padding:20px 28px">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px">Yi Youth Academy</span>
      <span style="color:#9fb2d8;font-size:13px;font-weight:normal"> &middot; Yi YUVA</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px;line-height:1.6;color:#1f2a3d;font-size:15px">
      <h2 style="margin:0 0 16px;color:${NAVY};font-size:20px">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8a93a3;font-size:12px;margin:18px 0 0">Young Indians &middot; CII</p>
  </div>
</body>
</html>`;
}

export function applicationConfirmationEmail(input: {
  studentName: string;
  programName: string;
  statusUrl: string;
}): RenderedEmail {
  const subject = `Application received — ${input.programName}`;
  const text = `Hi ${input.studentName},\n\nWe received your application for ${input.programName}. Your chapter team will review it and you will hear from us by email once a decision is made.\n\nTrack your application status anytime: ${input.statusUrl}\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Application received",
    `<p>Hi ${escapeHtml(input.studentName)},</p>
<p>We received your application for <strong>${escapeHtml(input.programName)}</strong>. Your chapter team will review it, and you will hear from us by email once a decision is made.</p>
${cta(input.statusUrl, "Track your application status")}
<p style="color:#5b6575;font-size:13px">Keep this email — the link above is your personal status page.</p>`
  );
  return { subject, html, text };
}

export function acceptanceEmail(input: {
  studentName: string;
  programName: string;
  accessCode: string;
  loginUrl: string;
  /** Optional one-line program/schedule summary (academy · dates · sessions). */
  scheduleSummary?: string;
}): RenderedEmail {
  const subject = `You're in — ${input.programName}`;
  const summaryText = input.scheduleSummary
    ? `\n${input.scheduleSummary}\n`
    : "";
  const text = `Hi ${input.studentName},\n\nCongratulations! You have been accepted into ${input.programName}.${summaryText}\nYour access code: ${input.accessCode}\n\nUse it to log in to your student portal: ${input.loginUrl}\n\nKeep this code private — it is your key to the portal. If you ever lose it, you can recover access with your email on the login page.\n\nYi Youth Academy\nYoung Indians · CII`;
  const summaryHtml = input.scheduleSummary
    ? `<p style="background:#f6f8fb;border-left:3px solid ${NAVY};padding:10px 14px;color:#3c4657;margin:16px 0">${escapeHtml(input.scheduleSummary)}</p>`
    : "";
  const html = shell(
    "You're accepted!",
    `<p>Hi ${escapeHtml(input.studentName)},</p>
<p>Congratulations! You have been accepted into <strong>${escapeHtml(input.programName)}</strong>.</p>
${summaryHtml}
<p style="margin-bottom:6px">Your access code:</p>
${codeBox(input.accessCode)}
${cta(input.loginUrl, "Log in to your student portal")}
<p style="color:#5b6575;font-size:13px">Keep this code private — it is your key to the portal. If you ever lose it, you can recover access with your email on the login page.</p>`
  );
  return { subject, html, text };
}

export function rejectionEmail(input: {
  studentName: string;
  programName: string;
}): RenderedEmail {
  const subject = `Update on your application — ${input.programName}`;
  const text = `Hi ${input.studentName},\n\nThank you for applying to ${input.programName}. Seats in each cohort are limited, and we are unable to offer you a place this time.\n\nThis is not a reflection of your potential — we would be glad to see you apply for a future program, and we hope you do.\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Application update",
    `<p>Hi ${escapeHtml(input.studentName)},</p>
<p>Thank you for applying to <strong>${escapeHtml(input.programName)}</strong>. Seats in each cohort are limited, and we are unable to offer you a place this time.</p>
<p>This is not a reflection of your potential — we would be glad to see you apply for a future program, and we hope you do.</p>`
  );
  return { subject, html, text };
}

export function otpEmail(input: { code: string }): RenderedEmail {
  const subject = "Your Yi Youth Academy login code";
  const text = `Your one-time login code is: ${input.code}\n\nIt is valid for 10 minutes. If you did not request this code, you can safely ignore this email.\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Your login code",
    `<p>Use this one-time code to log in to your Yi Youth Academy student portal:</p>
${codeBox(input.code)}
<p>It is valid for <strong>10 minutes</strong>.</p>
<p style="color:#5b6575;font-size:13px">If you did not request this code, you can safely ignore this email — no one can log in without it.</p>`
  );
  return { subject, html, text };
}

export function certificateEmail(input: {
  studentName: string;
  programName: string;
  certificateNo: string;
  downloadUrl: string;
}): RenderedEmail {
  const subject = `Your certificate — ${input.programName}`;
  const text = `Hi ${input.studentName},\n\nCongratulations on completing ${input.programName}! Your certificate (${input.certificateNo}) has been issued.\n\nDownload it from your student portal: ${input.downloadUrl}\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Certificate issued",
    `<p>Hi ${escapeHtml(input.studentName)},</p>
<p>Congratulations on completing <strong>${escapeHtml(input.programName)}</strong>! Your certificate has been issued.</p>
<p>Certificate number: <strong>${escapeHtml(input.certificateNo)}</strong></p>
${cta(input.downloadUrl, "Download your certificate")}
<p style="color:#5b6575;font-size:13px">Your certificate stays available in your student portal whenever you need it.</p>`
  );
  return { subject, html, text };
}

export function scheduleChangeEmail(input: {
  programName: string;
  sessionName: string;
  changeSummary: string;
}): RenderedEmail {
  const subject = `Schedule update — ${input.programName}`;
  const text = `A session in ${input.programName} has changed.\n\n${input.sessionName}: ${input.changeSummary}\n\nPlease check your student portal for the latest schedule.\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Schedule update",
    `<p>A session in <strong>${escapeHtml(input.programName)}</strong> has changed:</p>
<p style="background:#f6f8fb;border-left:3px solid ${NAVY};padding:10px 14px;margin:16px 0"><strong>${escapeHtml(input.sessionName)}</strong><br>${escapeHtml(input.changeSummary)}</p>
<p>Please check your student portal for the latest schedule.</p>`
  );
  return { subject, html, text };
}

export function mentorInviteEmail(input: {
  mentorName: string;
  chapter: string;
  portalUrl: string;
}): RenderedEmail {
  const subject = `Join the Mentor YUVA Network — Yi ${input.chapter}`;
  const text = `Hi ${input.mentorName},\n\nYi ${input.chapter} has invited you to join the Mentor YUVA Network on Yi Youth Academy.\n\nThe Mentor YUVA Network is the chapter's circle of professionals and leaders who deliver guest sessions and guide students through Yi Youth Academy programs — sharing real-world experience with the next generation.\n\nGet started: ${input.portalUrl}\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Mentor invitation",
    `<p>Hi ${escapeHtml(input.mentorName)},</p>
<p>Yi <strong>${escapeHtml(input.chapter)}</strong> has invited you to join the <strong>Mentor YUVA Network</strong> on Yi Youth Academy.</p>
<p>The Mentor YUVA Network is the chapter's circle of professionals and leaders who deliver guest sessions and guide students through Yi Youth Academy programs — sharing real-world experience with the next generation.</p>
${cta(input.portalUrl, "Log in to get started")}`
  );
  return { subject, html, text };
}

export function coordinatorInviteEmail(input: {
  coordinatorName: string;
  academyName: string;
  portalUrl: string;
}): RenderedEmail {
  const subject = `You're the coordinator for ${input.academyName}`;
  const text = `Hi ${input.coordinatorName},\n\nYou have been assigned as the institution coordinator for ${input.academyName} on Yi Youth Academy. As coordinator, you are the academy's point of contact — you can follow its programs, cohorts and sessions from your portal.\n\nGet started: ${input.portalUrl}\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Coordinator assignment",
    `<p>Hi ${escapeHtml(input.coordinatorName)},</p>
<p>You have been assigned as the institution coordinator for <strong>${escapeHtml(input.academyName)}</strong> on Yi Youth Academy.</p>
<p>As coordinator, you are the academy's point of contact — you can follow its programs, cohorts and sessions from your portal.</p>
${cta(input.portalUrl, "Log in to get started")}`
  );
  return { subject, html, text };
}

export function runCancelledEmail(input: {
  studentName: string;
  programName: string;
  academyName: string;
}): RenderedEmail {
  const subject = `Programme cancelled — ${input.programName}`;
  const text = `Hi ${input.studentName},\n\nWe're sorry to let you know that ${input.programName} at ${input.academyName} has been cancelled, and the cohort will not continue.\n\nWe know this is disappointing, and we're sorry for the change. Your place and your records remain with us, and we would be glad to welcome you to a future Yi Youth Academy programme.\n\nThank you for your understanding.\n\nYi Youth Academy\nYoung Indians · CII`;
  const html = shell(
    "Programme cancelled",
    `<p>Hi ${escapeHtml(input.studentName)},</p>
<p>We're sorry to let you know that <strong>${escapeHtml(input.programName)}</strong> at <strong>${escapeHtml(input.academyName)}</strong> has been cancelled, and the cohort will not continue.</p>
<p>We know this is disappointing, and we're sorry for the change. Your place and your records remain with us, and we would be glad to welcome you to a future Yi Youth Academy programme.</p>
<p style="color:#5b6575;font-size:13px">Thank you for your understanding.</p>`
  );
  return { subject, html, text };
}

/** Compile-time completeness check: one template per trigger type. */
export const TEMPLATE_BY_TYPE: Record<YuvaEmailType, (...args: never[]) => RenderedEmail> = {
  application_confirmation: applicationConfirmationEmail,
  acceptance: acceptanceEmail,
  rejection: rejectionEmail,
  otp: otpEmail,
  certificate: certificateEmail,
  schedule_change: scheduleChangeEmail,
  mentor_invite: mentorInviteEmail,
  coordinator_invite: coordinatorInviteEmail,
  run_cancelled: runCancelledEmail,
};
