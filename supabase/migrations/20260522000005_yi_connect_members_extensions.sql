-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Member extensions lifted to yi_connect.*
-- Phase A Batch 3 — combines 5 small migrations:
--   - 20251110000003 fix_members_insert_policy
--   - 20251110000004 add_missing_member_fields
--   - 20251110000005 extend_availability_profile
--   - 20251110000006 create_member_networks
--   - 20251110000007 create_member_requests
-- ═══════════════════════════════════════════════════════════════════════

-- ── 20251110000003 fix_members_insert_policy ─────────────────────────────
/**
 * Fix Members Table RLS Policies
 *
 * Add INSERT policy to allow:
 * 1. Users to create their own member record
 * 2. Admins (Chapter Admin and above) to create member records
 */

-- Drop the existing "Admins can manage all members" policy and recreate it more specifically
DROP POLICY IF EXISTS "Admins can manage all members in their chapter" ON yi_connect.members;

-- Allow users to insert their own member record
CREATE POLICY "Users can create their own member record"
  ON yi_connect.members FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow admins to insert new member records
CREATE POLICY "Admins can insert members"
  ON yi_connect.members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );

-- Recreate the admin update/delete policy
CREATE POLICY "Admins can update and delete members in their chapter"
  ON yi_connect.members FOR UPDATE
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM yi_connect.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  )
  WITH CHECK (
    chapter_id IN (
      SELECT m.chapter_id FROM yi_connect.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );

CREATE POLICY "Admins can delete members in their chapter"
  ON yi_connect.members FOR DELETE
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM yi_connect.members m
      WHERE m.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  );

-- ── 20251110000004 add_missing_member_fields ─────────────────────────────
/**
 * Add Missing Critical Member Fields
 *
 * Adds fields identified in MEMBER_FIELDS_COMPARISON.md:
 * - Photo/Avatar URL
 * - Renewal Date (auto-calculated)
 * - Membership Type (Individual/Couple)
 * - Family Count
 * - Languages Spoken
 * - Willingness Level (1-5 scale)
 * - Vertical Interests
 */

-- Add missing fields to members table
ALTER TABLE yi_connect.members
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS renewal_date DATE GENERATED ALWAYS AS (member_since + INTERVAL '1 year') STORED,
ADD COLUMN IF NOT EXISTS membership_type TEXT CHECK (membership_type IN ('individual', 'couple')) DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS family_count INTEGER DEFAULT 0 CHECK (family_count >= 0),
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS willingness_level INTEGER CHECK (willingness_level BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS vertical_interests TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN yi_connect.members.avatar_url IS 'URL to member profile photo in Supabase Storage';
COMMENT ON COLUMN yi_connect.members.renewal_date IS 'Auto-calculated as member_since + 1 year';
COMMENT ON COLUMN yi_connect.members.membership_type IS 'Type of membership: individual or couple';
COMMENT ON COLUMN yi_connect.members.family_count IS 'Number of family members';
COMMENT ON COLUMN yi_connect.members.languages IS 'Array of languages spoken (e.g., Tamil, English, Hindi)';
COMMENT ON COLUMN yi_connect.members.willingness_level IS 'Overall engagement willingness: 1=Passive, 2=Occasional, 3=Selective, 4=Regular, 5=Activist';
COMMENT ON COLUMN yi_connect.members.vertical_interests IS 'Array of Yi vertical interests (e.g., Masoom, Road Safety, Yuva, Thalir, Climate)';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_members_willingness_level ON yi_connect.members(willingness_level);
CREATE INDEX IF NOT EXISTS idx_members_membership_type ON yi_connect.members(membership_type);
CREATE INDEX IF NOT EXISTS idx_members_vertical_interests ON yi_connect.members USING GIN(vertical_interests);
CREATE INDEX IF NOT EXISTS idx_members_languages ON yi_connect.members USING GIN(languages);

-- ── 20251110000005 extend_availability_profile ──────────────────────────
/**
 * Extend Availability Table with Structured Profile Fields
 *
 * Adds comprehensive availability profile fields:
 * - Time Commitment (hours per week)
 * - Preferred Days (Weekdays/Weekends/Flexible)
 * - Notice Period (2 hours to 1 month)
 * - Geographic Flexibility (Erode to Pan-India)
 * - Preferred Contact Method
 */

-- Add structured availability profile fields
ALTER TABLE yi_connect.availability
ADD COLUMN IF NOT EXISTS time_commitment_hours INTEGER CHECK (time_commitment_hours IN (2, 5, 10, 15, 20)),
ADD COLUMN IF NOT EXISTS preferred_days TEXT CHECK (preferred_days IN ('weekdays', 'weekends', 'flexible')),
ADD COLUMN IF NOT EXISTS notice_period TEXT CHECK (notice_period IN ('2_hours', '1_day', '3_days', '1_week', '2_weeks', '1_month')),
ADD COLUMN IF NOT EXISTS geographic_flexibility TEXT CHECK (geographic_flexibility IN ('erode_only', 'district', 'state', 'zone', 'pan_india')),
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT CHECK (preferred_contact_method IN ('whatsapp', 'email', 'phone', 'notification'));

-- Add comments for documentation
COMMENT ON COLUMN yi_connect.availability.time_commitment_hours IS 'Weekly time commitment in hours: 2, 5, 10, 15, or 20+';
COMMENT ON COLUMN yi_connect.availability.preferred_days IS 'Preferred availability days: weekdays, weekends, or flexible';
COMMENT ON COLUMN yi_connect.availability.notice_period IS 'Required notice period: from 2_hours to 1_month';
COMMENT ON COLUMN yi_connect.availability.geographic_flexibility IS 'Geographic scope: erode_only to pan_india';
COMMENT ON COLUMN yi_connect.availability.preferred_contact_method IS 'How member prefers to be contacted: whatsapp, email, phone, or notification';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_availability_time_commitment ON yi_connect.availability(time_commitment_hours);
CREATE INDEX IF NOT EXISTS idx_availability_preferred_days ON yi_connect.availability(preferred_days);
CREATE INDEX IF NOT EXISTS idx_availability_geographic_flexibility ON yi_connect.availability(geographic_flexibility);

-- ── 20251110000006 create_member_networks ───────────────────────────────
/**
 * Create Member Networks Table
 *
 * Tracks member's stakeholder access and network connections:
 * - Schools, Colleges, Industries, Government, NGOs
 * - Venues, Speakers, Corporate Partners
 *
 * This enables smart volunteer matching based on network access.
 */

-- Create member_networks table
CREATE TABLE IF NOT EXISTS yi_connect.member_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  network_type TEXT NOT NULL CHECK (network_type IN (
    'schools',
    'colleges',
    'industries',
    'government',
    'ngos',
    'venues',
    'speakers',
    'corporate_partners'
  )),
  organization_name TEXT NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  relationship_strength TEXT CHECK (relationship_strength IN ('weak', 'moderate', 'strong')) DEFAULT 'moderate',
  notes TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate entries for same member-org combination
  UNIQUE(member_id, network_type, organization_name)
);

