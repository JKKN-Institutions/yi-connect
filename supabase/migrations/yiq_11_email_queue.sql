-- =====================================================================
-- YIQ — the outbound email queue.
--
-- WHY THIS EXISTS (Director, 2026-08-25): access codes were shown ONCE on
-- screen after a teacher registered a team, then unrecoverable by anyone.
-- Codes must ALSO be emailed — one full list to the registering teacher,
-- and one single-code email to each student who supplied an address.
--
-- WHY A QUEUE AND NOT AN INLINE SEND: registration is a public form filled
-- in on a phone in a school corridor. It must NEVER wait on a mail server,
-- and a Resend outage must never fail a registration that already wrote
-- rows. So the action enqueues and returns; the cron drains
-- (app/yiq/api/cron/drain-emails/route.ts). Same shape as
-- future.notification_log, yuva.notification_log and yip.formation_emails.
--
-- SECURITY-CRITICAL: this table stores NO ACCESS CODE. This is the lesson
-- yip.formation_emails already encodes — a queue row is long-lived audit
-- data, an access code is a live credential for a MINOR, and the two must
-- not share a row. `payload` carries only non-secret render context; the
-- drain re-reads the codes from yiq.students at send time through the same
-- pure templates (lib/yiq/email/templates.ts). A side benefit: if a code is
-- re-issued between enqueue and drain, the code delivered is the live one.
--
-- IDEMPOTENCY: `dedupe_key` is UNIQUE and every enqueue is an upsert with
-- ON CONFLICT DO NOTHING. A double-submitted registration form, a retried
-- server action, or a second call to enqueueTeamCodeEmails() for the same
-- team is therefore a NO-OP, not a second email. A deliberate re-send
-- (codes re-issued) passes a resend tag, which produces a different key.
--
-- GRANTS: tables created through the Supabase Management API receive NO
-- default grants, so service_role is granted explicitly at the end.
-- =====================================================================

create table if not exists yiq.email_queue (
  id uuid primary key default gen_random_uuid(),

  -- ── What to send ────────────────────────────────────────────────────
  kind text not null check (kind in (
    'team_codes_teacher',  -- one email, full list of the team's codes
    'student_code'         -- one email, that student's own code only
  )),

  -- ── Who it goes to ──────────────────────────────────────────────────
  recipient text not null,
  recipient_name text,

  -- Rendered at enqueue time for the organiser's "what did we send?" view.
  -- The drain sends the FRESHLY rendered subject, so treat this column as
  -- provenance, not as the wire value.
  subject text not null,

  -- Non-secret render context only (team name, school, chapter, category,
  -- round window, member names + class levels). NEVER an access code.
  payload jsonb not null default '{}'::jsonb,

  -- ── Provenance: lets an organiser answer "did this student get their
  --    code?" without opening a mail provider dashboard ────────────────
  chapter_event_id uuid references yiq.chapter_events(id) on delete cascade,
  team_id uuid references yiq.teams(id) on delete cascade,
  student_id uuid references yiq.students(id) on delete cascade,

  -- ── Delivery state ──────────────────────────────────────────────────
  -- 'sending' is the CLAIM state. A drain flips pending -> sending guarded
  -- by `.eq(status,'pending')` BEFORE calling the provider, so two
  -- overlapping cron runs can never hand the same row to Resend twice.
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,

  -- ── Idempotency ─────────────────────────────────────────────────────
  -- e.g. 'yiq:team:<uuid>:teacher' / 'yiq:student:<uuid>:code'
  dedupe_key text not null unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The drain's hot path: oldest pending first.
create index if not exists yiq_email_queue_drain
  on yiq.email_queue (status, created_at) where status = 'pending';

-- Reclaiming rows a crashed drain left claimed.
create index if not exists yiq_email_queue_stuck
  on yiq.email_queue (status, claimed_at) where status = 'sending';

-- "Did this student / this team get their codes?"
create index if not exists yiq_email_queue_team on yiq.email_queue (team_id);
create index if not exists yiq_email_queue_student on yiq.email_queue (student_id);
create index if not exists yiq_email_queue_event
  on yiq.email_queue (chapter_event_id, status);
create index if not exists yiq_email_queue_recipient
  on yiq.email_queue (recipient);

drop trigger if exists yiq_touch_email_queue on yiq.email_queue;
create trigger yiq_touch_email_queue before update on yiq.email_queue
  for each row execute function yiq.touch_updated_at();

-- RLS ENABLED with ZERO policies — the yiq house rule. anon/authenticated
-- see nothing; every read and write goes through the service client behind
-- an explicit auth gate.
alter table yiq.email_queue enable row level security;

grant select, insert, update, delete on yiq.email_queue to service_role;
