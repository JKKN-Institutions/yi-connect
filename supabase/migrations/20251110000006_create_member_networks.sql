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
CREATE TABLE IF NOT EXISTS public.member_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
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
COMMENT ON TABLE public.member_networks IS 'Tracks member stakeholder access and network connections';
COMMENT ON COLUMN public.member_networks.network_type IS 'Type of stakeholder: schools, colleges, industries, government, ngos, venues, speakers, corporate_partners';
COMMENT ON COLUMN public.member_networks.relationship_strength IS 'Strength of relationship: weak, moderate, or strong';
COMMENT ON COLUMN public.member_networks.verified IS 'Whether the network connection has been verified';

-- Create indexes for common queries
CREATE INDEX idx_member_networks_member_id ON public.member_networks(member_id);
CREATE INDEX idx_member_networks_type ON public.member_networks(network_type);
CREATE INDEX idx_member_networks_strength ON public.member_networks(relationship_strength);
CREATE INDEX idx_member_networks_verified ON public.member_networks(verified);

-- Enable RLS
ALTER TABLE public.member_networks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view all network connections in their chapter
CREATE POLICY "Users can view member networks in their chapter"
  ON public.member_networks FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM public.members m
      WHERE m.chapter_id IN (
        SELECT mem.chapter_id FROM public.members mem
        WHERE mem.id = auth.uid()
      )
    )
  );

-- Allow users to manage their own networks
CREATE POLICY "Users can manage their own networks"
  ON public.member_networks FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Allow admins to manage all networks in their chapter
CREATE POLICY "Admins can manage networks in their chapter"
  ON public.member_networks FOR ALL
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM public.members m
      WHERE m.chapter_id IN (
        SELECT mem.chapter_id FROM public.members mem
        WHERE mem.id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3 -- Co-Chair and above
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT m.id FROM public.members m
      WHERE m.chapter_id IN (
        SELECT mem.chapter_id FROM public.members mem
        WHERE mem.id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.hierarchy_level >= 3
    )
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER set_member_networks_updated_at
  BEFORE UPDATE ON public.member_networks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
