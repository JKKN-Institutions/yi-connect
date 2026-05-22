-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Fix handle_new_user cross-app bug + minimal seed
--
-- Critical bug: The yi_connect.handle_new_user() function (lifted in
-- Batch 4) RAISES EXCEPTION if a signup email is not in
-- yi_connect.approved_emails. Since auth.users is SHARED with YIP and
-- YiFuture in this Supabase project, this would block YIP students,
-- YiFuture delegates, YiFuture mentors, and YiFuture partners from
-- signing up — they're NOT in yi_connect.approved_emails because
-- they're not chapter members.
--
-- Fix: Make the function non-blocking. If email is not in yi_connect
-- whitelist, return NEW silently (let YIP/YiFuture's own handlers, if
-- any, decide what to do). Only create a yi_connect.profile for users
-- who ARE on the yi_connect whitelist.
--
-- Also: Seed the Erode chapter chair (director@jkkn.ac.in) into
-- yi_connect.approved_emails so they can actually sign in. Erode
-- chapter already exists in yi.chapters (id: fe71c429-...) — no need
-- to re-create.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Replace handle_new_user to be non-blocking ────────────────────────
CREATE OR REPLACE FUNCTION yi_connect.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = yi_connect, public, extensions
AS $$
DECLARE
  v_approved_email_record RECORD;
  v_member_role_id UUID;
BEGIN
  -- Check if email is in yi_connect.approved_emails whitelist.
  -- If NOT in whitelist, do nothing — let other apps (YIP/YiFuture)
  -- handle this user via their own triggers/checks.
  SELECT * INTO v_approved_email_record
  FROM yi_connect.approved_emails
  WHERE email = NEW.email
    AND is_active = TRUE;

  IF v_approved_email_record IS NULL THEN
    -- Not a yi_connect user. Silent no-op. Other apps may still
    -- create profile rows in public.* or future.* for this signup.
    RETURN NEW;
  END IF;

  -- User IS on yi_connect whitelist. Create yi_connect profile.
  INSERT INTO yi_connect.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    chapter_id,
    approved_email_id,
    approved_at,
    approved_by
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    v_approved_email_record.assigned_chapter_id,
    v_approved_email_record.id,
    NOW(),
    v_approved_email_record.approved_by
  )
  ON CONFLICT (id) DO NOTHING;

  -- Mark approved_email as used + link to created profile
  UPDATE yi_connect.approved_emails
  SET first_login_at = COALESCE(first_login_at, NOW()),
      member_created = TRUE
  WHERE id = v_approved_email_record.id;

  -- Assign default Member role if one exists.
  -- (yi_connect.roles is currently unseeded; this gracefully no-ops.)
  SELECT id INTO v_member_role_id
  FROM yi_connect.roles
  WHERE name = 'Member'
  LIMIT 1;

  IF v_member_role_id IS NOT NULL THEN
    INSERT INTO yi_connect.user_roles (user_id, role_id)
    VALUES (NEW.id, v_member_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Defensive: if anything fails, log and continue.
    -- Don't block the auth.users INSERT — the user can still sign in;
    -- profile can be created later via a manual repair path.
    RAISE WARNING 'yi_connect.handle_new_user failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION yi_connect.handle_new_user IS
  'Auth signup handler for yi_connect. Non-blocking: only acts on '
  'emails in yi_connect.approved_emails. YIP and YiFuture signups '
  'pass through untouched. See migration 20260522000022.';


-- ── 2. Minimal seed: director@jkkn.ac.in → yi_connect.approved_emails ────
-- Erode chapter already exists in yi.chapters (id fe71c429-...).
-- Find director's auth.users id via the national_admins email match.

DO $$
DECLARE
  v_erode_id   UUID;
  v_director_uid UUID;
BEGIN
  SELECT id INTO v_erode_id FROM yi.chapters WHERE name = 'Erode' AND city = 'Erode' LIMIT 1;

  SELECT u.id INTO v_director_uid
  FROM auth.users u
  WHERE u.email = 'director@jkkn.ac.in'
  LIMIT 1;

  -- Only insert if approved_by reference is satisfiable.
  -- If director hasn't signed in yet (no auth.users row), skip — the
  -- approved_emails.approved_by FK to auth.users(id) is NOT NULL.
  IF v_director_uid IS NOT NULL THEN
    INSERT INTO yi_connect.approved_emails (
      email,
      approved_by,
      approved_at,
      assigned_chapter_id,
      is_active,
      notes
    )
    VALUES (
      'director@jkkn.ac.in',
      v_director_uid,
      NOW(),
      v_erode_id,
      true,
      'Director — seeded via migration 20260522000022. Erode chapter chair, cross-app super-admin.'
    )
    ON CONFLICT (email) DO UPDATE
      SET is_active = true,
          assigned_chapter_id = EXCLUDED.assigned_chapter_id,
          notes = EXCLUDED.notes;

    RAISE NOTICE 'Seeded director@jkkn.ac.in into yi_connect.approved_emails for Erode chapter %', v_erode_id;
  ELSE
    RAISE NOTICE 'director@jkkn.ac.in has no auth.users row yet — skipping approved_emails seed. Will need re-run after first sign-in.';
  END IF;
END $$;
