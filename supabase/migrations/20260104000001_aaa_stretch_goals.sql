-- ============================================================================
-- AAA Stretch Goals Enhancement
-- Created: 2026-01-04
-- Purpose: Add optional stretch activities beyond core AAA (4th awareness, 3rd action, 2nd advocacy)
-- ============================================================================

-- Stretch Goal Flags
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS has_stretch_awareness BOOLEAN DEFAULT false;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS has_stretch_action BOOLEAN DEFAULT false;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS has_stretch_advocacy BOOLEAN DEFAULT false;

-- Awareness 4 (Optional Stretch)
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_title VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_description TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_audience VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_target_date DATE;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_4_status IS NULL OR awareness_4_status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS awareness_4_impact_measures TEXT;

-- Action 3 (Optional Stretch)
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_title VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_description TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_target VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_target_date DATE;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_status VARCHAR(20) DEFAULT 'planned' CHECK (action_3_status IS NULL OR action_3_status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS action_3_impact_measures TEXT;

-- Advocacy 2 (Optional Stretch)
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_target_contact VARCHAR(255);
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_approach TEXT;
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_status VARCHAR(20) DEFAULT 'planned' CHECK (advocacy_2_status IS NULL OR advocacy_2_status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE aaa_plans ADD COLUMN IF NOT EXISTS advocacy_2_outcome TEXT;

-- Comments
COMMENT ON COLUMN aaa_plans.has_stretch_awareness IS 'Flag indicating if vertical has added a 4th awareness session';
COMMENT ON COLUMN aaa_plans.has_stretch_action IS 'Flag indicating if vertical has added a 3rd action event';
COMMENT ON COLUMN aaa_plans.has_stretch_advocacy IS 'Flag indicating if vertical has added a 2nd advocacy goal';
COMMENT ON COLUMN aaa_plans.awareness_4_title IS 'Stretch: Optional 4th awareness session title';
COMMENT ON COLUMN aaa_plans.action_3_title IS 'Stretch: Optional 3rd action event title';
COMMENT ON COLUMN aaa_plans.advocacy_2_goal IS 'Stretch: Optional 2nd advocacy goal';

-- Update the get_aaa_completion function to include stretch goals
CREATE OR REPLACE FUNCTION get_aaa_completion(plan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  base_items INT := 6; -- 3 awareness + 2 action + 1 advocacy
  stretch_items INT := 0;
  total_items INT;
  completed_items INT := 0;
  plan_record RECORD;
BEGIN
  SELECT * INTO plan_record FROM aaa_plans WHERE id = plan_id;

  IF plan_record IS NULL THEN
    RETURN 0;
  END IF;

  -- Count stretch items (only if enabled)
  IF plan_record.has_stretch_awareness THEN stretch_items := stretch_items + 1; END IF;
  IF plan_record.has_stretch_action THEN stretch_items := stretch_items + 1; END IF;
  IF plan_record.has_stretch_advocacy THEN stretch_items := stretch_items + 1; END IF;

  total_items := base_items + stretch_items;

  -- Count completed base items
  IF plan_record.awareness_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_3_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.advocacy_status = 'completed' THEN completed_items := completed_items + 1; END IF;

  -- Count completed stretch items (only if enabled)
  IF plan_record.has_stretch_awareness AND plan_record.awareness_4_status = 'completed' THEN
    completed_items := completed_items + 1;
  END IF;
  IF plan_record.has_stretch_action AND plan_record.action_3_status = 'completed' THEN
    completed_items := completed_items + 1;
  END IF;
  IF plan_record.has_stretch_advocacy AND plan_record.advocacy_2_status = 'completed' THEN
    completed_items := completed_items + 1;
  END IF;

  RETURN ROUND((completed_items::NUMERIC / total_items) * 100, 1);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_aaa_completion IS 'Calculate AAA plan completion percentage (0-100), including stretch goals if enabled';