-- Add comments for documentation
COMMENT ON TABLE yi_connect.member_networks IS 'Tracks member stakeholder access and network connections';
COMMENT ON COLUMN yi_connect.member_networks.network_type IS 'Type of stakeholder: schools, colleges, industries, government, ngos, venues, speakers, corporate_partners';
COMMENT ON COLUMN yi_connect.member_networks.relationship_strength IS 'Strength of relationship: weak, moderate, or strong';
COMMENT ON COLUMN yi_connect.member_networks.verified IS 'Whether the network connection has been verified';

-- Create indexes for common queries
CREATE INDEX idx_member_networks_member_id ON yi_connect.member_networks(member_id);
CREATE INDEX idx_member_networks_type ON yi_connect.member_networks(network_type);
CREATE INDEX idx_member_networks_strength ON yi_connect.member_networks(relationship_strength);
CREATE INDEX idx_member_networks_verified ON yi_connect.member_networks(verified);

-- Enable RLS
ALTER TABLE yi_connect.member_networks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view all network connections in their chapter
CREATE POLICY "Users can view member networks in their chapter"
  ON yi_connect.member_networks FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM yi_connect.members m
      WHERE m.chapter_id IN (
        SELECT mem.chapter_id FROM yi_connect.members mem
        WHERE mem.id = auth.uid()
      )
    )
  );

-- Allow users to manage their own networks
CREATE POLICY "Users can manage their own networks"
  ON yi_connect.member_networks FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Allow admins to manage all networks in their chapter
CREATE POLICY "Admins can manage networks in their chapter"
  ON yi_connect.member_networks FOR ALL
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM yi_connect.members m
      WHERE m.chapter_id IN (
        SELECT mem.chapter_id FROM yi_connect.members mem
        WHERE mem.id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT m.id FROM yi_connect.members m
      WHERE m.chapter_id IN (
        SELECT mem.chapter_id FROM yi_connect.members mem
        WHERE mem.id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3
    )
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER set_member_networks_updated_at
  BEFORE UPDATE ON yi_connect.member_networks
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ── 20251110000007 create_member_requests ───────────────────────────────
/**
 * Create Member Requests Table
 *
 * Stores membership applications from public users.
 * Applications are reviewed and approved by Super Admins.
 *
 * Flow: Public applies → Admin reviews → Approves → Email whitelisted → User can login with Google
 */

-- Create member_requests table
CREATE TABLE IF NOT EXISTS yi_connect.member_requests (
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
  preferred_chapter_id UUID REFERENCES yi.chapters(id),

  -- Request Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),

  -- Admin Review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Created Member Reference (after first login)
  created_member_id UUID REFERENCES yi_connect.members(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_member_requests_status ON yi_connect.member_requests(status);
CREATE INDEX idx_member_requests_email ON yi_connect.member_requests(email);
CREATE INDEX idx_member_requests_chapter ON yi_connect.member_requests(preferred_chapter_id);
CREATE INDEX idx_member_requests_created_at ON yi_connect.member_requests(created_at DESC);

-- Enable RLS
ALTER TABLE yi_connect.member_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow anyone (including anonymous) to submit requests
CREATE POLICY "Anyone can submit member requests"
  ON yi_connect.member_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to view their own request by email
CREATE POLICY "Users can view their own requests"
  ON yi_connect.member_requests FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Executive Members and above can view all requests
CREATE POLICY "Executives can view all member requests"
  ON yi_connect.member_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi_connect.user_roles ur
      JOIN yi_connect.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 5 -- Executive Member and above
    )
  );

-- Executive Members and above can update requests (approve/reject)
CREATE POLICY "Executives can manage member requests"
  ON yi_connect.member_requests FOR UPDATE
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
CREATE TRIGGER set_member_requests_updated_at
  BEFORE UPDATE ON yi_connect.member_requests
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- Comments
COMMENT ON TABLE yi_connect.member_requests IS 'Stores membership applications from public users awaiting admin approval';
COMMENT ON COLUMN yi_connect.member_requests.email IS 'Google email address that will be used for OAuth login';
COMMENT ON COLUMN yi_connect.member_requests.status IS 'Request status: pending, approved, rejected, or withdrawn';
COMMENT ON COLUMN yi_connect.member_requests.motivation IS 'Why applicant wants to join Yi';
COMMENT ON COLUMN yi_connect.member_requests.created_member_id IS 'References member record created on first login after approval';
