-- =====================================================================
-- recognitions_03_nl_added_nomination — Yi Recognitions: National
-- Leadership can ADD a chapter that did not nominate for an award.
--
-- Source: the Take Pride 2026 briefing. During its review National
-- Leadership may find a chapter "which has done great but they have not
-- nominated ... they deserve to be there", and that triggers
-- re-evaluation. Director's decisions (2026-10-10):
--   1. National Leadership (or the Recognitions super admin) can add a
--      chapter to an award it did not nominate for, from when the award
--      reaches National Leadership review until the cycle's
--      reevaluation_deadline. The chapter must not already have ANY
--      nomination for that award (a draft counts).
--   2. National Leadership writes ONE short reason (100 words, enforced in
--      the app) instead of the chapter's form. The chapter fills nothing.
--      Category and region are snapshotted at add time, like a chapter
--      submission.
--   3. The added nomination still goes through the Regional Chair + RM
--      check. Its checks stay open until reevaluation_deadline (not the
--      check deadline). A send-back goes to NATIONAL LEADERSHIP, which edits
--      the reason and resubmits; a resubmission clears both passes, the
--      same rule as for chapters (migration 02).
--   4. Once both checks pass it is scored and ranked in re-evaluation.
--
-- NEW COLUMNS on recognition_nominations
--   origin        'chapter' (default, every existing row) | 'nl_added'
--   added_by      yi_directory.people id of who added it
--   added_at      when it was added
--   added_reason  National Leadership's reason; the nomination's CONTENT
--                 for an nl_added row (freezes/unfreezes like sections A-D)
--
-- NOT APPLIED to production by the build. The Director applies it, and it
-- must be applied BEFORE the app code that writes these columns deploys.
-- The app reads the columns tolerantly (a missing origin = 'chapter').
-- =====================================================================

alter table yi_connect.recognition_nominations
  add column if not exists origin text not null default 'chapter',
  add column if not exists added_by uuid,
  add column if not exists added_at timestamptz,
  add column if not exists added_reason text;

-- ---------------------------------------------------------------------
-- 1. Origin vocabulary. NAMED (migration 02 learned the hard way that an
--    inline unnamed CHECK gets a generated name).
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_origin_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_origin_ck
  check (origin in ('chapter', 'nl_added'));

-- ---------------------------------------------------------------------
-- 2. Shape of each origin.
--    chapter   the added_* columns are never set.
--    nl_added  who/when/why are all set; the reason is not blank and has a
--              technical character cap (the 100-word limit is the app's);
--              it is never a draft (it is filed the moment it is added);
--              and the chapter's own sections A-D stay EMPTY: five empty
--              reasons (satisfies recognition_nominations_reasons_ck), no
--              flagship event, no hosted event, no announcement draft.
--    The status list below deliberately names every non-draft state (it
--    includes 'returned'), so migration 02's "old status CHECK survived"
--    guard never mistakes this constraint for the pre-02 one.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_nl_added_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_nl_added_ck
  check (
    (origin = 'chapter'
      and added_by is null and added_at is null and added_reason is null)
    or
    (origin = 'nl_added'
      and added_by is not null
      and added_at is not null
      and added_reason is not null
      and btrim(added_reason) <> ''
      and char_length(added_reason) <= 2000
      and status in ('submitted', 'returned', 'checked', 'excluded')
      and reasons = array['', '', '', '', '']::text[]
      and flagship_event = ''
      and hosted_event = false
      and hosted_event_name is null
      and hosted_event_type is null
      and announcement_draft = '')
  );

create index if not exists recognition_nominations_award_origin
  on yi_connect.recognition_nominations (award_id, origin);

-- ---------------------------------------------------------------------
-- 3. Freeze trigger (rewrites migration 02's version; everything 02 enforced
--    is kept verbatim). Additions:
--      - added_reason is CONTENT: it may change only while the row is
--        'draft' or 'returned' (an nl_added row is never a draft, so in
--        practice only while National Leadership is fixing a send-back).
--      - origin, added_by and added_at never change after insert.
--    The status moves, the submitted_at rule and the "a resubmission must
--    clear both passes" rule are unchanged and apply to nl_added rows too.
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_freeze_submitted_nomination()
returns trigger
language plpgsql
as $$
declare
  content_changed boolean;
begin
  if new.origin is distinct from old.origin
     or new.added_by is distinct from old.added_by
     or new.added_at is distinct from old.added_at then
    raise exception 'recognition: who added a nomination, when, and its origin never change';
  end if;

  content_changed :=
       new.reasons is distinct from old.reasons
    or new.flagship_event is distinct from old.flagship_event
    or new.hosted_event is distinct from old.hosted_event
    or new.hosted_event_name is distinct from old.hosted_event_name
    or new.hosted_event_type is distinct from old.hosted_event_type
    or new.announcement_draft is distinct from old.announcement_draft
    or new.added_reason is distinct from old.added_reason
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

drop trigger if exists recognition_nominations_freeze on yi_connect.recognition_nominations;
create trigger recognition_nominations_freeze
  before update on yi_connect.recognition_nominations
  for each row execute function yi_connect.recognition_freeze_submitted_nomination();

-- The delete rule from 02 is unchanged: only a draft may be deleted, so an
-- nl_added row (never a draft) can never be deleted. It stays as history.

-- ---------------------------------------------------------------------
-- 4. Access unchanged: RLS on, zero policies, service_role only.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations enable row level security;
revoke all on yi_connect.recognition_nominations from anon, authenticated;
grant all on yi_connect.recognition_nominations to service_role;
