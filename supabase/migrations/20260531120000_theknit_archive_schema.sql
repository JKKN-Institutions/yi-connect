-- ============================================================================
-- The Knit (SRTN) — Archive Schema
-- ============================================================================
-- Migrates the finished "The Knit / SRTN" networking-event app into yi-connect
-- as a peer sub-app, following the same pattern as yifi (`future`) and yip.
--
-- Source: jicate-prototypes project (ileccfzrcrkoglssvxgm), public.theknitsrtn_*
-- Target: this project (bkmpbcoxbjyafieabxao), new isolated schema `theknit`
--
-- The event is OVER. These tables are a READ-ONLY ARCHIVE:
--   - structure faithfully reproduced from the live source (introspected)
--   - RLS enabled, SELECT allowed to anon + authenticated
--   - NO insert / update / delete policies (archive is frozen).
--     Admin/maintenance still possible via service_role (bypasses RLS).
--
-- Data rows are loaded separately (service-role bulk insert), NOT in this file,
-- to keep schema and data steps independently verifiable.
-- ============================================================================

create schema if not exists theknit;

-- ----------------------------------------------------------------------------
-- theknit.theknitsrtn_chapters  (chapter metadata from Google Form responses)
-- ----------------------------------------------------------------------------
create table if not exists theknit.theknitsrtn_chapters (
  id            text primary key,
  chapter_name  text not null,
  city          text,
  submitted_by  text,
  contact       text,
  practices     jsonb default '[]'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- theknit.theknitsrtn_state  (singleton app state)
-- ----------------------------------------------------------------------------
create table if not exists theknit.theknitsrtn_state (
  id                  text primary key default 'singleton'::text,
  presenting_chapter  text,
  updated_at          timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- theknit.theknitsrtn_threads  (the connection events — the core dataset)
-- ----------------------------------------------------------------------------
create table if not exists theknit.theknitsrtn_threads (
  id            uuid primary key default gen_random_uuid(),
  from_chapter  text not null,
  to_chapter    text not null,
  thread_type   text not null,
  note          text,
  session_id    text,
  created_at    timestamptz default now(),
  user_name     text,
  is_ec         boolean default false,
  connection_id text
);

-- Faithful to source: unique partial index preventing duplicate
-- (session_id, connection_id) pairs when a connection_id is present.
create unique index if not exists idx_theknit_threads_session_connection
  on theknit.theknitsrtn_threads using btree (session_id, connection_id)
  where (connection_id is not null);

-- Added for archive: report/live views order threads by created_at. Not in the
-- original source, but harmless and speeds up the chronological replay queries.
create index if not exists idx_theknit_threads_created
  on theknit.theknitsrtn_threads using btree (created_at);

-- ----------------------------------------------------------------------------
-- Row Level Security — READ-ONLY ARCHIVE
-- ----------------------------------------------------------------------------
alter table theknit.theknitsrtn_chapters enable row level security;
alter table theknit.theknitsrtn_state    enable row level security;
alter table theknit.theknitsrtn_threads  enable row level security;

-- SELECT-only policies for anon + authenticated. No write policies on purpose.
create policy "theknit_chapters_read" on theknit.theknitsrtn_chapters
  for select to anon, authenticated using (true);

create policy "theknit_state_read" on theknit.theknitsrtn_state
  for select to anon, authenticated using (true);

create policy "theknit_threads_read" on theknit.theknitsrtn_threads
  for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- Grants — let the API roles reach the schema (read-only)
-- ----------------------------------------------------------------------------
grant usage on schema theknit to anon, authenticated, service_role;

grant select on all tables in schema theknit to anon, authenticated;
grant all    on all tables in schema theknit to service_role;

-- Future-proof: same grants apply to any table later added to this schema
alter default privileges in schema theknit
  grant select on tables to anon, authenticated;
alter default privileges in schema theknit
  grant all on tables to service_role;

-- ============================================================================
-- NOTE (applied OUTSIDE this migration, via Management API):
--   The project's PostgREST exposed-schema list must include `theknit` so the
--   supabase-js client can reach it via .schema('theknit'). Current list:
--     public, graphql_public, future, yi, yi_directory, yi_connect, yip
--   -> becomes:
--     public, graphql_public, future, yi, yi_directory, yi_connect, yip, theknit
--   (Same step previously done for `future` and `yip`.)
-- ============================================================================
