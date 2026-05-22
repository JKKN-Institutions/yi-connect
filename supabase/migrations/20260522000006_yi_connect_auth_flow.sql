-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Auth flow lifted to yi_connect.*
-- Phase A Batch 4 — combines 3 migrations (2 skipped):
--   - 20251110000008 create_approved_emails_whitelist
--   - 20251110000009 update_auth_flow_for_oauth
--   - 20251110100000 auto_create_member_on_first_login
--
-- SKIPPED:
--   - 20251110000010 allow_public_chapters_read (yi.chapters has its
--     own RLS from YiFuture migration 128)
--   - 20251110110000 add_director_super_admin (director access is
--     handled via the cross-app yi.national_admins allow-list)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 20251110000008 create_approved_emails_whitelist ──────────────────────
/**
 * Create Approved Emails Whitelist
 *
 * Stores email addresses approved for Google OAuth login.
 * When admin approves a member request, email is added here.
 * OAuth callback checks this table to authorize new users.
 *
 * Flow: Admin approves → Email added to whitelist → User can login with Google
 */

-- Create approved_emails table
CREATE TABLE IF NOT EXISTS yi_connect.approved_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email Information
  email TEXT NOT NULL UNIQUE,

  -- Approval Information
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ DEFAULT NOW(),

  -- Associated Request
  member_request_id UUID REFERENCES yi_connect.member_requests(id),

  -- Chapter Assignment
  assigned_chapter_id UUID REFERENCES yi.chapters(id),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- First Login Tracking
  first_login_at TIMESTAMPTZ,
  member_created BOOLEAN DEFAULT FALSE,
  created_member_id UUID REFERENCES yi_connect.members(id),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_approved_emails_email ON yi_connect.approved_emails(email);
CREATE INDEX idx_approved_emails_active ON yi_connect.approved_emails(is_active);
CREATE INDEX idx_approved_emails_chapter ON yi_connect.approved_emails(assigned_chapter_id);
CREATE INDEX idx_approved_emails_request ON yi_connect.approved_emails(member_request_id);

-- Enable RLS
ALTER TABLE yi_connect.approved_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own approved email
CREATE POLICY "Users can view their own approved email"
  ON yi_connect.approved_emails FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Executive Members and above can view all approved emails
CREATE POLICY "Executives can view all approved emails"
  ON yi_connect.approved_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
  );

-- Executive Members and above can insert/update approved emails
CREATE POLICY "Executives can manage approved emails"
  ON yi_connect.approved_emails FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_approved_emails_updated_at
  BEFORE UPDATE ON yi_connect.approved_emails
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- Comments
COMMENT ON TABLE yi_connect.approved_emails IS 'Whitelist of email addresses approved for Google OAuth login';
COMMENT ON COLUMN yi_connect.approved_emails.email IS 'Email address that can login via Google OAuth';
COMMENT ON COLUMN yi_connect.approved_emails.is_active IS 'If false, this email is revoked and cannot login';
COMMENT ON COLUMN yi_connect.approved_emails.member_created IS 'True after member record has been created on first login';
COMMENT ON COLUMN yi_connect.approved_emails.assigned_chapter_id IS 'Chapter to assign when creating member record';

-- ── 20251110000009 update_auth_flow_for_oauth ──────────────────────────
/**
 * Update Authentication Flow for Google OAuth Only
 *
 * 1. Adds invitation tracking fields to profiles
 * 2. Updates handle_new_user trigger to:
 *    - Check if email is in approved_emails whitelist
 *    - Block unauthorized users
 *    - Auto-create profile for approved users
 *
 * Flow: User logs in with Google → Check whitelist → Create profile or block
 */

-- 1. Add invitation tracking fields to profiles
ALTER TABLE yi_connect.profiles
ADD COLUMN IF NOT EXISTS approved_email_id UUID REFERENCES yi_connect.approved_emails(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN yi_connect.profiles.approved_email_id IS 'Reference to approved_emails whitelist entry';
COMMENT ON COLUMN yi_connect.profiles.approved_at IS 'When this user was approved for membership';
COMMENT ON COLUMN yi_connect.profiles.approved_by IS 'Admin who approved this user';

-- 2. Drop and recreate handle_new_user function with whitelist check
DROP FUNCTION IF EXISTS yi_connect.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION yi_connect.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_email_record RECORD;
BEGIN
  -- Check if email is in approved_emails whitelist
  SELECT * INTO v_approved_email_record
  FROM yi_connect.approved_emails
  WHERE email = NEW.email
    AND is_active = TRUE;

  -- If email is NOT in whitelist, block the user
  IF v_approved_email_record IS NULL THEN
    RAISE EXCEPTION 'Email % is not authorized. Please apply at /apply first.', NEW.email
      USING ERRCODE = 'P0001';
  END IF;

  -- Email is approved, create profile
  INSERT INTO yi_connect.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
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
    v_approved_email_record.id,
    v_approved_email_record.approved_at,
    v_approved_email_record.approved_by
  );

  -- Assign default "Member" role
  INSERT INTO yi_connect.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM yi_connect.roles WHERE name = 'Member' LIMIT 1;

  -- Update approved_emails to mark first login
  UPDATE yi_connect.approved_emails
  SET first_login_at = NOW()
  WHERE id = v_approved_email_record.id
    AND first_login_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.handle_new_user();

