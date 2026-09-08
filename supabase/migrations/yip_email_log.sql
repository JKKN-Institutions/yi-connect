-- yip.email_log — a per-recipient record of every YIP email attempt.
--
-- Why: YIP had no email logging at all. When the SRTN Regional round emailed
-- 187 access codes on 2026-08-14, the only record that the send happened was a
-- dialog on screen that vanished when closed. If a student says "I never got my
-- code" there was no way to tell whether it was sent, rejected, or never
-- attempted. Yi-Future has had future.notification_log since day one; this
-- mirrors that pattern for YIP.
--
-- Shape follows future.notification_log deliberately so the two are readable
-- side by side, with event_id added because YIP email is always event-scoped.
--
-- Rows are written BEFORE the provider call (status='pending') so a crash or a
-- timeout mid-batch still leaves evidence of what was attempted.

create table if not exists yip.email_log (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references yip.events (id) on delete cascade,
  participant_id      uuid references yip.participants (id) on delete set null,
  -- What kind of email this was, e.g. 'access_code'. Free text so new senders
  -- can adopt the log without a migration.
  trigger_type        text not null,
  recipient_email     text,
  recipient_name      text,
  subject_line        text,
  -- pending  → row written, provider not yet called
  -- sent     → provider accepted it
  -- failed   → provider rejected it, or the call threw
  -- skipped  → never attempted (no email on file, or no access code)
  status              text not null default 'pending'
                      check (status in ('pending', 'sent', 'failed', 'skipped')),
  error               text,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

-- The two questions this table exists to answer:
--   "what happened on this event's last send?"  → (event_id, created_at desc)
--   "did THIS student ever get their code?"     → (participant_id, created_at desc)
create index if not exists idx_yip_email_log_event
  on yip.email_log (event_id, created_at desc);
create index if not exists idx_yip_email_log_participant
  on yip.email_log (participant_id, created_at desc);

-- Recipient addresses are personal data. Service role only: the app writes and
-- reads through the service client behind getYipEventAccess. No anon or
-- authenticated grant, and no policy — RLS on with zero policies denies all
-- direct PostgREST access, which is the intent.
alter table yip.email_log enable row level security;

-- The yip schema carries blanket default grants, so a new table arrives with
-- anon SELECT and authenticated INSERT/UPDATE/DELETE already attached. RLS with
-- no policies denies the rows anyway, but this table holds student email
-- addresses, so the grant is revoked as well rather than leaning on RLS alone.
revoke all on yip.email_log from anon, authenticated;

-- Tables created through the Management API do not inherit the service_role
-- grant, so it has to be explicit or every write fails with a bare permission
-- error that reads like a bug in the action.
grant select, insert, update on yip.email_log to service_role;

comment on table yip.email_log is
  'Per-recipient audit of YIP outbound email. Written before the provider call so failed and interrupted sends are still evidenced. Service-role only.';
