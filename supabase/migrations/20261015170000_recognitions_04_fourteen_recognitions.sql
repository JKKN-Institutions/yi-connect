-- =====================================================================
-- recognitions_04_fourteen_recognitions — Yi Recognitions 2026: the 14
-- recognitions and the short "tick and say why" application.
--
-- Source: the Director's call with Piyush Garg, 15 Oct 2026, with the
-- Latest Evaluation Matrix open. Director's decisions the same day:
--   1. There are 14 recognitions, not 7: the 5 Yi projects, the 3
--      initiatives (Entrepreneurship, Innovation, Learning), the 4
--      stakeholder groups, Sports and Branding. Each is given in all 3
--      chapter categories.
--   2. A chapter ticks the recognitions it applies for and writes ONE
--      "why" per tick, 100 words (enforced in the app). The five reasons,
--      flagship event, hosted event and announcement draft are no longer
--      asked for; they stay as empty values so older rows and checks hold.
--   3. Say "recognition", never "award". (Table names keep "award"; only
--      the words people see change.)
--
-- CHANGES
--   recognition_awards.vertical   the 7-value CHECK becomes a slug format
--                                 check, so a recognition Piyush adds or
--                                 renames never needs another migration.
--   recognition_awards.kind       NEW: project | initiative | stakeholder |
--                                 sports | branding. Picks the Health Card
--                                 table (A for project/initiative, B for
--                                 stakeholder) and groups the chapter's list.
--   recognition_nominations.justification
--                                 NEW: the chapter's "why". Frozen once filed,
--                                 like every other part of the content.
--
-- Titles are NOT fixed here: Piyush renames any recognition in the control
-- room. The slugs are stable keys only.
--
-- NOT APPLIED to production by the build. The Director applies it, and it
-- must be applied BEFORE the app code that reads `kind` / `justification`
-- deploys.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The recognition vocabulary.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_awards
  drop constraint if exists recognition_awards_vertical_check;
-- Piyush has not sent the final names yet, so the key is any short slug;
-- the app holds the known list and falls back on `kind` for anything new.
alter table yi_connect.recognition_awards
  add constraint recognition_awards_vertical_check
  check (vertical ~ '^[a-z][a-z0-9_]{1,39}$');

alter table yi_connect.recognition_awards
  add column if not exists kind text;
alter table yi_connect.recognition_awards
  drop constraint if exists recognition_awards_kind_ck;
alter table yi_connect.recognition_awards
  add constraint recognition_awards_kind_ck
  check (kind is null or kind in ('project', 'initiative', 'stakeholder', 'sports', 'branding'));

-- ---------------------------------------------------------------------
-- 2. The chapter's "why".
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  add column if not exists justification text;
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_justification_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_justification_ck
  check (justification is null or char_length(justification) <= 2000);

-- ---------------------------------------------------------------------
-- 3. Freeze: the "why" is content, so it freezes with the rest once filed.
--    Same function as migration 03, with one line added.
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_freeze_submitted_nomination()
 returns trigger
 language plpgsql
as $function$
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
    or new.justification is distinct from old.justification
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
$function$;
