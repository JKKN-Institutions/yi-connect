-- ================================================
-- Migration: Sponsorship Tier UI Enhancements
-- Stutzee Feature 3A
-- ================================================
-- 1. Add logo_url + display_name to sponsors
-- 2. Upgrade sponsorship_tiers.benefits from TEXT[] to structured JSONB
--    ({ label: string; included: boolean }[])
-- 3. Index on sponsors.logo_url for quick lookups
-- ================================================

-- 1) Sponsors: logo + display name
ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2) Sponsorship tiers: structured benefits
ALTER TABLE sponsorship_tiers
  ADD COLUMN IF NOT EXISTS benefits_structured JSONB DEFAULT '[]'::jsonb;

-- Backfill: convert text[] benefits → [{label, included: true}, ...]
UPDATE sponsorship_tiers
SET benefits_structured = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('label', b, 'included', true))
    FROM unnest(benefits) AS b
  ),
  '[]'::jsonb
)
WHERE benefits IS NOT NULL AND array_length(benefits, 1) > 0;

-- Drop old column, rename new one into place
ALTER TABLE sponsorship_tiers DROP COLUMN IF EXISTS benefits;
ALTER TABLE sponsorship_tiers RENAME COLUMN benefits_structured TO benefits;

-- 3) Index for sponsors with logos (used when listing per-event sponsor row)
CREATE INDEX IF NOT EXISTS idx_sponsors_logo
  ON sponsors(logo_url)
  WHERE logo_url IS NOT NULL;
