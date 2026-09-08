-- =====================================================================
-- YIQ — Young Indians Quiz : schema foundation
-- Created 2026-08-24. Cycle: YIQ 2026-27 (online round Sep-Oct 2026).
--
-- Model decisions (Director, 2026-08-24):
--   * Teams register UPFRONT (school team, 3 members). Every member takes
--     the online MCQ test individually; TEAM score = SUM of member scores.
--     Top 10 teams per (chapter_event, category) -> Chapter Finals.
--     Individual scores are retained for the Best Individual Quizzer award.
--   * Two categories run as SEPARATE championships: junior (Cl 9-10),
--     senior (Cl 11-12).
--
-- AUTHORIZATION: yi_directory.role_assignments (app='yiq') is the mother
-- source. This schema deliberately has NO organisers/admins table.
-- Students authenticate by access code -> signed `yiq_session` cookie.
--
-- GRANTS: tables created via the Management API receive NO default grants,
-- so every table below is granted explicitly at the end of this file.
-- =====================================================================

create schema if not exists yiq;

-- ---------------------------------------------------------------------
-- 1. editions — one competition cycle
-- ---------------------------------------------------------------------
create table if not exists yiq.editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  yi_year integer not null,
  slug text not null unique,
  is_active boolean not null default false,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  online_round_opens_at timestamptz,
  online_round_closes_at timestamptz,
  national_semifinal_at timestamptz,
  national_finale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. chapter_events — Level 1 container, one per chapter per edition
-- ---------------------------------------------------------------------
create table if not exists yiq.chapter_events (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references yiq.editions(id) on delete cascade,
  chapter_name text not null,
  yi_zone text,
  status text not null default 'draft'
    check (status in ('draft','registration_open','registration_closed',
                      'online_round_live','online_round_closed',
                      'finals_scheduled','finals_live','finals_complete')),
  -- Per-event window overrides; null => inherit the edition window.
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  online_round_opens_at timestamptz,
  online_round_closes_at timestamptz,
  finals_date date,
  finals_venue text,
  qualifying_team_count integer not null default 10 check (qualifying_team_count between 2 and 50),
  champion_team_junior_id uuid,
  champion_team_senior_id uuid,
  best_quizzer_junior_student_id uuid,
  best_quizzer_senior_student_id uuid,
  results_published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, chapter_name)
);

