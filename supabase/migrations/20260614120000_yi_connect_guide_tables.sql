-- Smart Guide — progress + instrumentation tables (yi_connect schema).
-- Powers the role-aware /user-guide: checkable steps with saved per-user
-- progress, and an events funnel to measure adoption. Both tables are per-user
-- and RLS-locked to the owner. Accessed by lib/guide/actions.ts via
-- supabase.schema('yi_connect').from('guide_*').

-- ── Progress: which steps each user has completed, per persona lane ──────────
create table if not exists yi_connect.guide_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  persona      text not null,
  step_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, persona, step_key)
);

alter table yi_connect.guide_progress enable row level security;

-- A user may only see and change their OWN progress rows.
drop policy if exists "guide_progress_own_select" on yi_connect.guide_progress;
create policy "guide_progress_own_select" on yi_connect.guide_progress
  for select using (auth.uid() = user_id);
drop policy if exists "guide_progress_own_insert" on yi_connect.guide_progress;
create policy "guide_progress_own_insert" on yi_connect.guide_progress
  for insert with check (auth.uid() = user_id);
drop policy if exists "guide_progress_own_delete" on yi_connect.guide_progress;
create policy "guide_progress_own_delete" on yi_connect.guide_progress
  for delete using (auth.uid() = user_id);

-- ── Events: the funnel you measure adoption with ────────────────────────────
create table if not exists yi_connect.guide_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null,
  persona    text not null,
  surface    text not null,
  step_key   text,
  context    text,
  created_at timestamptz not null default now()
);

alter table yi_connect.guide_events enable row level security;

-- Users may INSERT their own events. There is intentionally NO select policy:
-- analytics reads happen via the service role (or an admin-only view), so a user
-- can never read the whole event stream.
drop policy if exists "guide_events_own_insert" on yi_connect.guide_events;
create policy "guide_events_own_insert" on yi_connect.guide_events
  for insert with check (auth.uid() = user_id or user_id is null);

create index if not exists guide_events_analytics_idx
  on yi_connect.guide_events (name, persona, created_at);

-- ── Grants: PostgREST needs table privileges for the authenticated role even
--    with RLS (RLS narrows rows; GRANT is what lets the role touch the table). ─
grant usage on schema yi_connect to authenticated;
grant select, insert, delete on yi_connect.guide_progress to authenticated;
grant insert on yi_connect.guide_events to authenticated;

-- ── The activation question, ready to run once events flow in ───────────────
-- "Do guide users activate more?" — compare a downstream activation event
-- between users who clicked a guide deep-link and those who didn't:
--
--   with link_clickers as (
--     select distinct user_id from yi_connect.guide_events
--     where name = 'step_link_click' and user_id is not null
--   )
--   select count(*) as clicked from link_clickers;
