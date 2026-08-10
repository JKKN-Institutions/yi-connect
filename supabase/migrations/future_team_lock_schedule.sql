-- Yi-Future: per-chapter deadline after which a chapter's teams lock.
--
-- Field request 2026-08-10. Locking a team ("we're final") was something only
-- a CAPTAIN could do, from their own team page. Chapters wanted a cut-off:
-- at time T, every team in this chapter locks, whether its captain got round
-- to it or not.
--
-- Per chapter, not per edition: chapters run their finals on different dates
-- (Erode is 12 Aug while others are weeks later), so one national date would
-- lock some chapters long before they are ready and others after their event.
--
-- ── applied_at is the important column ───────────────────────────────
-- The sweep runs every 5 minutes, so it must lock ONCE per deadline and not
-- keep re-locking. Without applied_at, an admin who deliberately unlocked a
-- team after the deadline would find it re-locked within 5 minutes, with no
-- way to keep it open short of moving the date.
--
-- So: the sweep only acts on rows where lock_at has passed AND applied_at is
-- null, and stamps applied_at in the same run. Changing lock_at clears
-- applied_at (see setTeamLockDeadline), so a re-scheduled deadline fires again.
--
-- Applied to production 2026-08-10 via the Management API.

create table if not exists future.team_lock_schedule (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references yi.chapters(id) on delete cascade,
  edition_id  uuid not null references future.editions(id) on delete cascade,
  -- When this chapter's teams should lock. Null is not stored; clearing the
  -- deadline deletes the row.
  lock_at     timestamptz not null,
  -- Set by the sweep the first time it acts on this deadline. Null = pending.
  applied_at  timestamptz,
  -- How many teams that run actually locked, for the admin to see afterwards.
  locked_count integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uniq_team_lock_per_chapter_edition
    unique (chapter_id, edition_id)
);

-- The sweep's read path: "deadlines that have passed and not yet applied".
create index if not exists idx_team_lock_due
  on future.team_lock_schedule (lock_at)
  where applied_at is null;

-- Tables created through the Management API get no grants by default, and the
-- app reads and writes exclusively through the service client.
grant select, insert, update, delete on future.team_lock_schedule to service_role;
