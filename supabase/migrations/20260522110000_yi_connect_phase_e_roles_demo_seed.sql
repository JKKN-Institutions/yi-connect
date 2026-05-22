-- =========================================================================
-- Phase E hotfix: seed missing roles + wire demo accounts
-- =========================================================================
-- Symptoms before this migration:
--   * yi_connect.roles only had Super Admin + Industry Coordinator
--   * demo-chair / demo-cochair / demo-ec / demo-national / demo-exec /
--     demo-member did not exist in approved_emails so demo login bypass
--     left them without profile/member/role rows
--   * handle_new_user always assigned 'Member' role regardless of
--     approved_emails.assigned_role_name (column didn't exist in
--     yi_connect.approved_emails — only in master's public version)
--   * handle_new_user did NOT create a yi_connect.members row, only
--     a profile, so role-gated routes denied access
--
-- This migration:
--   1. Adds approved_emails.assigned_role_name column
--   2. Seeds 5 missing roles (Member, EC Member, Co-Chair, Chair,
--      National Admin)
--   3. Upserts approved_emails entries for all 8 demo accounts (Erode
--      chapter, role per account)
--   4. Replaces handle_new_user to read assigned_role_name + create a
--      yi_connect.members row
--   5. Re-fires handle_new_user logic for already-existing director +
--      demo-super so they get the right role + member row
-- =========================================================================

SET search_path TO yi_connect, public, extensions;

-- =========================================================================
-- 1. Add assigned_role_name column to approved_emails
-- =========================================================================

ALTER TABLE yi_connect.approved_emails
ADD COLUMN IF NOT EXISTS assigned_role_name TEXT DEFAULT 'Member';

COMMENT ON COLUMN yi_connect.approved_emails.assigned_role_name IS
  'Role to assign to this email when their auth.users row is first created. Defaults to Member.';

-- =========================================================================
-- 2. Seed missing roles
-- =========================================================================
--   hierarchy_level reference:
--     7 = Super Admin (already seeded)
--     6 = National Admin
--     5 = Executive Member
--     4 = Chair
--     3 = Co-Chair
--     2 = EC Member
--     1 = Industry Coordinator (already seeded)
--     0 = Member
-- =========================================================================

INSERT INTO yi_connect.roles (id, name, hierarchy_level)
VALUES
  ('00000000-0000-0000-0000-000000000060', 'National Admin',     6),
  ('00000000-0000-0000-0000-000000000050', 'Executive Member',   5),
  ('00000000-0000-0000-0000-000000000040', 'Chair',              4),
  ('00000000-0000-0000-0000-000000000030', 'Co-Chair',           3),
  ('00000000-0000-0000-0000-000000000020', 'EC Member',          2),
  ('00000000-0000-0000-0000-000000000000', 'Member',             0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, hierarchy_level = EXCLUDED.hierarchy_level;

-- =========================================================================
-- 3. Upsert demo accounts in approved_emails (Erode chapter)
-- =========================================================================

DO $$
DECLARE
  v_erode UUID;
BEGIN
  SELECT id INTO v_erode FROM yi.chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_erode IS NULL THEN
    RAISE EXCEPTION 'Erode chapter not found in yi.chapters; seed it first.';
  END IF;

  -- demo accounts + their target roles. approved_by = director's user id.
  INSERT INTO yi_connect.approved_emails (email, assigned_chapter_id, assigned_role_name, is_active, approved_at, approved_by)
  VALUES
    ('demo-super@yi-demo.com',    v_erode, 'Super Admin',          true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-national@yi-demo.com', v_erode, 'National Admin',       true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-exec@yi-demo.com',     v_erode, 'Executive Member',     true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-chair@yi-demo.com',    v_erode, 'Chair',                true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-cochair@yi-demo.com',  v_erode, 'Co-Chair',             true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-ec@yi-demo.com',       v_erode, 'EC Member',            true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-industry@yi-demo.com', v_erode, 'Industry Coordinator', true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687'),
    ('demo-member@yi-demo.com',   v_erode, 'Member',               true, now(), '6722f821-1c1b-48cd-9f22-2934888ca687')
  ON CONFLICT (email) DO UPDATE SET
    assigned_chapter_id = EXCLUDED.assigned_chapter_id,
    assigned_role_name  = EXCLUDED.assigned_role_name,
    is_active           = true;

  -- Director (Super Admin) for Erode
  UPDATE yi_connect.approved_emails
  SET assigned_role_name = 'Super Admin', assigned_chapter_id = v_erode, is_active = true
  WHERE email = 'director@jkkn.ac.in';
END $$;

-- =========================================================================
-- 4. Replace handle_new_user to read role + create member row
-- =========================================================================

CREATE OR REPLACE FUNCTION yi_connect.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO yi_connect, public, extensions
AS $$
DECLARE
  v_approved      RECORD;
  v_role_id       UUID;
  v_role_name     TEXT;
BEGIN
  SELECT * INTO v_approved
  FROM yi_connect.approved_emails
  WHERE email = NEW.email AND is_active = TRUE;

  IF v_approved IS NULL THEN
    -- Not a yi_connect-whitelisted user; let other apps handle them.
    RETURN NEW;
  END IF;

  -- Create profile (idempotent on id)
  INSERT INTO yi_connect.profiles (
    id, email, full_name, avatar_url, phone, chapter_id,
    approved_email_id, approved_at, approved_by
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    v_approved.assigned_chapter_id,
    v_approved.id,
    NOW(),
    v_approved.approved_by
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), yi_connect.profiles.full_name),
    chapter_id = COALESCE(EXCLUDED.chapter_id, yi_connect.profiles.chapter_id),
    updated_at = NOW();

  -- Create member row tied to the same chapter
  INSERT INTO yi_connect.members (
    id, chapter_id, membership_status, is_active, member_since, created_at, updated_at
  )
  VALUES (
    NEW.id,
    v_approved.assigned_chapter_id,
    'active',
    TRUE,
    CURRENT_DATE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    chapter_id = COALESCE(EXCLUDED.chapter_id, yi_connect.members.chapter_id),
    is_active  = TRUE,
    updated_at = NOW();

  -- Assign the role specified on the approved_emails row
  v_role_name := COALESCE(v_approved.assigned_role_name, 'Member');
  SELECT id INTO v_role_id FROM yi_connect.roles WHERE name = v_role_name LIMIT 1;

  IF v_role_id IS NULL THEN
    -- Fallback: pick Member if it exists, else any role
    SELECT id INTO v_role_id FROM yi_connect.roles WHERE name = 'Member' LIMIT 1;
    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM yi_connect.roles LIMIT 1;
    END IF;
  END IF;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO yi_connect.user_roles (user_id, role_id)
    VALUES (NEW.id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  -- Mark approved_email as used
  UPDATE yi_connect.approved_emails
  SET first_login_at  = COALESCE(first_login_at, NOW()),
      member_created  = TRUE,
      created_member_id = NEW.id
  WHERE id = v_approved.id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'yi_connect.handle_new_user failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure the trigger is wired on auth.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_yi_connect'
  ) THEN
    CREATE TRIGGER on_auth_user_created_yi_connect
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION yi_connect.handle_new_user();
  END IF;
END $$;

-- =========================================================================
-- 5. Backfill existing auth.users who match yi_connect approved_emails
-- =========================================================================
-- Walks every existing auth.users row and runs the same logic the trigger
-- would have run on signup. Idempotent via ON CONFLICT clauses above.
-- =========================================================================

DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    JOIN yi_connect.approved_emails ae ON ae.email = au.email AND ae.is_active = TRUE
  LOOP
    -- Re-use the trigger function's body by simulating a NEW row.
    -- We can't call handle_new_user() directly (it's a trigger function), but
    -- we can replicate its effect inline. Simplest: call PERFORM on a SELECT
    -- that mirrors the INSERTs above.
    DECLARE
      v_approved RECORD;
      v_role_id  UUID;
      v_role_name TEXT;
    BEGIN
      SELECT * INTO v_approved FROM yi_connect.approved_emails
      WHERE email = u.email AND is_active = TRUE;

      INSERT INTO yi_connect.profiles (
        id, email, full_name, avatar_url, phone, chapter_id,
        approved_email_id, approved_at, approved_by
      )
      VALUES (
        u.id, u.email,
        COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'phone',
        v_approved.assigned_chapter_id,
        v_approved.id, NOW(), v_approved.approved_by
      )
      ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), yi_connect.profiles.full_name),
        chapter_id = COALESCE(EXCLUDED.chapter_id, yi_connect.profiles.chapter_id),
        updated_at = NOW();

      INSERT INTO yi_connect.members (
        id, chapter_id, membership_status, is_active, member_since, created_at, updated_at
      )
      VALUES (u.id, v_approved.assigned_chapter_id, 'active', TRUE, CURRENT_DATE, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        chapter_id = COALESCE(EXCLUDED.chapter_id, yi_connect.members.chapter_id),
        is_active  = TRUE,
        updated_at = NOW();

      v_role_name := COALESCE(v_approved.assigned_role_name, 'Member');
      SELECT id INTO v_role_id FROM yi_connect.roles WHERE name = v_role_name LIMIT 1;
      IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM yi_connect.roles WHERE name = 'Member' LIMIT 1;
      END IF;
      IF v_role_id IS NOT NULL THEN
        -- Clear any wrong roles first so the user has ONLY the intended role
        DELETE FROM yi_connect.user_roles WHERE user_id = u.id AND role_id != v_role_id;
        INSERT INTO yi_connect.user_roles (user_id, role_id)
        VALUES (u.id, v_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
      END IF;

      RAISE NOTICE 'Backfilled %: role=%, chapter=%', u.email, v_role_name, v_approved.assigned_chapter_id;
    END;
  END LOOP;
END $$;

-- End of Phase E roles + demo seed
