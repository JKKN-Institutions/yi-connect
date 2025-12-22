-- Yi Connect - Multi-Chapter System Migration
-- Enables multiple chapters with admin invitations and feature toggles
-- Created: 2024-12-22

-- ============================================================================
-- PART 1: EXTEND CHAPTERS TABLE
-- ============================================================================

-- Add new columns to chapters table
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS
  status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('draft', 'pending_chair', 'active', 'suspended', 'archived'));

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS
  chair_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS
  settings JSONB DEFAULT '{}';

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS
  onboarding_completed_at TIMESTAMPTZ;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_chapters_chair ON public.chapters(chair_id);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON public.chapters(status);

-- ============================================================================
-- PART 2: CHAPTER INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chapter_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chapter assignment
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,

  -- Invitee info
  email TEXT,
  phone TEXT,
  full_name TEXT NOT NULL,
  invited_role TEXT NOT NULL DEFAULT 'Chair',

  -- Token for secure acceptance (using md5 hash of random + timestamp)
  token TEXT NOT NULL UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text || random()::text),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

  -- Personal message from inviter
  personal_message TEXT,

  -- Acceptance tracking
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),

  -- Audit trail
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Either email or phone required
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Indexes for chapter_invitations
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_token ON public.chapter_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_email ON public.chapter_invitations(email);
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_phone ON public.chapter_invitations(phone);
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_chapter ON public.chapter_invitations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_status ON public.chapter_invitations(status);

-- Trigger for updated_at
CREATE TRIGGER chapter_invitations_updated_at
  BEFORE UPDATE ON public.chapter_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 3: FEATURE TOGGLES TABLE
-- ============================================================================

-- Create feature enum type
DO $$ BEGIN
  CREATE TYPE feature_name AS ENUM (
    'events',
    'communications',
    'stakeholder_crm',
    'session_bookings',
    'opportunities',
    'knowledge_base',
    'awards',
    'finance',
    'analytics',
    'member_intelligence',
    'succession_planning',
    'verticals',
    'sub_chapters',
    'industrial_visits'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.chapter_feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  feature feature_name NOT NULL,

  -- Toggle state
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,

  -- Who changed it
  changed_by UUID REFERENCES auth.users(id),

  -- Optional settings per feature (JSON config)
  settings JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One toggle per feature per chapter
  UNIQUE(chapter_id, feature)
);

