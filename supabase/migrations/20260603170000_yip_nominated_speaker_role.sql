-- ═══════════════════════════════════════════════════════════════════════
-- Add the `nominated_speaker` parliament role + its position-point value.
-- Phase 2 of the 2026-06-03 Director scoring-model decisions.
--
-- Yi 2026 Workbook (Position Points): an ELECTED Speaker = 5, but a candidate
-- who was NOMINATED for Speaker and did NOT win the chair = 1. The platform had
-- only a single `speaker` role (worth 5), so every speaker candidate scored 5.
-- This adds a distinct `nominated_speaker` role worth 1. After the on-day
-- Speaker election, organisers set the non-elected candidates to "Nominated for
-- Speaker" via the allocation role dropdown; the elected Speaker keeps `speaker`.
--
-- No engine change: results.ts already reads Position Points as
-- position_bonus_config.bonuses[parliament_role], so `nominated_speaker` → 1
-- resolves automatically. Existing events (e.g. Mizoram) are UNAFFECTED — their
-- speakers stay role=`speaker`=5 unless an organiser explicitly reassigns them.
--
-- Already APPLIED to prod (project bkmpbcoxbjyafieabxao) via the Management API
-- on 2026-06-03; this file records it for schema history.
-- ═══════════════════════════════════════════════════════════════════════

-- Additive enum value (safe, irreversible). IF NOT EXISTS guards re-runs.
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'nominated_speaker';

-- Position Points for the new role (config singleton). Merge-set so the other
-- role bonuses are preserved.
UPDATE yip.position_bonus_config
SET bonuses = bonuses || '{"nominated_speaker": 1}'::jsonb
WHERE id = true;
