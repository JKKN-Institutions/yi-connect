-- =====================================================
-- SECTION X: [MODULE_NAME] TABLES
-- =====================================================
-- [Table description]
-- Created: YYYY-MM-DD
-- Last Updated: YYYY-MM-DD

-- Table: [table_name]
-- Purpose: [Detailed description of what this table stores]
CREATE TABLE IF NOT EXISTS public.[table_name] (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenant (required for most tables)
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,

    -- Business columns (customize these)
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    code TEXT UNIQUE,

    -- Foreign keys (add as needed)
    parent_id UUID REFERENCES public.[parent_table](id),
    related_id UUID REFERENCES public.[related_table](id),

    -- Metadata columns
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit columns (required)
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add table comment
COMMENT ON TABLE public.[table_name] IS '[Detailed description of table purpose and usage]';

-- Add column comments (optional but helpful)
COMMENT ON COLUMN public.[table_name].status IS 'Current status of the record';
COMMENT ON COLUMN public.[table_name].metadata IS 'Additional flexible data storage';

-- Enable RLS (required for all tables)
ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;

-- Create indexes (REQUIRED for performance)
-- Always index:
-- - Foreign keys
-- - Columns used in WHERE clauses
-- - Columns used in ORDER BY
-- - Columns used in JOIN conditions

CREATE INDEX IF NOT EXISTS idx_[table_name]_institution_id
ON public.[table_name](institution_id);

CREATE INDEX IF NOT EXISTS idx_[table_name]_status
ON public.[table_name](status);

CREATE INDEX IF NOT EXISTS idx_[table_name]_parent_id
ON public.[table_name](parent_id);

CREATE INDEX IF NOT EXISTS idx_[table_name]_created_at
ON public.[table_name](created_at DESC);

CREATE INDEX IF NOT EXISTS idx_[table_name]_created_by
ON public.[table_name](created_by);

-- Compound index for common queries
CREATE INDEX IF NOT EXISTS idx_[table_name]_institution_status
ON public.[table_name](institution_id, status);

-- Add update trigger (required)
CREATE TRIGGER update_[table_name]_updated_at
BEFORE UPDATE ON public.[table_name]
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add audit trigger (optional)
-- CREATE TRIGGER audit_[table_name]
-- AFTER INSERT OR UPDATE OR DELETE ON public.[table_name]
-- FOR EACH ROW
-- EXECUTE FUNCTION public.audit_trigger();
