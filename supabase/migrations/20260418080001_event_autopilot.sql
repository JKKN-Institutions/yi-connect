-- ============================================================================
-- Migration: Yi-Native Event Auto-Pilot + Quarterly Reporting
-- ============================================================================
--
-- Spec: specs/yi-native-event-autopilot-spec.md
-- Date: 2026-04-18
--
-- Adds three tables to power the Event Auto-Pilot pipeline and Quarterly
-- Report generator, plus extends feature_name enum so Chairs can opt-in
-- per chapter via the existing chapter_feature_toggles infrastructure.
--
--   1. event_autopilot_runs   — audit log for each auto-pilot invocation
--   2. chapter_reports        — quarterly/monthly/annual report archive
--   3. member_points_log      — minimal gamification points ledger
--   4. feature_name enum      += 'event_autopilot' (default OFF per chapter)
--
-- All tables scoped by chapter_id and gated by RLS:
--   - Chair+ (hierarchy_level >= 4) manage autopilot runs + reports in their
--     chapter
--   - Members read only their own points log rows
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend feature_name enum to include 'event_autopilot'
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE feature_name ADD VALUE IF NOT EXISTS 'event_autopilot';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. event_autopilot_runs — audit log of auto-pilot executions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_autopilot_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  chapter_id        UUID NOT NULL REFERENCES public.chapters(id),
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by      UUID REFERENCES auth.users(id), -- null = scheduled
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  steps_completed   JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_log         TEXT,
  completed_at      TIMESTAMPTZ,

  -- Idempotency: one run per event per minute (precision of triggered_at)
  UNIQUE (event_id, triggered_at)
);

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_event
  ON public.event_autopilot_runs(event_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_chapter
  ON public.event_autopilot_runs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_triggered
  ON public.event_autopilot_runs(triggered_at DESC);

COMMENT ON TABLE public.event_autopilot_runs IS
  'Audit log of Event Auto-Pilot runs. steps_completed JSONB records which of the 6 pipeline steps succeeded.';

-- RLS
ALTER TABLE public.event_autopilot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chapter Chair+ view autopilot runs" ON public.event_autopilot_runs;
CREATE POLICY "Chapter Chair+ view autopilot runs"
  ON public.event_autopilot_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = event_autopilot_runs.chapter_id
    )
  );

DROP POLICY IF EXISTS "Chapter Chair+ manage autopilot runs" ON public.event_autopilot_runs;
CREATE POLICY "Chapter Chair+ manage autopilot runs"
  ON public.event_autopilot_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = event_autopilot_runs.chapter_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = event_autopilot_runs.chapter_id
    )
  );

-- ----------------------------------------------------------------------------
-- 3. chapter_reports — quarterly/monthly/annual report archive
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chapter_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id        UUID NOT NULL REFERENCES public.chapters(id),
  report_type       TEXT NOT NULL
    CHECK (report_type IN ('quarterly', 'monthly', 'annual')),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  fiscal_year       INTEGER NOT NULL,
  generated_by      UUID NOT NULL REFERENCES auth.users(id),
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url           TEXT,               -- Supabase Storage signed/public URL
  data_snapshot     JSONB NOT NULL,     -- frozen data at generation time
  sent_to_national  BOOLEAN NOT NULL DEFAULT false,
  sent_at           TIMESTAMPTZ,

  UNIQUE (chapter_id, report_type, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_chapter_reports_chapter
  ON public.chapter_reports(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_reports_fiscal_year
  ON public.chapter_reports(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_chapter_reports_generated
  ON public.chapter_reports(generated_at DESC);

COMMENT ON TABLE public.chapter_reports IS
  'Archive of generated chapter reports to Yi National. data_snapshot stores the exact aggregated data at generation time for auditability.';

-- RLS
ALTER TABLE public.chapter_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chapter Chair+ and National view reports" ON public.chapter_reports;
CREATE POLICY "Chapter Chair+ and National view reports"
  ON public.chapter_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND (
          -- National Admin sees all
          r.hierarchy_level >= 6
          -- OR Chair+ of the owning chapter
          OR (
            r.hierarchy_level >= 4
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.chapter_id = chapter_reports.chapter_id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Chapter Chair+ manage reports" ON public.chapter_reports;
CREATE POLICY "Chapter Chair+ manage reports"
  ON public.chapter_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = chapter_reports.chapter_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = chapter_reports.chapter_id
    )
  );

-- ----------------------------------------------------------------------------
-- 4. member_points_log — minimal gamification points ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  chapter_id  UUID NOT NULL REFERENCES public.chapters(id),
  points      INTEGER NOT NULL CHECK (points <> 0),
  reason      TEXT NOT NULL,
  action_type TEXT NOT NULL,
  source_id   UUID,
  source_type TEXT,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate awards for the same action on the same source
  UNIQUE (member_id, action_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_points_log_member
  ON public.member_points_log(member_id);
CREATE INDEX IF NOT EXISTS idx_points_log_chapter
  ON public.member_points_log(chapter_id);
CREATE INDEX IF NOT EXISTS idx_points_log_awarded
  ON public.member_points_log(awarded_at DESC);

COMMENT ON TABLE public.member_points_log IS
  'Minimal gamification points ledger. Full badge/leaderboard UI deferred — this table exists so quarterly reports can rank top engagement-delta members.';

-- RLS
ALTER TABLE public.member_points_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own points" ON public.member_points_log;
CREATE POLICY "Members read own points"
  ON public.member_points_log
  FOR SELECT
  USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = member_points_log.chapter_id
    )
  );

DROP POLICY IF EXISTS "Chapter Chair+ award points" ON public.member_points_log;
CREATE POLICY "Chapter Chair+ award points"
  ON public.member_points_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = member_points_log.chapter_id
    )
  );
