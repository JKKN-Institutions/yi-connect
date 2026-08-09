-- Multi-ministry model: a participant can hold MORE THAN ONE ministry.
--
-- Additive array columns on yip.participants:
--   • ministries text[]         — ALL ministry KEYS held (primary first)
--   • cabinet_portfolios text[] — ALL ministry LABELS, index-aligned with
--     `ministries` (an element may be NULL for legacy rows that had a key but
--     no portfolio label)
--
-- The existing single columns (`ministry` / `cabinet_portfolio`) REMAIN and
-- always hold the PRIMARY (first) ministry — full back-compat. The arrays hold
-- the complete set INCLUDING the primary.
--
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually. The deployed code
-- degrades gracefully (single-ministry behaviour) until this lands.

ALTER TABLE yip.participants
  ADD COLUMN IF NOT EXISTS ministries text[] NOT NULL DEFAULT '{}';
ALTER TABLE yip.participants
  ADD COLUMN IF NOT EXISTS cabinet_portfolios text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN yip.participants.ministries IS
  'ALL ministry KEYS this participant holds (primary first, includes the primary). The single `ministry` column mirrors element 1. Kept in sync with legacy single-column writers by trg_sync_participant_ministry_arrays.';
COMMENT ON COLUMN yip.participants.cabinet_portfolios IS
  'Ministry LABELS index-aligned with `ministries` (element may be NULL when only a key is known). The single `cabinet_portfolio` column mirrors element 1.';

-- Backfill: seed the arrays from the existing single columns.
UPDATE yip.participants
SET ministries = ARRAY[ministry],
    cabinet_portfolios = ARRAY[cabinet_portfolio]
WHERE ministry IS NOT NULL AND ministries = '{}';

-- Sync trigger: legacy writers (participants.ts updateParticipant / role
-- changes, allocation.ts apply/clear, mock-data, CSV import) only know the
-- SINGLE columns. Whenever a write changes `ministry`/`cabinet_portfolio`
-- WITHOUT touching the arrays, recompute the arrays from the singles so the
-- two representations never drift. Writes that set the arrays themselves
-- (positions.ts setCabinetPortfolio / removeCabinetPortfolio /
-- clearCabinetPortfolio) are left untouched.
CREATE OR REPLACE FUNCTION yip.sync_participant_ministry_arrays()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New rows (imports, mock data) arrive with the array default '{}'; seed
    -- the arrays from the single columns when a ministry is set.
    IF (NEW.ministries IS NULL OR NEW.ministries = '{}')
       AND NEW.ministry IS NOT NULL THEN
      NEW.ministries := ARRAY[NEW.ministry];
      NEW.cabinet_portfolios := ARRAY[NEW.cabinet_portfolio];
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: only intervene when the singles changed but the arrays did not
  -- (i.e. a legacy single-column writer). Array-aware writers change the
  -- arrays in the same statement and are left alone.
  IF (NEW.ministries IS NOT DISTINCT FROM OLD.ministries)
     AND (NEW.cabinet_portfolios IS NOT DISTINCT FROM OLD.cabinet_portfolios)
     AND ((NEW.ministry IS DISTINCT FROM OLD.ministry)
          OR (NEW.cabinet_portfolio IS DISTINCT FROM OLD.cabinet_portfolio)) THEN
    IF NEW.ministry IS NULL THEN
      NEW.ministries := '{}';
      NEW.cabinet_portfolios := '{}';
    ELSE
      NEW.ministries := ARRAY[NEW.ministry];
      NEW.cabinet_portfolios := ARRAY[NEW.cabinet_portfolio];
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_participant_ministry_arrays ON yip.participants;
CREATE TRIGGER trg_sync_participant_ministry_arrays
  BEFORE INSERT OR UPDATE ON yip.participants
  FOR EACH ROW
  EXECUTE FUNCTION yip.sync_participant_ministry_arrays();
