-- Add Chair role to director@jkkn.ac.in for Yi Erode chapter
-- Migration: 20260125000001_add_director_chair_role.sql

-- This migration adds the Chair role to director@jkkn.ac.in
-- The user already has Super Admin and National Admin roles
-- Chair role is needed for chapter-level operations in Yi Erode

DO $$
DECLARE
  v_chair_role_id UUID;
  v_director_user_id UUID;
  v_erode_chapter_id UUID;
BEGIN
  -- Get Chair role ID
  SELECT id INTO v_chair_role_id
  FROM public.roles
  WHERE name = 'Chair'
  LIMIT 1;

  -- Get director user ID
  SELECT id INTO v_director_user_id
  FROM public.profiles
  WHERE email = 'director@jkkn.ac.in'
  LIMIT 1;

  -- Get Yi Erode chapter ID
  SELECT id INTO v_erode_chapter_id
  FROM public.chapters
  WHERE name ILIKE '%erode%' OR name ILIKE '%Yi Erode%'
  LIMIT 1;

  -- Validate we found all required records
  IF v_chair_role_id IS NULL THEN
    RAISE EXCEPTION 'Chair role not found in roles table';
  END IF;

  IF v_director_user_id IS NULL THEN
    RAISE NOTICE 'Director user not found - they may not have logged in yet. Chair role will be assigned on first login.';
    RETURN;
  END IF;

  -- Update user's chapter to Yi Erode if not already set
  IF v_erode_chapter_id IS NOT NULL THEN
    UPDATE public.profiles
    SET chapter_id = v_erode_chapter_id,
        updated_at = NOW()
    WHERE id = v_director_user_id
    AND (chapter_id IS NULL OR chapter_id != v_erode_chapter_id);

    RAISE NOTICE 'Updated director chapter to Yi Erode';
  END IF;

  -- Assign Chair role (without removing existing roles)
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_director_user_id, v_chair_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE 'Chair role assigned to director@jkkn.ac.in for Yi Erode chapter';
END $$;

-- Update the trigger function to also assign Chair role when director first logs in
CREATE OR REPLACE FUNCTION public.assign_director_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_super_admin_role_id UUID;
  v_national_admin_role_id UUID;
  v_chair_role_id UUID;
  v_erode_chapter_id UUID;
BEGIN
  -- Only process for director email
  IF NEW.email = 'director@jkkn.ac.in' THEN
    -- Get role IDs
    SELECT id INTO v_super_admin_role_id
    FROM public.roles
    WHERE name = 'Super Admin'
    LIMIT 1;

    SELECT id INTO v_national_admin_role_id
    FROM public.roles
    WHERE name = 'National Admin'
    LIMIT 1;

    SELECT id INTO v_chair_role_id
    FROM public.roles
    WHERE name = 'Chair'
    LIMIT 1;

    -- Get Yi Erode chapter ID
    SELECT id INTO v_erode_chapter_id
    FROM public.chapters
    WHERE name ILIKE '%erode%' OR name ILIKE '%Yi Erode%'
    LIMIT 1;

    -- Assign Super Admin role
    IF v_super_admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_super_admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE 'Super Admin role auto-assigned to director@jkkn.ac.in';
    END IF;

    -- Assign National Admin role
    IF v_national_admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_national_admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE 'National Admin role auto-assigned to director@jkkn.ac.in';
    END IF;

    -- Assign Chair role
    IF v_chair_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_chair_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE 'Chair role auto-assigned to director@jkkn.ac.in';
    END IF;

    -- Set chapter to Yi Erode
    IF v_erode_chapter_id IS NOT NULL THEN
      UPDATE public.profiles
      SET chapter_id = v_erode_chapter_id
      WHERE id = NEW.id;
      RAISE NOTICE 'Chapter set to Yi Erode for director@jkkn.ac.in';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.assign_director_super_admin() IS
  'Automatically assigns Super Admin, National Admin, and Chair roles to director@jkkn.ac.in when they first login, and sets their chapter to Yi Erode';
