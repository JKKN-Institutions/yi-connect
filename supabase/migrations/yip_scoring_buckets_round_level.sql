-- Scoring BUCKETS that can differ by ROUND LEVEL (chapter / regional / national).
--
-- THE PROBLEM
-- yip.scoring_buckets is the editable /100 model: which components exist, what
-- each is worth, how each splits between merit and jury marks, and which
-- session_keys roll into it. There is exactly ONE set of buckets, shared by
-- chapter, regional and national rounds, because bucket_key is globally unique.
-- A regional round therefore has to be composed exactly like a chapter round —
-- and the only workaround, editing the shared buckets, silently re-scores every
-- round that already finished, because results are recomputed on demand.
--
-- This is the second table to follow the recipe documented at the top of
-- lib/yip/round-level.ts; the first was yip.session_parameters
-- (yip_session_parameters_round_level.sql). Same shape, same reasoning, so the
-- two cannot drift apart.
--
-- THE SHAPE
-- `levels` is an ARRAY of the existing public.event_level enum, nullable:
--   levels IS NULL                 -> applies to EVERY level (what every row means today)
--   levels = '{regional}'          -> regional rounds only
--   levels = '{chapter,regional}'  -> one bucket serving two levels, no duplicate row
-- Reusing public.event_level (rather than text + a CHECK list) keeps ONE
-- definition of "what a level is", shared with yip.events.level.
--
-- ZERO BEHAVIOUR CHANGE
-- The column is added with no default and left NULL on all 7 existing rows.
-- NULL means "every level", which is precisely how those rows behave today, so
-- every existing round resolves to the same 7 buckets it resolved to before.
-- Nothing changes until a super-admin scopes a bucket to a level.
--
-- WHY THE UNIQUE KEY MOVES
-- "Regional Question Hour is worth 16, not 10" is only expressible if TWO rows
-- may share a bucket_key with different level scopes. UNIQUE (bucket_key) makes
-- that impossible, so it is replaced by UNIQUE (bucket_key, levels) NULLS NOT
-- DISTINCT. NULLS NOT DISTINCT keeps the old guarantee intact: there can still
-- be at most ONE global row per bucket_key. The new index is created BEFORE the
-- old constraint is dropped, and both run in one transaction, so there is never
-- a moment without a uniqueness guarantee.
--
-- WRITES MOVE TO ROW-ID IDENTITY
-- Because a bucket_key no longer identifies one row, the application stops
-- upserting on bucket_key (app/yip/actions/scoring-buckets.ts) and writes by the
-- row's uuid `id` instead. Without that change a second save would silently
-- create — or overwrite — the wrong row. yip.scoring_buckets already has a uuid
-- primary key, so no identity surgery is needed here.
--
-- SAFE ON A LIVE ROUND
-- Additive only: one nullable column, one new index, one constraint swapped for
-- a strictly weaker one. No column is dropped, no row is rewritten, no NOT NULL
-- is added to an existing column, and no result is recomputed. The table holds
-- 7 rows, so the brief ACCESS EXCLUSIVE lock is instantaneous. Idempotent.

BEGIN;

-- 1. The scope column. No DEFAULT: existing rows stay NULL = "every level".
ALTER TABLE yip.scoring_buckets
  ADD COLUMN IF NOT EXISTS levels public.event_level[];

COMMENT ON COLUMN yip.scoring_buckets.levels IS
  'Round levels this bucket applies to. NULL = every level (the default, and how all pre-2026-08 rows behave). Resolution prefers the set of buckets scoped to the event''s level and falls back to the NULL-scoped set; the two sets are never mixed, and a bucket scoped to a DIFFERENT level is never used.';

-- 2. Shape guard: an EMPTY array would be ambiguous against NULL, so forbid it.
--    Valid values are already constrained by the enum type itself.
ALTER TABLE yip.scoring_buckets
  DROP CONSTRAINT IF EXISTS scoring_buckets_levels_not_empty;
ALTER TABLE yip.scoring_buckets
  ADD CONSTRAINT scoring_buckets_levels_not_empty
  CHECK (levels IS NULL OR array_length(levels, 1) >= 1);

-- 3. Widen the uniqueness key, new index first so no window is left unguarded.
CREATE UNIQUE INDEX IF NOT EXISTS scoring_buckets_bucket_key_levels_key
  ON yip.scoring_buckets (bucket_key, levels) NULLS NOT DISTINCT;

ALTER TABLE yip.scoring_buckets
  DROP CONSTRAINT IF EXISTS scoring_buckets_bucket_key_key;

COMMIT;
