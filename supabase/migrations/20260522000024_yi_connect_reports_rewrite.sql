-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Reports & Dashboards System — REWRITE
-- Replaces:  20260522000018_yi_connect_reports.DEFERRED.sql
--
-- Why rewrite: the deferred file still referenced columns that do not exist
-- on the live yi_connect schema. This migration aligns every view, function
-- and trigger with the actual columns shipped by earlier migrations.
--
-- Column substitutions applied (vs deferred file / original source):
--   session_bookings:
--     sb.session_date                  → COALESCE(sb.confirmed_date, sb.preferred_date)
--     sb.feedback_score                → sb.session_rating
--     sb.attendance_count              → sb.actual_attendance
--     sb.confirmed_time_start          → (no equivalent; training_hours stubbed via
--     sb.confirmed_time_end              sb.duration_hours instead of TIME math)
--     sb.vertical_id                   → events.vertical_id (joined via sb.event_id)
--   session_booking_trainers:
--     sbt.trainer_id                   → sbt.trainer_profile_id
--   members.full_name                  → profiles.full_name (members.id = profiles.id)
--   events.created_by                  → events.organizer_id
--   events.start_datetime/end_datetime → events.start_date / events.end_date
--   stakeholders                       → STUBBED to NULL/0 (no unified table; CRM
--                                        keeps schools/colleges/industries/ngos/
--                                        vendors/speakers/government_stakeholders
--                                        separate). unique_stakeholders derived
--                                        from session_bookings.stakeholder_id.
--   event_attendance                   → STUBBED (table not present in repo).
--                                        events_attended = 0, volunteer_hours = 0.
--   public.chapters                    → yi.chapters (canonical chapter list)
--   set_updated_at()                   → yi_connect.update_updated_at_column()
-- ═══════════════════════════════════════════════════════════════════════

SET search_path TO yi_connect, public, extensions;

-- ============================================================================
-- ENUM: report_type
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'report_type' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.report_type AS ENUM (
      'trainer_performance',
      'stakeholder_engagement',
      'vertical_impact',
      'member_activity',
      'custom'
    );
  END IF;
END$$;

-- ============================================================================
-- ENUM: report_format
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'report_format' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.report_format AS ENUM ('pdf', 'xlsx', 'csv', 'json');
  END IF;
END$$;

-- ============================================================================
-- ENUM: report_schedule
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'report_schedule' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.report_schedule AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'on_demand');
  END IF;
END$$;

