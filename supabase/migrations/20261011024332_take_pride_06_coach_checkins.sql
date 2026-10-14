-- Take Pride 2026: "My 1% coach" — pledge check-ins at 7, 30, 60 and 90
-- days after the event (event ends 19 Dec 2026; due 26 Dec, 18 Jan, 17 Feb,
-- 19 Mar, IST).
--
-- ADDITIVE ONLY. One new table, same access model as take_pride_01/05: RLS
-- ENABLED with ZERO policies, only the service client reads or writes,
-- behind a delegate's secret pass token or the routine's X-Cron-Secret
-- (app/take-pride/api/ai-coach/route.ts).
--
-- The production app NEVER calls an LLM. A delegate's check-in becomes a
-- 'pending' row; the claude.ai routine claims rows (pending -> generating),
-- writes the coach note off-platform and POSTs it back
-- (generating -> ready | failed). `allowed` pins the person ids the routine
-- was shown at claim time, so the app drops any id outside that set.
-- No phone, email, token or badge secret is ever stored here.

create table if not exists yi_connect.tp_coach_checkins (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  step smallint not null check (step in (7, 30, 60, 90)),
  due_on date not null,
  update_text text check (update_text is null or char_length(update_text) <= 500),
  mood text check (mood is null or mood in ('on_track', 'slipping', 'done')),
  status text not null default 'open' check (status in ('open', 'pending', 'generating', 'ready', 'failed')),
  coach_note jsonb,
  allowed jsonb,
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  unique (delegate_id, step)
);

create index if not exists tp_coach_checkins_status_idx
  on yi_connect.tp_coach_checkins (status, submitted_at);

alter table yi_connect.tp_coach_checkins enable row level security;
revoke all on yi_connect.tp_coach_checkins from anon, authenticated, public;
grant all on yi_connect.tp_coach_checkins to service_role;
