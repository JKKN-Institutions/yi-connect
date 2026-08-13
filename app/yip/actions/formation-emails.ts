"use server";

/**
 * Online House Formation — email server actions (invites, reminders, reissue).
 *
 * The email leg of the pre-Regional-Round Online House Formation feature
 * (plan §3.5). Mirrors app/yip/actions/email-codes.ts: Resend batch ≤50,
 * getYipEventAccess(eventId).canManage gate on every action, inline-style
 * templates. Two additions over email-codes:
 *
 *   1. QUOTA PRE-FLIGHT — checkFormationEmailQuota runs before EVERY send
 *      (env key present → live Resend probe → today's sent count vs
 *      YIP_EMAIL_DAILY_CAP). Exists because a Resend monthly-quota outage in
 *      July 2026 silently killed all Yi-Future email; formation sends must
 *      refuse loudly up front instead.
 *   2. SEND LOG — every attempted send is a yip.formation_emails row
 *      ('pending' → 'sent'/'failed'). Rows left 'pending' (e.g. a crash
 *      between enqueue and send) are drained by the cron
 *      app/yip/api/cron/formation-drain-emails/route.ts, which RE-RENDERS
 *      from the participant row — access codes are NEVER stored in the log.
 *
 * Students are minors: an email carries only the recipient's OWN name + code,
 * sent only to their own registered address.
 *
 * CRITICAL: a "use server" file may export ONLY async functions. All types +
 * the shared renderer live in @/lib/yip/formation-email-types.
 */

import { Resend } from "resend";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { sessionAppliesToViewer } from "@/lib/yip/vote-scope";
import {
  renderFormationEmail,
  isValidFormationEmail,
  maskFormationEmail,
  FORMATION_DEEP_LINK_BASE,
} from "@/lib/yip/formation-email-types";
import type {
  FormationEmailKind,
  FormationEmailRecipient,
  FormationEmailSendPlan,
  FormationEmailBatchItemResult,
  FormationQuotaCheck,
} from "@/lib/yip/formation-email-types";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// Max recipients per Resend batch request (endpoint accepts 100; we stay well
// under — the email-codes.ts convention).
const EMAIL_BATCH_MAX = 50;

// ─── Untyped table access (formation_emails / formation_steps / votes) ───
// yip.formation_emails + yip.formation_steps arrive in migration
// 20260812090000_yip_online_formation.sql (Lane A), and yip.votes gained
// `session_id` in 20260612100000 — none are in types/yip/database.ts (never
// regenerated; the supabase CLI corrupts it). Narrow, file-local accessors
// only — the votesTable pattern documented in app/yip/actions/voting.ts
// lines 36–63. Every other table in this file stays fully typed.

type PgErrLite = { code?: string; message: string };

type FormationEmailRow = {
  id: string;
  participant_id: string | null;
  status?: string;
  attempts?: number;
};
type FormationEmailsTable = {
  select: (
    cols: string,
    opts?: { count?: "exact"; head?: boolean }
  ) => FormationEmailsTable;
  insert: (rows: Record<string, unknown>[]) => FormationEmailsTable;
  update: (row: Record<string, unknown>) => FormationEmailsTable;
  eq: (col: string, val: unknown) => FormationEmailsTable;
  in: (col: string, vals: readonly unknown[]) => FormationEmailsTable;
  gte: (col: string, val: unknown) => FormationEmailsTable;
  then: Promise<{
    data: FormationEmailRow[] | null;
    error: PgErrLite | null;
    count: number | null;
  }>["then"];
};
function formationEmailsTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): FormationEmailsTable {
  return (sb as unknown as { from: (t: string) => FormationEmailsTable }).from(
    "formation_emails"
  );
}

type FormationStepRowLite = {
  id: string;
  step_key: string;
  status: string;
  session_ids: string[] | null;
  closes_at: string | null;
};
type FormationStepsTable = {
  select: (cols: string) => FormationStepsTable;
  eq: (col: string, val: unknown) => FormationStepsTable;
  maybeSingle: () => Promise<{
    data: FormationStepRowLite | null;
    error: PgErrLite | null;
  }>;
};
function formationStepsTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): FormationStepsTable {
  return (sb as unknown as { from: (t: string) => FormationStepsTable }).from(
    "formation_steps"
  );
}

