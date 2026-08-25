-- `needs_human` has never been writable in production. This drops the leftover
-- constraint that forbids it.
--
-- ─── WHAT HAPPENED ─────────────────────────────────────────────────────────
-- The table was created with its CHECK named WITH the schema prefix
-- (supabase/migrations/20260815130000_yip_questionnaire.sql):
--
--     constraint yip_questionnaire_attempts_scoring_status_check
--       check (scoring_status in ('pending','scoring','scored','failed'))
--
-- The migration that introduced the resting state
-- (supabase/migrations/yip_questionnaire_scoring_needs_human.sql) then dropped a
-- name WITHOUT the prefix before adding its own:
--
--     DROP CONSTRAINT IF EXISTS questionnaire_attempts_scoring_status_check;
--
-- That name did not exist yet, so `IF EXISTS` turned the drop into a silent
-- no-op and the ADD created a SECOND constraint alongside the original. Both
-- are valid, and Postgres AND-s every CHECK on a table — so a status must
-- satisfy both lists, and `needs_human` appears in only one of them. Verified on
-- production before writing this:
--
--     questionnaire_attempts_scoring_status_check
--       CHECK (scoring_status = ANY (ARRAY['pending','scoring','scored','failed','needs_human']))
--     yip_questionnaire_attempts_scoring_status_check
--       CHECK (scoring_status = ANY (ARRAY['pending','scoring','scored','failed']))
--
-- ─── WHAT IT COST ──────────────────────────────────────────────────────────
-- `claimScoringWork` parks a paper handed in as a file by setting it to
-- `needs_human`, and discards that UPDATE's error. So the write was rejected in
-- silence, `continue` ran, and the attempt stayed at `scoring` — a state the
-- claim query never selects, because it only takes `pending`. The paper was
-- stranded permanently, with no `score_error` written, so the organiser's screen
-- never even said "read this one yourself".
--
-- Nothing has been lost yet only because no file has been submitted on any live
-- event so far. The Student Journalist round re-run is the first thing that
-- will produce them.
--
-- ─── WHY DROP RATHER THAN WIDEN ────────────────────────────────────────────
-- The prefixed constraint is the accidental survivor, not the intended rule.
-- The unprefixed one carries the current, complete list. Dropping the survivor
-- leaves exactly one CHECK on this column, which is what every other status
-- column in this schema has. Widening both would leave two lists to keep in
-- step, and the next status added would reintroduce this same bug.
--
-- Safe to run more than once, and safe on a database where the constraint was
-- already removed by hand.

ALTER TABLE yip.questionnaire_attempts
  DROP CONSTRAINT IF EXISTS yip_questionnaire_attempts_scoring_status_check;

-- Belt and braces: if this ever runs against a database where the ORIGINAL
-- migration was applied but the needs_human one was not, the line above would
-- leave the column with no CHECK at all. Re-assert the complete list under the
-- canonical name, so the end state is identical either way.
ALTER TABLE yip.questionnaire_attempts
  DROP CONSTRAINT IF EXISTS questionnaire_attempts_scoring_status_check;

ALTER TABLE yip.questionnaire_attempts
  ADD CONSTRAINT questionnaire_attempts_scoring_status_check
  CHECK (scoring_status = ANY (ARRAY[
    'pending'::text,
    'scoring'::text,
    'scored'::text,
    'failed'::text,
    'needs_human'::text
  ]));

-- ─── VERIFY AFTER APPLYING ─────────────────────────────────────────────────
-- Exactly ONE row, and its definition must include needs_human:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where contype='c'
--     and conrelid='yip.questionnaire_attempts'::regclass
--     and pg_get_constraintdef(oid) ilike '%scoring_status%';
--
-- Then confirm a park can actually be written (rolled back, touches nothing):
--
--   begin;
--     update yip.questionnaire_attempts set scoring_status='needs_human'
--     where id = (select id from yip.questionnaire_attempts limit 1);
--   rollback;
