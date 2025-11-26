-- ============================================================================
-- Part 3: Reports & Dashboards System Migration
-- Created: 2025-11-28
-- Description: Comprehensive reporting infrastructure for Yi Connect
--   - 4 Specialized Reports (Trainer, Stakeholder, Vertical, Member)
--   - Report Configuration and Scheduling
--   - Generated Report Storage
-- ============================================================================

-- ============================================================================
-- ENUM: report_type
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
    CREATE TYPE report_type AS ENUM (
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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_format') THEN
    CREATE TYPE report_format AS ENUM ('pdf', 'xlsx', 'csv', 'json');
  END IF;
END$$;

-- ============================================================================
-- ENUM: report_schedule
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_schedule') THEN
    CREATE TYPE report_schedule AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'on_demand');
  END IF;
END$$;

-- ============================================================================
-- TABLE: report_configurations
-- Stores report templates and configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.report_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type report_type NOT NULL,

  -- Scope
  chapter_id UUID REFERENCES public.chapters(id),
  vertical_id UUID REFERENCES public.verticals(id),

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure varies by report type:
  -- trainer_performance: {"metrics": ["sessions_count", "students_impacted", "feedback_score"], "period": "monthly"}
  -- stakeholder_engagement: {"metrics": ["session_count", "student_reach", "health_score"], "stakeholder_types": ["school", "college"]}
  -- vertical_impact: {"metrics": ["activities", "student_reach", "trainer_engagement"], "verticals": []}
  -- member_activity: {"metrics": ["participation", "training_hours", "awards"], "categories": []}

  -- Filters
  date_range_type TEXT DEFAULT 'last_30_days' CHECK (date_range_type IN (
    'last_7_days', 'last_30_days', 'last_90_days', 'last_year',
    'this_month', 'this_quarter', 'this_year', 'custom'
  )),
  custom_start_date DATE,
  custom_end_date DATE,

  -- Scheduling
  schedule report_schedule DEFAULT 'on_demand',
  schedule_day_of_week INTEGER CHECK (schedule_day_of_week >= 0 AND schedule_day_of_week <= 6),
  schedule_day_of_month INTEGER CHECK (schedule_day_of_month >= 1 AND schedule_day_of_month <= 31),
  schedule_time TIME DEFAULT '06:00',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,

  -- Distribution
  email_recipients TEXT[] DEFAULT '{}',
  auto_download BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.members(id),
  updated_by UUID REFERENCES public.members(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_report_configs_type ON report_configurations(report_type);
CREATE INDEX idx_report_configs_chapter ON report_configurations(chapter_id);
CREATE INDEX idx_report_configs_schedule ON report_configurations(schedule) WHERE is_active = TRUE;
CREATE INDEX idx_report_configs_next_run ON report_configurations(next_run_at) WHERE is_active = TRUE;

COMMENT ON TABLE report_configurations IS 'Report templates and scheduling configuration';

-- Enable RLS
ALTER TABLE report_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own chapter reports" ON report_configurations
  FOR SELECT USING (
    created_by = auth.uid()
    OR chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    OR get_user_hierarchy_level() >= 4 -- Chair+
  );

CREATE POLICY "Chair+ can manage report configs" ON report_configurations
  FOR ALL USING (get_user_hierarchy_level() >= 4);

GRANT ALL ON report_configurations TO authenticated;

-- ============================================================================
-- TABLE: generated_reports
-- Stores generated report files and metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID REFERENCES public.report_configurations(id) ON DELETE SET NULL,

  -- Report info
  name TEXT NOT NULL,
  report_type report_type NOT NULL,
  format report_format NOT NULL DEFAULT 'pdf',

  -- Scope
  chapter_id UUID REFERENCES public.chapters(id),

  -- Parameters used
  parameters JSONB DEFAULT '{}'::jsonb,
  date_from DATE,
  date_to DATE,

  -- File info
  file_url TEXT,
  file_size_bytes INTEGER,
  storage_path TEXT,

  -- Generation
  generated_by UUID REFERENCES public.members(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  generation_time_ms INTEGER,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN (
    'pending', 'generating', 'completed', 'failed'
  )),
  error_message TEXT,

  -- Stats
  row_count INTEGER,
  data_snapshot JSONB, -- Summary stats for quick view

  -- Access tracking
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  last_downloaded_by UUID REFERENCES public.members(id),

  -- Expiry
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days'),
  is_archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_generated_reports_config ON generated_reports(configuration_id);
CREATE INDEX idx_generated_reports_type ON generated_reports(report_type);
CREATE INDEX idx_generated_reports_chapter ON generated_reports(chapter_id);
CREATE INDEX idx_generated_reports_date ON generated_reports(generated_at DESC);
CREATE INDEX idx_generated_reports_status ON generated_reports(generation_status) WHERE generation_status != 'completed';

COMMENT ON TABLE generated_reports IS 'Generated report files and metadata';

-- Enable RLS
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own reports" ON generated_reports
  FOR SELECT USING (
    generated_by = auth.uid()
    OR chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    OR get_user_hierarchy_level() >= 4
  );

CREATE POLICY "Chair+ can manage reports" ON generated_reports
  FOR ALL USING (get_user_hierarchy_level() >= 4);

GRANT ALL ON generated_reports TO authenticated;

-- ============================================================================
-- TABLE: report_subscriptions
-- User subscriptions to scheduled reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID NOT NULL REFERENCES public.report_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Delivery preferences
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'in_app', 'both')),
  email_address TEXT,
  format_preference report_format DEFAULT 'pdf',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,

  UNIQUE(configuration_id, user_id)
);