-- ============================================================================
-- TABLE: report_configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.report_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type yi_connect.report_type NOT NULL,

  chapter_id UUID REFERENCES yi.chapters(id),
  vertical_id UUID REFERENCES yi_connect.verticals(id),

  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  date_range_type TEXT DEFAULT 'last_30_days' CHECK (date_range_type IN (
    'last_7_days', 'last_30_days', 'last_90_days', 'last_year',
    'this_month', 'this_quarter', 'this_year', 'custom'
  )),
  custom_start_date DATE,
  custom_end_date DATE,

  schedule yi_connect.report_schedule DEFAULT 'on_demand',
  schedule_day_of_week INTEGER CHECK (schedule_day_of_week >= 0 AND schedule_day_of_week <= 6),
  schedule_day_of_month INTEGER CHECK (schedule_day_of_month >= 1 AND schedule_day_of_month <= 31),
  schedule_time TIME DEFAULT '06:00',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,

  email_recipients TEXT[] DEFAULT '{}',
  auto_download BOOLEAN DEFAULT FALSE,

  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES yi_connect.members(id),
  updated_by UUID REFERENCES yi_connect.members(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_configs_type ON yi_connect.report_configurations(report_type);
CREATE INDEX IF NOT EXISTS idx_report_configs_chapter ON yi_connect.report_configurations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_report_configs_schedule ON yi_connect.report_configurations(schedule) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_configs_next_run ON yi_connect.report_configurations(next_run_at) WHERE is_active = TRUE;

COMMENT ON TABLE yi_connect.report_configurations IS 'Report templates and scheduling configuration';

ALTER TABLE yi_connect.report_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chapter reports" ON yi_connect.report_configurations;
CREATE POLICY "Users can view own chapter reports" ON yi_connect.report_configurations
  FOR SELECT USING (
    created_by = auth.uid()
    OR chapter_id IN (SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid())
    OR yi_connect.get_user_hierarchy_level() >= 4
  );

DROP POLICY IF EXISTS "Chair+ can manage report configs" ON yi_connect.report_configurations;
CREATE POLICY "Chair+ can manage report configs" ON yi_connect.report_configurations
  FOR ALL USING (yi_connect.get_user_hierarchy_level() >= 4);

GRANT ALL ON yi_connect.report_configurations TO authenticated;

-- ============================================================================
-- TABLE: generated_reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID REFERENCES yi_connect.report_configurations(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  report_type yi_connect.report_type NOT NULL,
  format yi_connect.report_format NOT NULL DEFAULT 'pdf',

  chapter_id UUID REFERENCES yi.chapters(id),

  parameters JSONB DEFAULT '{}'::jsonb,
  date_from DATE,
  date_to DATE,

  file_url TEXT,
  file_size_bytes INTEGER,
  storage_path TEXT,

  generated_by UUID REFERENCES yi_connect.members(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  generation_time_ms INTEGER,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN (
    'pending', 'generating', 'completed', 'failed'
  )),
  error_message TEXT,

  row_count INTEGER,
  data_snapshot JSONB,

  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  last_downloaded_by UUID REFERENCES yi_connect.members(id),

  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days'),
  is_archived BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_config ON yi_connect.generated_reports(configuration_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON yi_connect.generated_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_chapter ON yi_connect.generated_reports(chapter_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_date ON yi_connect.generated_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON yi_connect.generated_reports(generation_status) WHERE generation_status != 'completed';

COMMENT ON TABLE yi_connect.generated_reports IS 'Generated report files and metadata';

ALTER TABLE yi_connect.generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reports" ON yi_connect.generated_reports;
CREATE POLICY "Users can view own reports" ON yi_connect.generated_reports
  FOR SELECT USING (
    generated_by = auth.uid()
    OR chapter_id IN (SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid())
    OR yi_connect.get_user_hierarchy_level() >= 4
  );

DROP POLICY IF EXISTS "Chair+ can manage reports" ON yi_connect.generated_reports;
CREATE POLICY "Chair+ can manage reports" ON yi_connect.generated_reports
  FOR ALL USING (yi_connect.get_user_hierarchy_level() >= 4);

GRANT ALL ON yi_connect.generated_reports TO authenticated;

-- ============================================================================
-- TABLE: report_subscriptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID NOT NULL REFERENCES yi_connect.report_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'in_app', 'both')),
  email_address TEXT,
  format_preference yi_connect.report_format DEFAULT 'pdf',

  is_active BOOLEAN DEFAULT TRUE,

  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,

  UNIQUE(configuration_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_report_subs_config ON yi_connect.report_subscriptions(configuration_id);
CREATE INDEX IF NOT EXISTS idx_report_subs_user ON yi_connect.report_subscriptions(user_id);

COMMENT ON TABLE yi_connect.report_subscriptions IS 'User subscriptions to scheduled reports';

ALTER TABLE yi_connect.report_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON yi_connect.report_subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON yi_connect.report_subscriptions
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Chair+ can view all subscriptions" ON yi_connect.report_subscriptions;
CREATE POLICY "Chair+ can view all subscriptions" ON yi_connect.report_subscriptions
  FOR SELECT USING (yi_connect.get_user_hierarchy_level() >= 4);

GRANT ALL ON yi_connect.report_subscriptions TO authenticated;

-- ============================================================================
-- VIEW: trainer_performance_data
--
-- Substitutions vs deferred file:
--   sb.feedback_score    -> sb.session_rating
--   sbt.trainer_id       -> sbt.trainer_profile_id
--   sb.actual_attendance kept as-is
--   COALESCE(confirmed_date, preferred_date) for "session date"
-- ============================================================================
DROP VIEW IF EXISTS yi_connect.trainer_performance_data;
CREATE VIEW yi_connect.trainer_performance_data AS
SELECT
  m.id AS trainer_id,
  p.full_name AS trainer_name,
  m.chapter_id,
  swa.category AS skill_will_category,
  v.name AS assigned_vertical,

  -- Session metrics
  COALESCE(session_stats.total_sessions, 0) AS total_sessions,
  COALESCE(session_stats.sessions_this_month, 0) AS sessions_this_month,
  COALESCE(session_stats.sessions_this_quarter, 0) AS sessions_this_quarter,

  -- Impact metrics
  COALESCE(session_stats.total_students, 0) AS total_students_impacted,
  COALESCE(session_stats.unique_stakeholders, 0) AS unique_stakeholders,

  -- Quality metrics (session_rating is the live equivalent of feedback_score)
  COALESCE(session_stats.avg_feedback, 0) AS avg_feedback_score,
  COALESCE(session_stats.completion_rate, 0) AS session_completion_rate,

  -- Materials
  COALESCE(material_stats.materials_uploaded, 0) AS materials_uploaded,
  COALESCE(material_stats.materials_approved, 0) AS materials_approved,

  -- Workload
  COALESCE(tw.session_count, 0) AS current_month_sessions,
  6 - COALESCE(tw.session_count, 0) AS available_slots

FROM yi_connect.members m
JOIN yi_connect.profiles p ON p.id = m.id
LEFT JOIN yi_connect.skill_will_assessments swa ON m.id = swa.member_id AND swa.status = 'completed'
LEFT JOIN yi_connect.verticals v ON swa.assigned_vertical_id = v.id
LEFT JOIN yi_connect.trainer_workload_tracking tw ON m.id = tw.trainer_id
  AND tw.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND tw.month = EXTRACT(MONTH FROM CURRENT_DATE)
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.id) AS total_sessions,
    COUNT(DISTINCT sb.id) FILTER (
      WHERE DATE_TRUNC('month', COALESCE(sb.confirmed_date, sb.preferred_date)) = DATE_TRUNC('month', CURRENT_DATE)
    ) AS sessions_this_month,
    COUNT(DISTINCT sb.id) FILTER (
      WHERE DATE_TRUNC('quarter', COALESCE(sb.confirmed_date, sb.preferred_date)) = DATE_TRUNC('quarter', CURRENT_DATE)
    ) AS sessions_this_quarter,
    SUM(COALESCE(sb.actual_attendance, 0)) AS total_students,
    COUNT(DISTINCT sb.stakeholder_id) AS unique_stakeholders,
    ROUND(AVG(sb.session_rating)::NUMERIC, 2) AS avg_feedback,
    ROUND(
      (COUNT(*) FILTER (WHERE sb.status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0) * 100),
      2
    ) AS completion_rate
  FROM yi_connect.session_bookings sb
  JOIN yi_connect.session_booking_trainers sbt ON sb.id = sbt.booking_id
  WHERE sbt.trainer_profile_id = m.id
    AND sb.status IN ('completed', 'confirmed', 'in_progress')
) session_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS materials_uploaded,
    COUNT(*) FILTER (WHERE sm.approval_status = 'approved') AS materials_approved
  FROM yi_connect.session_materials sm
  WHERE sm.uploaded_by = m.id
) material_stats ON TRUE
WHERE EXISTS (
  SELECT 1 FROM yi_connect.session_booking_trainers sbt WHERE sbt.trainer_profile_id = m.id
)
OR swa.category IN ('star', 'enthusiast');

