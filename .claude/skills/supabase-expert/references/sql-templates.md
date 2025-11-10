# SQL Templates Reference

Complete templates for all SQL object types in MyJKKN project.

## Table Creation Template

```sql
-- =====================================================
-- SECTION X: [MODULE_NAME] TABLES
-- =====================================================
-- [Table description]
-- Created: YYYY-MM-DD
-- Last Updated: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS public.[table_name] (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenant (required for most tables)
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,

    -- Business columns
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',

    -- Foreign keys
    related_id UUID REFERENCES public.related_table(id),

    -- Audit columns (required)
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add table comment
COMMENT ON TABLE public.[table_name] IS '[Detailed description of table purpose]';

-- Enable RLS (required for all tables)
ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_[table_name]_institution_id ON public.[table_name](institution_id);
CREATE INDEX idx_[table_name]_status ON public.[table_name](status);
CREATE INDEX idx_[table_name]_created_at ON public.[table_name](created_at);

-- Add update trigger
CREATE TRIGGER update_[table_name]_updated_at
BEFORE UPDATE ON public.[table_name]
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Function Templates

### Basic SECURITY INVOKER Function
```sql
-- =====================================================
-- FUNCTION: [function_name]
-- Purpose: [description]
-- Created: YYYY-MM-DD
-- Security: INVOKER (runs with caller permissions)
-- Volatility: STABLE (or IMMUTABLE/VOLATILE)
-- =====================================================

CREATE OR REPLACE FUNCTION public.[function_name](
    p_param1 TYPE,
    p_param2 TYPE DEFAULT 'default_value'
)
RETURNS return_type
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE  -- or IMMUTABLE/VOLATILE
AS $$
DECLARE
    v_result TYPE;
    v_temp_var TYPE;
BEGIN
    -- Input validation
    IF p_param1 IS NULL THEN
        RAISE EXCEPTION 'Parameter p_param1 cannot be null';
    END IF;

    -- Use fully qualified names
    SELECT column_name
    INTO v_result
    FROM public.table_name
    WHERE condition = p_param1
    AND institution_id = p_param2;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'No data found for %', p_param1;
    END IF;

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in [function_name]: %', SQLERRM;
        RETURN NULL;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.[function_name] FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.[function_name] TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.[function_name] IS '[Detailed description]';
```

### Auth Function (SECURITY DEFINER)
```sql
-- =====================================================
-- FUNCTION: check_user_permission
-- Purpose: Verify user access (needs elevated permissions)
-- SECURITY DEFINER required for auth checks
-- Created: YYYY-MM-DD
-- =====================================================

CREATE OR REPLACE FUNCTION auth.check_user_permission(
    p_institution_id UUID,
    p_resource TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Required for auth functions
SET search_path = ''
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_has_access BOOLEAN;
BEGIN
    -- Get current user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check permission
    SELECT EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
        AND institution_id = p_institution_id
        AND resource = p_resource
    ) INTO v_has_access;

    RETURN v_has_access;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Permission check failed: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION auth.check_user_permission FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.check_user_permission TO authenticated;
```

### Trigger Function
```sql
-- =====================================================
-- TRIGGER FUNCTION: auto_update_timestamps
-- Purpose: Update timestamps automatically
-- Created: YYYY-MM-DD
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_update_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    -- Update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;

    -- Log the update (optional)
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_by = auth.uid();
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Timestamp update failed: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Create trigger on table
CREATE TRIGGER update_timestamps
BEFORE UPDATE ON public.your_table
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_timestamps();
```

### Immutable Calculation Function
```sql
-- =====================================================
-- FUNCTION: calculate_age
-- Purpose: Calculate age from birthdate (pure function)
-- Created: YYYY-MM-DD
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_age(
    p_birthdate DATE
)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
IMMUTABLE  -- Pure function
AS $$
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate))::INTEGER;
$$;
```

### Data Aggregation Function
```sql
-- =====================================================
-- FUNCTION: get_institution_statistics
-- Purpose: Get aggregated stats for institution
-- Created: YYYY-MM-DD
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_institution_statistics(
    p_institution_id UUID
)
RETURNS TABLE (
    total_students BIGINT,
    total_staff BIGINT,
    active_courses BIGINT,
    current_semester TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE  -- Result can change between statements
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.students
         WHERE institution_id = p_institution_id AND status = 'active'),
        (SELECT COUNT(*) FROM public.staff
         WHERE institution_id = p_institution_id AND status = 'active'),
        (SELECT COUNT(*) FROM public.courses
         WHERE institution_id = p_institution_id AND is_active = true),
        (SELECT name FROM public.semesters
         WHERE institution_id = p_institution_id AND is_current = true
         LIMIT 1);
END;
$$;
```

## View Template

```sql
-- =====================================================
-- VIEW: [view_name]
-- Purpose: [description]
-- Created: YYYY-MM-DD
-- =====================================================

CREATE OR REPLACE VIEW public.[view_name] AS
SELECT
    t1.id,
    t1.institution_id,
    t1.field1,
    t2.field2 AS related_field,
    t1.created_at
FROM
    public.table1 t1
LEFT JOIN
    public.table2 t2 ON t1.id = t2.table1_id
