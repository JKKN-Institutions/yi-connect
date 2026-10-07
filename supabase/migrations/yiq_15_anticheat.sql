-- =====================================================================
-- YIQ — closing the door on "the student had an AI open on a second phone".
--
-- THE PROBLEM (Director, 2026-08-27). Supervision in September is MIXED:
-- some chapters sit the round in a school computer lab with a teacher
-- present, others let students sit it at home on their own phone. The
-- unsupervised case is the weakest link, and a second device running an AI
-- is completely undetectable from the outside. So software is the only
-- defence there is for those students.
--
-- THE ARITHMETIC, which is the whole reason this is not just a timer.
-- The live paper is 30 questions in 30 minutes = 60 SECONDS PER QUESTION.
-- Copying a question into an AI and reading the answer back takes about
-- 15-25 seconds. A per-question timer ALONE therefore does not close it:
-- even a 30-second timer leaves roughly 10 seconds spare, and any timer
-- short enough to beat a copy-paste is too short to be fair to an honest
-- student reading the question.
--
-- What closes it is the COMBINATION, and specifically what happens when
-- copying is blocked: the student has to RETYPE the question, which takes
-- 25-40 seconds on a phone. A 30-second question timer then runs out
-- before they have finished typing it. Neither half works alone; together
-- they do.
--
-- THREE THINGS THIS MIGRATION ADDS
--
--  1. `papers.seconds_per_question` — NULL keeps today's behaviour exactly
--     (one clock for the whole paper, and the student may revisit earlier
--     questions). Set it and the paper becomes question-by-question.
--     Nullable on purpose: this must not change any paper until a human
--     decides it should, and the practice papers should probably stay
--     relaxed.
--
--  2. `yiq.attempt_question_views` — WHEN each question was first put in
--     front of this student. This is the anti-reload lock. Without it a
--     student refreshes the page and the question timer starts again, which
--     hands them unlimited time and makes the whole feature theatre. The
--     first view wins and can never be overwritten.
--
--  3. Focus-loss counters on `attempts` — how many times the student left
--     the page and for how long in total. DELIBERATELY NOT AUTOMATIC
--     PUNISHMENT: a phone call, a notification, or a dying battery all blur
--     a page innocently, and disqualifying a child on that signal would be
--     wrong. It is evidence for an organiser to look at, next to a score
--     that looks surprising.
--
-- HONEST ABOUT THE LIMIT. None of this defeats a determined adult. A
-- screenshot plus OCR, or a laptop with developer tools open, gets round
-- the copy block. What it does is make casual cheating cost more time than
-- the student has, which is the realistic threat from a 15-year-old with a
-- phone. Anyone who claims a browser can prevent cheating outright is
-- selling something.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Per-question pacing, opt-in per paper.
-- ---------------------------------------------------------------------
alter table yiq.papers
  add column if not exists seconds_per_question integer;

comment on column yiq.papers.seconds_per_question is
  'NULL = one clock for the whole paper and the student may revisit earlier questions (the original behaviour). A number = each question is shown for that many seconds and cannot be returned to. Added 2026-08-27 as the pacing half of the anti-AI measures.';

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'yiq_papers_seconds_per_question_sane'
  ) then
    alter table yiq.papers
      add constraint yiq_papers_seconds_per_question_sane
      -- Below 5 seconds nobody can read the question, let alone answer it;
      -- above 600 it is not a per-question timer in any meaningful sense.
      check (seconds_per_question is null
             or (seconds_per_question >= 5 and seconds_per_question <= 600));
  end if;
end
$do$;

-- ---------------------------------------------------------------------
-- 2. THE ANTI-RELOAD LOCK. When was each question first shown?
-- ---------------------------------------------------------------------
create table if not exists yiq.attempt_question_views (
  attempt_id uuid not null references yiq.attempts(id) on delete cascade,
  question_id uuid not null references yiq.questions(id) on delete cascade,

  -- Written ONCE, by the server, the first time this question is served to
  -- this student. Every later view re-reads this row rather than writing a
  -- new one, so a refresh cannot restart the clock.
  first_shown_at timestamptz not null default now(),

  primary key (attempt_id, question_id)
);

comment on table yiq.attempt_question_views is
  'When each question was FIRST put in front of a student. The primary key makes the first view final, which is what stops a page refresh from restarting a question timer. Never updated after insert.';

create index if not exists yiq_attempt_question_views_attempt
  on yiq.attempt_question_views (attempt_id);

-- ---------------------------------------------------------------------
-- 3. Focus loss — EVIDENCE, never an automatic verdict.
-- ---------------------------------------------------------------------
alter table yiq.attempts
  add column if not exists focus_lost_count integer not null default 0,
  add column if not exists focus_lost_seconds integer not null default 0;

comment on column yiq.attempts.focus_lost_count is
  'How many times the student left this page (switched tab or app) while the paper was open. EVIDENCE FOR A HUMAN, not grounds for automatic disqualification — a phone call blurs a page too. Counted client-side and reported; a student who disables scripting simply reports nothing, which is why this is a signal and not a gate.';
comment on column yiq.attempts.focus_lost_seconds is
  'Total seconds spent away from the page while the paper was open. Read alongside focus_lost_count: twelve one-second glances is a different story from two two-minute absences.';

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'yiq_attempts_focus_counters_sane'
  ) then
    alter table yiq.attempts
      add constraint yiq_attempts_focus_counters_sane
      check (focus_lost_count >= 0 and focus_lost_seconds >= 0);
  end if;
end
$do$;

-- ---------------------------------------------------------------------
-- RLS + GRANTS. Same posture as every other yiq table: RLS on with NO
-- permissive policies, service_role only. The GRANT is MANDATORY — a table
-- created through the Management API receives no default grants and the
-- app's service client would fail with "permission denied", silently, on
-- the first write.
-- ---------------------------------------------------------------------
alter table yiq.attempt_question_views enable row level security;
grant select, insert, update, delete on yiq.attempt_question_views to service_role;
