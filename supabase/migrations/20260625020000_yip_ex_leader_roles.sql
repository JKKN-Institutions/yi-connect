-- ═══════════════════════════════════════════════════════════════════════
-- "Ex-" deposed-leader roles.
--
-- When a sitting single-seat leader is removed mid-event — a No-Confidence
-- motion succeeds against the PM, the Speaker is impeached, or an organiser
-- deposes any single-seat leader — they become the ex_<role> variant and KEEP
-- their leadership points; the newly elected leader also earns them. Each ex_
-- role carries the SAME position bonus as its base role.
--
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction, so each is its
-- own statement (applied stepwise via the Management API). `IF NOT EXISTS`
-- guards re-runs. The position-bonus seeds reference only jsonb string keys
-- (never the enum literals), so they are safe to run in any order.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'ex_prime_minister';
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'ex_deputy_prime_minister';
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'ex_leader_of_opposition';
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'ex_speaker';
ALTER TYPE public.parliament_role ADD VALUE IF NOT EXISTS 'ex_deputy_speaker';

-- Seed each ex_ bonus = its base role's CURRENT value (COALESCE to the handbook
-- default for a fresh DB where the base key may not be seeded yet). The
-- `NOT (bonuses ? key)` guard makes each a no-op once present, so an
-- admin-tuned value is never overwritten.
UPDATE yip.position_bonus_config
SET bonuses = bonuses || jsonb_build_object('ex_prime_minister', COALESCE(bonuses->'prime_minister', '5'::jsonb))
WHERE id = true AND NOT (bonuses ? 'ex_prime_minister');

UPDATE yip.position_bonus_config
SET bonuses = bonuses || jsonb_build_object('ex_deputy_prime_minister', COALESCE(bonuses->'deputy_prime_minister', '4'::jsonb))
WHERE id = true AND NOT (bonuses ? 'ex_deputy_prime_minister');

UPDATE yip.position_bonus_config
SET bonuses = bonuses || jsonb_build_object('ex_leader_of_opposition', COALESCE(bonuses->'leader_of_opposition', '4'::jsonb))
WHERE id = true AND NOT (bonuses ? 'ex_leader_of_opposition');

UPDATE yip.position_bonus_config
SET bonuses = bonuses || jsonb_build_object('ex_speaker', COALESCE(bonuses->'speaker', '5'::jsonb))
WHERE id = true AND NOT (bonuses ? 'ex_speaker');

UPDATE yip.position_bonus_config
SET bonuses = bonuses || jsonb_build_object('ex_deputy_speaker', COALESCE(bonuses->'deputy_speaker', '4'::jsonb))
WHERE id = true AND NOT (bonuses ? 'ex_deputy_speaker');
