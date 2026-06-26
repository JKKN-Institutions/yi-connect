-- YIP Chapter Round Report — Section 5 (Committees & Bills).
-- Adds a REPORT-ONLY bill-outcome override to yip.committee_meta so an organiser
-- can correct a committee's Passed / Rejected / Not Presented line on the printed
-- Chapter Round Report WITHOUT mutating the live bills.status / vote tally.
--
-- Additive, nullable, idempotent. committee_meta is service-role-only (RLS on,
-- no policies, REVOKE from anon/authenticated — established by
-- 20260623010000_yip_committee_multijudge.sql); this column inherits that, so
-- no new grants/policies are needed. NULL = no override → the report derives the
-- outcome from the bill status (passed/rejected → those; anything else / no bill
-- → Not Presented).
--
-- Allowed values: 'passed' | 'rejected' | 'not_presented' (or NULL). The gated
-- server action validates the value before writing; the CHECK is defence in
-- depth. Added NOT VALID + a separate VALIDATE so re-runs are safe and an
-- existing row never blocks the migration.

ALTER TABLE yip.committee_meta
  ADD COLUMN IF NOT EXISTS report_bill_outcome_override text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committee_meta_report_bill_outcome_override_check'
      AND conrelid = 'yip.committee_meta'::regclass
  ) THEN
    ALTER TABLE yip.committee_meta
      ADD CONSTRAINT committee_meta_report_bill_outcome_override_check
      CHECK (
        report_bill_outcome_override IS NULL
        OR report_bill_outcome_override IN ('passed', 'rejected', 'not_presented')
      ) NOT VALID;
    ALTER TABLE yip.committee_meta
      VALIDATE CONSTRAINT committee_meta_report_bill_outcome_override_check;
  END IF;
END $$;

COMMENT ON COLUMN yip.committee_meta.report_bill_outcome_override IS
  'Chapter Round Report only: organiser override for a committee bill''s Passed/Rejected/Not Presented line. NULL = derive from bills.status. Never affects the live vote.';
