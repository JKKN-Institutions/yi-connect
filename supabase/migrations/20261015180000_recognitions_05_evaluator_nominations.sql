-- =====================================================================
-- recognitions_05_evaluator_nominations — Yi Recognitions: Regional
-- Mentors and the NMT can put forward a chapter that did not apply, and
-- the NMT leader can send a recognition back to its Regional Mentors.
--
-- Source: Piyush Garg, call of 15 Oct 2026 (the Director approved all of it).
--
-- 1. EVALUATOR-ADDED NOMINATIONS (extends migration 03's nl_added mechanism)
--    origin 'rm_added'   a Regional Mentor (active RM duty on the
--                        recognition) adds a chapter of THEIR OWN region
--                        that has no nomination, with a written reason
--                        (100 words, enforced in the app). It needs an NMT
--                        member of that recognition to APPROVE it before it
--                        is scored. It is filed as 'submitted'; approval
--                        moves it to 'checked' (in the race) and records
--                        approved_by / approved_at. A decline needs a
--                        reason, moves it to 'excluded' and keeps the row.
--    origin 'nmt_added'  an NMT member adds any chapter directly, with a
--                        reason. No further approval: it is filed straight
--                        into the race as 'checked'.
--    Neither goes through the Regional Chair + RM check (Lane A drops that
--    step for every nomination). Same shape rules as nl_added: who/when/why
--    set, the chapter's own sections A-D empty, never a draft. Category and
--    region are snapshotted at add time, like a chapter submission.
--    The "rm_added is not in the race until approved" rule is enforced in
--    the app (lib/recognitions/check-rules.ts inRace). The DB backs it as
--    far as a CHECK can cleanly: an rm_added row is 'checked' only with an
--    approval, and an approval/decline is set once and never changes.
--
-- 2. SEND BACK TO THE REGIONAL MENTORS (with full history)
--    The NMT leader sends a recognition back to its Regional Mentors with a
--    compulsory remark. Every SUBMITTED Regional Mentor score on that
--    recognition is first copied into recognition_score_history (append-
--    only), then reopened as a draft of the next round, keeping its marks as
--    the starting point. Stage 2's unlock is cleared so it re-opens itself
--    when the Mentors resubmit. Nothing is ever deleted. All of it runs in
--    ONE function (one transaction): recognition_send_back_to_mentors().
--    The score freeze trigger is narrowed so a submitted score can change
--    in exactly one way: submitted -> draft, round + 1, marks unchanged, and
--    only when its snapshot for the old round is already in the history.
--
-- NOT APPLIED to production by the build. The Director applies it, BEFORE
-- the app code that writes these columns deploys. The app reads the new
-- columns and tables tolerantly (missing = nothing added, no send-back).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. Nomination: approval / decline columns (rm_added only).
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists declined_by uuid,
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text;

-- ---------------------------------------------------------------------
-- 1b. Origin vocabulary (named in migration 03; dropped by that exact name).
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_origin_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_origin_ck
  check (origin in ('chapter', 'nl_added', 'rm_added', 'nmt_added'));

-- ---------------------------------------------------------------------
-- 1c. Shape of each origin. Same name as migration 03 so there is ONE
--     shape constraint. Every added origin follows nl_added's rules. The
--     status list still names every non-draft state (incl. 'returned'), so
--     migration 02's "old status CHECK survived" guard never trips on it.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_nl_added_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_nl_added_ck
  check (
    (origin = 'chapter'
      and added_by is null and added_at is null and added_reason is null)
    or
    (origin in ('nl_added', 'rm_added', 'nmt_added')
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

-- ---------------------------------------------------------------------
-- 1d. 'checked' meant "both checkers passed" (migration 02). A Mentor- or
--     NMT-added chapter skips the check: for those origins 'checked' means
--     "in the race" (nmt_added at once, rm_added once an NMT member
--     approved it). The 'returned' half is unchanged.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_check_state_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_check_state_ck
  check (
    (status <> 'checked'
      or (rc_checked_by is not null and rm_checked_by is not null)
      or origin = 'nmt_added'
      or (origin = 'rm_added' and approved_by is not null and approved_at is not null))
    and (status <> 'returned' or (return_note is not null and btrim(return_note) <> ''))
  );

-- ---------------------------------------------------------------------
-- 1e. Approval / decline shape. Only an rm_added row is ever approved or
--     declined; both halves of each pair are set together; a decline
--     carries its reason and takes the row out of the race; never both.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_nominations
  drop constraint if exists recognition_nominations_approval_ck;
alter table yi_connect.recognition_nominations
  add constraint recognition_nominations_approval_ck
  check (
    (origin = 'rm_added'
      or (approved_by is null and approved_at is null
          and declined_by is null and declined_at is null and decline_reason is null))
    and ((approved_by is null) = (approved_at is null))
    and ((declined_by is null) = (declined_at is null))
    and (declined_by is null
         or (decline_reason is not null and btrim(decline_reason) <> ''
             and char_length(decline_reason) <= 2000 and status = 'excluded'))
    and (decline_reason is null or declined_by is not null)
    and not (approved_by is not null and declined_by is not null)
  );

-- ---------------------------------------------------------------------
-- 1f. Freeze trigger (rewrites migration 03's version; everything 03
--     enforced is kept verbatim). Additions: an approval or a decline is
--     written once and never changes or disappears.
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

  if (old.approved_by is not null
        and (new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at))
     or (old.declined_by is not null
        and (new.declined_by is distinct from old.declined_by
             or new.declined_at is distinct from old.declined_at
             or new.decline_reason is distinct from old.decline_reason)) then
    raise exception 'recognition: an approval or a decline is recorded once and never changes';
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
$$;

drop trigger if exists recognition_nominations_freeze on yi_connect.recognition_nominations;
create trigger recognition_nominations_freeze
  before update on yi_connect.recognition_nominations
  for each row execute function yi_connect.recognition_freeze_submitted_nomination();

-- The delete rule from 02 is unchanged: only a draft may be deleted, so an
-- added row (never a draft) - including a declined one - stays as history.

-- ---------------------------------------------------------------------
-- 2a. Score round + history.
-- ---------------------------------------------------------------------
alter table yi_connect.recognition_scores
  add column if not exists round integer not null default 1;

alter table yi_connect.recognition_scores
  drop constraint if exists recognition_scores_round_ck;
alter table yi_connect.recognition_scores
  add constraint recognition_scores_round_ck check (round >= 1);

-- Each NMT-leader send-back to the Regional Mentors. Append-only.
create table if not exists yi_connect.recognition_mentor_sendbacks (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  -- The Mentor round this send-back opens: 2 for the first, 3 for the next.
  round integer not null check (round >= 2),
  remark text not null check (btrim(remark) <> '' and char_length(remark) <= 2000),
  sent_by uuid not null,
  sent_at timestamptz not null default now(),
  scores_reopened integer not null check (scores_reopened >= 1),
  -- What Stage 2's unlock said before the send-back cleared it.
  prev_stage2_unlocked_at timestamptz,
  prev_stage2_unlock_reason text,
  unique (award_id, round)
);

create index if not exists recognition_mentor_sendbacks_award
  on yi_connect.recognition_mentor_sendbacks (award_id, sent_at desc);

-- A frozen copy of every score a send-back reopened. Append-only. No FK to
-- recognition_scores on purpose: history outlives any later change there.
create table if not exists yi_connect.recognition_score_history (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  sendback_id uuid not null references yi_connect.recognition_mentor_sendbacks(id) on delete cascade,
  score_id uuid not null,
  nomination_id uuid not null,
  evaluator_id uuid not null,
  layer text not null check (layer in ('rm', 'nmt')),
  round integer not null,
  params jsonb not null,
  reasons text[] not null,
  additional_comments text,
  submitted_at timestamptz,
  archived_at timestamptz not null default now(),
  unique (score_id, round)
);

create index if not exists recognition_score_history_award
  on yi_connect.recognition_score_history (award_id, nomination_id);

-- ---------------------------------------------------------------------
-- 2b. Score freeze, narrowed. Replaces recognition_refuse_rewrite on
--     recognition_scores only (the other tables keep it).
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_score_freeze()
returns trigger
language plpgsql
as $$
begin
  if new.round is distinct from old.round
     and not (old.status = 'submitted' and new.status = 'draft' and new.round = old.round + 1) then
    raise exception 'recognition: a score''s round changes only when a send-back reopens it';
  end if;

  if old.status = 'submitted' then
    if new.status = 'draft'
       and new.round = old.round + 1
       and new.submitted_at is null
       and new.params = old.params
       and new.reasons = old.reasons
       and new.additional_comments is not distinct from old.additional_comments
       and new.nomination_id = old.nomination_id
       and new.evaluator_id = old.evaluator_id
       and new.layer = old.layer
       and exists (
         select 1 from yi_connect.recognition_score_history h
         where h.score_id = old.id and h.round = old.round
       ) then
      return new;
    end if;
    raise exception 'recognition: a submitted score is frozen';
  end if;
  return new;
end;
$$;

drop trigger if exists recognition_scores_freeze on yi_connect.recognition_scores;
create trigger recognition_scores_freeze
  before update on yi_connect.recognition_scores
  for each row execute function yi_connect.recognition_score_freeze();

-- A submitted score can't be deleted either (history is never deleted).
create or replace function yi_connect.recognition_refuse_score_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'submitted' then
    raise exception 'recognition: a submitted score cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists recognition_scores_no_delete on yi_connect.recognition_scores;
create trigger recognition_scores_no_delete
  before delete on yi_connect.recognition_scores
  for each row execute function yi_connect.recognition_refuse_score_delete();

-- History and send-backs are append-only.
create or replace function yi_connect.recognition_refuse_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'recognition: % is append-only', tg_table_name;
end;
$$;

drop trigger if exists recognition_score_history_freeze on yi_connect.recognition_score_history;
create trigger recognition_score_history_freeze
  before update or delete on yi_connect.recognition_score_history
  for each row execute function yi_connect.recognition_refuse_change();

drop trigger if exists recognition_mentor_sendbacks_freeze on yi_connect.recognition_mentor_sendbacks;
create trigger recognition_mentor_sendbacks_freeze
  before update or delete on yi_connect.recognition_mentor_sendbacks
  for each row execute function yi_connect.recognition_refuse_change();

-- ---------------------------------------------------------------------
-- 2c. The send-back itself, in one transaction. The app gates the caller
--     (NMT leader of the award, right phase) BEFORE calling it; this
--     function only refuses what would break the record.
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_send_back_to_mentors(
  p_award_id uuid,
  p_remark text,
  p_sent_by uuid
)
returns jsonb
language plpgsql
set search_path = yi_connect, pg_temp
as $$
declare
  v_award yi_connect.recognition_awards%rowtype;
  v_round integer;
  v_count integer;
  v_id uuid;
begin
  if p_remark is null or btrim(p_remark) = '' then
    raise exception 'recognition: a send-back to the Regional Mentors needs a remark';
  end if;
  if p_sent_by is null then
    raise exception 'recognition: a send-back needs the person who sent it';
  end if;

  -- Serialise send-backs on one award.
  select * into v_award from yi_connect.recognition_awards where id = p_award_id for update;
  if not found then
    raise exception 'recognition: recognition % not found', p_award_id;
  end if;

  select count(*) into v_count
  from yi_connect.recognition_scores s
  join yi_connect.recognition_nominations n on n.id = s.nomination_id
  where n.award_id = p_award_id and s.layer = 'rm' and s.status = 'submitted';
  if v_count = 0 then
    raise exception 'recognition: no Regional Mentor has submitted marks on this recognition, so there is nothing to send back';
  end if;

  select coalesce(max(round), 1) + 1 into v_round
  from yi_connect.recognition_mentor_sendbacks where award_id = p_award_id;

  insert into yi_connect.recognition_mentor_sendbacks
    (award_id, round, remark, sent_by, scores_reopened, prev_stage2_unlocked_at, prev_stage2_unlock_reason)
  values
    (p_award_id, v_round, btrim(p_remark), p_sent_by, v_count, v_award.stage2_unlocked_at, v_award.stage2_unlock_reason)
  returning id into v_id;

  insert into yi_connect.recognition_score_history
    (award_id, sendback_id, score_id, nomination_id, evaluator_id, layer, round,
     params, reasons, additional_comments, submitted_at)
  select p_award_id, v_id, s.id, s.nomination_id, s.evaluator_id, s.layer, s.round,
         s.params, s.reasons, s.additional_comments, s.submitted_at
  from yi_connect.recognition_scores s
  join yi_connect.recognition_nominations n on n.id = s.nomination_id
  where n.award_id = p_award_id and s.layer = 'rm' and s.status = 'submitted';

  update yi_connect.recognition_scores s
  set status = 'draft', submitted_at = null, round = s.round + 1, updated_at = now()
  from yi_connect.recognition_nominations n
  where n.id = s.nomination_id and n.award_id = p_award_id
    and s.layer = 'rm' and s.status = 'submitted';

  update yi_connect.recognition_awards
  set stage2_unlocked_at = null, stage2_unlock_reason = null, stage2_unlocked_by = null, updated_at = now()
  where id = p_award_id;

  return jsonb_build_object('id', v_id, 'round', v_round, 'reopened', v_count);
end;
$$;

-- Service role only (a function created in a migration is EXECUTE-able by
-- PUBLIC by default).
revoke all on function yi_connect.recognition_send_back_to_mentors(uuid, text, uuid) from public;
revoke all on function yi_connect.recognition_send_back_to_mentors(uuid, text, uuid) from anon, authenticated;
grant execute on function yi_connect.recognition_send_back_to_mentors(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------
-- 3. Access: RLS on, zero policies, service_role only (same as 01-03).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'recognition_nominations', 'recognition_scores',
    'recognition_mentor_sendbacks', 'recognition_score_history'
  ] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end;
$$;
