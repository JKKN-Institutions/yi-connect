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
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_email_record RECORD;
  v_member_request_record RECORD;
  v_profile_id UUID;
BEGIN
  -- 1. Check if email is in approved_emails whitelist
  SELECT * INTO v_approved_email_record
  FROM public.approved_emails
  WHERE email = NEW.email
    AND is_active = TRUE;

  -- If email is NOT in whitelist, block the user
  IF v_approved_email_record IS NULL THEN
    RAISE EXCEPTION 'Email % is not authorized. Please apply at /apply first.', NEW.email
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Create profile
  INSERT INTO public.profiles (
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
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'Member' LIMIT 1;

  -- 4. Get member request data if available
  IF v_approved_email_record.member_request_id IS NOT NULL THEN
    SELECT * INTO v_member_request_record
    FROM public.member_requests
    WHERE id = v_approved_email_record.member_request_id;

    -- 5. Create member record with data from member_request
    IF v_member_request_record IS NOT NULL THEN
      INSERT INTO public.members (
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
      UPDATE public.approved_emails
      SET
        first_login_at = NOW(),
        member_created = TRUE,
        created_member_id = v_profile_id
      WHERE id = v_approved_email_record.id;

      -- 7. Update member_requests to link created member
      UPDATE public.member_requests
      SET created_member_id = v_profile_id
      WHERE id = v_approved_email_record.member_request_id;

      -- 8. Log success
      RAISE NOTICE 'Successfully created profile and member record for %', NEW.email;
    END IF;
  ELSE
    -- No member_request found, just mark first login
    UPDATE public.approved_emails
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
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Creates profile AND member record for new users if their email is in the approved_emails whitelist. Uses data from member_requests table to populate member record.';
