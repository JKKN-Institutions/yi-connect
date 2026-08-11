-- ═══════════════════════════════════════════════════════════════════
-- YIP Online House Formation (pre-Regional-Round) — step engine + email log
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- Regional Rounds form their House ONLINE before event day: allocation +
-- party formation, then windowed remote elections (Speaker → per-party
-- leaders → PM → LoP), organiser appointments, and a final lock. This
-- migration adds the two tables that back that flow:
--
--   yip.formation_steps  — one row per (event, step) in the fixed 7-step
--                          sequence. Tracks status, the voting window
--                          (opens_at/closes_at), and the vote_sessions ids
--                          the step opened (election steps only). Config is
--                          a jsonb scratchpad (allocation summary, etc.).
--   yip.formation_emails — send log for invite/reminder/reissue emails
--                          (the yi-future notification_log pattern ported
--                          to yip). Rows are enqueued 'pending', flipped
--                          'sent'/'failed' by the send action or the drain
--                          cron. The access CODE is never stored here — the
--                          drain re-renders from the participant row.
--
-- Deliberately NO FK on participant_id / step_id (house style, cf.
-- yip.score_revisions): the log must survive participant resets.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists yip.formation_steps (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references yip.events(id) on delete cascade,
  step_key      text not null,
  step_order    int  not null,
  status        text not null default 'pending',
  opens_at      timestamptz,
  closes_at     timestamptz,
  session_ids   uuid[] not null default '{}',
  config        jsonb not null default '{}'::jsonb,
  opened_by     uuid,
  closed_at_ts  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint yip_formation_steps_status_check
    check (status in ('pending','open','closed','locked')),
  constraint yip_formation_steps_step_key_check
    check (step_key in ('allocation','speaker_ballot','party_leader_ballots',
                        'pm_ballot','lop_ballot','appointments','lock'))
);
create unique index if not exists yip_formation_steps_event_step
  on yip.formation_steps (event_id, step_key);
create index if not exists yip_formation_steps_event_order
  on yip.formation_steps (event_id, step_order);

create table if not exists yip.formation_emails (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references yip.events(id) on delete cascade,
  participant_id   uuid,               -- no FK by design (survives resets; house style)
  step_id          uuid,
  kind             text not null,      -- 'invite' | 'reminder' | 'reissue'
  recipient_email  text not null,
  subject_line     text,
  status           text not null default 'pending',
  error            text,
  attempts         int  not null default 0,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  constraint yip_formation_emails_kind_check   check (kind in ('invite','reminder','reissue')),
  constraint yip_formation_emails_status_check check (status in ('pending','sent','failed'))
);
create index if not exists yip_formation_emails_status_created
  on yip.formation_emails (status, created_at);
create index if not exists yip_formation_emails_event
  on yip.formation_emails (event_id, created_at);

-- RLS posture: server-action-only (same as yip.score_revisions) — enable RLS
-- with NO anon/authenticated policies (deny-all by default). Only the
-- service-role client touches these tables.
alter table yip.formation_steps  enable row level security;
alter table yip.formation_emails enable row level security;

-- Mgmt-API-created tables get NO default service_role grant (hard-won memory
-- rule) — grant explicitly or every service-client read/write silently fails.
grant all on yip.formation_steps  to service_role;
grant all on yip.formation_emails to service_role;
