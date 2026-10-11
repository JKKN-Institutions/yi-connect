-- Take Pride 2026: partner-side AI job queue (Catalyst Partner meeting
-- briefs, lead follow-up drafts, organiser sales chasers).
--
-- ADDITIVE ONLY. One new table, same access model as take_pride_01 and
-- take_pride_05_ai_jobs: RLS ENABLED with ZERO policies, only the service
-- client reads or writes, behind a partner's secret link token, the
-- organiser desk gate (requireTpDesk) or the routine's X-Cron-Secret
-- (app/take-pride/api/ai-partners/route.ts).
--
-- tp_ai_jobs (delegate jobs) is NOT touched: its kind CHECK and NOT NULL
-- delegate_id stay as they are.
--
-- The production app NEVER calls an LLM. A request becomes a 'pending' row;
-- the out-of-band claude.ai routine claims rows (pending -> generating),
-- writes text off-platform and POSTs it back (generating -> ready | failed).
-- `allowed` pins the one delegate a brief / follow-up was written about.
-- No phone, email, token or badge secret is ever stored here.

create table if not exists yi_connect.tp_partner_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('partner_brief', 'lead_followup', 'sales_chaser')),
  partner_id uuid not null references yi_connect.tp_partners(id) on delete cascade,
  subject_delegate_id uuid references yi_connect.tp_delegates(id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  allowed jsonb,
  output jsonb,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists tp_partner_ai_jobs_partner_kind_idx
  on yi_connect.tp_partner_ai_jobs (partner_id, kind, created_at desc);
create index if not exists tp_partner_ai_jobs_status_idx
  on yi_connect.tp_partner_ai_jobs (status, created_at);
create index if not exists tp_partner_ai_jobs_subject_idx
  on yi_connect.tp_partner_ai_jobs (subject_delegate_id)
  where subject_delegate_id is not null;

alter table yi_connect.tp_partner_ai_jobs enable row level security;
revoke all on yi_connect.tp_partner_ai_jobs from anon, authenticated, public;
grant all on yi_connect.tp_partner_ai_jobs to service_role;
