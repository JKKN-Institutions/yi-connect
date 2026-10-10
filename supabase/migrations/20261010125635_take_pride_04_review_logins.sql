-- Take Pride 2026: review logins for outside organisers trying the app.
--
-- ADDITIVE ONLY: three new tp_* tables, nothing else is touched.
--
--   tp_review_logins    a few shared logins (admin / delegate / catalyst).
--                       password_hash is scrypt (node:crypto) with a random
--                       salt. Rows are seeded by hand, NEVER in a migration,
--                       so no password or hash lives in the repo.
--                       admin    -> a review desk session (sample data only)
--                       delegate -> sent to target_token's delegate pass
--                       catalyst -> sent to target_token's partner page
--   tp_review_sessions  one row per signed-in review admin; the cookie
--                       "tp_review" holds only the id (32 hex).
--   tp_review_attempts  failed sign-ins, for the 5-tries-in-15-minutes lock.
--
-- RLS ON, ZERO policies, service_role only — same as take_pride_01.

create table if not exists yi_connect.tp_review_logins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username = lower(username)),
  password_hash text not null,
  role text not null check (role in ('admin', 'delegate', 'catalyst')),
  target_token text,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists yi_connect.tp_review_sessions (
  id text primary key check (id ~ '^[0-9a-f]{32}$'),
  login_id uuid not null references yi_connect.tp_review_logins(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists tp_review_sessions_login_idx
  on yi_connect.tp_review_sessions (login_id);

create table if not exists yi_connect.tp_review_attempts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists tp_review_attempts_username_idx
  on yi_connect.tp_review_attempts (username, attempted_at desc);

do $$
declare t text;
begin
  foreach t in array array['tp_review_logins', 'tp_review_sessions', 'tp_review_attempts'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;
