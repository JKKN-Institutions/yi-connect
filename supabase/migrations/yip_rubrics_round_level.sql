-- Role rubrics that can differ by ROUND LEVEL (chapter / regional / national).
--
-- THE PROBLEM
-- yip.rubrics holds the fallback scoring sheet for each parliament role — what a
-- juror marks against when the session itself has no configured criteria sheet.
-- There are exactly three rows (MP /110, Speaker /100, Deputy Speaker /100) and
-- they are GLOBAL: a regional round is marked on the same sheet as a chapter
-- round. The only workaround was to edit the shared row, and because results are
-- recomputed on demand that silently re-scores rounds that already finished.
--
-- This is the same trap yip.session_parameters had, and it is closed the same
-- way — see supabase/migrations/yip_session_parameters_round_level.sql (applied)
-- and the four-step recipe documented at the top of lib/yip/round-level.ts.
--
-- THE SHAPE
-- `levels` is an ARRAY of the existing public.event_level enum, nullable:
--   levels IS NULL                 -> applies to EVERY level (all 3 rows today)
--   levels = '{regional}'          -> regional rounds only
--   levels = '{chapter,regional}'  -> one rubric serving two levels, no duplicate
-- Reusing public.event_level (rather than text + a CHECK list) keeps ONE
-- definition of "what a level is", shared with yip.events.level.
--
-- ZERO BEHAVIOUR CHANGE
-- The column is added with no default and stays NULL on all 3 existing rows.
-- NULL means "every level", which is precisely how those rows behave today, so
-- every round resolves to the rubric it resolved to before. Nothing changes
-- until a super-admin scopes a rubric.
--
-- WHY THE UNIQUENESS RULES ARE NEW RATHER THAN WIDENED
-- Unlike session_parameters, yip.rubrics has NO unique key today beyond its
-- primary key — "one default per role" was enforced only in application code
-- (admin-rubrics.ts#clearDefaultForRole). Verified against production before
-- writing this migration: 3 rows, 3 defaults, 3 DISTINCT target_roles, so the
-- invariant holds and can safely be promoted to a database guarantee.
--
-- Two partial unique indexes, and one CHECK that ties them together:
--
--   1. rubrics_one_global_default_per_role
--      At most one GLOBAL default per role. This is the existing app-level
--      invariant, now enforced by the database.
--
--   2. rubrics_scoped_never_default  (CHECK)
--      A level-scoped rubric is NEVER flagged is_default. It wins by SCOPE, not
--      by the flag. This is what makes the change safe to deploy ahead of the
--      consumer: app/yip/actions/scoring.ts#getRubricForRole still runs
--      `.eq(target_role).eq(is_default,true).single()` with no level filter, and
--      `.single()` ERRORS when two rows come back. Because a scoped rubric can
--      never carry the flag, that query's result set cannot change no matter how
--      many scoped rubrics are created — the live jury fallback path is provably
--      untouched until that file is migrated to the new resolver.
--
--   3. rubrics_one_active_scoped_per_role
--      At most one ACTIVE rubric per (role, scope). Deactivated scoped rubrics
--      may pile up freely, so drafts and supersessions still work; resolution
--      within a scope tier therefore never needs a tie-breaker.
--
-- SAFE ON A LIVE ROUND
-- Additive only: one nullable column, two new partial indexes, two new CHECKs.
-- No column is dropped, no row is rewritten, no NOT NULL is added to an existing
-- column, no constraint is loosened and no result is recomputed. The table holds
-- 3 rows, so the brief ACCESS EXCLUSIVE lock is instantaneous. Idempotent.

BEGIN;

-- 1. The scope column. No DEFAULT: existing rows stay NULL = "every level".
ALTER TABLE yip.rubrics
  ADD COLUMN IF NOT EXISTS levels public.event_level[];

COMMENT ON COLUMN yip.rubrics.levels IS
  'Round levels this rubric applies to. NULL = every level (the default, and how all pre-2026-08 rows behave). Resolution prefers a rubric scoped to the event''s level and falls back to the NULL-scoped default; a rubric scoped to a DIFFERENT level is never used. See lib/yip/rubric.ts#resolveRubricForLevel.';

-- 2. Shape guard: an EMPTY array would be ambiguous against NULL, so forbid it.
--    Valid element values are already constrained by the enum type itself.
ALTER TABLE yip.rubrics
  DROP CONSTRAINT IF EXISTS rubrics_levels_not_empty;
ALTER TABLE yip.rubrics
  ADD CONSTRAINT rubrics_levels_not_empty
  CHECK (levels IS NULL OR array_length(levels, 1) >= 1);

-- 3. A scoped rubric is never the role default — it wins by scope. This is the
--    guard that keeps the un-migrated `.single()` consumer correct (see above).
ALTER TABLE yip.rubrics
  DROP CONSTRAINT IF EXISTS rubrics_scoped_never_default;
ALTER TABLE yip.rubrics
  ADD CONSTRAINT rubrics_scoped_never_default
  CHECK (levels IS NULL OR is_default IS NOT TRUE);

-- 4. At most one GLOBAL default per role (promotes the app-level invariant).
CREATE UNIQUE INDEX IF NOT EXISTS rubrics_one_global_default_per_role
  ON yip.rubrics (target_role)
  WHERE is_default IS TRUE AND levels IS NULL;

-- 5. At most one ACTIVE rubric per (role, scope). Inactive rows are unconstrained
--    so a replacement can be drafted before the incumbent is retired.
CREATE UNIQUE INDEX IF NOT EXISTS rubrics_one_active_scoped_per_role
  ON yip.rubrics (target_role, levels)
  WHERE is_active IS NOT FALSE AND levels IS NOT NULL;

COMMIT;