CREATE INDEX idx_report_subs_config ON report_subscriptions(configuration_id);
CREATE INDEX idx_report_subs_user ON report_subscriptions(user_id);

COMMENT ON TABLE report_subscriptions IS 'User subscriptions to scheduled reports';

-- Enable RLS
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON report_subscriptions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Chair+ can view all subscriptions" ON report_subscriptions
  FOR SELECT USING (get_user_hierarchy_level() >= 4);

GRANT ALL ON report_subscriptions TO authenticated;

-- ============================================================================
-- VIEW: trainer_performance_data
-- Base data for Trainer Performance Report
-- ============================================================================
CREATE VIEW trainer_performance_data AS
SELECT
  m.id AS trainer_id,
  m.full_name AS trainer_name,
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

  -- Quality metrics
  COALESCE(session_stats.avg_feedback, 0) AS avg_feedback_score,
  COALESCE(session_stats.completion_rate, 0) AS session_completion_rate,

  -- Materials
  COALESCE(material_stats.materials_uploaded, 0) AS materials_uploaded,
  COALESCE(material_stats.materials_approved, 0) AS materials_approved,

  -- Workload
  COALESCE(tw.session_count, 0) AS current_month_sessions,
  6 - COALESCE(tw.session_count, 0) AS available_slots

FROM members m
LEFT JOIN skill_will_assessments swa ON m.id = swa.member_id AND swa.status = 'completed'
LEFT JOIN verticals v ON swa.assigned_vertical_id = v.id
LEFT JOIN trainer_workload_tracking tw ON m.id = tw.trainer_id
  AND tw.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND tw.month = EXTRACT(MONTH FROM CURRENT_DATE)
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.id) AS total_sessions,
    COUNT(DISTINCT sb.id) FILTER (WHERE DATE_TRUNC('month', sb.session_date) = DATE_TRUNC('month', CURRENT_DATE)) AS sessions_this_month,
    COUNT(DISTINCT sb.id) FILTER (WHERE DATE_TRUNC('quarter', sb.session_date) = DATE_TRUNC('quarter', CURRENT_DATE)) AS sessions_this_quarter,
    SUM(COALESCE(sb.attendance_count, 0)) AS total_students,
    COUNT(DISTINCT sb.stakeholder_id) AS unique_stakeholders,
    ROUND(AVG(sb.feedback_score)::NUMERIC, 2) AS avg_feedback,
    ROUND((COUNT(*) FILTER (WHERE sb.status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) AS completion_rate
  FROM session_bookings sb
  JOIN session_booking_trainers sbt ON sb.id = sbt.booking_id
  WHERE sbt.trainer_id = m.id
  AND sb.status IN ('completed', 'confirmed', 'in_progress')
) session_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS materials_uploaded,
    COUNT(*) FILTER (WHERE sm.approval_status = 'approved') AS materials_approved
  FROM session_materials sm
  WHERE sm.uploaded_by = m.id
) material_stats ON TRUE
WHERE EXISTS (
  SELECT 1 FROM session_booking_trainers sbt WHERE sbt.trainer_id = m.id
)
OR swa.category IN ('star', 'enthusiast');