type VoteRowLite = { participant_id: string | null };
type VotesTableLite = {
  select: (cols: string) => VotesTableLite;
  eq: (col: string, val: unknown) => VotesTableLite;
  limit: (n: number) => VotesTableLite;
  then: Promise<{
    data: VoteRowLite[] | null;
    error: PgErrLite | null;
  }>["then"];
};
function votesTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): VotesTableLite {
  return (sb as unknown as { from: (t: string) => VotesTableLite }).from(
    "votes"
  );
}

// ─── Quota pre-flight (module-private core) ───────────────────────

/**
 * True when the probe failed because the API key is not PERMITTED to call
 * /domains — not because the Resend account is unhealthy. Production runs a
 * send-only key: /domains answers 401 `restricted_api_key` while POST /emails
 * works, so refusing on it blocked 100% of formation email. Quota codes
 * (monthly_quota_exceeded / daily_quota_exceeded) are deliberately NOT listed
 * here — those must keep refusing loudly (the July 2026 rule).
 */
function isProbeScopeError(err: {
  name?: string;
  statusCode?: number | null;
}): boolean {
  return (
    err.name === "restricted_api_key" ||
    err.name === "invalid_access" ||
    err.statusCode === 403
  );
}

async function computeQuota(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  plannedCount: number
): Promise<FormationQuotaCheck> {
  const dailyCap = Number(process.env.YIP_EMAIL_DAILY_CAP ?? 2000);

  // 1. Config present at all?
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "Email service is not configured (RESEND_API_KEY missing).",
      plannedCount,
      sentToday: 0,
      dailyCap,
    };
  }

  // 2. Live probe — a cheap authenticated call. A disabled key or exhausted
  // account fails HERE, before any student email is attempted (there is no
  // Resend quota API; this is the closest honest signal). A permission-scoped
  // refusal means only "probe unavailable" — proceed, since send scope is
  // unaffected. See isProbeScopeError.
  try {
    const resend = new Resend(apiKey);
    const { error: probeError } = await resend.domains.list();
    if (probeError && !isProbeScopeError(probeError)) {
      return {
        ok: false,
        reason: `Email service refused the pre-flight probe: ${
          probeError.message || "unknown error"
        }. Sends are blocked until the Resend account is healthy.`,
        plannedCount,
        sentToday: 0,
        dailyCap,
      };
    }
  } catch (e) {
    return {
      ok: false,
      reason: `Email service unreachable: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
      plannedCount,
      sentToday: 0,
      dailyCap,
    };
  }

  // 3. Today's sent count — GLOBAL across events (the cap protects the
  // shared Resend account, not one event). head:true → count only, no rows.
  const todayStartUtc = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { count, error: countError } = await formationEmailsTable(supabase)
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", todayStartUtc);
  if (countError) {
    return {
      ok: false,
      reason: `Could not read today's send count: ${countError.message}`,
      plannedCount,
      sentToday: 0,
      dailyCap,
    };
  }

  const sentToday = count ?? 0;
  if (plannedCount + sentToday > dailyCap) {
    return {
      ok: false,
      reason: `Daily email cap would be exceeded: ${sentToday} already sent today + ${plannedCount} planned > ${dailyCap} (YIP_EMAIL_DAILY_CAP).`,
      plannedCount,
      sentToday,
      dailyCap,
    };
  }

  return { ok: true, plannedCount, sentToday, dailyCap };
}

// ─── Batch send helper (module-private) ───────────────────────────
// Enqueues one 'pending' formation_emails row per recipient, sends ONE Resend
// batch request, then marks the rows 'sent'/'failed'. Rows that never reach
// the update (process crash) stay 'pending' and are drained by the cron.

type SendableRecipient = {
  participantId: string;
  fullName: string;
  email: string;
  accessCode: string;
};

