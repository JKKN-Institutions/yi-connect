"use server";

/**
 * Email trigger server actions for Future 6.0.
 *
 * Six PRD §8 triggers, each fetching the minimum data needed to compose a
 * plain-text body and delegating to sendEmail() which logs to
 * future.notification_log.
 *
 * Handbook refs: [CPB §2.2 team, CPB §3 problem allocation, CPB §6 consent,
 *                 HPB §4 nationals, PRD §8]
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { sendEmail } from "@/lib/yi-future/email";
import { yfUrl } from "@/lib/yi-future/constants";

// ─── TRIGGER 1: Registration confirmed ──────────────────────────────────────

/**
 * Sent immediately after a delegate is registered.
 * Body includes their access code so they can log in from any device.
 */
export async function notifyRegistrationConfirmed(
  delegateId: string
): Promise<void> {
  const svc = await createServiceClient();

  const { data: delegate } = await svc
    .schema("future")
    .from("delegates")
    .select("full_name, email, access_code")
    .eq("id", delegateId)
    .maybeSingle();

  if (!delegate || !delegate.email) return;

  const d = delegate as {
    full_name: string;
    email: string;
    access_code: string;
  };

  const body = `Hi ${d.full_name},

Welcome to Yi YUVA Future 6.0! You're officially registered.

Your access code: ${d.access_code}

Keep this safe — you'll need it to sign in at ${yfUrl("/join")}

What's next:
- Join or form a team of 3–5 delegates
- Pick a problem statement with your team captain
- Start your 90-day policy & solutions journey

Good luck!

Yi YUVA · CII`;

  await sendEmail({
    to: d.email,
    triggerType: "registration_confirmed",
    subject: "You're registered for Future 6.0 — your access code inside",
    body,
    recipientSubjectType: "delegate",
    recipientSubjectId: delegateId,
  });
}

// ─── TRIGGER 2: Team invite ──────────────────────────────────────────────────

/**
 * Sent when a captain invites a delegate to join their team.
 */
export async function notifyTeamInvite(
  invitedDelegateId: string,
  fromTeamName: string
): Promise<void> {
  const svc = await createServiceClient();

  const { data: delegate } = await svc
    .schema("future")
    .from("delegates")
    .select("full_name, email, access_code")
    .eq("id", invitedDelegateId)
    .maybeSingle();

  if (!delegate || !delegate.email) return;

  const d = delegate as {
    full_name: string;
    email: string;
    access_code: string;
  };

  const body = `Hi ${d.full_name},

You've been invited to join team "${fromTeamName}" for Future 6.0.

To accept, sign in at ${yfUrl("/join")} with your access code: ${d.access_code}

Then go to My Team → Accept Invite.

Team size is 3–5 delegates. You can only be in one team per edition, so make sure this is the right fit for you.

Yi YUVA · CII`;

  await sendEmail({
    to: d.email,
    triggerType: "team_invite",
    subject: `You've been invited to join "${fromTeamName}" — Future 6.0`,
    body,
    recipientSubjectType: "delegate",
    recipientSubjectId: invitedDelegateId,
  });
}

// ─── TRIGGER 3: Problem allocated ────────────────────────────────────────────

/**
 * Sent when a team's problem statement is confirmed.
 * [CPB §3.1 — problem selection locked in by coordinator]
 */
export async function notifyProblemAllocated(teamId: string): Promise<void> {
  const svc = await createServiceClient();

  const { data: team } = await svc
    .schema("future")
    .from("teams")
    .select(
      "team_name, problem_statement_id, problem_statements(title, short_description)"
    )
    .eq("id", teamId)
    .maybeSingle();

  if (!team || !team.problem_statement_id) return;

  const t = team as {
    team_name: string;
    problem_statement_id: string;
    problem_statements: { title: string; short_description: string } | null;
  };

  const problemTitle = t.problem_statements?.title ?? "your assigned problem";
  const problemDesc = t.problem_statements?.short_description ?? "";

  // Fetch all member emails
  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegates(email, full_name)")
    .eq("team_id", teamId);

  const rows = (members ?? []) as {
    delegates: { email: string | null; full_name: string } | null;
  }[];

  for (const row of rows) {
    if (!row.delegates?.email) continue;

    const body = `Hi ${row.delegates.full_name},

Your team "${t.team_name}" has been allocated a problem statement for Future 6.0.

Problem: ${problemTitle}
${problemDesc ? `\n${problemDesc}\n` : ""}
Your 90-day journey starts now. Phase A deliverable is due at the end of Month 1.

Sign in at ${yfUrl("/join")} to view the full brief and start submitting.

Yi YUVA · CII`;

    await sendEmail({
      to: row.delegates.email,
      triggerType: "problem_allocated",
      subject: `Your team has been allocated: ${problemTitle}`,
      body,
      recipientSubjectType: "team",
      recipientSubjectId: teamId,
    });
  }
}

// ─── TRIGGER 4: Session reminder ─────────────────────────────────────────────

/**
 * Sent ~24 hours before a phase event (workshop, mentoring session, etc.).
 * [CPB §3.2 — Phase A/B/C session calendar]
 */
