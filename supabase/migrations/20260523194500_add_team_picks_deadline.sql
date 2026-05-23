-- Add per-edition team-picks deadline.
--
-- After this timestamp, any team in the edition that still has
-- problem_statement_id IS NULL will be auto-assigned a problem statement
-- by the cron at /api/cron/auto-assign-problems.
--
-- NULL = no deadline configured = cron skips this edition.
--
-- Decision: 2026-05-23 — admin no longer gates each team's PS pick. Teams
-- self-finalize, and any team that misses the deadline gets an auto-pick
-- based on captain's preferred_track_slug, falling back to any active
-- problem. Admin retains the override via pickProblemStatement.

ALTER TABLE future.editions
  ADD COLUMN IF NOT EXISTS team_picks_deadline TIMESTAMPTZ;

COMMENT ON COLUMN future.editions.team_picks_deadline IS
  'Cutoff after which the cron auto-assigns a problem statement to any team that still has problem_statement_id IS NULL. NULL = no deadline = cron skips.';

NOTIFY pgrst, 'reload schema';