async function enqueueAndSendBatch(args: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  eventId: string;
  eventName: string;
  kind: FormationEmailKind;
  stepId?: string | null;
  deadline?: string | null;
  recipients: SendableRecipient[]; // length ≤ EMAIL_BATCH_MAX
}): Promise<FormationEmailBatchItemResult[]> {
  const { supabase, eventId, eventName, kind, stepId, deadline, recipients } =
    args;
  if (recipients.length === 0) return [];

  const apiKey = process.env.RESEND_API_KEY ?? "";
  const fromEmail =
    process.env.FROM_EMAIL || "Yi Connect <noreply@yi-connect.org>";

  const rendered = recipients.map((r) => ({
    recipient: r,
    email: renderFormationEmail({
      kind,
      fullName: r.fullName,
      accessCode: r.accessCode,
      eventName,
      deadline: deadline ?? null,
    }),
  }));

  // 1. Enqueue the log rows (status 'pending'; code NEVER stored).
  const { data: logRows, error: insertError } = await formationEmailsTable(
    supabase
  )
    .insert(
      rendered.map(({ recipient, email }) => ({
        event_id: eventId,
        participant_id: recipient.participantId,
        step_id: stepId ?? null,
        kind,
        recipient_email: recipient.email,
        subject_line: email.subject,
        status: "pending",
      }))
    )
    .select("id, participant_id");
  if (insertError) {
    return recipients.map((r) => ({
      participantId: r.participantId,
      fullName: r.fullName,
      success: false,
      error: `Could not enqueue email: ${insertError.message}`,
    }));
  }
  const logIdByParticipant = new Map<string, string>();
  for (const row of logRows ?? []) {
    if (row.participant_id) logIdByParticipant.set(row.participant_id, row.id);
  }
  const allLogIds = (logRows ?? []).map((r) => r.id);

  // 2. One batch request for all recipients — sidesteps the per-message rate
  // limit a sequential loop would hit. A batch-level failure marks every
  // attempted row failed with the reason; it never throws past this helper.
  let batchFailure: string | null = null;
  try {
    const resend = new Resend(apiKey);
    const { error: batchError } = await resend.batch.send(
      rendered.map(({ recipient, email }) => ({
        from: fromEmail,
        to: [recipient.email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }))
    );
    if (batchError) batchFailure = batchError.message || "Email send failed";
  } catch (e) {
    batchFailure = e instanceof Error ? e.message : "Email service error";
  }

  // 3. Mark the log rows.
  if (batchFailure) {
    if (allLogIds.length > 0) {
      await formationEmailsTable(supabase)
        .update({ status: "failed", error: batchFailure, attempts: 1 })
        .in("id", allLogIds);
    }
    return recipients.map((r) => ({
      participantId: r.participantId,
      fullName: r.fullName,
      success: false,
      error: batchFailure ?? undefined,
    }));
  }

  if (allLogIds.length > 0) {
    await formationEmailsTable(supabase)
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: 1,
      })
      .in("id", allLogIds);
  }
  return recipients.map((r) => ({
    participantId: r.participantId,
    fullName: r.fullName,
    success: true,
  }));
}

// ─── Refusal audit (module-private) ───────────────────────────────
// A quota refusal used to leave ZERO trace — no email AND no row — so nobody
// could later tell a refused send from one never requested. Log one 'failed'
// row per intended recipient. attempts:0 marks "never attempted"; the drain
// cron only picks 'pending', so these are never auto-retried, and the daily
// count only sums 'sent', so they can't feed back into the cap.

async function logRefusedSends(args: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  eventId: string;
  kind: FormationEmailKind;
  stepId?: string | null;
  reason: string;
  recipients: { participantId: string; email: string }[];
}): Promise<void> {
  const { supabase, eventId, kind, stepId, reason, recipients } = args;
  if (recipients.length === 0) return;
  try {
    await formationEmailsTable(supabase).insert(
      recipients.map((r) => ({
        event_id: eventId,
        participant_id: r.participantId,
        step_id: stepId ?? null,
        kind,
        recipient_email: r.email,
        status: "failed",
        error: reason,
        attempts: 0,
      }))
    );
  } catch {
    // Best-effort audit — never mask the refusal the organiser must see.
  }
}

