-- Multi-track jury panels (Yi-Future)
-- A jury member may sit on MULTIPLE track juries; each track jury holds up to
-- 10 members (cap enforced in the application layer, app/yi-future/actions/jury.ts).
-- Supersedes the legacy single-track column future.jury_assignments.track_id:
-- the column is KEPT in place (old data preserved) but is no longer written.

create table if not exists future.jury_track_assignments (
  jury_id uuid not null references future.jury_assignments(id) on delete cascade,
  track_id uuid not null references future.tracks(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (jury_id, track_id)
);

create index if not exists idx_jury_track_assignments_track_id
  on future.jury_track_assignments (track_id);

-- Backfill from the legacy single-track column so existing assignments carry over.
insert into future.jury_track_assignments (jury_id, track_id)
select id, track_id
from future.jury_assignments
where track_id is not null
on conflict do nothing;

-- Service-role only: RLS enabled with NO policies (all app access goes through
-- the service client in server actions; anon/authenticated get nothing).
alter table future.jury_track_assignments enable row level security;