-- Indexes for feature toggles
CREATE INDEX IF NOT EXISTS idx_chapter_features_chapter ON public.chapter_feature_toggles(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_features_enabled ON public.chapter_feature_toggles(chapter_id, is_enabled)
  WHERE is_enabled = true;

-- Trigger for updated_at
CREATE TRIGGER chapter_feature_toggles_updated_at
  BEFORE UPDATE ON public.chapter_feature_toggles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: SECURITY FUNCTIONS
-- ============================================================================

-- Function: Check if user is National Admin (hierarchy_level >= 6)
CREATE OR REPLACE FUNCTION public.is_national_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
    AND r.hierarchy_level >= 6
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Override user_belongs_to_chapter to allow National Admin bypass
CREATE OR REPLACE FUNCTION public.user_belongs_to_chapter(p_chapter_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- National Admin can access all chapters
  IF public.is_national_admin() THEN
    RETURN TRUE;
  END IF;

  -- Regular users check chapter membership via profiles
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND chapter_id = p_chapter_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Check if feature is enabled for a chapter
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_chapter_id UUID,
  p_feature feature_name
)
RETURNS BOOLEAN AS $$
BEGIN
  -- National Admin can access all features
  IF public.is_national_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.chapter_feature_toggles
    WHERE chapter_id = p_chapter_id
    AND feature = p_feature
    AND is_enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Get all enabled features for a chapter
CREATE OR REPLACE FUNCTION public.get_chapter_features(p_chapter_id UUID)
RETURNS feature_name[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT feature FROM public.chapter_feature_toggles
    WHERE chapter_id = p_chapter_id
    AND is_enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function: Initialize default features for a new chapter
CREATE OR REPLACE FUNCTION public.initialize_chapter_features(p_chapter_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
  default_enabled feature_name[] := ARRAY[
    'events'::feature_name,
    'communications'::feature_name,
    'stakeholder_crm'::feature_name,
    'knowledge_base'::feature_name,
    'analytics'::feature_name,
    'verticals'::feature_name
  ];
  all_features feature_name[] := ARRAY[
    'events'::feature_name,
    'communications'::feature_name,
    'stakeholder_crm'::feature_name,
    'session_bookings'::feature_name,
    'opportunities'::feature_name,
    'knowledge_base'::feature_name,
    'awards'::feature_name,
    'finance'::feature_name,
    'analytics'::feature_name,
    'member_intelligence'::feature_name,
    'succession_planning'::feature_name,
    'verticals'::feature_name,
    'sub_chapters'::feature_name,
    'industrial_visits'::feature_name
  ];
  f feature_name;
BEGIN
  FOREACH f IN ARRAY all_features LOOP
    INSERT INTO public.chapter_feature_toggles (
      chapter_id,
      feature,
      is_enabled,
      enabled_at,
      changed_by
    ) VALUES (
      p_chapter_id,
      f,
      f = ANY(default_enabled),
      CASE WHEN f = ANY(default_enabled) THEN NOW() ELSE NULL END,
      p_user_id
    )
    ON CONFLICT (chapter_id, feature) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Accept chapter invitation
CREATE OR REPLACE FUNCTION public.accept_chapter_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_chair_role_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM public.chapter_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND token_expires_at > NOW();

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Get Chair role ID
  SELECT id INTO v_chair_role_id
  FROM public.roles
  WHERE name = 'Chair';

  -- Update invitation status
  UPDATE public.chapter_invitations
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = v_user_id
  WHERE id = v_invitation.id;

  -- Update user's profile with chapter
  UPDATE public.profiles
  SET chapter_id = v_invitation.chapter_id
  WHERE id = v_user_id;

  -- Update member record with chapter
  UPDATE public.members
  SET chapter_id = v_invitation.chapter_id
  WHERE id = v_user_id;

  -- Assign Chair role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_chair_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- Update chapter with chair and status
  UPDATE public.chapters
  SET
    chair_id = v_user_id,
    status = 'active'
  WHERE id = v_invitation.chapter_id;

  RETURN jsonb_build_object(
    'success', true,
    'chapter_id', v_invitation.chapter_id,
    'message', 'Invitation accepted successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get invitation details by token
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT
    ci.id,
    ci.status,
    ci.full_name,
    ci.email,
    ci.phone,
    ci.invited_role,
    ci.personal_message,
    ci.token_expires_at,
    c.name as chapter_name,
    c.location as chapter_location,
    p.full_name as inviter_name
  INTO v_invitation
  FROM public.chapter_invitations ci
  JOIN public.chapters c ON ci.chapter_id = c.id
  JOIN public.profiles p ON ci.invited_by = p.id
  WHERE ci.token = p_token;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_invitation.id,
    'status', v_invitation.status,
    'full_name', v_invitation.full_name,
    'email', v_invitation.email,
    'phone', v_invitation.phone,
    'invited_role', v_invitation.invited_role,
    'personal_message', v_invitation.personal_message,
    'expires_at', v_invitation.token_expires_at,
    'chapter_name', v_invitation.chapter_name,
    'chapter_location', v_invitation.chapter_location,
    'inviter_name', v_invitation.inviter_name,
    'is_expired', v_invitation.token_expires_at < NOW(),
    'is_valid', v_invitation.status = 'pending' AND v_invitation.token_expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.chapter_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_feature_toggles ENABLE ROW LEVEL SECURITY;

-- Chapter Invitations Policies

-- National Admin can manage all invitations
CREATE POLICY "invitations_national_admin_all"
  ON public.chapter_invitations FOR ALL
  TO authenticated
  USING (public.is_national_admin())
  WITH CHECK (public.is_national_admin());

-- Anyone can view invitations by token (for accepting)
CREATE POLICY "invitations_view_by_token"
  ON public.chapter_invitations FOR SELECT
  TO authenticated
  USING (true);

-- Chapter Feature Toggles Policies

-- National Admin can manage all feature toggles
CREATE POLICY "features_national_admin_all"
  ON public.chapter_feature_toggles FOR ALL
  TO authenticated
  USING (public.is_national_admin())
  WITH CHECK (public.is_national_admin());

-- Chapter members can view their chapter's features
CREATE POLICY "features_chapter_member_select"
  ON public.chapter_feature_toggles FOR SELECT
  TO authenticated
  USING (user_belongs_to_chapter(chapter_id));

-- ============================================================================
-- PART 6: UPDATE CHAPTERS POLICIES
-- ============================================================================

-- Drop old insert policy
DROP POLICY IF EXISTS "Chapters are insertable by Executive Members and above" ON public.chapters;

-- Create new policy: Only National Admin can create chapters
CREATE POLICY "Chapters are insertable by National Admin only"
  ON public.chapters FOR INSERT
  TO authenticated
  WITH CHECK (public.is_national_admin());

-- ============================================================================
-- PART 7: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.chapter_invitations IS 'Invitation tokens for chapter admin onboarding';
COMMENT ON TABLE public.chapter_feature_toggles IS 'Per-chapter feature flags to enable/disable functionality';
COMMENT ON FUNCTION public.is_national_admin IS 'Check if user has National Admin privileges (level 6+)';
COMMENT ON FUNCTION public.is_feature_enabled IS 'Check if a specific feature is enabled for a chapter';
COMMENT ON FUNCTION public.accept_chapter_invitation IS 'Process invitation acceptance and assign Chair role';

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON public.chapter_invitations TO authenticated;
GRANT ALL ON public.chapter_feature_toggles TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_national_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chapter_features TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_chapter_features TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chapter_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token TO authenticated;
