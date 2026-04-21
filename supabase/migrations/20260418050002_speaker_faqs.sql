-- ============================================================================
-- Migration: Speaker FAQs + Close Speakers Type/Schema Drift
-- Date: 2026-04-18
-- Feature: Stutzee 1B — Speaker Profiles
--
-- Changes:
--   1. Creates public.speaker_faqs table (Q&A per speaker)
--   2. Adds ~15 columns to public.speakers that exist in the TS type but not DB
--   3. RLS: Co-Chair+ manage FAQs; anyone reads is_public=true FAQs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. speaker_faqs table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.speaker_faqs (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id  UUID           NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  question    TEXT           NOT NULL,
  answer      TEXT           NOT NULL,
  sort_order  INTEGER        NOT NULL DEFAULT 0,
  is_public   BOOLEAN        NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_speaker_faqs_speaker    ON public.speaker_faqs(speaker_id);
CREATE INDEX IF NOT EXISTS idx_speaker_faqs_sort_order ON public.speaker_faqs(speaker_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_speaker_faqs_public     ON public.speaker_faqs(speaker_id, is_public) WHERE is_public = true;

-- updated_at trigger (reuse existing helper)
DROP TRIGGER IF EXISTS set_speaker_faqs_updated_at ON public.speaker_faqs;
CREATE TRIGGER set_speaker_faqs_updated_at
  BEFORE UPDATE ON public.speaker_faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. Close type/DB schema drift on speakers
-- ----------------------------------------------------------------------------
ALTER TABLE public.speakers
  ADD COLUMN IF NOT EXISTS social_media_links       JSONB   DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suitable_topics          TEXT[],
  ADD COLUMN IF NOT EXISTS target_audience          TEXT[],
  ADD COLUMN IF NOT EXISTS session_formats          TEXT[],
  ADD COLUMN IF NOT EXISTS years_of_experience      INTEGER,
  ADD COLUMN IF NOT EXISTS organizations_associated TEXT[],
  ADD COLUMN IF NOT EXISTS notable_achievements     TEXT[],
  ADD COLUMN IF NOT EXISTS typical_session_duration TEXT,
  ADD COLUMN IF NOT EXISTS max_audience_size        INTEGER,
  ADD COLUMN IF NOT EXISTS requires_av_equipment    TEXT[],
  ADD COLUMN IF NOT EXISTS language_proficiency     TEXT[],
  ADD COLUMN IF NOT EXISTS charges_fee              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_range                TEXT,
  ADD COLUMN IF NOT EXISTS availability_status      TEXT    DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS blackout_dates           TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_days           TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_time_slots     TEXT[];

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.speaker_faqs ENABLE ROW LEVEL SECURITY;

-- Public read access to public FAQs (supports future public speaker pages)
DROP POLICY IF EXISTS "Anyone can read public speaker FAQs" ON public.speaker_faqs;
CREATE POLICY "Anyone can read public speaker FAQs"
  ON public.speaker_faqs FOR SELECT
  USING (is_public = true);

-- Chapter members can read all FAQs for speakers in their chapter (public or private)
DROP POLICY IF EXISTS "Chapter members can read speaker FAQs" ON public.speaker_faqs;
CREATE POLICY "Chapter members can read speaker FAQs"
  ON public.speaker_faqs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.speakers s
      WHERE s.id = speaker_faqs.speaker_id
        AND public.user_belongs_to_chapter(s.chapter_id)
    )
  );

-- Co-Chair+ manage FAQs (INSERT / UPDATE / DELETE)
-- Gate on role membership via user_roles + roles tables
DROP POLICY IF EXISTS "Co-Chair+ can insert speaker FAQs" ON public.speaker_faqs;
CREATE POLICY "Co-Chair+ can insert speaker FAQs"
  ON public.speaker_faqs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member')
    )
  );

DROP POLICY IF EXISTS "Co-Chair+ can update speaker FAQs" ON public.speaker_faqs;
CREATE POLICY "Co-Chair+ can update speaker FAQs"
  ON public.speaker_faqs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member')
    )
  );

DROP POLICY IF EXISTS "Co-Chair+ can delete speaker FAQs" ON public.speaker_faqs;
CREATE POLICY "Co-Chair+ can delete speaker FAQs"
  ON public.speaker_faqs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member')
    )
  );

COMMENT ON TABLE public.speaker_faqs IS 'Speaker profile FAQs; supports public speaker pages via is_public flag.';
