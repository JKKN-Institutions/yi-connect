-- Applied to prod (bkmpbcoxbjyafieabxao) via the Supabase Management API on
-- 2026-06-30; this file is the record (per project convention).
--
-- Director decision 2026-06-30: "Leadership & Positions" becomes 100%
-- position-based. The bucket's 10 points now come entirely from role merit —
-- the jury half is dropped (jurors' speaker-nomination/election + party-formation
-- scores no longer contribute to the final score). PM now earns the full 10
-- (was capped at 5).
--
-- Plus two new COMMITTEE BILL-ROLE merits — Committee Drafter and Committee
-- Presenter, 4 points each (matching Committee Chairperson). These are NOT
-- parliament roles: app/yip/actions/results.ts awards them to every participant
-- named on a bill's drafters[]/presenters[] jsonb lists, folded into roleBonus
-- and capped with all other merit at the leadership bucket's merit_max (10).
-- (Also in this change: app/yip/actions/positions.ts updatePositionBonusConfig
-- now MERGES instead of full-replacing the bonuses jsonb, so saving role bonuses
-- from any one admin screen no longer silently wipes keys the others own.)

-- 1. Leadership & Positions → merit 10 / jury 0 (position-only, out of 10).
update yip.scoring_buckets
set merit_max = 10, jury_max = 0, updated_at = now()
where bucket_key = 'leadership_positions';

-- 2. Add the two committee bill-role merits (merge-safe, preserves all keys).
update yip.position_bonus_config
set bonuses = bonuses || '{"committee_drafter":4,"committee_presenter":4}'::jsonb,
    updated_at = now()
where id = true;
