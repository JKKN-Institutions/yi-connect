-- ═══════════════════════════════════════════════════════════════════════
-- Make `committee_chair` (Committee Chairperson) + `coalition_leader`
-- (Coalition Leader) ASSIGNABLE parliament roles.
--
-- Context (2026-06-24 Director decision: "1 person 1 role so everyone gets
-- opportunity" — more distinct leadership slots): both roles already carried
-- Position Points in yip.position_bonus_config (committee_chair = 2,
-- coalition_leader = 4) and both already appear in the Scoring Configuration
-- bonus editor — but neither was a member of the `parliament_role` enum, so NO
-- participant could ever be assigned them via the allocation role dropdown.
-- This migration adds the two enum values; the allocation UI then lists them
-- automatically (it iterates lib/yip/constants.ts PARLIAMENT_ROLES).
--
-- No engine change needed: results.ts reads Position Points as
-- position_bonus_config.bonuses[parliament_role] (a plain string lookup), so
-- once a student holds committee_chair / coalition_leader their +2 / +4 bonus
-- resolves automatically. Existing data is UNAFFECTED — these are additive enum
-- values; no row references them today.
--
-- Applied to prod (project bkmpbcoxbjyafieabxao) via the Management API on
-- 2026-06-24; this file records it for schema history.
-- ═══════════════════════════════════════════════════════════════════════

-- Additive enum values (safe, irreversible). IF NOT EXISTS guards re-runs.
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so on a
-- fresh `supabase db push` each statement runs on its own — keep them separate.
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'committee_chair';
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'coalition_leader';

-- Position Points safety-net for a FRESH database that seeds bonuses without
-- these two keys. On prod the keys already exist (2 / 4) so these are no-ops:
-- the `NOT (bonuses ? key)` guard means we ONLY insert a missing key and NEVER
-- overwrite an existing (possibly admin-tuned) value.
UPDATE yip.position_bonus_config
SET bonuses = bonuses || '{"committee_chair": 2}'::jsonb
WHERE id = true AND NOT (bonuses ? 'committee_chair');

UPDATE yip.position_bonus_config
SET bonuses = bonuses || '{"coalition_leader": 4}'::jsonb
WHERE id = true AND NOT (bonuses ? 'coalition_leader');
