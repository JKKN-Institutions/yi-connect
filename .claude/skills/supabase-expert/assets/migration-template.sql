-- Migration: [action]_[object]_[description]
-- Created: YYYY-MM-DD
-- Description: [Brief description of what this migration does and why]
-- Related Issue/Ticket: #[number] (if applicable)

-- =====================================================
-- MIGRATION START
-- =====================================================

-- Add new column to existing table
-- ALTER TABLE public.[table_name]
-- ADD COLUMN [column_name] TYPE DEFAULT 'default_value';

-- Add index for new column
-- CREATE INDEX IF NOT EXISTS idx_[table_name]_[column_name]
-- ON public.[table_name]([column_name]);

-- Update existing data (if needed)
-- UPDATE public.[table_name]
-- SET [column_name] = 'value'
-- WHERE condition;

-- Add column comment
-- COMMENT ON COLUMN public.[table_name].[column_name] IS '[Description]';

-- =====================================================
-- MIGRATION END
-- =====================================================

-- ROLLBACK (if needed):
-- ALTER TABLE public.[table_name] DROP COLUMN [column_name];
