# RLS Policy Patterns Reference

Performance-optimized RLS policy templates for MyJKKN project.

## Golden Rules for ALL Policies

```sql
-- CRITICAL PERFORMANCE RULES:

1. Performance: Always wrap functions in SELECT
   ✅ USING ((SELECT auth.uid()) = user_id)
   ❌ USING (auth.uid() = user_id)

2. Operation-specific clauses:
   SELECT: USING only
   INSERT: WITH CHECK only
   UPDATE: USING + WITH CHECK
   DELETE: USING only

3. Always specify target roles:
   TO authenticated -- for logged-in users
   TO authenticated, anon -- for public access
   TO anon -- for public only (rare)

4. Policy naming convention:
   "[Role] [action] [condition] [table]"
   Example: "Institution admins update own staff records"

5. Performance indexes (MANDATORY):
   - Index every column used in USING/WITH CHECK
   - Index foreign keys referenced in policies
   - Index commonly filtered columns
```

## Pattern 1: Institution-Based Access (Most Common)

**Use when:** Table has `institution_id` and users should only see their institution's data.

### Complete Policy Set

```sql
-- =====================================================
-- [TABLE_NAME] RLS POLICIES
-- =====================================================
-- Created: YYYY-MM-DD
-- Performance: Indexed on institution_id, created_by
-- Pattern: Institution-based access

-- SELECT: Authenticated users can view their institution's records
CREATE POLICY "Users view own institution [table_name] records"
ON public.[table_name]
FOR SELECT
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
    OR (SELECT auth.jwt()->>'role') IN ('super_admin', 'admin')
);

-- INSERT: Institution admins can create records
CREATE POLICY "Institution admins create [table_name] records"
ON public.[table_name]
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'institution_admin')
);

-- UPDATE: Institution admins can update their records
CREATE POLICY "Institution admins update own [table_name] records"
ON public.[table_name]
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'institution_admin')
)
WITH CHECK (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'institution_admin')
);

-- DELETE: Only super admins can delete
CREATE POLICY "Super admins delete [table_name] records"
ON public.[table_name]
FOR DELETE
TO authenticated
USING (
    (SELECT auth.jwt()->>'role') = 'super_admin'
);

-- PERFORMANCE: Create indexes for policy columns
CREATE INDEX IF NOT EXISTS idx_[table_name]_institution_id
ON public.[table_name](institution_id);

CREATE INDEX IF NOT EXISTS idx_[table_name]_created_by
ON public.[table_name](created_by);
```

## Pattern 2: User-Owned Records

**Use when:** Each record belongs to a specific user (profiles, preferences, etc.).

```sql
-- =====================================================
-- USER_DATA RLS POLICIES
-- =====================================================
-- Pattern: User-owned records

-- SELECT: Users can view own records
CREATE POLICY "Users view own user_data records"
ON public.user_data
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- INSERT: Users can create own records
CREATE POLICY "Users create own user_data records"
ON public.user_data
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE: Users can update own records
CREATE POLICY "Users update own user_data records"
ON public.user_data
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: Users can delete own records
CREATE POLICY "Users delete own user_data records"
ON public.user_data
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- PERFORMANCE INDEX
CREATE INDEX IF NOT EXISTS idx_user_data_user_id
ON public.user_data(user_id);
```

## Pattern 3: Role-Based Access

**Use when:** Access is determined by user role (admin, teacher, student, etc.).

```sql
-- =====================================================
-- SENSITIVE_TABLE RLS POLICIES
-- =====================================================
-- Pattern: Role-based access

-- SELECT: Admins and institution admins can view
CREATE POLICY "Admins view sensitive_table records"
ON public.sensitive_table
FOR SELECT
TO authenticated
USING (
    (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin', 'institution_admin')
);

-- INSERT: Only admins can create
CREATE POLICY "Admins create sensitive_table records"
ON public.sensitive_table
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
);

-- UPDATE: Only admins can update
CREATE POLICY "Admins update sensitive_table records"
ON public.sensitive_table
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
)
WITH CHECK (
    (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
);

-- DELETE: Only super admins can delete
CREATE POLICY "Super admins delete sensitive_table records"
ON public.sensitive_table
FOR DELETE
TO authenticated
USING (
    (SELECT auth.jwt()->>'role') = 'super_admin'
);
```

## Pattern 4: Public Read, Authenticated Write

**Use when:** Anyone can read, but only logged-in users can modify (announcements, public courses).

