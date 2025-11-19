-- ============================================================================
-- Module 9: Vertical Performance Tracker
-- Created: 2025-01-19
-- Description: Complete schema for vertical performance tracking system
-- ============================================================================

-- ============================================================================
-- PHASE 1: CORE TABLES
-- ============================================================================

-- Table 1: verticals (Master)
CREATE TABLE verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color for UI: "#3B82F6"
  icon VARCHAR(50), -- Icon name: "heart", "users", "briefcase"
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_verticals_chapter_id ON verticals(chapter_id);
CREATE INDEX idx_verticals_slug ON verticals(slug);

COMMENT ON TABLE verticals IS 'Master table for vertical definitions (Masoom, Yuva, Health, etc.)';

-- Table 2: vertical_chairs (Leadership)
CREATE TABLE vertical_chairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('chair', 'co_chair')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  appointed_by UUID REFERENCES members(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vertical_id, member_id, start_date)
);

CREATE INDEX idx_vertical_chairs_vertical_id ON vertical_chairs(vertical_id);
CREATE INDEX idx_vertical_chairs_member_id ON vertical_chairs(member_id);

COMMENT ON TABLE vertical_chairs IS 'Chair and Co-Chair assignments for verticals';

-- Table 3: vertical_plans (Annual Planning)
CREATE TABLE vertical_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  plan_name VARCHAR(255) NOT NULL,
  vision TEXT,
  mission TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active', 'completed')),

  -- Quarterly budgets
  q1_budget NUMERIC(10,2) DEFAULT 0,
  q2_budget NUMERIC(10,2) DEFAULT 0,
  q3_budget NUMERIC(10,2) DEFAULT 0,
  q4_budget NUMERIC(10,2) DEFAULT 0,
  total_budget NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(q1_budget, 0) + COALESCE(q2_budget, 0) +
    COALESCE(q3_budget, 0) + COALESCE(q4_budget, 0)
  ) STORED,

  -- Approval workflow
  approved_by UUID REFERENCES members(id),
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,

  -- Plan continuity
  copied_from_plan_id UUID REFERENCES vertical_plans(id),

  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year)
);

CREATE INDEX idx_vertical_plans_vertical_id ON vertical_plans(vertical_id);
CREATE INDEX idx_vertical_plans_fiscal_year ON vertical_plans(fiscal_year);

COMMENT ON TABLE vertical_plans IS 'Annual plans with goals, KPIs, and quarterly budgets';

-- Table 4: vertical_kpis (KPI Definitions)
CREATE TABLE vertical_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES vertical_plans(id) ON DELETE CASCADE,
  kpi_name VARCHAR(255) NOT NULL,
  kpi_description TEXT,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('count', 'percentage', 'amount', 'hours', 'score')),
  unit VARCHAR(50),

  -- Quarterly targets
  target_q1 NUMERIC(10,2) DEFAULT 0,
  target_q2 NUMERIC(10,2) DEFAULT 0,
  target_q3 NUMERIC(10,2) DEFAULT 0,
  target_q4 NUMERIC(10,2) DEFAULT 0,
  target_annual NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(target_q1, 0) + COALESCE(target_q2, 0) +
    COALESCE(target_q3, 0) + COALESCE(target_q4, 0)
  ) STORED,

  weight NUMERIC(5,2) DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_kpis_plan_id ON vertical_kpis(plan_id);

COMMENT ON TABLE vertical_kpis IS 'KPI definitions with quarterly targets and weights';

-- Table 5: vertical_kpi_actuals (KPI Progress)
CREATE TABLE vertical_kpi_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES vertical_kpis(id) ON DELETE CASCADE,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  actual_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  recorded_by UUID REFERENCES members(id),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  supporting_event_ids UUID[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(kpi_id, quarter)
);

CREATE INDEX idx_vertical_kpi_actuals_kpi_id ON vertical_kpi_actuals(kpi_id);

COMMENT ON TABLE vertical_kpi_actuals IS 'Actual KPI values per quarter';

-- Table 6: vertical_members (Team Assignments)
CREATE TABLE vertical_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role_in_vertical VARCHAR(100),
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date DATE,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, member_id)
);

CREATE INDEX idx_vertical_members_vertical_id ON vertical_members(vertical_id);
CREATE INDEX idx_vertical_members_member_id ON vertical_members(member_id);