-- ---------------------------------------------------------------------
-- 3. schools
-- ---------------------------------------------------------------------
create table if not exists yiq.schools (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references yiq.editions(id) on delete cascade,
  chapter_name text not null,
  name text not null,
  school_type text not null default 'private'
    check (school_type in ('government','private','international','aided','other')),
  board text,
  city text,
  district text,
  state text,
  pincode text,
  principal_name text,
  contact_person text not null,
  contact_email text not null,
  contact_phone text not null,
  is_verified boolean not null default false,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. teams — the registered competing unit
-- ---------------------------------------------------------------------
create table if not exists yiq.teams (
  id uuid primary key default gen_random_uuid(),
  chapter_event_id uuid not null references yiq.chapter_events(id) on delete cascade,
  school_id uuid not null references yiq.schools(id) on delete cascade,
  name text not null,
  category text not null check (category in ('junior','senior')),
  team_code text not null unique,
  status text not null default 'registered'
    check (status in ('registered','confirmed','withdrawn','disqualified',
                      'qualified','eliminated','runner_up','champion')),
  -- Denormalised rollup written when the online round is scored.
  online_total_score numeric(10,2),
  online_rank integer,
  online_members_attempted integer not null default 0,
  finals_total_score numeric(10,2),
  finals_rank integer,
  advanced_to_national boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. students — team members (Classes 9-12)
-- ---------------------------------------------------------------------
create table if not exists yiq.students (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references yiq.teams(id) on delete cascade,
  full_name text not null,
  class_level integer not null check (class_level between 9 and 12),
  section text,
  gender text check (gender in ('male','female','other','undisclosed')),
  email text,
  phone text,
  guardian_name text,
  guardian_phone text,
  access_code text not null unique,
  is_captain boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. topics — the 7 syllabus areas (deck slide 7)
-- ---------------------------------------------------------------------
create table if not exists yiq.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. questions — the national bank
-- ---------------------------------------------------------------------
create table if not exists yiq.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references yiq.topics(id) on delete restrict,
  category text not null default 'both' check (category in ('junior','senior','both')),
  question_type text not null default 'mcq'
    check (question_type in ('mcq','visual','audio','direct','pass_on','rapid_fire')),
  question_text text not null,
  media_url text,
  media_credit text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text check (correct_option in ('a','b','c','d')),
  -- Non-MCQ (live finals) questions carry a free-text answer instead.
  correct_answer_text text,
  answer_explanation text,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  source text,
  is_active boolean not null default true,
  is_retired boolean not null default false,
  times_used integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An MCQ must be answerable: four options and a key.
  constraint yiq_questions_mcq_complete check (
    question_type <> 'mcq' or (
      option_a is not null and option_b is not null and
      option_c is not null and option_d is not null and
      correct_option is not null
    )
  )
);

-- ---------------------------------------------------------------------
-- 8. papers — a generated question paper for one round
-- ---------------------------------------------------------------------
create table if not exists yiq.papers (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references yiq.editions(id) on delete cascade,
  -- null chapter_event_id => a national/shared paper (e.g. the common
  -- online round paper, or the mock practice paper).
  chapter_event_id uuid references yiq.chapter_events(id) on delete cascade,
  name text not null,
  paper_kind text not null default 'online_round'
    check (paper_kind in ('mock','online_round','national_semifinal')),
  category text not null check (category in ('junior','senior')),
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 240),
  total_questions integer not null default 0,
  marks_per_question numeric(6,2) not null default 1,
  negative_marks numeric(6,2) not null default 0,
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  is_published boolean not null default false,
  published_at timestamptz,
  instructions text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists yiq.paper_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references yiq.papers(id) on delete cascade,
  question_id uuid not null references yiq.questions(id) on delete restrict,
  display_order integer not null default 0,
  marks numeric(6,2),
  created_at timestamptz not null default now(),
  unique (paper_id, question_id)
);

-- ---------------------------------------------------------------------
-- 9. attempts — one student's sitting of one paper
-- ---------------------------------------------------------------------
create table if not exists yiq.attempts (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references yiq.papers(id) on delete cascade,
  student_id uuid not null references yiq.students(id) on delete cascade,
  team_id uuid not null references yiq.teams(id) on delete cascade,
  chapter_event_id uuid references yiq.chapter_events(id) on delete cascade,
  is_mock boolean not null default false,
  status text not null default 'in_progress'
    check (status in ('in_progress','submitted','auto_submitted','disqualified')),
  -- The AUTHORITATIVE deadline, written once at start and enforced on every
  -- write. Never derive time remaining from client state alone.
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  -- Server-materialised question order for THIS attempt (shuffle is per
  -- student, so the order must be stable across reloads).
  question_order uuid[] not null default '{}',
  score numeric(10,2) not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  unanswered_count integer not null default 0,
  time_taken_seconds integer,
  disqualified_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One REAL attempt per (paper, student). Mock attempts are unlimited.
create unique index if not exists yiq_attempts_one_real_per_student
  on yiq.attempts (paper_id, student_id) where is_mock = false;

create table if not exists yiq.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references yiq.attempts(id) on delete cascade,
  question_id uuid not null references yiq.questions(id) on delete cascade,
  selected_option text check (selected_option in ('a','b','c','d')),
  is_correct boolean,
  marks_awarded numeric(6,2) not null default 0,
  is_flagged boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------
-- 10. finals_rounds / finals_scores — Level 1B live stage (BQC format)
-- ---------------------------------------------------------------------
create table if not exists yiq.finals_rounds (
  id uuid primary key default gen_random_uuid(),
  chapter_event_id uuid references yiq.chapter_events(id) on delete cascade,
  edition_id uuid references yiq.editions(id) on delete cascade,
  stage text not null default 'chapter_finals'
    check (stage in ('chapter_finals','national_semifinal','national_finale')),
  category text not null check (category in ('junior','senior')),
  round_number integer not null,
  round_type text not null
    check (round_type in ('direct','pass_on','visual','audio','rapid_fire','india_challenge')),
  name text not null,
  points_correct numeric(6,2) not null default 10,
  points_pass_bonus numeric(6,2) not null default 5,
  points_wrong numeric(6,2) not null default 0,
  time_limit_seconds integer,
  questions_per_team integer not null default 1,
  status text not null default 'pending'
    check (status in ('pending','live','complete')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists yiq.finals_scores (
  id uuid primary key default gen_random_uuid(),
  finals_round_id uuid not null references yiq.finals_rounds(id) on delete cascade,
  team_id uuid not null references yiq.teams(id) on delete cascade,
  question_id uuid references yiq.questions(id) on delete set null,
  outcome text not null default 'unanswered'
    check (outcome in ('correct','wrong','passed','bonus','unanswered')),
  points numeric(6,2) not null default 0,
  sequence_no integer not null default 0,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 11. national_entries — Level 2 (chapter champions -> nationals)
-- ---------------------------------------------------------------------
create table if not exists yiq.national_entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references yiq.editions(id) on delete cascade,
  team_id uuid not null references yiq.teams(id) on delete cascade,
  chapter_name text not null,
  category text not null check (category in ('junior','senior')),
  semifinal_score numeric(10,2),
  semifinal_rank integer,
  finale_score numeric(10,2),
  finale_rank integer,
  status text not null default 'entered'
    check (status in ('entered','semifinal_qualified','finalist','runner_up','national_champion','eliminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, team_id)
);

-- ---------------------------------------------------------------------
-- 12. audit_log
-- ---------------------------------------------------------------------
create table if not exists yiq.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_label text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  chapter_event_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists yiq_chapter_events_edition on yiq.chapter_events (edition_id);
create index if not exists yiq_chapter_events_chapter on yiq.chapter_events (chapter_name);
create index if not exists yiq_schools_edition_chapter on yiq.schools (edition_id, chapter_name);
create index if not exists yiq_teams_event_cat on yiq.teams (chapter_event_id, category);
create index if not exists yiq_teams_school on yiq.teams (school_id);
create index if not exists yiq_teams_rank on yiq.teams (chapter_event_id, category, online_rank);
create index if not exists yiq_students_team on yiq.students (team_id);
create index if not exists yiq_questions_topic on yiq.questions (topic_id);
create index if not exists yiq_questions_active on yiq.questions (is_active, category, question_type);
create index if not exists yiq_paper_questions_paper on yiq.paper_questions (paper_id, display_order);
create index if not exists yiq_papers_edition_kind on yiq.papers (edition_id, paper_kind, category);
create index if not exists yiq_attempts_student on yiq.attempts (student_id);
create index if not exists yiq_attempts_team on yiq.attempts (team_id);
create index if not exists yiq_attempts_event on yiq.attempts (chapter_event_id, is_mock, status);
create index if not exists yiq_attempt_answers_attempt on yiq.attempt_answers (attempt_id);
create index if not exists yiq_finals_rounds_event on yiq.finals_rounds (chapter_event_id, category, display_order);
create index if not exists yiq_finals_scores_round on yiq.finals_scores (finals_round_id);
create index if not exists yiq_finals_scores_team on yiq.finals_scores (team_id);
create index if not exists yiq_national_entries_edition on yiq.national_entries (edition_id, category);
create index if not exists yiq_audit_log_entity on yiq.audit_log (entity_type, entity_id);
create index if not exists yiq_audit_log_created on yiq.audit_log (created_at desc);

-- One active edition at a time.
create unique index if not exists yiq_editions_one_active
  on yiq.editions ((is_active)) where is_active = true;

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function yiq.touch_updated_at() returns trigger
language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

do $do$
declare t text;
begin
  foreach t in array array[
    'editions','chapter_events','schools','teams','students','questions',
    'papers','attempts','finals_rounds','national_entries'
  ] loop
    execute format(
      'drop trigger if exists yiq_touch_%1$s on yiq.%1$s;
       create trigger yiq_touch_%1$s before update on yiq.%1$s
       for each row execute function yiq.touch_updated_at();', t);
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------
-- RLS — every table on, NO permissive policies. All access flows through
-- the app's service client behind an explicit auth gate (yi_directory for
-- staff, signed yiq_session cookie for students). Public reads that the
-- landing page needs are served by server components, not PostgREST.
-- ---------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array[
    'editions','chapter_events','schools','teams','students','topics',
    'questions','papers','paper_questions','attempts','attempt_answers',
    'finals_rounds','finals_scores','national_entries','audit_log'
  ] loop
    -- ENABLE only, never FORCE: service_role carries BYPASSRLS, and FORCE
    -- would additionally bind the table owner. With zero policies this denies
    -- anon/authenticated outright while the service client still works.
    execute format('alter table yiq.%I enable row level security;', t);
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------
-- GRANTS — MANDATORY. Tables created through the Supabase Management API
-- receive NO default grants, so the app's service client would otherwise
-- fail with "permission denied for table ...", silently, on first write.
-- service_role ONLY: anon/authenticated never touch yiq via PostgREST.
-- ---------------------------------------------------------------------
grant usage on schema yiq to service_role;

do $do$
declare t text;
begin
  foreach t in array array[
    'editions','chapter_events','schools','teams','students','topics',
    'questions','papers','paper_questions','attempts','attempt_answers',
    'finals_rounds','finals_scores','national_entries','audit_log'
  ] loop
    execute format('grant select, insert, update, delete on yiq.%I to service_role;', t);
  end loop;
end;
$do$;

alter default privileges in schema yiq
  grant select, insert, update, delete on tables to service_role;
