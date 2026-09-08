-- Yi-Future: durable record of every STAFF OVERRIDE placement.
--
-- ⚠️  NOT APPLIED TO PRODUCTION. This file is committed only. Until an admin
--     applies it, `placeDelegateDirectly` REFUSES to place anybody (it writes
--     the record BEFORE the membership, so a missing log means no override can
--     happen at all) and the placement screen says so on screen. That is the
--     intended fail-closed behaviour, not a bug.
--
-- ── Why this table exists ────────────────────────────────────────────
-- The locked product rule (2026-06-20, Nashik report) is that an admin may NOT
-- drop a student onto a team: the student must accept an invitation
-- (app/yi-future/actions/members.ts#inviteMember →
--  app/yi-future/actions/team-invites.ts#respondInvite). That rule is unchanged
-- and is still the ONLY path the placement screen's approve button uses.
--
-- The Director's decision (2026-08-11) added one exception: a chapter admin may
-- place a specific student directly, case by case — and "every such override
-- must be recorded so you can see who was placed without consenting and by
-- whom". This table IS that record. No row here ⇒ no override happened.
--
-- ── Why it holds no foreign keys ─────────────────────────────────────
-- Deliberate. `future.delegates` and `future.teams` are both deletable from the
-- admin UI, and every existing FK into them is ON DELETE CASCADE. An audit row
-- that cascades away is evidence that disappears exactly when someone deletes
-- the delegate they placed — the one moment it matters most. So the ids are
-- stored as plain uuids for joining, and `delegate_name` / `team_name` /
-- `placed_by_*` are SNAPSHOTS taken at the time of the override so the row
-- still reads in plain English after the rows it points at are gone.
-- Referential integrity is enforced on the write path instead: the action
-- re-resolves the delegate and the team against the gated chapter + the active
-- edition before it writes anything.
--
-- ── Why `outcome` exists (the half-applied case) ─────────────────────
-- An override is two writes: this record, then future.team_members. They are
-- written in THAT order and never the reverse, so the worst crash leaves a row
-- saying "an override was attempted, outcome unknown" rather than a student
-- silently on a team with nothing recorded.
--   pending  — record written, membership not confirmed. Read it as "someone
--              tried; go and look at the team".
--   applied  — membership row written. This is a completed override.
--   failed   — membership refused (team filled up, delegate joined elsewhere,
--              trigger fired); `error_detail` says why. Nothing was placed.

create table if not exists future.team_placement_overrides (
  id                  uuid primary key default gen_random_uuid(),

  -- Scope. chapter_id is the gate the action was authorised against.
  chapter_id          uuid not null,
  edition_id          uuid not null,

  -- Who was placed, and where. Ids for joining, names so the row survives them.
  delegate_id         uuid not null,
  delegate_name       text not null,
  team_id             uuid not null,
  team_name           text not null,

  -- Who did it. auth.users.id plus a snapshot of how they were identified at
  -- the time; 'national' vs 'chapter' says whether it was the chapter's own
  -- chair or a national admin reaching into the chapter.
  placed_by_user_id   uuid not null,
  placed_by_name      text,
  placed_by_email     text,
  placed_by_scope     text not null
    check (placed_by_scope in ('national', 'chapter')),

  -- True when the student was sitting on an unanswered invitation at the moment
  -- they were overridden — i.e. the admin stopped waiting for an answer rather
  -- than placing a student nobody had asked.
  had_pending_invite  boolean not null default false,

  -- Optional. The Director asked for "optionally why", so it is nullable; the
  -- UI records whatever the admin typed, and records its absence honestly.
  reason              text,

  outcome             text not null default 'pending'
    check (outcome in ('pending', 'applied', 'failed')),
  error_detail        text,

  created_at          timestamptz not null default now(),
  applied_at          timestamptz
);

comment on table future.team_placement_overrides is
  'Audit log of staff-override team placements (consent bypassed). Written BEFORE the future.team_members row; no row here means no override happened. Never deleted.';
comment on column future.team_placement_overrides.outcome is
  'pending = attempted, membership unconfirmed; applied = student joined; failed = refused, nothing placed.';

-- The screen's read path: this chapter's overrides, newest first.
create index if not exists idx_team_placement_overrides_chapter
  on future.team_placement_overrides (chapter_id, edition_id, created_at desc);

-- "Was this student placed by an override?" — used when auditing one delegate.
create index if not exists idx_team_placement_overrides_delegate
  on future.team_placement_overrides (delegate_id);

-- RLS on with NO policies = deny all. Every read and write goes through the
-- service client inside a server action that has already run
-- requireChapterAdmin(chapterId), so anon and authenticated must get nothing
-- directly: this log names students who did not consent and the admins who
-- placed them, and it is not a delegate-facing table.
alter table future.team_placement_overrides enable row level security;

-- Tables created through the Supabase Management API get NO default grants for
-- service_role (default privileges only cover the postgres role). Without this
-- grant the app's reads fail with "permission denied for table
-- team_placement_overrides" — and a swallowed permission error reads as an
-- EMPTY log, i.e. "no overrides ever happened", which is the worst possible
-- lie for an audit table. The read path surfaces the error instead of
-- returning [], but the grant is what makes it work at all.
--
-- DELETE is deliberately NOT granted: the application must never be able to
-- erase an override record. Correcting a bad placement means removing the
-- member (which is its own action) and leaving this row standing.
grant select, insert, update on future.team_placement_overrides to service_role;
