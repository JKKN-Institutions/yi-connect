-- =====================================================================
-- YIQ — the three CONTENT LEVELS, corrected.
--
-- Product owner, 2026-08-24: content will be authored for THREE levels —
--   1. Chapter ONLINE round
--   2. Chapter OFFLINE round (live, on stage)
--   3. NATIONAL round: Quarter, Semi and Final, with the depth of the
--      ladder depending on how many teams qualify.
--
-- The original build (from the deck) modelled the national level as only
-- semifinal -> finale. Three gaps are closed here:
--
--   A. No QUARTER-FINAL existed anywhere. With ~65 chapter champions per
--      category, quarters are the normal case, not the exception.
--   B. A live round had NOWHERE to hold its questions. finals_scores
--      records which question was asked AFTER the fact, one row at a
--      time; there was no way to PRE-LOAD a round's question set. Since
--      content is being authored now, it needs a home first.
--   C. questions.question_type was missing 'india_challenge', so the
--      sixth chapter-offline round type could not be tagged.
--
-- Naming note: 'national_finale' is renamed to 'national_final' so the
-- stage names read as one consistent ladder.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. The national ladder: quarter -> semi -> final
-- ---------------------------------------------------------------------
update yiq.finals_rounds set stage = 'national_final' where stage = 'national_finale';

alter table yiq.finals_rounds drop constraint if exists finals_rounds_stage_check;
alter table yiq.finals_rounds add constraint finals_rounds_stage_check
  check (stage in (
    'chapter_finals',           -- level 2: the chapter OFFLINE round
    'national_quarterfinal',    -- level 3, rung 1
    'national_semifinal',       -- level 3, rung 2
    'national_final'            -- level 3, rung 3
  ));

alter table yiq.papers drop constraint if exists papers_paper_kind_check;
alter table yiq.papers add constraint papers_paper_kind_check
  check (paper_kind in (
    'mock',                     -- practice, never counts
    'online_round',             -- level 1: the chapter ONLINE round
    'chapter_offline',          -- level 2, when a written set is used on stage
    'national_quarterfinal',
    'national_semifinal',
    'national_final'
  ));

-- A team's progress up the ladder. 'quarterfinal_qualified' was missing.
alter table yiq.national_entries drop constraint if exists national_entries_status_check;
alter table yiq.national_entries add constraint national_entries_status_check
  check (status in (
    'entered',
    'quarterfinal_qualified',
    'semifinal_qualified',
    'finalist',
    'runner_up',
    'national_champion',
    'eliminated'
  ));

-- Per-rung scores. semifinal_* already existed; quarters and the final
-- need their own columns so a team's whole run is legible in one row.
alter table yiq.national_entries
  add column if not exists quarterfinal_score numeric(10,2),
  add column if not exists quarterfinal_rank integer;

-- ---------------------------------------------------------------------
-- B. Content for LIVE rounds — the missing home.
--
-- Applies to BOTH the chapter offline round and every national rung that
-- is played on stage. Ordered, so a quizmaster works down the list, and
-- optionally assigned to a specific team for a direct/pass-on question.
-- ---------------------------------------------------------------------
create table if not exists yiq.finals_round_questions (
  id uuid primary key default gen_random_uuid(),
  finals_round_id uuid not null references yiq.finals_rounds(id) on delete cascade,
  question_id uuid not null references yiq.questions(id) on delete restrict,
  display_order integer not null default 0,
  -- Null = open to the floor / assigned live by the quizmaster. Set when
  -- the running order is fixed in advance.
  assigned_team_id uuid references yiq.teams(id) on delete set null,
  -- Marks it as already put to the room, so a reload of the console does
  -- not re-ask a question the audience has heard.
  asked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (finals_round_id, question_id)
);

create index if not exists yiq_frq_round
  on yiq.finals_round_questions (finals_round_id, display_order);
create index if not exists yiq_frq_team
  on yiq.finals_round_questions (assigned_team_id);

-- MANDATORY: tables created through the Management API receive NO
-- default grants, so the service client would fail with "permission
-- denied" — silently, as an empty read.
grant select, insert, update, delete on yiq.finals_round_questions to service_role;

alter table yiq.finals_round_questions enable row level security;

-- ---------------------------------------------------------------------
-- C. The sixth chapter-offline round type could not be tagged.
-- ---------------------------------------------------------------------
alter table yiq.questions drop constraint if exists questions_question_type_check;
alter table yiq.questions add constraint questions_question_type_check
  check (question_type in (
    'mcq',              -- level 1 online + any written stage
    'direct',           -- R1
    'pass_on',          -- R2
    'visual',           -- R3  (uses media_url)
    'audio',            -- R4  (uses media_url)
    'rapid_fire',       -- R5
    'india_challenge'   -- R6
  ));
