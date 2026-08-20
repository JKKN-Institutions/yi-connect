-- A small, bounded, VISIBLE credit for speaking more than once in a session.
--
-- WHAT THE NATIONAL ADMIN ASKED FOR (2026-08-18)
--   "Multiple iterations also can be entered for scoring… eventually averaging
--    out the scores and maybe adding up a bit for participative efforts and
--    involvement"
--   "Scores must be averages of all scores. Some consideration for repeat
--    participation as well, but not very much."
--
-- The averaging half already exists and is live: yip.scores.occurrence (added
-- by #462) lets one juror record the same delegate several times in a session,
-- and the results engine averages a juror's turns into one per-juror mark
-- before averaging across jurors. 15 submitted marks in production are already
-- second turns. What did not exist is the "bit" for having spoken more than
-- once, and this migration adds the two numbers that control it.
--
-- THE SHAPE
--   participation_bonus_per_turn  points per EXTRA turn beyond the first
--   participation_bonus_max       the most those points may total
-- A delegate's bonus is
--   min(participation_bonus_max, 3, participation_bonus_per_turn x extra_turns)
-- where extra turns are counted per session as the MOST turns any ONE juror
-- recorded there, minus one — three jurors marking the same two speeches is two
-- speeches, not six.
--
-- The 3 in that formula is a HARD CEILING IN CODE
-- (PARTICIPATION_BONUS_HARD_CAP in app/yip/actions/results.ts), not a setting.
-- "Not very much" has to survive a typo: whatever is typed into these two
-- columns, the most repeat participation can move anyone is 3 points out of
-- 100. So it can only reorder delegates already within 3 points of each other —
-- it cannot lift a mid-table delegate past a strong one on volume alone. The
-- /100 ceiling itself does not move.
--
-- ZERO BEHAVIOUR CHANGE
-- Both columns are NOT NULL DEFAULT 0, and the engine treats 0 as OFF, so every
-- one of the 1,420 stored result rows across 15 events recomputes to exactly
-- the number it holds today. Nothing changes until a super-admin sets them.
-- Until then the results screen shows only "participation_turns" — how many
-- repeat turns a delegate had — worth no points, purely so the host can see
-- what the averaging is already smoothing.
--
-- SAFE ON A LIVE ROUND
-- Additive only: two nullable-free columns with defaults on a ONE-ROW singleton
-- table, plus two CHECK constraints. No column dropped, no row rewritten, no
-- NOT NULL added to an existing column, no result recomputed by this file. The
-- ACCESS EXCLUSIVE lock is on a single row and is instantaneous. Idempotent.
--
-- APPLY THIS BEFORE MERGING. app/yip/actions/results.ts selects both columns.
-- It is written to fall back to OFF if the select fails, so a merge without the
-- migration does not break scoring — but the setting would then be permanently
-- unreachable and silently ignored, which is worse than an error.

BEGIN;

ALTER TABLE yip.scoring_settings
  ADD COLUMN IF NOT EXISTS participation_bonus_per_turn numeric NOT NULL DEFAULT 0;

ALTER TABLE yip.scoring_settings
  ADD COLUMN IF NOT EXISTS participation_bonus_max numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN yip.scoring_settings.participation_bonus_per_turn IS
  'Points credited per EXTRA speaking turn beyond the first, summed across sessions. 0 = the participation bonus is off (the default, and how every event scores today).';

COMMENT ON COLUMN yip.scoring_settings.participation_bonus_max IS
  'Ceiling on the total participation bonus, in points out of 100. 0 = off. The engine also applies its own hard ceiling of 3 regardless of this value, so repeat participation can never decide a rank on its own.';

-- Shape guards. Negative points would turn "spoke more often" into a penalty;
-- a ceiling above the engine's own hard cap would be silently ignored and is
-- therefore rejected here instead, so the stored setting always means what it
-- says.
ALTER TABLE yip.scoring_settings
  DROP CONSTRAINT IF EXISTS scoring_settings_participation_per_turn_range;
ALTER TABLE yip.scoring_settings
  ADD CONSTRAINT scoring_settings_participation_per_turn_range
  CHECK (participation_bonus_per_turn >= 0 AND participation_bonus_per_turn <= 3);

ALTER TABLE yip.scoring_settings
  DROP CONSTRAINT IF EXISTS scoring_settings_participation_max_range;
ALTER TABLE yip.scoring_settings
  ADD CONSTRAINT scoring_settings_participation_max_range
  CHECK (participation_bonus_max >= 0 AND participation_bonus_max <= 3);

COMMIT;
