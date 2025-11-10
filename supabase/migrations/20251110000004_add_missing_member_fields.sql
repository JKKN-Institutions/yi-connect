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
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS renewal_date DATE GENERATED ALWAYS AS (member_since + INTERVAL '1 year') STORED,
ADD COLUMN IF NOT EXISTS membership_type TEXT CHECK (membership_type IN ('individual', 'couple')) DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS family_count INTEGER DEFAULT 0 CHECK (family_count >= 0),
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS willingness_level INTEGER CHECK (willingness_level BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS vertical_interests TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN public.members.avatar_url IS 'URL to member profile photo in Supabase Storage';
COMMENT ON COLUMN public.members.renewal_date IS 'Auto-calculated as member_since + 1 year';
COMMENT ON COLUMN public.members.membership_type IS 'Type of membership: individual or couple';
COMMENT ON COLUMN public.members.family_count IS 'Number of family members';
COMMENT ON COLUMN public.members.languages IS 'Array of languages spoken (e.g., Tamil, English, Hindi)';
COMMENT ON COLUMN public.members.willingness_level IS 'Overall engagement willingness: 1=Passive, 2=Occasional, 3=Selective, 4=Regular, 5=Activist';
COMMENT ON COLUMN public.members.vertical_interests IS 'Array of Yi vertical interests (e.g., Masoom, Road Safety, Yuva, Thalir, Climate)';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_members_willingness_level ON public.members(willingness_level);
CREATE INDEX IF NOT EXISTS idx_members_membership_type ON public.members(membership_type);
CREATE INDEX IF NOT EXISTS idx_members_vertical_interests ON public.members USING GIN(vertical_interests);
CREATE INDEX IF NOT EXISTS idx_members_languages ON public.members USING GIN(languages);
