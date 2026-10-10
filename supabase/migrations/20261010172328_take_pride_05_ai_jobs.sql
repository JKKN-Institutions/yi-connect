-- Take Pride 2026: AI helper job queue (summit plan, profile helper,
-- opportunity radar, why-meet notes, ask the desk).
--
-- ADDITIVE ONLY. One new table, same access model as take_pride_01: RLS
-- ENABLED with ZERO policies, only the service client reads or writes,
-- behind a delegate's secret pass token or the routine's X-Cron-Secret
-- (app/take-pride/api/ai/route.ts).
--
-- The production app NEVER calls an LLM. A delegate's request becomes a
-- 'pending' row; the out-of-band claude.ai routine claims rows
-- (pending -> generating), writes text off-platform and POSTs it back
-- (generating -> ready | failed). `allowed` pins the ids the routine was
-- shown at claim time, so the app drops any id outside that set.
-- No phone, email, token or badge secret is ever stored here.

create table if not exists yi_connect.tp_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('summit_plan', 'profile_helper', 'radar', 'why_meet', 'ask')),
  delegate_id uuid not null references yi_connect.tp_delegates(id) on delete cascade,
  input jsonb not null default '{}'::jsonb,
  allowed jsonb,
  output jsonb,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists tp_ai_jobs_delegate_kind_idx
  on yi_connect.tp_ai_jobs (delegate_id, kind, created_at desc);
create index if not exists tp_ai_jobs_status_idx
  on yi_connect.tp_ai_jobs (status, created_at);

alter table yi_connect.tp_ai_jobs enable row level security;
revoke all on yi_connect.tp_ai_jobs from anon, authenticated, public;
grant all on yi_connect.tp_ai_jobs to service_role;