```sql
-- =====================================================
-- PUBLIC_CONTENT RLS POLICIES
-- =====================================================
-- Pattern: Public read, authenticated write

-- SELECT: Anyone can view published content
CREATE POLICY "Anyone view published public_content"
ON public.public_content
FOR SELECT
TO anon, authenticated
USING (is_published = true);

-- INSERT: Authenticated users can create
CREATE POLICY "Authenticated users create public_content"
ON public.public_content
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- UPDATE: Content owners and admins can update
CREATE POLICY "Owners update own public_content"
ON public.public_content
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) = created_by
    OR (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
)
WITH CHECK (
    (SELECT auth.uid()) = created_by
    OR (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
);

-- DELETE: Only content owners and admins can delete
CREATE POLICY "Owners delete own public_content"
ON public.public_content
FOR DELETE
TO authenticated
USING (
    (SELECT auth.uid()) = created_by
    OR (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
);

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_public_content_is_published
ON public.public_content(is_published);

CREATE INDEX IF NOT EXISTS idx_public_content_created_by
ON public.public_content(created_by);
```

## Pattern 5: MFA-Protected Operations

**Use when:** Sensitive operations require multi-factor authentication.

```sql
-- =====================================================
-- SENSITIVE_TABLE RLS POLICIES
-- =====================================================
-- Pattern: MFA-protected operations

-- SELECT: Normal authentication required
CREATE POLICY "Users view sensitive_table with MFA"
ON public.sensitive_table
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
    AND (SELECT auth.jwt()->>'aal') = 'aal2'  -- MFA required
);

-- UPDATE: MFA required for updates
CREATE POLICY "Users update sensitive_table with MFA"
ON public.sensitive_table
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (SELECT auth.uid()) = user_id
)
WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
);

-- DELETE: MFA required for deletion
CREATE POLICY "Users delete sensitive_table with MFA"
ON public.sensitive_table
FOR DELETE
TO authenticated
USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (SELECT auth.uid()) = user_id
);
```

## Pattern 6: Team/Group Access

**Use when:** Users belong to teams/groups and should access team resources.

```sql
-- =====================================================
-- TEAM_RESOURCES RLS POLICIES
-- =====================================================
-- Pattern: Team-based access with optimized queries

-- SELECT: Team members can view team resources
CREATE POLICY "Team members view team_resources"
ON public.team_resources
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT team_id
        FROM public.team_members
        WHERE user_id = (SELECT auth.uid())
    )
);

-- INSERT: Team admins can create resources
CREATE POLICY "Team admins create team_resources"
ON public.team_resources
FOR INSERT
TO authenticated
WITH CHECK (
    team_id IN (
        SELECT team_id
        FROM public.team_members
        WHERE user_id = (SELECT auth.uid())
        AND role IN ('admin', 'owner')
    )
);

-- UPDATE: Team admins can update resources
CREATE POLICY "Team admins update team_resources"
ON public.team_resources
FOR UPDATE
TO authenticated
USING (
    team_id IN (
        SELECT team_id
        FROM public.team_members
        WHERE user_id = (SELECT auth.uid())
        AND role IN ('admin', 'owner')
    )
)
WITH CHECK (
    team_id IN (
        SELECT team_id
        FROM public.team_members
        WHERE user_id = (SELECT auth.uid())
        AND role IN ('admin', 'owner')
    )
);

-- PERFORMANCE INDEXES (CRITICAL)
CREATE INDEX IF NOT EXISTS idx_team_members_user_id
ON public.team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id
ON public.team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_resources_team_id
ON public.team_resources(team_id);
```

## Pattern 7: Hierarchical Access (Manager-Employee)

**Use when:** Users can access their own data and their subordinates' data.

```sql
-- =====================================================
-- EMPLOYEE_DATA RLS POLICIES
-- =====================================================
-- Pattern: Hierarchical access

-- SELECT: Users can view own data and subordinates' data
CREATE POLICY "Users view accessible employee_data"
ON public.employee_data
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = user_id  -- Own data
    OR user_id IN (  -- Subordinates' data
        SELECT employee_id
        FROM public.employee_hierarchy
        WHERE manager_id = (SELECT auth.uid())
    )
    OR (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')  -- Admins see all
);

-- UPDATE: Users can update own data, managers can update subordinates
CREATE POLICY "Users update accessible employee_data"
ON public.employee_data
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) = user_id
    OR user_id IN (
        SELECT employee_id
        FROM public.employee_hierarchy
        WHERE manager_id = (SELECT auth.uid())
    )
    OR (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
)
WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IN (
        SELECT employee_id
        FROM public.employee_hierarchy
        WHERE manager_id = (SELECT auth.uid())
    )
    OR (SELECT auth.jwt()->>'role') IN ('admin', 'super_admin')
);

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_employee_hierarchy_manager_id
ON public.employee_hierarchy(manager_id);

CREATE INDEX IF NOT EXISTS idx_employee_hierarchy_employee_id
ON public.employee_hierarchy(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_data_user_id
ON public.employee_data(user_id);
```