COMMENT ON TABLE vertical_members IS 'Team member assignments to verticals';

-- Table 7: vertical_activities (Activity Tracking)
CREATE TABLE vertical_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  activity_date DATE NOT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) CHECK (activity_type IN ('event', 'meeting', 'outreach', 'campaign', 'training', 'other')),
  description TEXT,

  -- Outcome metrics
  beneficiaries_count INT DEFAULT 0,
  volunteer_count INT DEFAULT 0,
  volunteer_hours NUMERIC(8,2) DEFAULT 0,
  cost_incurred NUMERIC(10,2) DEFAULT 0,
  photos_count INT DEFAULT 0,

  report_url TEXT,
  impact_summary TEXT,

  -- Auto-calculate quarter from date
  quarter INT GENERATED ALWAYS AS (
    CASE
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 1 AND 3 THEN 1
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 4 AND 6 THEN 2
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 7 AND 9 THEN 3
      ELSE 4
    END
  ) STORED,

  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_activities_vertical_id ON vertical_activities(vertical_id);
CREATE INDEX idx_vertical_activities_event_id ON vertical_activities(event_id);
CREATE INDEX idx_vertical_activities_date ON vertical_activities(activity_date);

COMMENT ON TABLE vertical_activities IS 'Activity logs with outcome tracking';

-- Table 8: vertical_performance_reviews (Chair Reviews)
CREATE TABLE vertical_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  review_type VARCHAR(20) DEFAULT 'quarterly' CHECK (review_type IN ('quarterly', 'annual', 'mid_year')),

  top_achievements TEXT[],
  pending_actions TEXT[],
  improvement_areas TEXT[],
  chair_comments TEXT,

  -- Auto-calculated scores
  kpi_completion_percentage NUMERIC(5,2),
  budget_utilization_percentage NUMERIC(5,2),
  engagement_score NUMERIC(5,2),
  innovation_score NUMERIC(5,2),
  overall_rating NUMERIC(5,2) CHECK (overall_rating >= 0 AND overall_rating <= 10),

  reviewed_by UUID REFERENCES members(id),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year, quarter)
);

CREATE INDEX idx_vertical_reviews_vertical_id ON vertical_performance_reviews(vertical_id);

COMMENT ON TABLE vertical_performance_reviews IS 'Quarterly performance reviews with auto-generated insights';

-- Table 9: vertical_achievements (Recognition)
CREATE TABLE vertical_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  achievement_title VARCHAR(255) NOT NULL,
  achievement_description TEXT,
  achievement_date DATE NOT NULL,
  achievement_type VARCHAR(50) CHECK (achievement_type IN ('kpi_exceeded', 'innovation', 'impact', 'partnership', 'recognition', 'other')),

  impact_metrics JSONB,
  is_highlighted BOOLEAN DEFAULT false,
  nominated_for_award BOOLEAN DEFAULT false,
  award_nomination_id UUID REFERENCES nominations(id),

  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_achievements_vertical_id ON vertical_achievements(vertical_id);

COMMENT ON TABLE vertical_achievements IS 'Notable achievements for recognition and awards';

-- ============================================================================
-- PHASE 2: INTEGRATION ALTERATIONS
-- ============================================================================

-- Alter events table to link to verticals
ALTER TABLE events
ADD COLUMN vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

CREATE INDEX idx_events_vertical_id ON events(vertical_id);

COMMENT ON COLUMN events.vertical_id IS 'Link event to vertical for performance tracking';

-- Alter expenses table to link to verticals
ALTER TABLE expenses
ADD COLUMN vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_vertical_id ON expenses(vertical_id);

COMMENT ON COLUMN expenses.vertical_id IS 'Link expense to vertical for cost tracking';

-- ============================================================================
-- PHASE 3: ANALYTICS VIEWS
-- ============================================================================

