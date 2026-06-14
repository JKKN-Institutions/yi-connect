-- Smart Guide — add an `app` discriminator to the SHARED guide tables.
--
-- All four Yi guides (dashboard, Yi-Future, Yuva, YIP) write to
-- yi_connect.guide_progress / guide_events. The same persona/lane NAME can exist
-- in more than one app (e.g. "national"), and shared section ids like "get-help"
-- produce the same step_key — so the old primary key (user_id, persona, step_key)
-- let two apps' progress collide on one row. Adding `app` to the key namespaces
-- each app's progress + events.
--
-- Default 'unknown' keeps already-deployed code (which doesn't send `app`) working
-- through the deploy window; each app's actions.ts now sends its own value
-- ('dashboard' | 'future' | 'yuva'). Any legacy rows land under 'unknown'.

-- guide_progress: add column, repoint the primary key to include it.
alter table yi_connect.guide_progress
  add column if not exists app text not null default 'unknown';

alter table yi_connect.guide_progress drop constraint if exists guide_progress_pkey;
alter table yi_connect.guide_progress
  add constraint guide_progress_pkey primary key (user_id, app, persona, step_key);

-- guide_events: add column (append-only, no PK change) + a per-app analytics index.
alter table yi_connect.guide_events
  add column if not exists app text not null default 'unknown';

create index if not exists guide_events_app_analytics_idx
  on yi_connect.guide_events (app, name, persona, created_at);
