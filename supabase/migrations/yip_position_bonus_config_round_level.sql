-- Leadership / position MERIT points that can differ by ROUND LEVEL.
--
-- THE PROBLEM
-- yip.position_bonus_config holds one JSONB dictionary of role -> merit points
-- (prime_minister 5, speaker 3, ...). It is shared by chapter, regional and
-- national rounds. But the levels genuinely differ in WHICH ROLES EXIST: the
-- 2026 Regional Round introduced deputy_minister, parliamentary_administrator
-- and parliamentary_journalist (see KEY_ROLES in app/yip/actions/positions.ts),
-- which no chapter round has. Today one shared dictionary must serve both, and
-- editing it to suit a regional round silently re-scores every finished chapter
-- round, because results are recomputed on demand.
--
-- WHY THIS TABLE IS SHAPED DIFFERENTLY FROM THE OTHER TWO
-- yip.session_parameters and yip.scoring_buckets each have a uuid primary key,
-- so step 2 of the recipe in lib/yip/round-level.ts — "widen the natural unique
-- key to include levels" — applies to them directly.
--
-- yip.position_bonus_config CANNOT do that. It is a hard singleton:
--     id boolean PRIMARY KEY, CHECK (id = true)
-- so the table can physically hold exactly one row. Scoping it in place would
-- mean DROPPING its primary key and its CHECK constraint and grafting on a new
-- uuid identity — a rewrite of the identity of a live table that the results
-- engine and the event-readiness board both read, four days before the first
-- regional round. That is not an additive change and it is not worth the risk.
--
-- So the scoped tier lives in a NEW, purely additive table and the existing
-- singleton row keeps its exact meaning: it IS the global tier. Nothing about
-- yip.position_bonus_config is altered by this migration — not one column, not
-- one constraint, not one row. The vocabulary and the resolution rule are still
-- the shared ones from lib/yip/round-level.ts (public.event_level[], NULL/absent
-- = every level, scoped tier tried before the global tier, tiers never mixed);
-- only the physical storage of the scoped tier differs, and it differs because
-- the base table's primary key leaves no alternative.
--
-- THE SHAPE
--   yip.position_bonus_config          -> the GLOBAL merit table (unchanged)
--   yip.position_bonus_config_levels   -> zero or more LEVEL-SCOPED merit tables
-- `levels` is NOT NULL here: a row in this table exists precisely because it is
-- scoped. "Applies to every level" is spelled by the base singleton, so a NULL
-- would be a second spelling of the same thing. UNIQUE (levels) then means one
-- merit table per distinct scope, which is the same guarantee the widened
-- NULLS NOT DISTINCT keys give the other two tables.
--
-- A SCOPED ROW IS A COMPLETE MERIT TABLE, NOT A PATCH
-- Resolution never mixes the tiers: if a row scoped to the event's level exists,
-- its `bonuses` dictionary is used whole and the global one is ignored. A
-- partial dictionary would therefore score every unlisted role 0. The
-- application seeds a newly created scope from the current global dictionary so
-- an admin always starts from a full copy and edits down.
--
-- ZERO BEHAVIOUR CHANGE
-- The new table is created EMPTY. With no rows, every event resolves to the
-- global singleton — exactly what happens today. Nothing changes until a
-- super-admin creates a scope.
--
-- SAFE ON A LIVE ROUND
-- Additive only: one new empty table, no ALTER of any existing table, no row
-- rewritten, no result recomputed. Idempotent. Reversible by dropping the new
-- table.

BEGIN;

CREATE TABLE IF NOT EXISTS yip.position_bonus_config_levels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  levels       public.event_level[] NOT NULL,
  bonuses      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE yip.position_bonus_config_levels IS
  'Level-scoped overrides of yip.position_bonus_config. Each row is a COMPLETE role -> merit-points dictionary for the round levels it names. yip.position_bonus_config remains the global tier; a level with no row here uses it. The tiers are never merged.';

COMMENT ON COLUMN yip.position_bonus_config_levels.levels IS
  'Round levels this merit table applies to. NOT NULL and non-empty: "every level" is spelled by the base yip.position_bonus_config singleton, not by a NULL here.';

-- A scope must name at least one level, and each distinct scope may exist once.
ALTER TABLE yip.position_bonus_config_levels
  DROP CONSTRAINT IF EXISTS position_bonus_config_levels_not_empty;
ALTER TABLE yip.position_bonus_config_levels
  ADD CONSTRAINT position_bonus_config_levels_not_empty
  CHECK (array_length(levels, 1) >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS position_bonus_config_levels_levels_key
  ON yip.position_bonus_config_levels (levels);

-- Same posture as the base table: RLS on with NO policy, so anon/authenticated
-- read nothing and only the service role (the admin server actions) can touch
-- it. Tables created outside the normal migration path do not inherit the
-- service_role grant, so grant it explicitly.
ALTER TABLE yip.position_bonus_config_levels ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON yip.position_bonus_config_levels TO authenticated;
GRANT ALL    ON yip.position_bonus_config_levels TO service_role;

COMMIT;