-- View 1: vertical_kpi_progress
CREATE VIEW vertical_kpi_progress AS
SELECT
  vk.id AS kpi_id,
  vk.plan_id,
  vp.vertical_id,
  v.name AS vertical_name,
  vp.fiscal_year,
  vk.kpi_name,
  vk.metric_type,
  vk.unit,
  vk.target_q1,
  vk.target_q2,
  vk.target_q3,
  vk.target_q4,
  vk.target_annual,
  COALESCE(vka_q1.actual_value, 0) AS actual_q1,
  COALESCE(vka_q2.actual_value, 0) AS actual_q2,
  COALESCE(vka_q3.actual_value, 0) AS actual_q3,
  COALESCE(vka_q4.actual_value, 0) AS actual_q4,
  (COALESCE(vka_q1.actual_value, 0) + COALESCE(vka_q2.actual_value, 0) +
   COALESCE(vka_q3.actual_value, 0) + COALESCE(vka_q4.actual_value, 0)) AS actual_annual,
  CASE
    WHEN vk.target_annual > 0
    THEN ROUND(((COALESCE(vka_q1.actual_value, 0) + COALESCE(vka_q2.actual_value, 0) +
                 COALESCE(vka_q3.actual_value, 0) + COALESCE(vka_q4.actual_value, 0)) / vk.target_annual * 100), 2)
    ELSE 0
  END AS completion_percentage
FROM vertical_kpis vk
JOIN vertical_plans vp ON vk.plan_id = vp.id
JOIN verticals v ON vp.vertical_id = v.id
LEFT JOIN vertical_kpi_actuals vka_q1 ON vk.id = vka_q1.kpi_id AND vka_q1.quarter = 1
LEFT JOIN vertical_kpi_actuals vka_q2 ON vk.id = vka_q2.kpi_id AND vka_q2.quarter = 2
LEFT JOIN vertical_kpi_actuals vka_q3 ON vk.id = vka_q3.kpi_id AND vka_q3.quarter = 3
LEFT JOIN vertical_kpi_actuals vka_q4 ON vk.id = vka_q4.kpi_id AND vka_q4.quarter = 4
WHERE vk.is_active = true;

COMMENT ON VIEW vertical_kpi_progress IS 'Real-time KPI progress tracking with completion percentages';

-- View 2: vertical_impact_metrics
CREATE VIEW vertical_impact_metrics AS
SELECT
  v.id AS vertical_id,
  v.name AS vertical_name,
  v.chapter_id,
  EXTRACT(YEAR FROM va.activity_date)::INT AS year,
  COUNT(DISTINCT va.id) AS total_activities,
  COUNT(DISTINCT va.event_id) AS total_events,
  SUM(va.beneficiaries_count) AS total_beneficiaries,
  SUM(va.volunteer_hours) AS total_volunteer_hours,
  SUM(va.cost_incurred) AS total_cost,
  CASE
    WHEN SUM(va.beneficiaries_count) > 0
    THEN ROUND(SUM(va.cost_incurred) / SUM(va.beneficiaries_count), 2)
    ELSE 0
  END AS cost_per_beneficiary,
  COUNT(DISTINCT vm.member_id) AS team_size,
  CASE
    WHEN COUNT(DISTINCT vm.member_id) > 0
    THEN ROUND(SUM(va.volunteer_hours) / COUNT(DISTINCT vm.member_id), 2)
    ELSE 0
  END AS avg_hours_per_member
FROM verticals v
LEFT JOIN vertical_activities va ON v.id = va.vertical_id
LEFT JOIN vertical_members vm ON v.id = vm.vertical_id AND vm.is_active = true
WHERE v.is_active = true
GROUP BY v.id, v.name, v.chapter_id, EXTRACT(YEAR FROM va.activity_date);

COMMENT ON VIEW vertical_impact_metrics IS 'Impact analytics per vertical with cost efficiency metrics';

-- ============================================================================
-- PHASE 4: DATABASE FUNCTIONS
-- ============================================================================

