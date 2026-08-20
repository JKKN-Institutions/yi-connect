-- Scoring criteria that can differ by ROUND LEVEL (chapter / regional / national).
--
-- THE PROBLEM
-- `level` exists on exactly one table in the yip schema: yip.events
-- (chapter | regional | national). Every scoring-configuration table is a single
-- global set shared by all three levels, so a regional round is scored exactly
-- like a chapter round. The only workaround was to edit the shared sheets — and
-- because results are recomputed on demand, that silently re-scores rounds that
-- already finished. This migration removes that trap for the first of those
-- tables, yip.session_parameters (the per-session criteria sheets).
--
-- THE SHAPE
-- `levels` is an ARRAY of the existing public.event_level enum, nullable:
--   levels IS NULL  -> the sheet applies to EVERY level  (what every row means today)
--   levels = '{regional}'          -> regional rounds only
--   levels = '{chapter,regional}'  -> one sheet serving two levels, no duplicate row
-- Reusing public.event_level (rather than text + a CHECK list) keeps ONE
-- definition of "what a level is", shared with yip.events.level, so the two
-- cannot drift apart.
--
-- ZERO BEHAVIOUR CHANGE
-- The column is added with no default and is left NULL on all 13 existing rows.
-- NULL means "every level", which is precisely how those rows behave today, so
-- every existing round resolves to the same criteria sheet it resolved to before.
-- Nothing changes until a super-admin sets a level scope on some row.
--
-- WHY THE UNIQUE KEY MOVES
-- Regional agenda rows already carry the SAME session_key values as chapter ones
-- (question_hour, zero_hour, debate_central_agenda, ...). So "regional Question
-- Hour is scored out of 18, not 100" is only expressible if TWO rows may share
-- session_key with different level scopes. UNIQUE (session_key) makes that
-- impossible, so it is replaced by UNIQUE (session_key, levels) NULLS NOT
-- DISTINCT. NULLS NOT DISTINCT is what keeps the old guarantee intact: there can
-- still be at most ONE global row per session_key, and the existing
-- ON CONFLICT upsert path keeps working (now inferring on both columns).
-- The new index is created BEFORE the old constraint is dropped and both run in
-- one transaction, so there is never a moment without a uniqueness guarantee.
--
-- SAFE ON A LIVE ROUND
-- Additive only: one nullable column, one new index, one constraint swapped for
-- a strictly weaker one. No column is dropped, no row is rewritten, no NOT NULL
-- is added to an existing column, and no result is recomputed. The table holds
-- 13 rows, so the brief ACCESS EXCLUSIVE lock is instantaneous. Idempotent.

BEGIN;

-- 1. The scope column. No DEFAULT: existing rows stay NULL = "every level".
ALTER TABLE yip.session_parameters
  ADD COLUMN IF NOT EXISTS levels public.event_level[];

COMMENT ON COLUMN yip.session_parameters.levels IS
  'Round levels this criteria sheet applies to. NULL = every level (the default, and how all pre-2026-08 rows behave). Resolution prefers a row scoped to the event''s level and falls back to a NULL-scoped row; a row scoped to a DIFFERENT level is never used.';

-- 2. Shape guard: an EMPTY array would be ambiguous against NULL, so forbid it.
--    Valid values are already constrained by the enum type itself.
ALTER TABLE yip.session_parameters
  DROP CONSTRAINT IF EXISTS session_parameters_levels_not_empty;
ALTER TABLE yip.session_parameters
  ADD CONSTRAINT session_parameters_levels_not_empty
  CHECK (levels IS NULL OR array_length(levels, 1) >= 1);

-- 3. Widen the uniqueness key, new index first so no window is left unguarded.
CREATE UNIQUE INDEX IF NOT EXISTS session_parameters_session_key_levels_key
  ON yip.session_parameters (session_key, levels) NULLS NOT DISTINCT;

ALTER TABLE yip.session_parameters
  DROP CONSTRAINT IF EXISTS session_parameters_session_key_key;

COMMIT;
