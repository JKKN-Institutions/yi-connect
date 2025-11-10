/**
 * Create Member Requests Table
 *
 * Stores membership applications from public users.
 * Applications are reviewed and approved by Super Admins.
 *
 * Flow: Public applies → Admin reviews → Approves → Email whitelisted → User can login with Google
 */

-- Create member_requests table
CREATE TABLE IF NOT EXISTS public.member_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, -- Must be Google email they'll use to login
  phone TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

  -- Professional Information
  company TEXT,
  designation TEXT,
  industry TEXT,
  years_of_experience INTEGER CHECK (years_of_experience >= 0),
  linkedin_url TEXT,

  -- Personal Information
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  pincode TEXT,

  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,

  -- Why join Yi?
  motivation TEXT NOT NULL, -- Why do you want to join Yi?
  how_did_you_hear TEXT, -- How did you hear about Yi?

  -- Preferred Chapter
  preferred_chapter_id UUID REFERENCES public.chapters(id),

  -- Request Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),

  -- Admin Review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Created Member Reference (after first login)
  created_member_id UUID REFERENCES public.members(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_member_requests_status ON public.member_requests(status);
CREATE INDEX idx_member_requests_email ON public.member_requests(email);
CREATE INDEX idx_member_requests_chapter ON public.member_requests(preferred_chapter_id);
CREATE INDEX idx_member_requests_created_at ON public.member_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.member_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow anyone (including anonymous) to submit requests
CREATE POLICY "Anyone can submit member requests"
  ON public.member_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to view their own request by email
CREATE POLICY "Users can view their own requests"
  ON public.member_requests FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Executive Members and above can view all requests
CREATE POLICY "Executives can view all member requests"
  ON public.member_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5 -- Executive Member and above
    )
  );

-- Executive Members and above can update requests (approve/reject)
CREATE POLICY "Executives can manage member requests"
  ON public.member_requests FOR UPDATE
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
CREATE TRIGGER set_member_requests_updated_at
  BEFORE UPDATE ON public.member_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Comments
COMMENT ON TABLE public.member_requests IS 'Stores membership applications from public users awaiting admin approval';
COMMENT ON COLUMN public.member_requests.email IS 'Google email address that will be used for OAuth login';
COMMENT ON COLUMN public.member_requests.status IS 'Request status: pending, approved, rejected, or withdrawn';
COMMENT ON COLUMN public.member_requests.motivation IS 'Why applicant wants to join Yi';
COMMENT ON COLUMN public.member_requests.created_member_id IS 'References member record created on first login after approval';