COMMENT ON VIEW yi_connect.trainer_performance_data IS
  'Aggregated data for Trainer Performance Report (session_rating used as feedback)';
GRANT SELECT ON yi_connect.trainer_performance_data TO authenticated;

-- ============================================================================
-- VIEW: stakeholder_engagement_data — STUBBED
--
-- The CRM keeps stakeholders in 7 separate tables (schools, colleges,
-- industries, government_stakeholders, ngos, vendors, speakers). There is no
-- unified `stakeholders` table. Restoring this view requires a UNION-ALL view
-- across all 7 tables — tracked as follow-up. Intentionally omitted to keep
-- this migration runnable.
-- ============================================================================

-- ============================================================================
-- VIEW: vertical_impact_data
--
-- Substitutions vs deferred file:
--   sb.vertical_id (does not exist) -> joined via sb.event_id = events.id
--                                      and read events.vertical_id
--   sb.feedback_score               -> sb.session_rating
--   sb.actual_attendance kept
-- ============================================================================
DROP VIEW IF EXISTS yi_connect.vertical_impact_data;
CREATE VIEW yi_connect.vertical_impact_data AS
SELECT
  v.id AS vertical_id,
  v.name AS vertical_name,
  v.chapter_id,

  -- Leadership
  COALESCE(chair_info.chair_count, 0) AS chair_count,
  chair_info.primary_chair_name,

  -- Member metrics
  COALESCE(member_stats.assigned_members, 0) AS assigned_members,
  COALESCE(member_stats.active_trainers, 0) AS active_trainers,
  COALESCE(member_stats.star_members, 0) AS star_members,
  COALESCE(member_stats.enthusiast_members, 0) AS enthusiast_members,

  -- Activity metrics
  COALESCE(session_stats.total_sessions, 0) AS total_sessions,
  COALESCE(session_stats.sessions_this_month, 0) AS sessions_this_month,
  COALESCE(session_stats.total_students, 0) AS total_students_impacted,

  -- Stakeholder reach (counted by stakeholder_id on session_bookings,
  -- since there is no unified stakeholders table)
  COALESCE(stakeholder_stats.total_stakeholders, 0) AS total_stakeholders,
  COALESCE(stakeholder_stats.active_stakeholders, 0) AS active_stakeholders,

  -- Quality
  COALESCE(session_stats.avg_feedback, 0) AS avg_feedback_score,
  COALESCE(material_stats.approved_materials, 0) AS approved_materials,

  -- Performance score (calculated)
  ROUND((
    (COALESCE(session_stats.sessions_this_month, 0) * 10) +
    (COALESCE(member_stats.active_trainers, 0) * 5) +
    (COALESCE(session_stats.avg_feedback, 0) * 20)
  )::NUMERIC, 2) AS performance_score

