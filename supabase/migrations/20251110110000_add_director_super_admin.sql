-- Add director@jkkn.ac.in to approved emails and assign Super Admin role
-- Migration: 20251110110000_add_director_super_admin.sql

-- 1. Add director email to approved_emails whitelist (if not already exists)
INSERT INTO public.approved_emails (
  email,
  approved_at,
  is_active,
  notes
)
VALUES (
  'director@jkkn.ac.in',
  NOW(),
  true,
  'Director - Auto-approved as Super Admin'
)
ON CONFLICT (email) DO UPDATE
SET
  is_active = true,
  notes = 'Director - Auto-approved as Super Admin',
  updated_at = NOW();

-- 2. Get the Super Admin role ID
DO $$
DECLARE
  v_super_admin_role_id UUID;
  v_director_user_id UUID;
BEGIN
  -- Get Super Admin role ID
  SELECT id INTO v_super_admin_role_id
  FROM public.roles
  WHERE name = 'Super Admin'
  LIMIT 1;

  -- Check if director has already logged in (has a profile)
  SELECT id INTO v_director_user_id
  FROM public.profiles
  WHERE email = 'director@jkkn.ac.in'
  LIMIT 1;

  -- If user exists and role exists, assign Super Admin role
  IF v_director_user_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    -- Remove any existing roles for this user (to avoid duplicates)
    DELETE FROM public.user_roles
    WHERE user_id = v_director_user_id;

    -- Assign Super Admin role
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_director_user_id, v_super_admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RAISE NOTICE 'Director email approved and Super Admin role assigned to existing user';
  ELSE
    RAISE NOTICE 'Director email approved. Super Admin role will be assigned after first login';
  END IF;
END $$;

-- 3. Create a trigger function to auto-assign Super Admin role when director logs in for the first time
CREATE OR REPLACE FUNCTION public.assign_director_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_super_admin_role_id UUID;
BEGIN
  -- Only process for director email
  IF NEW.email = 'director@jkkn.ac.in' THEN
    -- Get Super Admin role ID
    SELECT id INTO v_super_admin_role_id
    FROM public.roles
    WHERE name = 'Super Admin'
    LIMIT 1;

    -- Assign Super Admin role
    IF v_super_admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_super_admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;

      RAISE NOTICE 'Super Admin role auto-assigned to director@jkkn.ac.in';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_assign_director_super_admin_trigger ON public.profiles;

CREATE TRIGGER auto_assign_director_super_admin_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_director_super_admin();

-- Add comment
COMMENT ON TRIGGER auto_assign_director_super_admin_trigger ON public.profiles IS
  'Automatically assigns Super Admin role to director@jkkn.ac.in when they first login';
