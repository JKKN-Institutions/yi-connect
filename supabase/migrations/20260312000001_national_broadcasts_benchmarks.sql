-- ============================================================================
-- Migration: National Broadcasts & Benchmarks Tables
-- Module 10: National Integration Layer
-- Created: 2026-03-12
-- Description: Creates tables for national broadcasts, broadcast receipts,
--              and national benchmarks with RLS policies and indexes
-- ============================================================================

-- ============================================================================
-- TABLE: national_broadcasts
-- Stores broadcast messages received from Yi National
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.national_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_broadcast_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  content_html text,
  summary text,
  broadcast_type text NOT NULL DEFAULT 'announcement'
    CHECK (broadcast_type IN ('announcement', 'directive', 'update', 'alert', 'newsletter')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_roles text[] NOT NULL DEFAULT '{}',
  target_regions text[] NOT NULL DEFAULT '{}',
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_acknowledgment boolean NOT NULL DEFAULT false,
  acknowledgment_deadline timestamptz,
  allows_comments boolean NOT NULL DEFAULT false,
  original_language text NOT NULL DEFAULT 'en',
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.national_broadcasts IS 'Broadcast messages and announcements from Yi National to chapters';

-- ============================================================================
-- TABLE: national_broadcast_receipts
-- Tracks chapter member acknowledgment / read status of broadcasts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.national_broadcast_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  broadcast_id uuid NOT NULL REFERENCES public.national_broadcasts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  response_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, member_id)
);

COMMENT ON TABLE public.national_broadcast_receipts IS 'Tracks read/acknowledgment status of national broadcasts per member';

-- ============================================================================
-- TABLE: national_benchmarks
-- Stores benchmark comparisons between chapters
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.national_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  metric_type text NOT NULL
    CHECK (metric_type IN (
      'event_count', 'member_engagement', 'csr_value', 'vertical_impact',
      'membership_growth', 'volunteer_hours', 'sponsorship_raised', 'awards_won'
    )),
  metric_name text NOT NULL,
  metric_description text,
  chapter_value numeric NOT NULL DEFAULT 0,
  regional_avg numeric,
  national_avg numeric,
  regional_rank integer,
  regional_total integer,
  national_rank integer,
  national_total integer,
  percentile_rank numeric,
  performance_tier text
    CHECK (performance_tier IN ('top_10', 'above_average', 'average', 'below_average', 'bottom_10')),
  period_type text NOT NULL DEFAULT 'quarterly'
    CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  calendar_year integer,
  quarter integer CHECK (quarter IS NULL OR quarter BETWEEN 1 AND 4),
  previous_value numeric,
  change_percentage numeric,
  trend text CHECK (trend IN ('improving', 'stable', 'declining')),
  synced_from_national_at timestamptz,
  national_benchmark_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.national_benchmarks IS 'Benchmark metrics comparing chapter performance against regional and national averages';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- national_broadcasts indexes
CREATE INDEX IF NOT EXISTS idx_national_broadcasts_published_at
  ON public.national_broadcasts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_national_broadcasts_priority
  ON public.national_broadcasts (priority);
CREATE INDEX IF NOT EXISTS idx_national_broadcasts_type
  ON public.national_broadcasts (broadcast_type);

-- national_broadcast_receipts indexes
CREATE INDEX IF NOT EXISTS idx_national_broadcast_receipts_broadcast_id
  ON public.national_broadcast_receipts (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_national_broadcast_receipts_chapter_id
  ON public.national_broadcast_receipts (chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_broadcast_receipts_member_id
  ON public.national_broadcast_receipts (member_id);

-- national_benchmarks indexes
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_chapter_id
  ON public.national_benchmarks (chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_metric_type
  ON public.national_benchmarks (metric_type);
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_period
  ON public.national_benchmarks (period_type, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_chapter_period
  ON public.national_benchmarks (chapter_id, period_type, period_end DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.national_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.national_broadcast_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.national_benchmarks ENABLE ROW LEVEL SECURITY;

-- national_broadcasts: authenticated users can read all broadcasts
-- (broadcasts are not chapter-scoped, they come from national)
CREATE POLICY "Authenticated users can read broadcasts"
  ON public.national_broadcasts
  FOR SELECT
  TO authenticated
  USING (true);

-- national_broadcast_receipts: members can read their own receipts
CREATE POLICY "Members can read own broadcast receipts"
  ON public.national_broadcast_receipts
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );

-- national_broadcast_receipts: members can insert their own receipts
CREATE POLICY "Members can create own broadcast receipts"
  ON public.national_broadcast_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );

-- national_broadcast_receipts: members can update their own receipts
CREATE POLICY "Members can update own broadcast receipts"
  ON public.national_broadcast_receipts
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );

-- national_benchmarks: members can read benchmarks for their chapter
CREATE POLICY "Members can read own chapter benchmarks"
  ON public.national_benchmarks
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

-- Reuse or create the trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_national_broadcasts_updated_at
  BEFORE UPDATE ON public.national_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_national_benchmarks_updated_at
  BEFORE UPDATE ON public.national_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
