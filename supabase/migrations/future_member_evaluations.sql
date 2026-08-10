-- Yi-Future: per-delegate jury scores, for individual recognition.
--
-- Field request 2026-08-10: the jury screen scored the TEAM only. Chapters
-- wanted to recognise individuals (best delegate and similar) off the same
-- screen, while the team was being judged.
--
-- Kept in its own table rather than as columns on future.evaluations because
-- the grain is different: evaluations is one row per (jury, team, event),
-- this is one row per (jury, team, event, DELEGATE).
--
-- These scores are deliberately NOT part of the team total. future.evaluations
-- .total_score and everything downstream of it are untouched, so adding this
-- cannot move a team's rank.
--
-- Applied to production 2026-08-10 via the Management API.

create table if not exists future.member_evaluations (
  id            uuid primary key default gen_random_uuid(),
  jury_id       uuid not null references future.jury_assignments(id) on delete cascade,
  team_id       uuid not null references future.teams(id) on delete cascade,
  delegate_id   uuid not null references future.delegates(id) on delete cascade,
  event_id      uuid not null references future.events(id) on delete cascade,
  -- {contribution: 8, communication: 7, subject_command: 9}
  -- Keys come from MEMBER_CRITERIA in lib/yi-future/member-rubric.ts.
  scores        jsonb not null default '{}'::jsonb,
  total_score   numeric(6,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One score per juror per delegate per event: re-scoring updates in place
  -- and is what the upsert in saveMemberEvaluations targets.
  constraint uniq_member_eval_per_juror
    unique (jury_id, team_id, delegate_id, event_id)
);

-- The read path is "this juror's scores for this team at this event".
create index if not exists idx_member_eval_jury_team_event
  on future.member_evaluations (jury_id, team_id, event_id);

-- Reporting path: every score a delegate received.
create index if not exists idx_member_eval_delegate
  on future.member_evaluations (delegate_id);

-- Tables created through the Management API get no grants by default, and the
-- app reads and writes exclusively through the service client.
grant select, insert, update, delete on future.member_evaluations to service_role;
