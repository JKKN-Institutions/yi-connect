-- =====================================================================
-- YIQ — the ONE restart a chapter organiser may grant a student.
--
-- THE PROBLEM. A student's phone dies mid-paper. The clock keeps running
-- server-side (by design — `attempts.expires_at` is written once at start
-- and is never extended), the round closes, and today there is no second
-- chance of any kind.
--
-- THE DECISION (Director, 2026-08-25). The chapter organiser may grant
-- ONE restart per student, and the student gets back only THE TIME THAT
-- WAS LEFT when their paper actually stopped. A restart is therefore a
-- RESUME, not a re-sit:
--
--   * same paper, same question order (`attempts.question_order` already
--     stores the exact per-student order, so this is exact);
--   * answers already saved stay saved — cutting the time AND discarding
--     the answers would leave the student worse off than not restarting,
--     which cannot be the intent;
--   * a new deadline of (when the student returns) + (time that was left).
--
-- WHY THE CLOCK STARTS ON RETURN, NOT ON GRANT. The grant is consumed by
-- the STUDENT's next start (app/yiq/actions/attempt.ts), never by the
-- organiser's click. Otherwise the 8 minutes they were given would tick
-- away while they hunt for a charger.
--
-- WHY A TABLE AND NOT A FLAG. This is a scored national competition. A
-- granted restart has to be defensible afterwards, so the reason, the
-- grantor and the exact number of milliseconds handed back are all
-- recorded, permanently, next to the attempt.
--
-- NOTHING HERE IS APPLIED BY THIS FILE'S AUTHOR — apply it the usual way.
-- =====================================================================

create table if not exists yiq.attempt_restarts (
  id uuid primary key default gen_random_uuid(),

  attempt_id uuid not null references yiq.attempts(id) on delete cascade,
  student_id uuid not null references yiq.students(id) on delete cascade,
  chapter_event_id uuid references yiq.chapter_events(id) on delete cascade,

  -- Exactly how much time was handed back, computed SERVER-SIDE from the
  -- original attempt (expires_at - submitted_at, clamped). Never a number
  -- that came from a client. > 0 is a hard constraint: a restart that
  -- grants nothing is a refusal, not a row.
  granted_ms integer not null check (granted_ms > 0),

  -- Belt and braces on the same fact from the other side: no grant may
  -- ever exceed the longest paper this platform can build (240 minutes,
  -- see generatePaper()). A clamp bug can then only under-grant.
  constraint yiq_attempt_restarts_sane_ms check (granted_ms <= 240 * 60 * 1000),

  -- REQUIRED, and deliberately not a free-for-all: an empty or one-word
  -- "reason" is not a reason anyone can defend three months later.
  reason text not null,
  constraint yiq_attempt_restarts_reason_substantive
    check (length(btrim(reason)) between 10 and 500),

  granted_by_user_id uuid,
  granted_by_label text,
  granted_at timestamptz not null default now(),

  -- Set when the STUDENT actually resumes. Until then the grant is
  -- unspent and the attempt is untouched.
  consumed_at timestamptz,
  new_expires_at timestamptz,
  new_started_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ONE RESTART PER STUDENT, EVER — enforced HERE, not only in code.
--
-- Scoped to the STUDENT rather than the attempt on purpose: a student has
-- exactly one real online-round attempt today (yiq_attempts_one_real_per_
-- student), but if that ever changes, "one restart ever" must still mean
-- one restart ever rather than one per attempt row.
--
-- This is what makes two organisers clicking Grant at the same instant
-- safe: the second INSERT raises 23505 and the action reports the grant
-- that already exists instead of creating a second one.
-- ---------------------------------------------------------------------
create unique index if not exists yiq_attempt_restarts_one_per_student
  on yiq.attempt_restarts (student_id);

-- The organiser panel reads by event; the student's resume reads by
-- attempt and only cares about unspent grants.
create index if not exists yiq_attempt_restarts_event
  on yiq.attempt_restarts (chapter_event_id, granted_at desc);
create index if not exists yiq_attempt_restarts_unconsumed
  on yiq.attempt_restarts (attempt_id) where consumed_at is null;

drop trigger if exists yiq_touch_attempt_restarts on yiq.attempt_restarts;
create trigger yiq_touch_attempt_restarts before update on yiq.attempt_restarts
  for each row execute function yiq.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS + GRANTS. Same posture as every other yiq table: RLS on with NO
-- permissive policies, and service_role only — anon/authenticated never
-- reach yiq through PostgREST. The GRANT is MANDATORY: a table created
-- through the Management API receives no default grants and the app's
-- service client would fail with "permission denied", silently, on the
-- first write.
-- ---------------------------------------------------------------------
alter table yiq.attempt_restarts enable row level security;
grant select, insert, update, delete on yiq.attempt_restarts to service_role;
