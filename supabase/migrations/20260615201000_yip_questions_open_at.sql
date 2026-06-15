-- Add an OPEN bound for Question Hour submissions (event-days only).
--
-- yip.events already has questions_close_at — a single server-enforced CLOSE
-- time (handbook "collect questions >= 4 days before the session"). This adds
-- the matching OPEN bound so submissions are only accepted during the event
-- window. submitQuestion enforces open_at <= now() <= close_at server-side.
--
-- NULL = no open bound configured = submissions are open from the start
-- (preserves prior behaviour for events that never set this).
--
-- Decision 2026-06-15: explicit organiser-overridable column (mirrors
-- questions_close_at + setQuestionsDeadline) rather than binding to
-- day1_date, to avoid coupling two unrelated concepts and to keep the open
-- time independently settable in the questions dashboard.

ALTER TABLE yip.events
  ADD COLUMN IF NOT EXISTS questions_open_at TIMESTAMPTZ;

COMMENT ON COLUMN yip.events.questions_open_at IS
  'Earliest time students may submit Question Hour questions. Enforced server-side in submitQuestion alongside questions_close_at. NULL = no open bound (submissions open from the start).';

NOTIFY pgrst, 'reload schema';