WHERE
    t1.is_active = true
    AND t1.deleted_at IS NULL;

-- Add view comment
COMMENT ON VIEW public.[view_name] IS '[Detailed description]';

-- Grant permissions
GRANT SELECT ON public.[view_name] TO authenticated;
```

## Trigger Template

```sql
-- =====================================================
-- TRIGGER: [trigger_name]
-- Purpose: [description]
-- Created: YYYY-MM-DD
-- =====================================================

CREATE TRIGGER [trigger_name]
BEFORE INSERT OR UPDATE ON public.[table_name]
FOR EACH ROW
EXECUTE FUNCTION public.[function_name]();
```

## Migration Template

```sql
-- Migration: add_[column]_to_[table]
-- Created: YYYY-MM-DD
-- Description: [Brief description of change]

-- Add column
ALTER TABLE public.[table_name]
ADD COLUMN [column_name] TYPE DEFAULT 'default_value';

-- Add index if needed
CREATE INDEX IF NOT EXISTS idx_[table_name]_[column_name]
ON public.[table_name]([column_name]);

-- Update existing data if needed
UPDATE public.[table_name]
SET [column_name] = 'value'
WHERE condition;

-- Add comment
COMMENT ON COLUMN public.[table_name].[column_name] IS '[Description]';
```

## Complex Query with CTEs

```sql
-- Complex query template for reports
WITH active_students AS (
    -- Get all active students in current semester
    SELECT
        students.id,
        students.first_name,
        students.last_name,
        students.current_section_id,
        students.institution_id
    FROM
        public.students
    WHERE
        students.status = 'active'
        AND students.current_semester_id IS NOT NULL
),
attendance_summary AS (
    -- Calculate attendance percentage
    SELECT
        active_students.id AS student_id,
        COUNT(CASE WHEN daily_attendance.status = 'present' THEN 1 END) AS present_days,
        COUNT(*) AS total_days,
        ROUND(
            COUNT(CASE WHEN daily_attendance.status = 'present' THEN 1 END)::NUMERIC /
            COUNT(*)::NUMERIC * 100,
            2
        ) AS attendance_percentage
    FROM
        active_students
    LEFT JOIN
        public.daily_attendance ON active_students.id = daily_attendance.student_id
    WHERE
        daily_attendance.date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY
        active_students.id
)
SELECT
    active_students.first_name,
    active_students.last_name,
    attendance_summary.present_days,
    attendance_summary.total_days,
    attendance_summary.attendance_percentage
FROM
    active_students
JOIN
    attendance_summary ON active_students.id = attendance_summary.student_id
WHERE
    attendance_summary.attendance_percentage < 75
ORDER BY
    attendance_summary.attendance_percentage ASC;
```

## MyJKKN Specific Patterns

### Multi-Tenant Query Pattern
```sql
-- Always filter by institution
SELECT
    students.first_name,
    students.last_name,
    students.admission_number
FROM
    public.students
WHERE
    students.institution_id = (
        SELECT auth.jwt() -> 'app_metadata' ->> 'institution_id'
    )::UUID
    AND students.status = 'active';
```

### Soft Delete Pattern
```sql
-- Add soft delete columns
ALTER TABLE public.students
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN deleted_by UUID REFERENCES public.profiles(id);

-- Create view excluding deleted
CREATE VIEW public.active_students AS
SELECT * FROM public.students
WHERE deleted_at IS NULL;

-- Soft delete function
CREATE OR REPLACE FUNCTION public.soft_delete_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.students
    SET
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = auth.uid()
    WHERE id = p_student_id;

    RETURN FOUND;
END;
$$;
```

### Audit Trail Pattern
```sql
-- Audit log table
CREATE TABLE public.audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id UUID REFERENCES public.profiles(id),
    institution_id UUID REFERENCES public.institutions(id),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.audit_logs IS 'Audit trail for all data modifications';

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (
            table_name, operation, user_id, record_id, new_data
        ) VALUES (
            TG_TABLE_NAME, 'INSERT', auth.uid(), NEW.id, ROW_TO_JSON(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (
            table_name, operation, user_id, record_id, old_data, new_data
        ) VALUES (
            TG_TABLE_NAME, 'UPDATE', auth.uid(), NEW.id,
            ROW_TO_JSON(OLD), ROW_TO_JSON(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (
            table_name, operation, user_id, record_id, old_data
        ) VALUES (
            TG_TABLE_NAME, 'DELETE', auth.uid(), OLD.id, ROW_TO_JSON(OLD)
        );
        RETURN OLD;
    END IF;
END;
$$;
```

## Checklist

When creating SQL objects, verify:

- [ ] Using lowercase for SQL keywords
- [ ] Snake_case for all identifiers
- [ ] Plural table names, singular columns
- [ ] Schema prefix in all queries (public.)
- [ ] Comments on tables and functions
- [ ] Meaningful aliases with 'as'
- [ ] Full table names in joins
- [ ] ISO 8601 date format
- [ ] CTEs for complex logic
- [ ] Proper error handling
- [ ] Input validation
- [ ] Security settings (INVOKER/DEFINER)
- [ ] Search_path set to ''
- [ ] Appropriate volatility
- [ ] Permissions granted correctly
