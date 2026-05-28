-- Backfill: 9 Yi-Future national admins from yi.national_admins into yi_directory canonical tables.
--
-- Source rows in yi.national_admins (per 2026-05-28 backfill):
--   director@jkkn.ac.in            -- is_super_admin=true, is_platform_admin=true
--   piyush.garg@powertekengg.com   -- is_platform_admin=true (Yuva chair)
--   mayank.jain@cii.in             -- plain national admin
--   vedant@wrs.energy              -- plain national admin
--   varanmittal@gmail.com          -- plain national admin
--   akshar@groupnish.com           -- plain national admin
--   koushikmodi26@gmail.com        -- plain national admin
--   ankushmadan7@gmail.com         -- plain national admin (already had a yi_directory.people row, user_id was NULL)
--   manav@boxpushindia.com         -- plain national admin
--
-- All 9 emails already exist in auth.users.
-- yi_directory.people.email is UNIQUE. role_assignments has no uniqueness constraint, so the
-- inserts use WHERE NOT EXISTS guards to stay idempotent on re-run.
-- CLAUDE.md "freeze writes" rule: this migration does NOT delete from yi.national_admins.

DO $$
DECLARE
  v_emails CONSTANT text[] := ARRAY[
    'director@jkkn.ac.in',
    'piyush.garg@powertekengg.com',
    'mayank.jain@cii.in',
    'vedant@wrs.energy',
    'varanmittal@gmail.com',
    'akshar@groupnish.com',
    'koushikmodi26@gmail.com',
    'ankushmadan7@gmail.com',
    'manav@boxpushindia.com'
  ];
  v_email text;
  v_local text;
  v_auth_uid uuid;
  v_person_id uuid;
  v_role text;
  v_title text;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    -- Local-part fallback for full_name when no row exists yet
    v_local := split_part(v_email, '@', 1);

    -- Look up existing auth.users.id for this email (may be NULL)
    SELECT id INTO v_auth_uid
    FROM auth.users
    WHERE lower(email) = lower(v_email)
    LIMIT 1;

    -- Upsert into yi_directory.people: keyed on email (UNIQUE).
    -- If a row exists with NULL user_id and auth.users now has one, attach it.
    -- Do NOT overwrite full_name if already set.
    INSERT INTO yi_directory.people (user_id, full_name, email, is_active)
    VALUES (v_auth_uid, v_local, v_email, true)
    ON CONFLICT (email) DO UPDATE
      SET user_id = COALESCE(yi_directory.people.user_id, EXCLUDED.user_id),
          updated_at = now()
    RETURNING id INTO v_person_id;

    -- Decide role + title from the source national_admins booleans
    IF v_email = 'director@jkkn.ac.in' THEN
      v_role  := 'super_admin';
      v_title := 'Yi-Future Super Admin';
    ELSIF v_email = 'piyush.garg@powertekengg.com' THEN
      v_role  := 'national_admin';
      v_title := 'Yi-Future Platform Admin';
    ELSE
      v_role  := 'national_admin';
      v_title := 'Yi-Future National Admin';
    END IF;

    -- Idempotent INSERT into role_assignments
    INSERT INTO yi_directory.role_assignments
      (person_id, app, role, yi_year, title, is_active, is_primary)
    SELECT v_person_id, 'future', v_role, 2026, v_title, true, false
    WHERE NOT EXISTS (
      SELECT 1 FROM yi_directory.role_assignments
      WHERE person_id = v_person_id
        AND app       = 'future'
        AND role      = v_role
        AND yi_year   = 2026
    );
  END LOOP;
END $$;