FROM yi_connect.verticals v
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS chair_count,
    MAX(p.full_name) FILTER (WHERE vc.role = 'chair') AS primary_chair_name
  FROM yi_connect.vertical_chairs vc
  JOIN yi_connect.members m ON vc.member_id = m.id
  JOIN yi_connect.profiles p ON p.id = m.id
  WHERE vc.vertical_id = v.id AND vc.is_active = TRUE
) chair_info ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT swa.member_id) AS assigned_members,
    COUNT(DISTINCT swa.member_id) FILTER (WHERE EXISTS (
      SELECT 1 FROM yi_connect.session_booking_trainers sbt
      WHERE sbt.trainer_profile_id = swa.member_id
    )) AS active_trainers,
    COUNT(*) FILTER (WHERE swa.category = 'star') AS star_members,
    COUNT(*) FILTER (WHERE swa.category = 'enthusiast') AS enthusiast_members
  FROM yi_connect.skill_will_assessments swa
  WHERE swa.assigned_vertical_id = v.id AND swa.status = 'completed'
) member_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.id) AS total_sessions,
    COUNT(DISTINCT sb.id) FILTER (
      WHERE DATE_TRUNC('month', COALESCE(sb.confirmed_date, sb.preferred_date)) = DATE_TRUNC('month', CURRENT_DATE)
    ) AS sessions_this_month,
    SUM(COALESCE(sb.actual_attendance, 0)) AS total_students,
    ROUND(AVG(sb.session_rating)::NUMERIC, 2) AS avg_feedback
  FROM yi_connect.session_bookings sb
  JOIN yi_connect.events e ON e.id = sb.event_id
  WHERE e.vertical_id = v.id
    AND sb.status IN ('completed', 'confirmed')
) session_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.stakeholder_id) AS total_stakeholders,
    COUNT(DISTINCT sb.stakeholder_id) FILTER (
      WHERE COALESCE(sb.confirmed_date, sb.preferred_date) > CURRENT_DATE - INTERVAL '90 days'
    ) AS active_stakeholders
  FROM yi_connect.session_bookings sb
  JOIN yi_connect.events e ON e.id = sb.event_id
  WHERE e.vertical_id = v.id AND sb.status = 'completed'
) stakeholder_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS approved_materials
  FROM yi_connect.session_materials sm
  JOIN yi_connect.session_bookings sb ON sm.booking_id = sb.id
  JOIN yi_connect.events e ON e.id = sb.event_id
  WHERE e.vertical_id = v.id AND sm.approval_status = 'approved'
) material_stats ON TRUE;

