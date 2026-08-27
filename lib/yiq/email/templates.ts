/**
 * YIQ access-code emails — pure render functions, zero server dependencies.
 *
 * Two templates, both returning { subject, html, text }:
 *   renderTeacherCodesEmail — ONE email to the registering teacher with the
 *     whole team's codes, so the codes are recoverable after the one-time
 *     confirmation screen is closed.
 *   renderStudentCodeEmail — one line to each student who supplied an email,
 *     carrying ONLY that student's own code.
 *
 * Why the split matters: a student's score counts individually towards the
 * team total, so a code is a personal credential. renderStudentCodeEmail is
 * NEVER given the other members' codes — its input type has no field that
 * could carry one. That is enforced by the type, not by discipline.
 *
 * VOICE: written for a schoolteacher and a 14-year-old. No marketing words,
 * no exclamation marks, no hedging. Say what the code is, that it is theirs
 * alone, and when the round opens.
 *
 * Plain lib/ module (NOT "use server") so non-async exports are legal, and so
 * both the enqueue path and the cron drain render through this ONE file. The
 * drain re-renders from live rows at send time — duplicating a template in
 * two places is how a re-issued code gets delivered stale.
 */

// ── Brand + destinations ──────────────────────────────────────────────────
// Literal hex: the per-vertical globals.css files in this repo are imported
// nowhere, so brand CSS tokens are dead. lib/yiq/constants.ts carries the
// same values, but this module stays dependency-free so the check script can
// run it in isolation.
const NAVY = "#0B1B3A";
const SAFFRON = "#F0A03C";
const INK = "#101828";

export const YIQ_LOGIN_URL = "https://yi-connect-app.vercel.app/yiq/login";

export type YiqRenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type YiqCategoryLabel = "junior" | "senior";

/** One member as shown to the TEACHER. Only the teacher email uses this. */
export type YiqTeamMemberLine = {
  fullName: string;
  classLevel: number;
  /** Null when the student has no email of their own — the teacher hands it over. */
  email?: string | null;
  accessCode: string;
};

export type YiqTeacherCodesInput = {
  teacherName: string;
  teamName: string;
  teamCode: string;
  schoolName: string;
  chapterName: string;
  category: YiqCategoryLabel;
  /** ISO timestamp for when the online round opens; null when not yet set. */
  roundOpensAt?: string | null;
  members: YiqTeamMemberLine[];
};

/**
 * A student's own email. Note what is ABSENT: there is no member list and no
 * second access code. The shape is the guarantee.
 */
export type YiqStudentCodeInput = {
  studentName: string;
  accessCode: string;
  classLevel: number;
  teamName: string;
  /** The shared team code — not a credential, printed on the team's slip. */
  teamCode: string;
  schoolName: string;
  chapterName: string;
  category: YiqCategoryLabel;
  roundOpensAt?: string | null;
};

// ── Helpers (pure) ────────────────────────────────────────────────────────

/**
 * Escape for HTML text nodes and double-quoted attributes. A real school name
 * WILL contain "&" (e.g. "St. Mary's Boys' & Girls' Hr. Sec. School"), and an
 * unescaped one breaks the message body.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same rule the registration validator uses. Null/blank is simply "no email". */
export function isValidYiqEmail(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

export function categoryWords(category: YiqCategoryLabel): string {
  return category === "junior"
    ? "Junior (Classes 9 and 10)"
    : "Senior (Classes 11 and 12)";
}

/**
 * "12 September 2026" in IST. Returns null for a missing or unparseable
 * timestamp so callers fall back to the vaguer sentence rather than printing
 * "Invalid Date" to a schoolteacher.
 */
export function formatRoundDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(ms));
}

/** One sentence about the online round, with or without a known date. */
function roundSentence(roundOpensAt: string | null | undefined): string {
  const date = formatRoundDate(roundOpensAt);
  return date
    ? `The online round opens on ${date}.`
    : "Your chapter will confirm the date of the online round.";
}

function classWord(classLevel: number): string {
  return `Class ${classLevel}`;
}

/** Shared branded shell. Inline styles only — email clients strip <style>. */
function shell(preheaderText: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
    preheaderText
  )}</div>
  <div style="max-width:600px;margin:0 auto;padding:24px 12px">
    <div style="background:${NAVY};border-radius:8px 8px 0 0;padding:20px 28px;border-bottom:4px solid ${SAFFRON}">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px">YIQ</span>
      <span style="color:#9fb0d4;font-size:13px;font-weight:normal"> &middot; Young Indians Quiz</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 8px 8px;padding:28px;line-height:1.6;color:${INK};font-size:15px">
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8a93a3;font-size:12px;margin:18px 0 0">Young Indians &middot; CII</p>
  </div>
</body>
</html>`;
}

function codeBox(code: string): string {
  return `<div style="background:#fdf6ec;border:1px solid #f3d9b0;border-radius:8px;padding:18px 24px;margin:20px 0;text-align:center"><span style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:${NAVY}">${escapeHtml(
    code
  )}</span></div>`;
}

// ── Template 1: the registering teacher's full list ───────────────────────

export function renderTeacherCodesEmail(
  input: YiqTeacherCodesInput
): YiqRenderedEmail {
  const subject = `YIQ access codes for ${input.teamName} — ${input.schoolName}`;
  const round = roundSentence(input.roundOpensAt);
  const members = input.members ?? [];

  const textRows = members
    .map(
      (m) =>
        `  ${m.fullName} (${classWord(m.classLevel)}) — ${m.accessCode}${
          isValidYiqEmail(m.email) ? "  [emailed to them]" : ""
        }`
    )
    .join("\n");

  const text = `Young Indians Quiz 2026-27
