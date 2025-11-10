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
CREATE TABLE IF NOT EXISTS public.approved_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email Information
  email TEXT NOT NULL UNIQUE,

  -- Approval Information
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ DEFAULT NOW(),

  -- Associated Request
  member_request_id UUID REFERENCES public.member_requests(id),

  -- Chapter Assignment
  assigned_chapter_id UUID REFERENCES public.chapters(id),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- First Login Tracking
  first_login_at TIMESTAMPTZ,
  member_created BOOLEAN DEFAULT FALSE,
  created_member_id UUID REFERENCES public.members(id),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX idx_approved_emails_email ON public.approved_emails(email);
CREATE INDEX idx_approved_emails_active ON public.approved_emails(is_active);
CREATE INDEX idx_approved_emails_chapter ON public.approved_emails(assigned_chapter_id);
CREATE INDEX idx_approved_emails_request ON public.approved_emails(member_request_id);

-- Enable RLS
ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own approved email
CREATE POLICY "Users can view their own approved email"
  ON public.approved_emails FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Executive Members and above can view all approved emails
CREATE POLICY "Executives can view all approved emails"
  ON public.approved_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
  );

-- Executive Members and above can insert/update approved emails
CREATE POLICY "Executives can manage approved emails"
  ON public.approved_emails FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_approved_emails_updated_at
  BEFORE UPDATE ON public.approved_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Comments
COMMENT ON TABLE public.approved_emails IS 'Whitelist of email addresses approved for Google OAuth login';
COMMENT ON COLUMN public.approved_emails.email IS 'Email address that can login via Google OAuth';
COMMENT ON COLUMN public.approved_emails.is_active IS 'If false, this email is revoked and cannot login';
COMMENT ON COLUMN public.approved_emails.member_created IS 'True after member record has been created on first login';
COMMENT ON COLUMN public.approved_emails.assigned_chapter_id IS 'Chapter to assign when creating member record';