// ─── 1. Quota check (also exposed to the UI) ──────────────────────

/**
 * Pre-flight check the Formation tab can show before an organiser commits to
 * a send. Every send action in this file re-runs it server-side regardless.
 */
export async function checkFormationEmailQuota(
  eventId: string,
  plannedCount: number
): Promise<ActionResult<FormationQuotaCheck>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const quota = await computeQuota(supabase, Math.max(0, plannedCount));
  return { success: true, data: quota };
}

// ─── 2. Invite plan (preview) ─────────────────────────────────────

/**
 * "Who will get a formation invite" confirmation: every participant and
 * whether they have a sendable email + access code. Mirrors
 * getYipEmailCodePlan (masked emails only — never full addresses).
 */
export async function getFormationInvitePlan(
  eventId: string
): Promise<ActionResult<FormationEmailSendPlan>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { data: participants, error } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, email, access_code")
    .eq("event_id", eventId)
    .order("serial_no");
  if (error) return { success: false, error: error.message };

  const recipients: FormationEmailRecipient[] = (participants ?? []).map(
    (p) => ({
      participantId: p.id,
      serialNo: p.serial_no,
      fullName: p.full_name,
      emailMasked: maskFormationEmail(p.email),
      hasEmail: isValidFormationEmail(p.email) && !!p.access_code,
    })
  );

  return {
    success: true,
    data: {
      total: recipients.length,
      withEmail: recipients.filter((r) => r.hasEmail).length,
      recipients,
    },
  };
}

// ─── 3. Send invites (one batch ≤50; client iterates batches) ─────

/**
 * Emails the formation invite (code + one-tap /yip/f/{code} deep link) to up
 * to EMAIL_BATCH_MAX participants. The client iterates batches to cover a
 * full event and show progress — the email-codes dialog pattern.
 */
export async function sendFormationInvites(
  eventId: string,
  participantIds: string[]
): Promise<
  ActionResult<{
    results: FormationEmailBatchItemResult[];
    quota: FormationQuotaCheck;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (participantIds.length > EMAIL_BATCH_MAX) {
    return { success: false, error: `Batch too large (max ${EMAIL_BATCH_MAX})` };
  }

  const supabase = await createServiceClient();

  if (participantIds.length === 0) {
    const quota = await computeQuota(supabase, 0);
    return { success: true, data: { results: [], quota } };
  }

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single();
  const eventName = event?.name ?? "Young Indians Parliament";

  const { data: participants, error } = await supabase
    .from("participants")
    .select("id, full_name, email, access_code")
    .eq("event_id", eventId)
    .in("id", participantIds);
  if (error) return { success: false, error: error.message };

  const results: FormationEmailBatchItemResult[] = [];
  const sendable: SendableRecipient[] = [];
  for (const p of participants ?? []) {
    if (!isValidFormationEmail(p.email) || !p.access_code) {
      results.push({
        participantId: p.id,
        fullName: p.full_name,
        success: false,
        error: !p.access_code ? "No access code" : "No valid email",
      });
      continue;
    }
    sendable.push({
      participantId: p.id,
      fullName: p.full_name,
      email: p.email.trim(),
      accessCode: p.access_code,
    });
  }

  // Quota pre-flight — refuse the WHOLE batch on !ok (July 2026 rule).
  const quota = await computeQuota(supabase, sendable.length);
  if (!quota.ok) {
    const reason = `Send refused by quota pre-flight: ${quota.reason}`;
    await logRefusedSends({
      supabase,
      eventId,
      kind: "invite",
      reason,
      recipients: sendable,
    });
    return { success: false, error: reason };
  }

  const sent = await enqueueAndSendBatch({
    supabase,
    eventId,
    eventName,
    kind: "invite",
    recipients: sendable,
  });
  results.push(...sent);

  return { success: true, data: { results, quota } };
}

// ─── 4. Send reminders (per formation step, non-voters only) ──────

/**
 * Emails a "your ballot is still open" reminder to every participant who is
 * eligible for the step's OPEN ballot(s) but has not voted yet. Recipient
 * selection is computed server-side from the step's vote sessions.
 */
