-- ============================================================================
-- BUG-CD-007: Rename aaa_plans.fiscal_year → calendar_year
-- ============================================================================
-- Root cause: table was created with fiscal_year but ALL application code
-- (server actions, data queries, validations, types, UI forms) uses
-- calendar_year. This caused createAAAPlan inserts to fail silently in the
-- catch block and the Pathfinder dashboard query to 42703 (column does not
-- exist), which the code swallows and returns [] for.
--
-- Fix: align DB with code. Rename column + index + unique constraint.
-- ============================================================================

ALTER TABLE aaa_plans RENAME COLUMN fiscal_year TO calendar_year;

-- Rename the supporting index (safe no-op if name already matches)
ALTER INDEX IF EXISTS idx_aaa_plans_fiscal_year RENAME TO idx_aaa_plans_calendar_year;

-- Re-assert the CHECK using the new name. Postgres carries the constraint
-- through the rename automatically, so no constraint rename is required.

COMMENT ON COLUMN aaa_plans.calendar_year IS 'Calendar year the AAA plan covers (renamed from fiscal_year 2026-04-18 to match application code).';