COMMENT ON VIEW trainer_performance_data IS 'Aggregated data for Trainer Performance Report';
GRANT SELECT ON trainer_performance_data TO authenticated;

-- ============================================================================
-- VIEW: stakeholder_engagement_data
-- Base data for Stakeholder Engagement Report
-- ============================================================================
CREATE VIEW stakeholder_engagement_data AS
SELECT
  s.id AS stakeholder_id,
  s.name AS stakeholder_name,
  s.type AS stakeholder_type,
  s.chapter_id,
  s.city,
  s.district,

  -- MoU Status
  mou.mou_status,
  mou.expiry_date AS mou_expiry,

  -- Engagement metrics
  COALESCE(booking_stats.total_sessions, 0) AS total_sessions,
  COALESCE(booking_stats.sessions_this_year, 0) AS sessions_this_year,
  COALESCE(booking_stats.pending_bookings, 0) AS pending_bookings,

  -- Student reach
  COALESCE(booking_stats.total_students_reached, 0) AS total_students_reached,
  s.student_count AS registered_students,

  -- Engagement health
  COALESCE(booking_stats.last_session_date, s.created_at) AS last_engagement,
  CASE
    WHEN booking_stats.last_session_date > CURRENT_DATE - INTERVAL '30 days' THEN 'active'
    WHEN booking_stats.last_session_date > CURRENT_DATE - INTERVAL '90 days' THEN 'moderate'
    WHEN booking_stats.last_session_date > CURRENT_DATE - INTERVAL '180 days' THEN 'dormant'
    ELSE 'at_risk'
  END AS engagement_status,

  -- Coordinator info
  COALESCE(coordinator_count.count, 0) AS coordinator_count,

  -- Quality
  COALESCE(booking_stats.avg_feedback, 0) AS avg_feedback_score

FROM stakeholders s
LEFT JOIN stakeholder_mous mou ON s.id = mou.stakeholder_id AND mou.stakeholder_type = s.type
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_sessions,
    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM sb.session_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS sessions_this_year,
    COUNT(*) FILTER (WHERE sb.status IN ('pending', 'pending_chair_approval')) AS pending_bookings,
    SUM(COALESCE(sb.attendance_count, 0)) AS total_students_reached,
    MAX(sb.session_date) AS last_session_date,
    ROUND(AVG(sb.feedback_score)::NUMERIC, 2) AS avg_feedback
  FROM session_bookings sb
  WHERE sb.stakeholder_id = s.id
  AND sb.status NOT IN ('cancelled', 'rejected')
) booking_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS count
  FROM stakeholder_coordinators sc
  WHERE sc.stakeholder_id = s.id AND sc.status = 'active'
) coordinator_count ON TRUE;

COMMENT ON VIEW stakeholder_engagement_data IS 'Aggregated data for Stakeholder Engagement Report';
GRANT SELECT ON stakeholder_engagement_data TO authenticated;

-- ============================================================================
-- VIEW: vertical_impact_data
-- Base data for Vertical Impact Report
-- ============================================================================
CREATE VIEW vertical_impact_data AS
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

  -- Stakeholder reach
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