-- Function 1: calculate_vertical_ranking
CREATE OR REPLACE FUNCTION calculate_vertical_ranking(
  p_chapter_id UUID,
  p_fiscal_year INT,
  p_quarter INT DEFAULT NULL
)
RETURNS TABLE (
  vertical_id UUID,
  vertical_name VARCHAR,
  kpi_score NUMERIC,
  engagement_score NUMERIC,
  innovation_score NUMERIC,
  total_score NUMERIC,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH vertical_scores AS (
    SELECT
      v.id AS vertical_id,
      v.name AS vertical_name,
      -- KPI Score: Average KPI completion percentage (weighted 50%)
      COALESCE(AVG(
        CASE
          WHEN vkp.target_annual > 0
          THEN (vkp.actual_annual / vkp.target_annual) * 100
          ELSE 0
        END
      ), 0) AS kpi_score,
      -- Engagement Score: Volunteer hours per member (weighted 30%)
      COALESCE(
        (SUM(va.volunteer_hours) / NULLIF(COUNT(DISTINCT vm.member_id), 0)) * 10, 0
      ) AS engagement_score,
      -- Innovation Score: From performance reviews (weighted 20%)
      COALESCE(AVG(vpr.innovation_score), 0) * 10 AS innovation_score
    FROM verticals v
    LEFT JOIN vertical_plans vp ON v.id = vp.vertical_id AND vp.fiscal_year = p_fiscal_year
    LEFT JOIN vertical_kpi_progress vkp ON vp.id = vkp.plan_id
    LEFT JOIN vertical_activities va ON v.id = va.vertical_id
      AND EXTRACT(YEAR FROM va.activity_date) = p_fiscal_year
      AND (p_quarter IS NULL OR va.quarter = p_quarter)
    LEFT JOIN vertical_members vm ON v.id = vm.vertical_id AND vm.is_active = true
    LEFT JOIN vertical_performance_reviews vpr ON v.id = vpr.vertical_id
      AND vpr.fiscal_year = p_fiscal_year
      AND (p_quarter IS NULL OR vpr.quarter = p_quarter)
    WHERE v.chapter_id = p_chapter_id AND v.is_active = true
    GROUP BY v.id, v.name
  )
  SELECT
    vs.vertical_id,
    vs.vertical_name,
    ROUND(vs.kpi_score, 2),
    ROUND(vs.engagement_score, 2),
    ROUND(vs.innovation_score, 2),
    ROUND((vs.kpi_score * 0.5 + vs.engagement_score * 0.3 + vs.innovation_score * 0.2), 2) AS total_score,
    RANK() OVER (ORDER BY (vs.kpi_score * 0.5 + vs.engagement_score * 0.3 + vs.innovation_score * 0.2) DESC) AS rank
  FROM vertical_scores vs
  ORDER BY total_score DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_vertical_ranking IS 'Calculate vertical rankings based on KPI completion, engagement, and innovation';

-- Function 2: check_kpi_alerts
CREATE OR REPLACE FUNCTION check_kpi_alerts(p_chapter_id UUID DEFAULT NULL)
RETURNS TABLE (
  vertical_id UUID,
  vertical_name VARCHAR,
  kpi_name VARCHAR,
  target NUMERIC,
  actual NUMERIC,
  completion_percentage NUMERIC,
  alert_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    vkp.kpi_name,
    vkp.target_annual,
    vkp.actual_annual,
    vkp.completion_percentage,
    CASE
      WHEN vkp.completion_percentage < 70 THEN 'target_missed'
      WHEN vkp.completion_percentage > 120 THEN 'overachievement'
      ELSE 'on_track'
    END::VARCHAR AS alert_type
  FROM vertical_kpi_progress vkp
  JOIN verticals v ON vkp.vertical_id = v.id
  WHERE v.is_active = true
    AND vkp.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND (p_chapter_id IS NULL OR v.chapter_id = p_chapter_id)
    AND (vkp.completion_percentage < 70 OR vkp.completion_percentage > 120);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_kpi_alerts IS 'Check for KPIs that missed targets (<70%) or exceeded targets (>120%)';

-- ============================================================================
-- PHASE 5: AUTOMATION TRIGGERS
-- ============================================================================

-- Trigger 1: Auto-create vertical_activity from completed event
CREATE OR REPLACE FUNCTION auto_create_vertical_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_volunteer_hours NUMERIC;
  v_created_by UUID;
BEGIN
  IF NEW.vertical_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- Calculate total volunteer hours for this event
    SELECT COALESCE(SUM(hours_contributed), 0) INTO v_volunteer_hours
    FROM event_volunteers
    WHERE event_id = NEW.id AND status = 'completed';

    -- Get the organizer of the event
    v_created_by := NEW.organizer_id;

    -- Insert activity record (ON CONFLICT DO NOTHING prevents duplicates)
    INSERT INTO vertical_activities (
      vertical_id,
      event_id,
      activity_date,
      activity_title,
      activity_type,
      description,
      beneficiaries_count,
      volunteer_hours,
      cost_incurred,
      created_by
    )
    VALUES (
      NEW.vertical_id,
      NEW.id,
      NEW.start_date::date,
      NEW.title,
      'event',
      NEW.description,
      NEW.current_registrations,
      v_volunteer_hours,
      COALESCE(NEW.actual_expense, 0),
      v_created_by
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_completed_create_activity
AFTER UPDATE ON events
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION auto_create_vertical_activity();

COMMENT ON FUNCTION auto_create_vertical_activity IS 'Automatically create vertical_activity when event is completed';

-- Trigger 2: Update timestamp triggers
CREATE TRIGGER update_verticals_updated_at
BEFORE UPDATE ON verticals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_plans_updated_at
BEFORE UPDATE ON vertical_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_kpis_updated_at
BEFORE UPDATE ON vertical_kpis
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_kpi_actuals_updated_at
BEFORE UPDATE ON vertical_kpi_actuals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_members_updated_at
BEFORE UPDATE ON vertical_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_activities_updated_at
BEFORE UPDATE ON vertical_activities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_reviews_updated_at
BEFORE UPDATE ON vertical_performance_reviews
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_chairs_updated_at
BEFORE UPDATE ON vertical_chairs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- PHASE 6: RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_kpi_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_achievements ENABLE ROW LEVEL SECURITY;

-- verticals: Read by chapter members, write by EC/Chair
CREATE POLICY verticals_select_policy ON verticals
  FOR SELECT USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
  );

CREATE POLICY verticals_insert_policy ON verticals
  FOR INSERT WITH CHECK (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 3
  );

CREATE POLICY verticals_update_policy ON verticals
  FOR UPDATE USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    AND get_user_hierarchy_level() >= 3
  );

CREATE POLICY verticals_delete_policy ON verticals
  FOR DELETE USING (
    get_user_hierarchy_level() >= 4
  );

-- vertical_plans: Read by chapter members, write by vertical chairs/EC
CREATE POLICY vertical_plans_select_policy ON vertical_plans
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_plans_insert_policy ON vertical_plans
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

CREATE POLICY vertical_plans_update_policy ON vertical_plans
  FOR UPDATE USING (
    (vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    ) AND locked_at IS NULL)
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_activities: Read by all chapter members, write by vertical members/chairs
CREATE POLICY vertical_activities_select_policy ON vertical_activities
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_activities_insert_policy ON vertical_activities
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

CREATE POLICY vertical_activities_update_policy ON vertical_activities
  FOR UPDATE USING (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_kpis: Read by all, write by chairs/EC
CREATE POLICY vertical_kpis_select_policy ON vertical_kpis
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM vertical_plans
      WHERE vertical_id IN (
        SELECT id FROM verticals
        WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
      )
    )
  );