COMMENT ON VIEW yi_connect.vertical_impact_data IS
  'Aggregated data for Vertical Impact Report (vertical resolved via events.vertical_id)';
GRANT SELECT ON yi_connect.vertical_impact_data TO authenticated;

-- ============================================================================
-- VIEW: member_activity_data
--
-- Substitutions vs deferred file:
--   sb.actual_attendance kept
--   sb.confirmed_time_end - sb.confirmed_time_start -> sb.duration_hours
--                                                     (no start/end TIME columns
--                                                     exist; duration_hours is
--                                                     the canonical hours field)
--   event_attendance (missing table)             -> events_attended = 0,
--                                                   volunteer_hours = 0 (stubbed)
--   events.created_by                            -> events.organizer_id
--   members.full_name                            -> profiles.full_name
-- ============================================================================
DROP VIEW IF EXISTS yi_connect.member_activity_data;
CREATE VIEW yi_connect.member_activity_data AS
SELECT
  m.id AS member_id,
  p.full_name AS member_name,
  m.chapter_id,
  m.membership_status,
  m.member_since AS join_date,

  -- Assessment
  swa.category AS skill_will_category,
  swa.skill_score,
  swa.will_score,
  v.name AS assigned_vertical,

  -- Training activity (training_hours from duration_hours field)
  COALESCE(training_stats.sessions_conducted, 0) AS sessions_conducted,
  COALESCE(training_stats.students_impacted, 0) AS students_impacted,
  COALESCE(training_stats.training_hours, 0) AS training_hours,

  -- Event participation (events_attended stubbed: no event_attendance table)
  0::BIGINT AS events_attended,
  COALESCE(event_stats.events_organized, 0) AS events_organized,
  0::NUMERIC AS volunteer_hours,

  -- Sub-chapter activity
  COALESCE(subchapter_stats.subchapter_events, 0) AS subchapter_events_led,

  -- Recognition
  COALESCE(award_stats.awards_received, 0) AS awards_received,
  COALESCE(award_stats.nominations_received, 0) AS nominations_received,

  -- Engagement score (calculated)
  ROUND((
    (COALESCE(training_stats.sessions_conducted, 0) * 15) +
    (COALESCE(event_stats.events_organized, 0) * 10) +
    (COALESCE(award_stats.awards_received, 0) * 20) +
    (CASE WHEN swa.category = 'star' THEN 30
          WHEN swa.category = 'enthusiast' THEN 20
          WHEN swa.category = 'cynic' THEN 10
          ELSE 0 END)
  )::NUMERIC, 2) AS engagement_score,

  -- Last activity
  GREATEST(
    training_stats.last_session::timestamptz,
    event_stats.last_event,
    m.updated_at
  ) AS last_activity_date

FROM yi_connect.members m
JOIN yi_connect.profiles p ON p.id = m.id
LEFT JOIN yi_connect.skill_will_assessments swa ON m.id = swa.member_id AND swa.status = 'completed'
LEFT JOIN yi_connect.verticals v ON swa.assigned_vertical_id = v.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.id) AS sessions_conducted,
    SUM(COALESCE(sb.actual_attendance, 0)) AS students_impacted,
    SUM(COALESCE(sb.duration_hours, 0)) AS training_hours,
    MAX(COALESCE(sb.confirmed_date, sb.preferred_date)) AS last_session
  FROM yi_connect.session_bookings sb
  JOIN yi_connect.session_booking_trainers sbt ON sb.id = sbt.booking_id
  WHERE sbt.trainer_profile_id = m.id AND sb.status = 'completed'
) training_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE e.organizer_id = m.id) AS events_organized,
    MAX(e.start_date) AS last_event
  FROM yi_connect.events e
  WHERE e.organizer_id = m.id
) event_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS subchapter_events
  FROM yi_connect.sub_chapter_events sce
  JOIN yi_connect.sub_chapter_leads scl ON sce.sub_chapter_id = scl.sub_chapter_id
  WHERE scl.member_id = m.id AND scl.is_active = TRUE
) subchapter_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE an.status = 'awarded') AS awards_received,
    COUNT(*) AS nominations_received
  FROM yi_connect.award_nominations an
  WHERE an.nominee_id = m.id
) award_stats ON TRUE
WHERE m.membership_status = 'active';

