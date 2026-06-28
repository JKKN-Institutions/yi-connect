-- Configurable committee bill roles + report-optional default.
-- Applied to prod 2026-06-28 via the Management API; recorded here for parity.

-- 1. Bills can be drafted WITHOUT the Committee Report by default, for every
--    chapter. The per-event `allow_bill_before_report` flag remains the override
--    (set it false to re-require the report for a specific event).
ALTER TABLE yip.events ALTER COLUMN allow_bill_before_report SET DEFAULT true;
UPDATE yip.events SET allow_bill_before_report = true
  WHERE allow_bill_before_report IS DISTINCT FROM true;

-- 2. Bill drafters + presenters become CONFIGURABLE LISTS (any number per
--    committee), stored as jsonb arrays of participant ids. The legacy single
--    columns (lead_drafter / presenter_1 / presenter_2) are kept in sync by the
--    app (drafters[0] / presenters[0] / presenters[1]) so the dashboard,
--    control panel, projector and bill report keep working unchanged.
ALTER TABLE yip.bills
  ADD COLUMN IF NOT EXISTS drafters jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS presenters jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE yip.bills SET
  drafters = CASE WHEN lead_drafter IS NOT NULL
    THEN jsonb_build_array(lead_drafter::text) ELSE '[]'::jsonb END,
  presenters =
    (CASE WHEN presenter_1 IS NOT NULL THEN jsonb_build_array(presenter_1::text) ELSE '[]'::jsonb END)
    || (CASE WHEN presenter_2 IS NOT NULL THEN jsonb_build_array(presenter_2::text) ELSE '[]'::jsonb END)
WHERE drafters = '[]'::jsonb AND presenters = '[]'::jsonb;
