-- Yi-Future: durable record of every time a submitted jury score was REOPENED.
--
-- ── Why this exists ──────────────────────────────────────────────────
-- Before this, a submitted evaluation was final and there was no way back.
-- future.evaluations refuses to be overwritten once status = 'submitted'
-- (app/yi-future/actions/evaluations.ts), and the refusal it returns reads
-- "Evaluation already submitted. Ask admin to unlock if needed." — but no
-- unlock existed anywhere in the codebase, for any role. A juror who
-- mis-tapped a slider and submitted had produced a permanent wrong score that
-- only a direct database edit could correct.
--
-- Reopening is now possible, and because these scores decide the awards, every
-- reopen is recorded here. No row here ⇒ no unlock happened.
--
-- ── Why it holds no foreign keys ─────────────────────────────────────
-- Same reasoning as future.team_placement_overrides. Teams and evaluations are
-- deletable, and the existing FKs into them cascade. An audit row that cascades
-- away is evidence that disappears exactly when someone deletes the thing it
-- describes. Ids are stored as plain uuids for joining; team_name, jury_name
-- and score_at_unlock are SNAPSHOTS so the row still reads in plain English
-- after the rows it points at are gone.
--
-- ── Why the score is snapshotted ─────────────────────────────────────
-- Unlocking deliberately LEAVES the juror's numbers in place so they can
-- correct the one that was wrong rather than re-enter all six from memory.
-- That means the score is about to be edited, so the value at the moment of
-- unlock is captured here — otherwise "what did it say before?" is
-- unanswerable, which is the question an award dispute actually asks.

create table if not exists future.evaluation_unlocks (
  id                   uuid primary key default gen_random_uuid(),

  -- What was reopened.
  evaluation_id        uuid not null,
  team_id              uuid not null,
  team_name            text not null,
  jury_id              uuid not null,
  jury_name            text,

  -- Scope the unlock was authorised against.
  chapter_id           uuid not null,
  edition_id           uuid not null,

  -- The score as it stood the instant before it was reopened.
  score_at_unlock      numeric,

  -- Who did it. 'chapter' = the chapter's own admin acting on their own
  -- chapter; 'national' = a national admin reaching in.
  unlocked_by_user_id  uuid not null,
  unlocked_by_name     text,
  unlocked_by_email    text,
  unlocked_by_scope    text not null
    check (unlocked_by_scope in ('national', 'chapter')),

  reason               text,

  created_at           timestamptz not null default now()
);

comment on table future.evaluation_unlocks is
  'Audit log of reopened jury evaluations. Written BEFORE the evaluation is set back to draft; no row here means no unlock happened. Never updated, never deleted.';
comment on column future.evaluation_unlocks.score_at_unlock is
  'total_score as it stood immediately before the reopen, snapshotted because the juror is about to edit it.';

-- The chapter screen reads its own chapter's unlocks, newest first.
create index if not exists idx_evaluation_unlocks_chapter
  on future.evaluation_unlocks (chapter_id, edition_id, created_at desc);

-- "Has this particular score been reopened, and how often?"
create index if not exists idx_evaluation_unlocks_evaluation
  on future.evaluation_unlocks (evaluation_id, created_at desc);

-- RLS on with NO policies = deny all. Every read and write goes through the
-- service client inside a server action that has already checked the caller is
-- an admin of THIS chapter. This log names jurors and the admins who reopened
-- their scores; it is not delegate-facing and not juror-facing.
alter table future.evaluation_unlocks enable row level security;

-- Tables created through the Supabase Management API get NO default grants for
-- service_role. Without this the write fails and — because a swallowed error on
-- an audit table reads as "no unlocks ever happened" — that is the worst
-- possible failure mode. The action refuses to unlock at all if it cannot
-- write this row first, so the grant is what makes the feature work.
--
-- UPDATE and DELETE are deliberately NOT granted: an unlock record is
-- write-once. Correcting a bad unlock means unlocking again (which writes
-- another row), never editing or erasing the history.
grant select, insert on future.evaluation_unlocks to service_role;
