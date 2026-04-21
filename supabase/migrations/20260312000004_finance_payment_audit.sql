-- ================================================
-- MIGRATION: Finance Payment Methods & Audit Logs Enhancement
-- ================================================
-- Description: Adds account_details JSONB column to payment_methods table
--              and additional indexes for financial_audit_logs.
--              Both tables were created in 20251115000002_financial_command_center.sql
--              This migration adds enhancements for the new data layer.
-- Version: 1.0
-- Created: 2026-03-12
-- ================================================

-- ================================================
-- ENHANCE: payment_methods - add account_details JSONB
-- ================================================
-- Adds a flexible JSONB column to store structured payment account details
-- (e.g., bank details, UPI info, etc.) alongside the existing normalized columns.
-- This allows the data layer to store/read all account info in one field.

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS account_details JSONB DEFAULT '{}'::jsonb;

-- Backfill account_details from existing columns
UPDATE payment_methods
SET account_details = jsonb_strip_nulls(jsonb_build_object(
    'account_number', account_number,
    'bank_name', bank_name,
    'ifsc_code', ifsc_code,
    'upi_id', upi_id
))
WHERE account_details IS NULL OR account_details = '{}'::jsonb;

-- ================================================
-- ADDITIONAL INDEXES for financial_audit_logs
-- ================================================
-- Add index on entity_type alone for filtering by entity type
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
ON financial_audit_logs(entity_type);

-- Add index on action for filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON financial_audit_logs(action);

-- Add composite index for date-range queries within a chapter
CREATE INDEX IF NOT EXISTS idx_audit_logs_chapter_created
ON financial_audit_logs(chapter_id, created_at DESC);

-- ================================================
-- TRIGGER: Auto-update updated_at for payment_methods
-- ================================================
-- Ensure payment_methods has the same auto-update trigger as other finance tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_payment_methods_updated_at'
    ) THEN
        CREATE TRIGGER trigger_payment_methods_updated_at
            BEFORE UPDATE ON payment_methods
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ================================================
-- RLS: Ensure authenticated users can insert audit logs
-- ================================================
-- The original migration only has a SELECT policy for finance admins.
-- Add an INSERT policy so server actions can write audit log entries.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'financial_audit_logs'
          AND policyname = 'Authenticated users can insert audit logs'
    ) THEN
        CREATE POLICY "Authenticated users can insert audit logs"
            ON financial_audit_logs FOR INSERT
            TO authenticated
            WITH CHECK (
                performed_by = auth.uid()
            );
    END IF;
END;
$$;

-- ================================================
-- COMMENTS
-- ================================================
COMMENT ON COLUMN payment_methods.account_details IS 'Flexible JSONB storage for payment account details (bank info, UPI, etc.)';

-- ================================================
-- END OF MIGRATION
-- ================================================
