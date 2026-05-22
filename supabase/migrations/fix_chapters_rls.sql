-- Fix Chapters RLS for Public Apply Page
-- Run this in Supabase Studio → SQL Editor

-- 1. Check current data
SELECT 'Current chapters in database:' as info;
SELECT id, name, location FROM chapters;

-- 2. Check current policies
SELECT 'Current RLS policies on chapters table:' as info;
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'chapters';

-- 3. Add policy for anonymous users to read chapters
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chapters'
    AND policyname = 'Chapters are viewable by everyone (including anonymous)'
  ) THEN
    -- Create the policy
    EXECUTE 'CREATE POLICY "Chapters are viewable by everyone (including anonymous)"
      ON public.chapters FOR SELECT
      TO anon
      USING (true);';

    RAISE NOTICE 'Policy created successfully!';
  ELSE
    RAISE NOTICE 'Policy already exists, skipping...';
  END IF;
END $$;

-- 4. Verify the fix
SELECT 'Verification - checking all policies again:' as info;
SELECT
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'chapters'
ORDER BY roles;

-- 5. Test query as anonymous user would see it
SELECT 'Test: What anonymous users will see:' as info;
SET ROLE anon;
SELECT id, name, location FROM chapters;
RESET ROLE;

SELECT 'Fix complete! Refresh your /apply page to see chapters.' as result;