FROM verticals v
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS chair_count,
    MAX(m.full_name) FILTER (WHERE vc.role = 'chair') AS primary_chair_name
  FROM vertical_chairs vc
  JOIN members m ON vc.member_id = m.id
  WHERE vc.vertical_id = v.id AND vc.is_active = TRUE
) chair_info ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT swa.member_id) AS assigned_members,
    COUNT(DISTINCT swa.member_id) FILTER (WHERE EXISTS (
      SELECT 1 FROM session_booking_trainers sbt WHERE sbt.trainer_id = swa.member_id
    )) AS active_trainers,
    COUNT(*) FILTER (WHERE swa.category = 'star') AS star_members,
    COUNT(*) FILTER (WHERE swa.category = 'enthusiast') AS enthusiast_members
  FROM skill_will_assessments swa
  WHERE swa.assigned_vertical_id = v.id AND swa.status = 'completed'
) member_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.id) AS total_sessions,
    COUNT(DISTINCT sb.id) FILTER (WHERE DATE_TRUNC('month', sb.session_date) = DATE_TRUNC('month', CURRENT_DATE)) AS sessions_this_month,
    SUM(COALESCE(sb.attendance_count, 0)) AS total_students,
    ROUND(AVG(sb.feedback_score)::NUMERIC, 2) AS avg_feedback
  FROM session_bookings sb
  WHERE sb.vertical_id = v.id
  AND sb.status IN ('completed', 'confirmed')
) session_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT stakeholder_id) AS total_stakeholders,
    COUNT(DISTINCT stakeholder_id) FILTER (WHERE session_date > CURRENT_DATE - INTERVAL '90 days') AS active_stakeholders
  FROM session_bookings sb
  WHERE sb.vertical_id = v.id AND sb.status = 'completed'
) stakeholder_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS approved_materials
  FROM session_materials sm
  JOIN session_bookings sb ON sm.booking_id = sb.id
  WHERE sb.vertical_id = v.id AND sm.approval_status = 'approved'
) material_stats ON TRUE;

COMMENT ON VIEW vertical_impact_data IS 'Aggregated data for Vertical Impact Report';
GRANT SELECT ON vertical_impact_data TO authenticated;

-- ============================================================================
-- VIEW: member_activity_data
-- Base data for Member Activity Report
-- ============================================================================
CREATE VIEW member_activity_data AS
SELECT
  m.id AS member_id,
  m.full_name AS member_name,
  m.chapter_id,
  m.membership_status,
  m.join_date,

  -- Assessment
  swa.category AS skill_will_category,
  swa.skill_score,
  swa.will_score,
  v.name AS assigned_vertical,

  -- Training activity
  COALESCE(training_stats.sessions_conducted, 0) AS sessions_conducted,
  COALESCE(training_stats.students_impacted, 0) AS students_impacted,
  COALESCE(training_stats.training_hours, 0) AS training_hours,

  -- Event participation
  COALESCE(event_stats.events_attended, 0) AS events_attended,
  COALESCE(event_stats.events_organized, 0) AS events_organized,
  COALESCE(event_stats.volunteer_hours, 0) AS volunteer_hours,

  -- Sub-chapter activity
  COALESCE(subchapter_stats.subchapter_events, 0) AS subchapter_events_led,

  -- Recognition
  COALESCE(award_stats.awards_received, 0) AS awards_received,
  COALESCE(award_stats.nominations_received, 0) AS nominations_received,

  -- Engagement score (calculated)
  ROUND((
    (COALESCE(training_stats.sessions_conducted, 0) * 15) +
    (COALESCE(event_stats.events_attended, 0) * 5) +
    (COALESCE(event_stats.events_organized, 0) * 10) +
    (COALESCE(award_stats.awards_received, 0) * 20) +
    (CASE WHEN swa.category = 'star' THEN 30
          WHEN swa.category = 'enthusiast' THEN 20
          WHEN swa.category = 'cynic' THEN 10
          ELSE 0 END)
  )::NUMERIC, 2) AS engagement_score,

  -- Last activity
  GREATEST(
    training_stats.last_session,
    event_stats.last_event,
    m.updated_at
  ) AS last_activity_date

