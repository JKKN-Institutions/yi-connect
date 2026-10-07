-- ═══════════════════════════════════════════════════════════════════════
-- Yi-Future — durable counter for rate-limiting the PUBLIC returning-delegate
-- lookup (`lookupReturningDelegate` on /yi-future/join).
--
-- Context: #863 closed the actual leak on that action — it used to match on
-- email OR phone, so one email address returned that student's phone number.
-- It now requires email AND phone on the same row. That PR closed with an
-- explicit debt note: "No rate limiter on this action ... a durable per-IP
-- counter would need its own storage. Worth adding as defence-in-depth later."
-- This table is that storage.
--
-- One row per lookup attempt. `blocked = true` marks a refused attempt, so a
-- blocked address stays attributable after the fact. Read and written only by
-- lib/yi-future/delegate-lookup-guard.ts:
--   * per-IP cap    — 800 lookups / rolling 15 min  (rides idx_dla_ip_created)
--   * burst breaker — 1,200 lookups / rolling 5 min (rides idx_dla_created)
--
-- Applied to production 2026-08-11 via the Management API. This file is the
-- record of that change; it is idempotent, so re-running it against a database
-- that already has the table is a no-op.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists future.delegate_lookup_attempts (
  id         bigserial   primary key,
  ip         text        not null,
  blocked    boolean     not null default false,
  created_at timestamptz not null default now()
);

comment on table future.delegate_lookup_attempts is
  'Rate-limit counter for the public lookupReturningDelegate() Server Action. '
  'One row per lookup attempt; blocked=true marks a refused attempt. '
  'Written only by the service role. Rows older than 24h are dead weight and may be purged.';

-- Per-IP rolling-window count.
create index if not exists idx_dla_ip_created
  on future.delegate_lookup_attempts (ip, created_at desc);

-- Platform-wide burst-breaker count.
create index if not exists idx_dla_created
  on future.delegate_lookup_attempts (created_at desc);

-- RLS ON with ZERO policies: anon and authenticated are denied outright.
-- No policy is created on purpose — only the service role (which bypasses RLS)
-- ever touches this table, so there is no legitimate caller to write one for.
alter table future.delegate_lookup_attempts enable row level security;

-- Tables created through the Supabase Management API arrive with NO
-- service_role grant, which reads as an empty table rather than an error and
-- would leave the guard silently inert. The grant therefore lives here
-- explicitly rather than being assumed.
--
-- SELECT + INSERT only, deliberately: no DELETE means the public code path can
-- never purge its own audit trail. Cleanup is a privileged operation.
--
-- Guarded so the file is safe on a database where the Supabase roles are
-- absent (a bare local Postgres, for instance).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on future.delegate_lookup_attempts to service_role;
    grant usage, select on sequence future.delegate_lookup_attempts_id_seq to service_role;
  end if;

  -- Belt and braces against a schema whose default privileges hand new tables
  -- to the public roles. RLS already denies them; this removes the grant too.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on future.delegate_lookup_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on future.delegate_lookup_attempts from authenticated;
  end if;
end $$;
