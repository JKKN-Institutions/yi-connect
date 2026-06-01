-- YIP per-session scoring foundation (BUG-385).
-- Additive + backward-compatible. Applied to prod 2026-06-01 via the Supabase
-- Management API; captured here for repo parity. The disruptive part (changing
-- the scores uniqueness to include agenda_item_id + clearing null-session rows)
-- ships separately at cutover, when live testing pauses.

-- 1. Mark which agenda items are scoreable sessions.
alter table yip.agenda
  add column if not exists is_scoreable boolean not null default false;

update yip.agenda set is_scoreable = true
where agenda_type::text in (
  'opening_speech','speaker_election','debate','zero_hour',
  'question_hour','bill_presentation','committee_discussion','cabinet_intro'
);

-- 2. Which juror may score which session (the per-session jury panel).
create table if not exists yip.jury_session_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references yip.events(id) on delete cascade,
  jury_assignment_id uuid not null references yip.jury_assignments(id) on delete cascade,
  agenda_item_id uuid not null references yip.agenda(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (jury_assignment_id, agenda_item_id)
);

create index if not exists idx_jsa_event on yip.jury_session_assignments(event_id);
create index if not exists idx_jsa_agenda on yip.jury_session_assignments(agenda_item_id);

-- 3. Lock it down — reachable only via service-role server actions.
alter table yip.jury_session_assignments enable row level security;
revoke all on yip.jury_session_assignments from anon, authenticated;
grant all on yip.jury_session_assignments to service_role;