COMMENT ON VIEW yi_connect.member_activity_data IS
  'Aggregated data for Member Activity Report (events_attended/volunteer_hours stubbed: no event_attendance table)';
GRANT SELECT ON yi_connect.member_activity_data TO authenticated;

-- ============================================================================
-- FUNCTION: calculate_next_run_time
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.calculate_next_run_time(
  p_schedule yi_connect.report_schedule,
  p_day_of_week INTEGER,
  p_day_of_month INTEGER,
  p_time TIME
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_next_run TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
BEGIN
  CASE p_schedule
    WHEN 'daily' THEN
      v_next_run := DATE_TRUNC('day', v_now) + p_time;
      IF v_next_run <= v_now THEN
        v_next_run := v_next_run + INTERVAL '1 day';
      END IF;

    WHEN 'weekly' THEN
      v_next_run := DATE_TRUNC('week', v_now) + (p_day_of_week || ' days')::INTERVAL + p_time;
      IF v_next_run <= v_now THEN
        v_next_run := v_next_run + INTERVAL '1 week';
      END IF;

    WHEN 'monthly' THEN
      v_next_run := DATE_TRUNC('month', v_now) + ((p_day_of_month - 1) || ' days')::INTERVAL + p_time;
      IF v_next_run <= v_now THEN
        v_next_run := v_next_run + INTERVAL '1 month';
      END IF;

    WHEN 'quarterly' THEN
      v_next_run := DATE_TRUNC('quarter', v_now) + ((p_day_of_month - 1) || ' days')::INTERVAL + p_time;
      IF v_next_run <= v_now THEN
        v_next_run := v_next_run + INTERVAL '3 months';
      END IF;

    ELSE
      v_next_run := NULL;
  END CASE;

  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION yi_connect.calculate_next_run_time IS 'Calculate next scheduled run time for a report';
GRANT EXECUTE ON FUNCTION yi_connect.calculate_next_run_time(yi_connect.report_schedule, INTEGER, INTEGER, TIME) TO authenticated;

-- ============================================================================
-- FUNCTION: get_pending_scheduled_reports
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.get_pending_scheduled_reports()
RETURNS TABLE(
  config_id UUID,
  report_name TEXT,
  report_type yi_connect.report_type,
  chapter_id UUID,
  config JSONB,
  date_range_type TEXT,
  email_recipients TEXT[],
  schedule yi_connect.report_schedule
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id AS config_id,
    rc.name AS report_name,
    rc.report_type,
    rc.chapter_id,
    rc.config,
    rc.date_range_type,
    rc.email_recipients,
    rc.schedule
  FROM yi_connect.report_configurations rc
  WHERE rc.is_active = TRUE
    AND rc.schedule != 'on_demand'
    AND rc.next_run_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION yi_connect.get_pending_scheduled_reports IS 'Get scheduled reports due for generation';
GRANT EXECUTE ON FUNCTION yi_connect.get_pending_scheduled_reports() TO authenticated;

-- ============================================================================
-- TRIGGER: Update next_run_at after report generation
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.update_report_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.configuration_id IS NOT NULL AND NEW.generation_status = 'completed' THEN
    UPDATE yi_connect.report_configurations
    SET
      last_run_at = NEW.generated_at,
      next_run_at = yi_connect.calculate_next_run_time(
        schedule,
        schedule_day_of_week,
        schedule_day_of_month,
        schedule_time
      )
    WHERE id = NEW.configuration_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_report_next_run ON yi_connect.generated_reports;
CREATE TRIGGER trigger_update_report_next_run
  AFTER INSERT OR UPDATE OF generation_status ON yi_connect.generated_reports
  FOR EACH ROW
  WHEN (NEW.generation_status = 'completed')
  EXECUTE FUNCTION yi_connect.update_report_next_run();

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS set_report_configurations_updated_at ON yi_connect.report_configurations;
CREATE TRIGGER set_report_configurations_updated_at
BEFORE UPDATE ON yi_connect.report_configurations
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
