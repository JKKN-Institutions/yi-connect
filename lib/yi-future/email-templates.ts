/**
 * Email templates for Future 6.0's 6 PRD §8 triggers.
 *
 * Each function returns { subject, body } where body is plain-text / light
 * markdown. Callers pass these directly to sendEmail().
 *
 * Bodies are kept under 120 words. Sign-off is consistent across all.
 */

const SIGN_OFF = "\n\n— Future 6.0 by Yi YUVA · CII";
const BASE_URL = "https://yifuture-platform.vercel.app";

// ─── 1. Registration confirmed ───────────────────────────────────────────────

export function tplRegistrationConfirmed(d: {
  name: string;
  access_code: string;
  chapter: string;
}): { subject: string; body: string } {
  return {
    subject: "You're registered for Future 6.0 — your access code inside",
    body: `Hi ${d.name}, welcome to Yi YUVA Future 6.0 — your journey with ${d.chapter} starts now.

Your personal access code is **${d.access_code}** — keep it safe, you'll need it every time you sign in.

**[Sign in and get started](${BASE_URL}/join)**

Next steps: join or form a team of 3–5 delegates, pick a problem statement with your captain, and kick off your 90-day policy & solutions journey.${SIGN_OFF}`,
  };
}

// ─── 2. Team invite ──────────────────────────────────────────────────────────

export function tplTeamInvite(d: {
  recipient_name: string;
  team_name: string;
  from_name: string;
}): { subject: string; body: string } {
  return {
    subject: `You've been invited to join "${d.team_name}" — Future 6.0`,
    body: `Hi ${d.recipient_name}, ${d.from_name} has invited you to join team **${d.team_name}** for Future 6.0.

Teams are 3–5 delegates and you can only be in one team per edition — so make sure this is the right fit.

**[Sign in to accept](${BASE_URL}/join)** → My Team → Accept Invite.${SIGN_OFF}`,
  };
}

// ─── 3. Problem allocated ────────────────────────────────────────────────────

export function tplProblemAllocated(d: {
  team_name: string;
  problem_title: string;
  problem_description: string;
}): { subject: string; body: string } {
  const descLine = d.problem_description
    ? `\n\n${d.problem_description}`
    : "";
  return {
    subject: `Your team has been allocated: ${d.problem_title}`,
    body: `Your team **${d.team_name}** has been allocated a problem statement for Future 6.0.

**Problem:** ${d.problem_title}${descLine}

Your 90-day journey begins now. Phase A deliverable is due at the end of Month 1.

**[View your brief and start submitting](${BASE_URL}/me)**${SIGN_OFF}`,
  };
}

// ─── 4. Session reminder ─────────────────────────────────────────────────────

export function tplSessionReminder(d: {
  team_name: string;
  session_name: string;
  date_iso: string;
  venue?: string;
}): { subject: string; body: string } {
  const dateStr = new Date(d.date_iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  const venueLine = d.venue ? `\n**Where:** ${d.venue}` : "";

  return {
    subject: `Reminder: ${d.session_name} — Future 6.0`,
    body: `This is a heads-up for your team **${d.team_name}** — you have an upcoming Future 6.0 session tomorrow.

**Session:** ${d.session_name}
**When:** ${dateStr} IST${venueLine}

Please attend on time. If you can't make it, let your mentor or chapter coordinator know in advance.

**[View your schedule](${BASE_URL}/me)**${SIGN_OFF}`,
  };
}

// ─── 5. Threshold achieved ───────────────────────────────────────────────────

export function tplThresholdAchieved(d: {
  team_name: string;
  score: number;
  chapter: string;
}): { subject: string; body: string } {
  return {
    subject: `${d.team_name} crossed the qualifying threshold — Future 6.0`,
    body: `Congratulations! Your team **${d.team_name}** has crossed the qualifying threshold at the ${d.chapter} Chapter Final with a score of **${d.score}/100**.

You are now in contention for a spot at the National Track Final.

Shortlisting decisions are made by your Chapter Coordinator — watch for your confirmation email.

**[View your results](${BASE_URL}/me)**${SIGN_OFF}`,
  };
}

// ─── 6. Finals confirmed ─────────────────────────────────────────────────────

export function tplFinalsConfirmed(d: {
  team_name: string;
  host_city: string;
  date_iso: string;
}): { subject: string; body: string } {
  const dateStr = new Date(d.date_iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "long",
  });

  return {
    subject: `You're going to ${d.host_city}! Nationals confirmed — Future 6.0`,
    body: `Team **${d.team_name}** is officially confirmed for the National Track Final — see you in ${d.host_city}!

**Event date:** ${dateStr}
**Host city:** ${d.host_city}

**Important:** all delegates must submit a signed Parent Consent Letter before travelling.
**[Download yours now](${BASE_URL}/me/consent)**

Travel and accommodation details will be shared by your Chapter Coordinator.${SIGN_OFF}`,
  };
}