${input.chapterName} Chapter

Dear ${input.teacherName},

${input.teamName} from ${input.schoolName} is registered for the Young Indians Quiz, in the ${categoryWords(
    input.category
  )} category.

Team code: ${input.teamCode}

Each student has their own access code. They sign in with it and answer the paper on their own device. Every student's score counts towards the team total, so all of them need to sit the round.

ACCESS CODES
${textRows || "  (no members recorded on this team)"}

Give each student only their own code. Students with an email address have also been sent their code directly.

Sign in: ${YIQ_LOGIN_URL}

${round}

Keep this email. The codes are not shown on screen again.

Young Indians · CII`;

  const rowsHtml =
    members.length > 0
      ? members
          .map(
            (m) => `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e7ebf0">${escapeHtml(
              m.fullName
            )}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e7ebf0;color:#6b7280;white-space:nowrap">${escapeHtml(
              classWord(m.classLevel)
            )}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e7ebf0;font-family:'Courier New',Courier,monospace;font-weight:bold;letter-spacing:2px;color:${NAVY};white-space:nowrap">${escapeHtml(
              m.accessCode
            )}</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:10px 12px;color:#6b7280">No members recorded on this team.</td></tr>`;

  const html = shell(
    `Access codes for ${input.teamName}`,
    `<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${escapeHtml(
      input.chapterName
    )} Chapter &middot; ${escapeHtml(categoryWords(input.category))}</p>
      <h2 style="margin:0 0 16px;color:${NAVY};font-size:20px">Dear ${escapeHtml(
        input.teacherName
      )},</h2>
      <p style="margin:0 0 14px">${escapeHtml(
        input.teamName
      )} from ${escapeHtml(
        input.schoolName
      )} is registered for the Young Indians Quiz.</p>
      <p style="margin:0 0 6px;color:#6b7280;font-size:13px">Team code</p>
      ${codeBox(input.teamCode)}
      <p style="margin:0 0 16px">Each student has their own access code. They sign in with it and answer the paper on their own device. Every student's score counts towards the team total, so all of them need to sit the round.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px">
        <thead>
          <tr>
            <th align="left" style="padding:8px 12px;background:#f4f6f9;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.6px">Student</th>
            <th align="left" style="padding:8px 12px;background:#f4f6f9;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.6px">Class</th>
            <th align="left" style="padding:8px 12px;background:#f4f6f9;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.6px">Access code</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin:0 0 16px">Give each student only their own code. Students with an email address have also been sent their code directly.</p>
      <p style="margin:0 0 8px"><a href="${YIQ_LOGIN_URL}" style="display:inline-block;background:${NAVY};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Sign in to YIQ</a></p>
      <p style="margin:0 0 18px;color:#6b7280;font-size:13px">Or open <a href="${YIQ_LOGIN_URL}" style="color:${NAVY}">${YIQ_LOGIN_URL}</a></p>
      <p style="margin:0 0 14px">${escapeHtml(round)}</p>
      <p style="margin:0;color:#6b7280;font-size:13px">Keep this email. The codes are not shown on screen again.</p>`
  );

  return { subject, html, text };
}

// ── Template 2: one student, one code ─────────────────────────────────────

export function renderStudentCodeEmail(
  input: YiqStudentCodeInput
): YiqRenderedEmail {
  const subject = `Your YIQ access code — ${input.teamName}`;
  const round = roundSentence(input.roundOpensAt);

  const text = `Young Indians Quiz 2026-27
${input.chapterName} Chapter

Hi ${input.studentName},

You are registered for the Young Indians Quiz with ${input.teamName} from ${
    input.schoolName
  }, in the ${categoryWords(input.category)} category.

Your access code is: ${input.accessCode}

Sign in with it at ${YIQ_LOGIN_URL} and answer the paper on your own device. ${round}

This code is yours alone. Every student in your team has a different one, and your answers count towards your team's total. Do not share your code with anyone, including your teammates.

Your team code is ${input.teamCode}. That one is shared — your teacher has it. It does not sign you in.

Young Indians · CII`;

  const html = shell(
    `Your access code for ${input.teamName}`,
    `<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${escapeHtml(
      input.chapterName
    )} Chapter &middot; ${escapeHtml(categoryWords(input.category))}</p>
      <h2 style="margin:0 0 16px;color:${NAVY};font-size:20px">Hi ${escapeHtml(
        input.studentName
      )},</h2>
      <p style="margin:0 0 14px">You are registered for the Young Indians Quiz with ${escapeHtml(
        input.teamName
      )} from ${escapeHtml(input.schoolName)}.</p>
      <p style="margin:0 0 6px;color:#6b7280;font-size:13px">Your access code</p>
      ${codeBox(input.accessCode)}
      <p style="margin:0 0 8px"><a href="${YIQ_LOGIN_URL}" style="display:inline-block;background:${NAVY};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Sign in to YIQ</a></p>
      <p style="margin:0 0 18px;color:#6b7280;font-size:13px">Or open <a href="${YIQ_LOGIN_URL}" style="color:${NAVY}">${YIQ_LOGIN_URL}</a> and type your code.</p>
      <p style="margin:0 0 16px">${escapeHtml(round)}</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:0 0 16px">
        <p style="margin:0;color:#b91c1c;font-size:13px;font-weight:600">This code is yours alone. Every student in your team has a different one, and your answers count towards your team&#39;s total. Do not share your code with anyone, including your teammates.</p>
      </div>
      <p style="margin:0;color:#6b7280;font-size:13px">Your team code is ${escapeHtml(
        input.teamCode
      )}. That one is shared &mdash; your teacher has it. It does not sign you in.</p>`
  );

  return { subject, html, text };
}
