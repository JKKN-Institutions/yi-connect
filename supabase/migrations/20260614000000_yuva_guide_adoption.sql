-- Yi Youth Academy guide — adoption layer (progress + instrumentation).
-- Applied to prod 2026-06-14 via the Management API; captured here for the record.
--
-- guide_progress : per-user setup-checklist completion, RLS-locked to the owner.
--   Accessed via the AUTHENTICATED user client (auth.uid() = user_id), so only
--   Supabase-authed staff persist progress; students (cookie session) and
--   applicants (anonymous) get the plain guide.
-- guide_events   : append-only adoption funnel. Written ONLY by the service role
--   (the logGuideEvent server action, which validates the payload), so student /
--   anonymous events log without needing anon grants. No client read/write.

create table if not exists yi_connect.guide_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  persona      text not null,
  step_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, persona, step_key)
);
alter table yi_connect.guide_progress enable row level security;
drop policy if exists guide_progress_own_select on yi_connect.guide_progress;
drop policy if exists guide_progress_own_insert on yi_connect.guide_progress;
drop policy if exists guide_progress_own_delete on yi_connect.guide_progress;
create policy guide_progress_own_select on yi_connect.guide_progress for select using (auth.uid() = user_id);
create policy guide_progress_own_insert on yi_connect.guide_progress for insert with check (auth.uid() = user_id);
create policy guide_progress_own_delete on yi_connect.guide_progress for delete using (auth.uid() = user_id);
grant select, insert, delete on yi_connect.guide_progress to authenticated;

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
-- No client policies on purpose: only the service role writes; analytics reads
-- go through the service role / an admin view.
create index if not exists guide_events_analytics_idx on yi_connect.guide_events (name, persona, created_at);

-- Activation question (run once events flow): do guide deep-link clickers
-- activate more than non-clickers? Replace `your_activation_event`:
--   with link_clickers as (
--     select distinct user_id from yi_connect.guide_events
--     where name = 'step_link_click' and user_id is not null
--   )
--   select (select count(*) from link_clickers) as clicked,
--          (select count(*) from link_clickers lc
--             where exists (select 1 from your_activation_event a where a.user_id = lc.user_id))
--            as clicked_and_activated;