## Pattern 8: Time-Based Access

**Use when:** Access changes based on time (e.g., exam results visible after date).

```sql
-- =====================================================
-- EXAM_RESULTS RLS POLICIES
-- =====================================================
-- Pattern: Time-based access

-- SELECT: Students can view results after publish date
CREATE POLICY "Students view published exam_results"
ON public.exam_results
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = student_id
    AND (
        publish_date <= CURRENT_TIMESTAMP
        OR (SELECT auth.jwt()->>'role') IN ('admin', 'teacher')
    )
);

-- PERFORMANCE INDEX
CREATE INDEX IF NOT EXISTS idx_exam_results_publish_date
ON public.exam_results(publish_date);

CREATE INDEX IF NOT EXISTS idx_exam_results_student_id
ON public.exam_results(student_id);
```

## Performance Optimization Checklist

When creating RLS policies, verify:

- [ ] Wrapped all functions in SELECT statements
- [ ] Added indexes on ALL policy filter columns
- [ ] Specified TO role to prevent unnecessary checks
- [ ] Avoided joins where possible (use IN/ANY instead)
- [ ] Used auth.jwt() for app_metadata access
- [ ] Tested with EXPLAIN ANALYZE for performance
- [ ] Created separate policies (not FOR ALL)
- [ ] Used PERMISSIVE (not RESTRICTIVE)

## Testing RLS Policies

```sql
-- Test as specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SET request.jwt.claim.role = 'admin';

-- Run query to test
SELECT * FROM public.table_name;

-- Check query plan
EXPLAIN ANALYZE SELECT * FROM public.table_name;

-- Reset
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;
```

## Common Pitfalls to Avoid

```sql
-- ❌ WRONG: Not wrapping functions
USING (auth.uid() = user_id)

-- ✅ CORRECT: Wrapped in SELECT
USING ((SELECT auth.uid()) = user_id)

-- ❌ WRONG: Using FOR ALL
CREATE POLICY "policy_name" ON table FOR ALL

-- ✅ CORRECT: Separate policies
CREATE POLICY "policy_select" ON table FOR SELECT
CREATE POLICY "policy_insert" ON table FOR INSERT
CREATE POLICY "policy_update" ON table FOR UPDATE
CREATE POLICY "policy_delete" ON table FOR DELETE

-- ❌ WRONG: Missing indexes
-- Policy uses institution_id but no index

-- ✅ CORRECT: Index all policy columns
CREATE INDEX idx_table_institution_id ON table(institution_id);

-- ❌ WRONG: Using WITH CHECK on SELECT
CREATE POLICY "select_policy" ON table FOR SELECT
USING (...) WITH CHECK (...);  -- WITH CHECK ignored on SELECT

-- ✅ CORRECT: USING only for SELECT
CREATE POLICY "select_policy" ON table FOR SELECT
TO authenticated
USING (...);

-- ❌ WRONG: Using USING on INSERT
CREATE POLICY "insert_policy" ON table FOR INSERT
USING (...) WITH CHECK (...);  -- USING ignored on INSERT

-- ✅ CORRECT: WITH CHECK only for INSERT
CREATE POLICY "insert_policy" ON table FOR INSERT
TO authenticated
WITH CHECK (...);
```

## Helper Functions for RLS

```sql
-- Check if user has institution access
CREATE OR REPLACE FUNCTION auth.has_institution_access(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
    RETURN (
        SELECT auth.jwt() -> 'app_metadata' ->> 'institution_id'
    )::UUID = p_institution_id;
END;
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION auth.has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
    RETURN (SELECT auth.jwt() ->> 'role') = p_role;
END;
$$;

-- Check if user has any of the roles
CREATE OR REPLACE FUNCTION auth.has_any_role(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
    RETURN (SELECT auth.jwt() ->> 'role') = ANY(p_roles);
END;
$$;
```

## Quick Reference

| Operation | USING Clause | WITH CHECK Clause |
|-----------|--------------|-------------------|
| SELECT    | ✅ Required  | ❌ Ignored        |
| INSERT    | ❌ Ignored   | ✅ Required       |
| UPDATE    | ✅ Required  | ✅ Required       |
| DELETE    | ✅ Required  | ❌ Ignored        |