export async function notifySessionReminder(
  teamId: string,
  phaseEventId: string
): Promise<void> {
  const svc = await createServiceClient();

  const { data: phaseEvent } = await svc
    .schema("future")
    .from("phase_events")
    .select("title, scheduled_at, mode, venue, meeting_url")
    .eq("id", phaseEventId)
    .maybeSingle();

  if (!phaseEvent) return;

  const pe = phaseEvent as {
    title: string;
    scheduled_at: string;
    mode: string | null;
    venue: string | null;
    meeting_url: string | null;
  };

  const dateStr = new Date(pe.scheduled_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });

  const locationLine =
    pe.mode === "online" && pe.meeting_url
      ? `Join online: ${pe.meeting_url}`
      : pe.venue
      ? `Venue: ${pe.venue}`
      : "Check the platform for location details.";

  // Fetch all member emails
  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegates(email, full_name)")
    .eq("team_id", teamId);

  const rows = (members ?? []) as {
    delegates: { email: string | null; full_name: string } | null;
  }[];

  for (const row of rows) {
    if (!row.delegates?.email) continue;

    const body = `Hi ${row.delegates.full_name},

This is a reminder about an upcoming Future 6.0 session for your team.

Session: ${pe.title}
When: ${dateStr} IST
${locationLine}

Please attend on time. If you can't make it, let your mentor or chapter coordinator know.

Yi YUVA · CII`;

    await sendEmail({
      to: row.delegates.email,
      triggerType: "session_reminder",
      subject: `Reminder: ${pe.title} — Future 6.0`,
      body,
      recipientSubjectType: "team",
      recipientSubjectId: teamId,
    });
  }
}

// ─── TRIGGER 5: Threshold achieved ───────────────────────────────────────────

/**
 * Sent when a team's aggregate score crosses the national qualifying threshold.
 * [CPB §4 — Chapter Final shortlisting, HPB §4 — National qualification]
 */
export async function notifyThresholdAchieved(teamId: string): Promise<void> {
  const svc = await createServiceClient();

  const { data: team } = await svc
    .schema("future")
    .from("teams")
    .select("team_name")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return;

  const t = team as { team_name: string };

  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegates(email, full_name)")
    .eq("team_id", teamId);

  const rows = (members ?? []) as {
    delegates: { email: string | null; full_name: string } | null;
  }[];

  for (const row of rows) {
    if (!row.delegates?.email) continue;

    const body = `Hi ${row.delegates.full_name},

Congratulations! Your team "${t.team_name}" has crossed the qualifying threshold in the Future 6.0 Chapter Final.

This means you are in contention for a spot at the National Track Final.

Watch for your confirmation email — shortlisting decisions are made by the Chapter Coordinator.

Keep up the great work.

Yi YUVA · CII`;

    await sendEmail({
      to: row.delegates.email,
      triggerType: "threshold_achieved",
      subject: `${t.team_name} crossed the qualifying threshold — Future 6.0`,
      body,
      recipientSubjectType: "team",
      recipientSubjectId: teamId,
    });
  }
}

// ─── TRIGGER 6: Finals confirmed ─────────────────────────────────────────────

/**
 * Sent when a team is formally confirmed for a National Track Final.
 * Includes host city. Parent consent reminder included per [CPB §6].
 * [HPB §4 — National Track Final logistics]
 */
export async function notifyFinalsConfirmed(teamId: string): Promise<void> {
  const svc = await createServiceClient();

  // Pull team → advancement → to_event → chapter (host city)
  const { data: advancement } = await svc
    .schema("future")
    .from("advancements")
    .select("to_event_id, total_score, events!advancements_to_event_id_fkey(name, venue, start_date, chapters(city, name))")
    .eq("team_id", teamId)
    .order("advanced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: team } = await svc
    .schema("future")
    .from("teams")
    .select("team_name")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) return;

  const t = team as { team_name: string };

  const adv = advancement as {
    to_event_id: string;
    total_score: number | null;
    events: {
      name: string;
      venue: string | null;
      start_date: string | null;
      chapters: { city: string; name: string } | null;
    } | null;
  } | null;

  const eventName = adv?.events?.name ?? "the National Track Final";
  const hostCity = adv?.events?.chapters?.city ?? "the host city";
  const dateStr = adv?.events?.start_date
    ? new Date(adv.events.start_date).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "long",
      })
    : "date TBC";

  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegates(email, full_name)")
    .eq("team_id", teamId);

  const rows = (members ?? []) as {
    delegates: { email: string | null; full_name: string } | null;
  }[];

  for (const row of rows) {
    if (!row.delegates?.email) continue;

    const body = `Hi ${row.delegates.full_name},

Congratulations! Team "${t.team_name}" is officially confirmed for the National Track Final.

Event: ${eventName}
Host city: ${hostCity}
Date: ${dateStr}

IMPORTANT — Parent consent required:
All delegates must submit a signed Parent Consent Letter before travelling.
Download yours at ${yfUrl("/me/consent")}

Travel and accommodation details will be shared separately by your Chapter Coordinator.

See you at the finals!

Yi YUVA · CII`;

    await sendEmail({
      to: row.delegates.email,
      triggerType: "finals_confirmed",
      subject: `You're going to ${hostCity}! Nationals confirmed — Future 6.0`,
      body,
      recipientSubjectType: "team",
      recipientSubjectId: teamId,
    });
  }
}
