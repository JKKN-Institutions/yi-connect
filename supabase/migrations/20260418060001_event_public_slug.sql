-- =============================================================================
-- Event Public Slug (Stutzee Feature 2B)
-- =============================================================================
-- Adds a short, human-readable public_slug to events for use on public landing
-- pages at /e/[slug]. Anonymous visitors get read access to events that have
-- a slug assigned and are in a public-visible status.
-- =============================================================================

-- 1. public_slug column (unique when present)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

-- 2. Partial index for fast lookup by slug (ignoring drafts/unpublished)
CREATE INDEX IF NOT EXISTS idx_events_public_slug
  ON public.events(public_slug)
  WHERE public_slug IS NOT NULL;

-- 3. Anonymous RLS policy: allow SELECT by slug for publish-visible events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'events'
      AND policyname = 'anon_view_events_by_slug'
  ) THEN
    CREATE POLICY "anon_view_events_by_slug"
      ON public.events FOR SELECT
      TO anon
      USING (
        public_slug IS NOT NULL
        AND status IN ('published', 'ongoing', 'completed')
      );
  END IF;
END $$;
