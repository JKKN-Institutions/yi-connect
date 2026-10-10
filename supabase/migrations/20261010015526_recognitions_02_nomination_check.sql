-- =====================================================================
-- recognitions_02_nomination_check — Yi Recognitions: Regional Chair + RM
-- check of every nomination before it is scored.
--
-- Source: Piyush Garg's 2026 deck adds a step between nominations and
-- scoring: "Regional Chairs + Regional Mentors validate nominations for
-- eligibility and completeness." The Director's decisions (2026-10-10):
--   1. BOTH must pass a nomination: the Regional Chair of the chapter's
--      region AND a Regional Mentor on that award for that region. Either
--      may send it back.
--   2. Sending back needs a note. The chapter fixes and resubmits until the
--      cycle's fix deadline. A resubmission CLEARS both passes (both must
--      pass the final version). Still sent back after the fix deadline =
--      out of the race.
--   3. Only a nomination both checkers passed is scored.
--   4. Checks close at the cycle's check deadline.
--
-- NOMINATION STATUS
--   draft      the chapter is still writing it
--   submitted  filed; awaiting the two checks
--   returned   a checker sent it back with a note; the chapter may fix it
--   checked    both checkers passed it; it is in the race and is scored
--   excluded   out of the race (reserved for an explicit exclusion; the app
--              ALSO treats "returned past the fix deadline" and "still
--              awaiting checks past the check deadline" as excluded at READ
--              time, so no cron is needed)
--
-- Regional Chair is a yi_directory role (mother source), NOT a table here:
--   yi_directory.role_assignments app='recognitions', role='regional_chair',
--   yi_zone = region code (ER, NER, NR, SRTKKA, SRTN, WR).
--
-- NOT APPLIED to production by the build. The Director applies it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cycle: two new deadlines. Order (enforced in the app):
--    nomination < fix < check < stage1.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_cycles
  add column if not exists fix_deadline timestamptz,
  add column if not exists check_deadline timestamptz;

-- ---------------------------------------------------------------------
-- 2. Nomination: check columns. rm_recommended_by / nmt_approved_by are
--    NOT reused: they are the optional "RM recommends to NMT" flags.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  add column if not exists rc_checked_by uuid,
  add column if not exists rc_checked_at timestamptz,
  add column if not exists rm_checked_by uuid,
  add column if not exists rm_checked_at timestamptz,
  add column if not exists returned_by uuid,
  add column if not exists returned_at timestamptz,
  add column if not exists return_note text;

-- ---------------------------------------------------------------------
-- 3. Status CHECK. Migration 01 declared it INLINE and UNNAMED, so Postgres
--    generated the name. Verified on production 2026-10-10 via pg_constraint:
--      recognition_nominations_status_check
--      CHECK (status = ANY (ARRAY['draft','submitted']))
--    It MUST be dropped by that exact name. A mis-named DROP IF EXISTS is a
--    silent no-op, and the old CHECK would then AND with the new one and
--    reject every new state.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_status_check;

-- Fail loudly if any other CHECK still pins status to the old two values.
do $$
declare leftover text;
begin
  select string_agg(conname, ', ') into leftover
  from pg_constraint
  where conrelid = 'yi_connect.recognition_nominations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%'
    and pg_get_constraintdef(oid) not ilike '%returned%';
  if leftover is not null then
    raise exception 'recognitions_02: an old status CHECK survived: %', leftover;
  end if;
end;
$$;

alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_status_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_status_ck
  check (status in ('draft', 'submitted', 'returned', 'checked', 'excluded'));

-- 'checked' means both passed; 'returned' always carries its note.
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_check_state_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_check_state_ck
  check (
    (status <> 'checked' or (rc_checked_by is not null and rm_checked_by is not null))
    and (status <> 'returned' or (return_note is not null and btrim(return_note) <> ''))
  );

create index if not exists recognition_nominations_award_status
  on yi_connect.recognition_nominations (award_id, status);

-- ---------------------------------------------------------------------
-- 4. Freeze trigger, rewritten for the new states.
--    Content (sections A-D, snapshots, ids) may change ONLY while the row is
--    'draft' or 'returned'. Status may move only along:
--      draft     -> submitted
--      submitted -> returned | checked | excluded
--      returned  -> submitted (resubmit) | excluded
--      checked   -> excluded
--    A resubmission must arrive with BOTH passes cleared: the checkers pass
--    the final version, never an earlier one.
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_freeze_submitted_nomination()
returns trigger
language plpgsql
as $$
declare
  content_changed boolean;
begin
  content_changed :=
       new.reasons is distinct from old.reasons
    or new.flagship_event is distinct from old.flagship_event
    or new.hosted_event is distinct from old.hosted_event
    or new.hosted_event_name is distinct from old.hosted_event_name
    or new.hosted_event_type is distinct from old.hosted_event_type
    or new.announcement_draft is distinct from old.announcement_draft
    or new.category is distinct from old.category
    or new.region is distinct from old.region
    or new.award_id is distinct from old.award_id
    or new.chapter_id is distinct from old.chapter_id;

  if old.status in ('submitted', 'checked', 'excluded') and content_changed then
    raise exception 'recognition: a % nomination is frozen', old.status;
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'draft'     and new.status = 'submitted')
      or (old.status = 'submitted' and new.status in ('returned', 'checked', 'excluded'))
      or (old.status = 'returned'  and new.status in ('submitted', 'excluded'))
      or (old.status = 'checked'   and new.status = 'excluded')
    ) then
      raise exception 'recognition: a nomination cannot move from % to %', old.status, new.status;
    end if;
  end if;

  -- submitted_at is set when filed and again on a resubmission, never otherwise.
  if new.submitted_at is distinct from old.submitted_at
     and not (old.status in ('draft', 'returned') and new.status = 'submitted') then
    raise exception 'recognition: submitted_at changes only when a nomination is (re)submitted';
  end if;

  if old.status = 'returned' and new.status = 'submitted'
     and (new.rc_checked_by is not null or new.rm_checked_by is not null) then
    raise exception 'recognition: a resubmitted nomination must clear both passes';
  end if;

  return new;
end;
$$;

-- Only a draft may be deleted (was: anything but 'submitted').
create or replace function yi_connect.recognition_refuse_submitted_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from 'draft' then
    raise exception 'recognition: a % % cannot be deleted', old.status, tg_table_name;
  end if;
  return old;
end;
$$;

-- Triggers from migration 01 already point at these two functions; recreate
-- them anyway so this file is self-sufficient.
drop trigger if exists recognition_nominations_freeze on yi_connect.recognition_nominations;
create trigger recognition_nominations_freeze
  before update on yi_connect.recognition_nominations
  for each row execute function yi_connect.recognition_freeze_submitted_nomination();

drop trigger if exists recognition_nominations_no_delete on yi_connect.recognition_nominations;
create trigger recognition_nominations_no_delete
  before delete on yi_connect.recognition_nominations
  for each row execute function yi_connect.recognition_refuse_submitted_delete();

-- ---------------------------------------------------------------------
-- 5. Access unchanged: RLS on, zero policies, service_role only (same as 01).
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations enable row level security;
alter table yi_connect.recognition_cycles enable row level security;
revoke all on yi_connect.recognition_nominations from anon, authenticated;
revoke all on yi_connect.recognition_cycles from anon, authenticated;
grant all on yi_connect.recognition_nominations to service_role;
grant all on yi_connect.recognition_cycles to service_role;