-- 4. Add index on profiles.approved_email_id
CREATE INDEX IF NOT EXISTS idx_profiles_approved_email ON yi_connect.profiles(approved_email_id);

COMMENT ON FUNCTION yi_connect.handle_new_user IS 'Creates profile for new users only if their email is in the approved_emails whitelist. Blocks unauthorized users.';

-- ── 20251110100000 auto_create_member_on_first_login ───────────────────
/**
 * Auto-Create Member Record on First Login
 *
 * Updates the handle_new_user() trigger to automatically create a member record
 * when an approved user logs in for the first time.
 *
 * Flow:
 * 1. Admin approves request → email added to approved_emails with member_request_id
 * 2. User logs in with Google OAuth
 * 3. handle_new_user() trigger:
 *    a. Checks if email is in approved_emails whitelist
 *    b. Creates profile record
 *    c. Fetches data from member_requests table
 *    d. Creates member record with application data
 *    e. Updates approved_emails to mark member_created = true
 */

-- Drop and recreate handle_new_user function with member creation logic
DROP FUNCTION IF EXISTS yi_connect.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION yi_connect.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_email_record RECORD;
  v_member_request_record RECORD;
  v_profile_id UUID;
BEGIN
  -- 1. Check if email is in approved_emails whitelist
  SELECT * INTO v_approved_email_record
  FROM yi_connect.approved_emails
  WHERE email = NEW.email
    AND is_active = TRUE;

  -- If email is NOT in whitelist, block the user
  IF v_approved_email_record IS NULL THEN
    RAISE EXCEPTION 'Email % is not authorized. Please apply at /apply first.', NEW.email
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Create profile
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
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_approved_email_record.assigned_chapter_id,
    v_approved_email_record.id,
    v_approved_email_record.approved_at,
    v_approved_email_record.approved_by
  );

  v_profile_id := NEW.id;

  -- 3. Assign default "Member" role
  INSERT INTO yi_connect.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM yi_connect.roles WHERE name = 'Member' LIMIT 1;

  -- 4. Get member request data if available
  IF v_approved_email_record.member_request_id IS NOT NULL THEN
    SELECT * INTO v_member_request_record
    FROM yi_connect.member_requests
    WHERE id = v_approved_email_record.member_request_id;

    -- 5. Create member record with data from member_request
    IF v_member_request_record IS NOT NULL THEN
      INSERT INTO yi_connect.members (
        id,
        chapter_id,
        membership_status,
        member_since,
        -- Professional Information
        company,
        designation,
        industry,
        years_of_experience,
        linkedin_url,
        -- Personal Information
        date_of_birth,
        gender,
        address,
        city,
        state,
        country,
        pincode,
        -- Emergency Contact
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        -- System fields
        is_active
      )
      VALUES (
        v_profile_id,
        v_approved_email_record.assigned_chapter_id,
        'active',
        CURRENT_DATE,
        -- Professional Information
        v_member_request_record.company,
        v_member_request_record.designation,
        v_member_request_record.industry,
        v_member_request_record.years_of_experience,
        v_member_request_record.linkedin_url,
        -- Personal Information
        v_member_request_record.date_of_birth,
        v_member_request_record.gender,
        v_member_request_record.address,
        v_member_request_record.city,
        v_member_request_record.state,
        v_member_request_record.country,
        v_member_request_record.pincode,
        -- Emergency Contact
        v_member_request_record.emergency_contact_name,
        v_member_request_record.emergency_contact_phone,
        v_member_request_record.emergency_contact_relationship,
        -- System fields
        TRUE
      );

      -- 6. Update approved_emails to mark member_created
      UPDATE yi_connect.approved_emails
      SET
        first_login_at = NOW(),
        member_created = TRUE,
        created_member_id = v_profile_id
      WHERE id = v_approved_email_record.id;

      -- 7. Update member_requests to link created member
      UPDATE yi_connect.member_requests
      SET created_member_id = v_profile_id
      WHERE id = v_approved_email_record.member_request_id;

      -- 8. Log success
      RAISE NOTICE 'Successfully created profile and member record for %', NEW.email;
    END IF;
  ELSE
    -- No member_request found, just mark first login
    UPDATE yi_connect.approved_emails
    SET first_login_at = NOW()
    WHERE id = v_approved_email_record.id
      AND first_login_at IS NULL;

    RAISE NOTICE 'Created profile for % but no member_request found', NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.handle_new_user();

COMMENT ON FUNCTION yi_connect.handle_new_user IS 'Creates profile AND member record for new users if their email is in the approved_emails whitelist. Uses data from member_requests table to populate member record.';