export async function sendFormationReminders(
  eventId: string,
  stepKey: string
): Promise<
  ActionResult<{
    results: FormationEmailBatchItemResult[];
    quota: FormationQuotaCheck;
    pendingCount: number;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();

  const { data: step, error: stepError } = await formationStepsTable(supabase)
    .select("id, step_key, status, session_ids, closes_at")
    .eq("event_id", eventId)
    .eq("step_key", stepKey)
    .maybeSingle();
  if (stepError) return { success: false, error: stepError.message };
  if (!step) {
    return {
      success: false,
      error: "Formation step not found — open the Formation tab first.",
    };
  }
  const sessionIds = step.session_ids ?? [];
  if (sessionIds.length === 0) {
    return {
      success: false,
      error: "No ballots have been opened for this step yet.",
    };
  }

  // TODO wire-up: replace with getFormationTurnout (Lane A). Self-contained
  // local turnout query so this lane compiles standalone on master: eligible
  // participants per open session (house = all; party = config.partyId match;
  // bench = config.side match — scope truth via sessionAppliesToViewer) minus
  // those who already voted.
  const { data: sessions, error: sessionsError } = await supabase
    .from("vote_sessions")
    .select("id, vote_type, config, status")
    .in("id", sessionIds);
  if (sessionsError) return { success: false, error: sessionsError.message };

  const openSessions = (sessions ?? []).filter((s) => s.status === "open");
  if (openSessions.length === 0) {
    return {
      success: false,
      error: "No ballot is currently open for this step — nothing to remind.",
    };
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, email, access_code, party_id, party_side")
    .eq("event_id", eventId)
    .order("serial_no");
  if (participantsError) {
    return { success: false, error: participantsError.message };
  }

  // Voter sets — one query per open session (a handful at most; per-session
  // result stays well under the PostgREST row cap, unlike one giant IN query).
  const votedBySession = new Map<string, Set<string>>();
  for (const s of openSessions) {
    const { data: votes, error: votesError } = await votesTable(supabase)
      .select("participant_id")
      .eq("session_id", s.id)
      .limit(5000);
    if (votesError) return { success: false, error: votesError.message };
    votedBySession.set(
      s.id,
      new Set(
        (votes ?? [])
          .map((v) => v.participant_id)
          .filter((id): id is string => !!id)
      )
    );
  }

  const results: FormationEmailBatchItemResult[] = [];
  const pending: SendableRecipient[] = [];
  let pendingCount = 0;
  for (const p of participants ?? []) {
    const viewer = { partyId: p.party_id, side: p.party_side };
    const applicable = openSessions.filter((s) =>
      sessionAppliesToViewer({ vote_type: s.vote_type, config: s.config }, viewer)
    );
    if (applicable.length === 0) continue;
    const hasUnvoted = applicable.some(
      (s) => !(votedBySession.get(s.id)?.has(p.id) ?? false)
    );
    if (!hasUnvoted) continue;
    pendingCount++;
    if (!isValidFormationEmail(p.email) || !p.access_code) {
      results.push({
        participantId: p.id,
        fullName: p.full_name,
        success: false,
        error: !p.access_code ? "No access code" : "No valid email",
      });
      continue;
    }
    pending.push({
      participantId: p.id,
      fullName: p.full_name,
      email: p.email.trim(),
      accessCode: p.access_code,
    });
  }

  // Quota pre-flight — refuse the whole reminder run on !ok.
  const quota = await computeQuota(supabase, pending.length);
  if (!quota.ok) {
    const reason = `Send refused by quota pre-flight: ${quota.reason}`;
    await logRefusedSends({
      supabase,
      eventId,
      kind: "reminder",
      stepId: step.id,
      reason,
      recipients: pending,
    });
    return { success: false, error: reason };
  }

  if (pending.length === 0) {
    return { success: true, data: { results, quota, pendingCount } };
  }

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single();
  const eventName = event?.name ?? "Young Indians Parliament";

  // Recipient list is server-derived, so chunk into ≤50 batches here
  // (invites chunk client-side instead — the dialog shows progress).
  for (let i = 0; i < pending.length; i += EMAIL_BATCH_MAX) {
    const chunk = pending.slice(i, i + EMAIL_BATCH_MAX);
    const sent = await enqueueAndSendBatch({
      supabase,
      eventId,
      eventName,
      kind: "reminder",
      stepId: step.id,
      deadline: step.closes_at,
      recipients: chunk,
    });
    results.push(...sent);
  }

  return { success: true, data: { results, quota, pendingCount } };
}

// ─── 5. Re-issue an access code ───────────────────────────────────

/**
 * Rotates one participant's access code (old code stops working) and emails
 * them the new one. Uniqueness loop mirrors generateUniqueCode in
 * participants.ts: unique within the event across participants AND jury.
 */
export async function reissueFormationCode(
  eventId: string,
  participantId: string
): Promise<
  ActionResult<{
    participantId: string;
    accessCode: string;
    emailMasked: string | null;
    sent: boolean;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();

  const { data: participant, error } = await supabase
    .from("participants")
    .select("id, full_name, email, access_code")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!participant) {
    return { success: false, error: "Participant not found in this event" };
  }
  if (!isValidFormationEmail(participant.email)) {
    return {
      success: false,
      error:
        "Participant has no valid email on file — update their email first, then re-issue.",
    };
  }

  // Quota pre-flight BEFORE rotating — never leave a student with a dead old
  // code and no way to receive the new one.
  const quota = await computeQuota(supabase, 1);
  if (!quota.ok) {
    const reason = `Send refused by quota pre-flight: ${quota.reason}`;
    await logRefusedSends({
      supabase,
      eventId,
      kind: "reissue",
      reason,
      recipients: [
        { participantId: participant.id, email: participant.email.trim() },
      ],
    });
    return { success: false, error: reason };
  }

  // Fresh unique code (participants.ts loop: check participants + jury).
  let newCode = generateAccessCode();
  let attempts = 0;
  let unique = false;
  while (attempts < 20) {
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", eventId)
      .eq("access_code", newCode)
      .maybeSingle();
    if (!existing) {
      const { data: juryExisting } = await supabase
        .from("jury_assignments")
        .select("id")
        .eq("event_id", eventId)
        .eq("access_code", newCode)
        .maybeSingle();
      if (!juryExisting) {
        unique = true;
        break;
      }
    }
    newCode = generateAccessCode();
    attempts++;
  }
  if (!unique) {
    return {
      success: false,
      error: "Failed to generate a unique access code after 20 attempts",
    };
  }

  const { error: updateError } = await supabase
    .from("participants")
    .update({ access_code: newCode })
    .eq("id", participantId)
    .eq("event_id", eventId);
  if (updateError) return { success: false, error: updateError.message };

  const { data: event } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single();
  const eventName = event?.name ?? "Young Indians Parliament";

  const [result] = await enqueueAndSendBatch({
    supabase,
    eventId,
    eventName,
    kind: "reissue",
    recipients: [
      {
        participantId: participant.id,
        fullName: participant.full_name,
        email: participant.email.trim(),
        accessCode: newCode,
      },
    ],
  });

  return {
    success: true,
    data: {
      participantId: participant.id,
      accessCode: newCode,
      emailMasked: maskFormationEmail(participant.email),
      sent: result?.success ?? false,
    },
  };
}

/**
 * The participant's formation deep link, for organiser hand-off over any
 * channel (Director edge-case decision 2, 11 Aug 2026: the escape hatch for
 * qualifiers whose email can't be fixed in time). canManage-gated; the link is
 * exactly as sensitive as the emailed code itself, so it is fetched one
 * participant at a time on click — never bulk-listed.
 */
export async function getFormationDeepLink(
  eventId: string,
  participantId: string
): Promise<ActionResult<{ url: string; fullName: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("id, full_name, access_code")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!p) {
    return { success: false, error: "Participant not found in this event." };
  }
  if (!p.access_code) {
    return { success: false, error: "This participant has no access code yet." };
  }
  return {
    success: true,
    data: {
      url: `${FORMATION_DEEP_LINK_BASE}/${p.access_code}`,
      fullName: p.full_name,
    },
  };
}
