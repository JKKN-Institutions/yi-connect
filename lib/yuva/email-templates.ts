/**
 * Yi Youth Academy email templates — Phase 2 STUBS for the 8 trigger types
 * (spec → Third-Party Services / Resend). Later phases flesh these out with
 * full branded HTML; the shapes (inputs → { subject, html, text }) are the
 * contract the actions code in Phases 7–14 builds against.
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

/** Minimal shared shell — branded layout lands in a later phase. */
function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px"><h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>${bodyHtml}<p style="margin-top:32px;color:#666;font-size:13px">Yi Youth Academy · Young Indians</p></body></html>`;
}

export function applicationConfirmationEmail(input: {
  studentName: string;
  programName: string;
  statusUrl: string;
}): RenderedEmail {
  const subject = `Application received — ${input.programName}`;
  const text = `Hi ${input.studentName},\n\nWe received your application for ${input.programName}. Track its status here: ${input.statusUrl}\n\nYi Youth Academy`;
  const html = shell(
    "Application received",
    `<p>Hi ${escapeHtml(input.studentName)},</p><p>We received your application for <strong>${escapeHtml(input.programName)}</strong>.</p><p><a href="${input.statusUrl}">Track your application status</a></p>`
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
  const text = `Hi ${input.studentName},\n\nCongratulations! You have been accepted into ${input.programName}.${summaryText}\nYour access code: ${input.accessCode}\nLog in: ${input.loginUrl}\n\nYi Youth Academy`;
  const summaryHtml = input.scheduleSummary
    ? `<p style="color:#444">${escapeHtml(input.scheduleSummary)}</p>`
    : "";
  const html = shell(
    "You're accepted!",
    `<p>Hi ${escapeHtml(input.studentName)},</p><p>Congratulations! You have been accepted into <strong>${escapeHtml(input.programName)}</strong>.</p>${summaryHtml}<p>Your access code: <strong style="font-size:18px;letter-spacing:2px">${escapeHtml(input.accessCode)}</strong></p><p><a href="${input.loginUrl}">Log in to your student portal</a></p>`
  );
  return { subject, html, text };
}

export function rejectionEmail(input: {
  studentName: string;
  programName: string;
}): RenderedEmail {
  const subject = `Update on your application — ${input.programName}`;
  const text = `Hi ${input.studentName},\n\nThank you for applying to ${input.programName}. We are unable to offer you a seat in this cohort. We encourage you to apply to future programs.\n\nYi Youth Academy`;
  const html = shell(
    "Application update",
    `<p>Hi ${escapeHtml(input.studentName)},</p><p>Thank you for applying to <strong>${escapeHtml(input.programName)}</strong>. We are unable to offer you a seat in this cohort.</p><p>We encourage you to apply to future programs.</p>`
  );
  return { subject, html, text };
}

export function otpEmail(input: { code: string }): RenderedEmail {
  const subject = "Your Yi Youth Academy login code";
  const text = `Your one-time login code is: ${input.code}\n\nIt expires shortly. If you did not request this, ignore this email.\n\nYi Youth Academy`;
  const html = shell(
    "Your login code",
    `<p>Your one-time login code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${escapeHtml(input.code)}</p><p>It expires shortly. If you did not request this, ignore this email.</p>`
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
  const text = `Hi ${input.studentName},\n\nYour certificate (${input.certificateNo}) for ${input.programName} has been issued.\nDownload: ${input.downloadUrl}\n\nYi Youth Academy`;
  const html = shell(
    "Certificate issued",
    `<p>Hi ${escapeHtml(input.studentName)},</p><p>Your certificate (<strong>${escapeHtml(input.certificateNo)}</strong>) for <strong>${escapeHtml(input.programName)}</strong> has been issued.</p><p><a href="${input.downloadUrl}">Download your certificate</a></p>`
  );
  return { subject, html, text };
}

export function scheduleChangeEmail(input: {
  programName: string;
  sessionName: string;
  changeSummary: string;
}): RenderedEmail {
  const subject = `Schedule update — ${input.programName}`;
  const text = `A session in ${input.programName} has changed.\n\n${input.sessionName}: ${input.changeSummary}\n\nYi Youth Academy`;
  const html = shell(
    "Schedule update",
    `<p>A session in <strong>${escapeHtml(input.programName)}</strong> has changed.</p><p><strong>${escapeHtml(input.sessionName)}</strong>: ${escapeHtml(input.changeSummary)}</p>`
  );
  return { subject, html, text };
}

export function mentorInviteEmail(input: {
  mentorName: string;
  chapter: string;
  portalUrl: string;
}): RenderedEmail {
  const subject = `Join the Mentor YUVA Network — Yi ${input.chapter}`;
  const text = `Hi ${input.mentorName},\n\nYi ${input.chapter} has invited you to the Mentor YUVA Network on Yi Youth Academy.\nGet started: ${input.portalUrl}\n\nYi Youth Academy`;
  const html = shell(
    "Mentor invitation",
    `<p>Hi ${escapeHtml(input.mentorName)},</p><p>Yi <strong>${escapeHtml(input.chapter)}</strong> has invited you to the Mentor YUVA Network on Yi Youth Academy.</p><p><a href="${input.portalUrl}">Get started</a></p>`
  );
  return { subject, html, text };
}

export function coordinatorInviteEmail(input: {
  coordinatorName: string;
  academyName: string;
  portalUrl: string;
}): RenderedEmail {
  const subject = `You're the coordinator for ${input.academyName}`;
  const text = `Hi ${input.coordinatorName},\n\nYou have been assigned as the institution coordinator for ${input.academyName} on Yi Youth Academy.\nGet started: ${input.portalUrl}\n\nYi Youth Academy`;
  const html = shell(
    "Coordinator assignment",
    `<p>Hi ${escapeHtml(input.coordinatorName)},</p><p>You have been assigned as the institution coordinator for <strong>${escapeHtml(input.academyName)}</strong> on Yi Youth Academy.</p><p><a href="${input.portalUrl}">Get started</a></p>`
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
};
