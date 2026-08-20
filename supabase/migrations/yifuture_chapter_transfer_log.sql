-- Chapter transfers: move a college (with its delegates) or a team (with its
-- members) from one Yi chapter to another, and keep a record of every move.
--
-- WHY THIS TABLE EXISTS
-- Students register by choosing a chapter from a list, and they get it wrong.
-- The Kanchipuram case that prompted this: 15 delegates across 12 college
-- records, every college physically in Ranipet / Kalavai / Vellore, all filed
-- under Kanchipuram. Nothing in the app could move them — updateDelegate edits
-- name, email, phone, age, course, year, college and home state but NOT
-- chapter_id, and updateCollege cannot change a college's chapter either. The
-- only remedy was editing the database by hand.
--
-- WHY A NEW TABLE RATHER THAN AN EXISTING LOG
-- future has four log tables and none of them is a home for this:
--   evaluation_audit_log  — changes to one jury scorecard
--   edition_stage_log     — an edition moving between stages
--   notification_log      — outbound email/push attempts
--   outreach_log          — contact attempts with an institution
-- A chapter transfer is none of those. Per CLAUDE.md #26 the check for an
-- existing mechanism was run first; this is a genuinely new kind of event, not
-- a parallel copy of one that already exists.
--
-- WHY IT RECORDS NAMES AS TEXT
-- The point of the record is to answer "who moved this, and what was it called
-- at the time" long after the row itself may have been renamed or deleted. A
-- pure foreign key would silently change its answer.

create table if not exists future.chapter_transfer_log (
  id               uuid primary key default gen_random_uuid(),
  transferred_at   timestamptz not null default now(),

  -- Who did it. Text, not a FK: the record must survive the actor's row.
  transferred_by   text not null,

  -- What moved. 'college' also moves that college's delegates in the source
  -- chapter; 'team' also moves that team's members.
  entity_type      text not null check (entity_type in ('college', 'team')),
  entity_id        uuid not null,
  entity_name      text not null,

  from_chapter_id  uuid not null references yi.chapters(id),
  to_chapter_id    uuid not null references yi.chapters(id),
  from_chapter_name text not null,
  to_chapter_name   text not null,

  -- How many delegate rows this particular move carried with it.
  delegates_moved  integer not null default 0,

  reason           text,

  -- A transfer can move several colleges and teams in one click. This groups
  -- the rows written by a single submission so the whole action can be read
  -- back (and, if it ever needs undoing, reversed) as one unit.
  batch_id         uuid not null
);

create index if not exists idx_chapter_transfer_log_batch
  on future.chapter_transfer_log (batch_id);
create index if not exists idx_chapter_transfer_log_entity
  on future.chapter_transfer_log (entity_type, entity_id);
create index if not exists idx_chapter_transfer_log_when
  on future.chapter_transfer_log (transferred_at desc);

-- Deny-all RLS. Every read and write goes through the server action, which
-- gates on national admin. Tables created via the Management API get no
-- service_role grant automatically, so it is granted explicitly here.
alter table future.chapter_transfer_log enable row level security;

grant select, insert on future.chapter_transfer_log to service_role;

-- No update or delete grant, deliberately: a transfer record is history. If a
-- move was wrong, the fix is to transfer back, which writes a second row and
-- leaves both visible.
