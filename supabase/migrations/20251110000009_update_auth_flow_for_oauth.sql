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
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_email_id UUID REFERENCES public.approved_emails(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.profiles.approved_email_id IS 'Reference to approved_emails whitelist entry';
COMMENT ON COLUMN public.profiles.approved_at IS 'When this user was approved for membership';
COMMENT ON COLUMN public.profiles.approved_by IS 'Admin who approved this user';

-- 2. Drop and recreate handle_new_user function with whitelist check
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_approved_email_record RECORD;
BEGIN
  -- Check if email is in approved_emails whitelist
  SELECT * INTO v_approved_email_record
  FROM public.approved_emails
  WHERE email = NEW.email
    AND is_active = TRUE;

  -- If email is NOT in whitelist, block the user
  IF v_approved_email_record IS NULL THEN
    RAISE EXCEPTION 'Email % is not authorized. Please apply at /apply first.', NEW.email
      USING ERRCODE = 'P0001';
  END IF;

  -- Email is approved, create profile
  INSERT INTO public.profiles (
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
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'Member' LIMIT 1;

  -- Update approved_emails to mark first login
  UPDATE public.approved_emails
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
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Add index on profiles.approved_email_id
CREATE INDEX IF NOT EXISTS idx_profiles_approved_email ON public.profiles(approved_email_id);

COMMENT ON FUNCTION public.handle_new_user IS 'Creates profile for new users only if their email is in the approved_emails whitelist. Blocks unauthorized users.';