CREATE POLICY vertical_kpis_insert_policy ON vertical_kpis
  FOR INSERT WITH CHECK (
    plan_id IN (
      SELECT vp.id FROM vertical_plans vp
      JOIN vertical_chairs vc ON vp.vertical_id = vc.vertical_id
      WHERE vc.member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND vc.is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_kpi_actuals: Read by all, write by vertical members/chairs
CREATE POLICY vertical_kpi_actuals_select_policy ON vertical_kpi_actuals
  FOR SELECT USING (
    kpi_id IN (
      SELECT vk.id FROM vertical_kpis vk
      JOIN vertical_plans vp ON vk.plan_id = vp.id
      JOIN verticals v ON vp.vertical_id = v.id
      WHERE v.chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_kpi_actuals_insert_policy ON vertical_kpi_actuals
  FOR INSERT WITH CHECK (
    kpi_id IN (
      SELECT vk.id FROM vertical_kpis vk
      JOIN vertical_plans vp ON vk.plan_id = vp.id
      JOIN vertical_members vm ON vp.vertical_id = vm.vertical_id
      WHERE vm.member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND vm.is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_members: Read by all, write by chairs/EC
CREATE POLICY vertical_members_select_policy ON vertical_members
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_members_insert_policy ON vertical_members
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_chairs: Read by all, write by EC only
CREATE POLICY vertical_chairs_select_policy ON vertical_chairs
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_chairs_insert_policy ON vertical_chairs
  FOR INSERT WITH CHECK (
    get_user_hierarchy_level() >= 3
  );

-- vertical_performance_reviews: Read by all, write by chairs/EC
CREATE POLICY vertical_reviews_select_policy ON vertical_performance_reviews
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_reviews_insert_policy ON vertical_performance_reviews
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_achievements: Read by all, write by vertical members/chairs
CREATE POLICY vertical_achievements_select_policy ON vertical_achievements
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_achievements_insert_policy ON vertical_achievements
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
