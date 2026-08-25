-- =====================================================================
-- YIQ — the AI job queue, and provenance for generated questions.
--
-- THE RULE (inherited from docs/yip-ai-routine.md): the production app
-- NEVER calls an LLM. No Anthropic key lives in prod. Reasons, all of
-- which apply harder to YIQ than to YIP:
--   * these are minors (Classes 9-12);
--   * this is a SCORED national competition, so every surface has to be
--     defensible in a dispute;
--   * cost blast radius on a public form.
--
-- So AI work is queued here and drained by an external routine that
-- polls a secret-authed endpoint. The queue IS the status column —
-- there is no BullMQ / Inngest / QStash anywhere in this repo.
-- =====================================================================

create table if not exists yiq.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'practice_questions',   -- personalised practice set for one student
    'bank_draft',           -- new competition questions for review
    'staleness_scan',       -- flag questions whose answer can rot
    'distractor_audit',     -- are the wrong options plausible?
    'student_topic_note',   -- post-round note: strengths, NEVER a rank
    'chapter_report'        -- chapter round narrative, review-gated
  )),
  -- Who/what this job is about. Nullable: a bank-wide scan has no subject.
  subject_id uuid,
  chapter_event_id uuid references yiq.chapter_events(id) on delete cascade,
  edition_id uuid references yiq.editions(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending','claimed','ready','failed','cancelled')),
  -- Grounding the app assembles FOR the routine. Never contains a rank,
  -- a score comparison, or another student's data.
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_text text,
  attempts integer not null default 0,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists yiq_ai_jobs_drain
  on yiq.ai_jobs (status, created_at) where status = 'pending';
create index if not exists yiq_ai_jobs_subject
  on yiq.ai_jobs (kind, subject_id, status);
-- One live personalised-practice job per student at a time: a student
-- tapping "next set" twice must not bill two generations.
create unique index if not exists yiq_ai_jobs_one_live_practice
  on yiq.ai_jobs (kind, subject_id)
  where kind = 'practice_questions' and status in ('pending','claimed');

-- Provenance on questions. An AI-written question is usable in PRACTICE
-- immediately (a wrong answer there costs nothing and is never scored),
-- but pool separation already forbids it reaching a scored paper, and it
-- cannot be promoted to `competition` until a human has reviewed it.
alter table yiq.questions
  add column if not exists is_ai_generated boolean not null default false,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists generated_for_student_id uuid;

create index if not exists yiq_questions_ai_unreviewed
  on yiq.questions (is_ai_generated, reviewed_at) where is_ai_generated = true;

-- HARD GUARD, not a convention: an AI-written question may never sit in
-- the competition pool unless a human has reviewed it. This is the line
-- that keeps an unreviewed fact out of a scored national paper.
alter table yiq.questions drop constraint if exists yiq_questions_ai_needs_review;
alter table yiq.questions add constraint yiq_questions_ai_needs_review
  check (
    is_ai_generated = false
    or pool <> 'competition'
    or reviewed_at is not null
  );

drop trigger if exists yiq_touch_ai_jobs on yiq.ai_jobs;
create trigger yiq_touch_ai_jobs before update on yiq.ai_jobs
  for each row execute function yiq.touch_updated_at();

alter table yiq.ai_jobs enable row level security;
grant select, insert, update, delete on yiq.ai_jobs to service_role;