FROM members m
LEFT JOIN skill_will_assessments swa ON m.id = swa.member_id AND swa.status = 'completed'
LEFT JOIN verticals v ON swa.assigned_vertical_id = v.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT sb.id) AS sessions_conducted,
    SUM(COALESCE(sb.attendance_count, 0)) AS students_impacted,
    SUM(EXTRACT(EPOCH FROM (sb.confirmed_time_end - sb.confirmed_time_start))/3600) AS training_hours,
    MAX(sb.session_date) AS last_session
  FROM session_bookings sb
  JOIN session_booking_trainers sbt ON sb.id = sbt.booking_id
  WHERE sbt.trainer_id = m.id AND sb.status = 'completed'
) training_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE ea.attendance_status = 'attended') AS events_attended,
    COUNT(*) FILTER (WHERE e.created_by = m.id) AS events_organized,
    SUM(CASE WHEN ea.attendance_status = 'attended' THEN
      EXTRACT(EPOCH FROM (e.end_datetime - e.start_datetime))/3600 ELSE 0 END) AS volunteer_hours,
    MAX(e.start_datetime) AS last_event
  FROM events e
  LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.member_id = m.id
  WHERE ea.member_id = m.id OR e.created_by = m.id
) event_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS subchapter_events
  FROM sub_chapter_events sce
  JOIN sub_chapter_leads scl ON sce.sub_chapter_id = scl.sub_chapter_id
  WHERE scl.member_id = m.id AND scl.is_active = TRUE
) subchapter_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE an.status = 'awarded') AS awards_received,
    COUNT(*) AS nominations_received
  FROM award_nominations an
  WHERE an.nominee_id = m.id
) award_stats ON TRUE
WHERE m.membership_status = 'active';

COMMENT ON VIEW member_activity_data IS 'Aggregated data for Member Activity Report';
GRANT SELECT ON member_activity_data TO authenticated;

-- ============================================================================
-- FUNCTION: calculate_next_run_time
-- Calculates the next scheduled run time for a report
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_next_run_time(
  p_schedule report_schedule,
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
      -- Find next occurrence of the specified day
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

COMMENT ON FUNCTION calculate_next_run_time IS 'Calculate next scheduled run time for a report';
GRANT EXECUTE ON FUNCTION calculate_next_run_time(report_schedule, INTEGER, INTEGER, TIME) TO authenticated;

-- ============================================================================
-- FUNCTION: get_pending_scheduled_reports
-- Returns reports that are due for generation
-- ============================================================================
CREATE OR REPLACE FUNCTION get_pending_scheduled_reports()
RETURNS TABLE(
  config_id UUID,
  report_name TEXT,
  report_type report_type,
  chapter_id UUID,
  config JSONB,
  date_range_type TEXT,
  email_recipients TEXT[],
  schedule report_schedule
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
  FROM report_configurations rc
  WHERE rc.is_active = TRUE
  AND rc.schedule != 'on_demand'
  AND rc.next_run_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pending_scheduled_reports IS 'Get scheduled reports due for generation';
GRANT EXECUTE ON FUNCTION get_pending_scheduled_reports() TO authenticated;

-- ============================================================================
-- TRIGGER: Update next_run_at after report generation
-- ============================================================================
CREATE OR REPLACE FUNCTION update_report_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.configuration_id IS NOT NULL AND NEW.generation_status = 'completed' THEN
    UPDATE report_configurations
    SET
      last_run_at = NEW.generated_at,
      next_run_at = calculate_next_run_time(
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

DROP TRIGGER IF EXISTS trigger_update_report_next_run ON generated_reports;
CREATE TRIGGER trigger_update_report_next_run
  AFTER INSERT OR UPDATE OF generation_status ON generated_reports
  FOR EACH ROW
  WHEN (NEW.generation_status = 'completed')
  EXECUTE FUNCTION update_report_next_run();

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER set_report_configurations_updated_at
BEFORE UPDATE ON report_configurations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
