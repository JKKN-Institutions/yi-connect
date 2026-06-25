-- Add lock_on_submit to yip.session_parameters.
--
-- When true, a session is scored ONCE per juror and frozen on submit:
--   • no extra turns (the `occurrence`/"Score another turn" path is rejected), and
--   • no re-scoring after submit (submitScore rejects a live re-edit of an
--     already-submitted row, and the jury form renders read-only).
-- The score KEEPS status='submitted' (so it still counts everywhere — award
-- engine, coverage, etc.); the lock is enforced in app code, NOT via a new
-- status value. The cross-juror panel average at result-computation time is
-- UNCHANGED — several jurors may each enter one score, still averaged once.
--
-- Director ruling 2026-06-25 (Erode Chapter Round, Jul 1-2): the 90-second
-- Constituency Speech ("Matters of Urgent Public Importance", session_key
-- 'urgent_public_importance') is given once per delegate, so unlike other sessions
-- it must not allow the jury to re-score or average across multiple turns.
--
-- Idempotent. Default false → every other session keeps its current multi-turn,
-- editable-until-event-lock behaviour.

alter table yip.session_parameters
  add column if not exists lock_on_submit boolean not null default false;

update yip.session_parameters
  set lock_on_submit = true
  where session_key = 'urgent_public_importance';
