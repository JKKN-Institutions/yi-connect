-- ============================================================================
-- AAA Depth Metrics Enhancement
-- Created: 2026-01-02
-- Purpose: Add target attendance, engagement goals, and impact measures
-- ============================================================================

-- Add depth metrics columns to aaa_plans

-- Awareness 1 depth metrics
ALTER TABLE aaa_plans ADD COLUMN awareness_1_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN awareness_1_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN awareness_1_impact_measures TEXT;

-- Awareness 2 depth metrics
ALTER TABLE aaa_plans ADD COLUMN awareness_2_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN awareness_2_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN awareness_2_impact_measures TEXT;

-- Awareness 3 depth metrics
ALTER TABLE aaa_plans ADD COLUMN awareness_3_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN awareness_3_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN awareness_3_impact_measures TEXT;

-- Action 1 depth metrics
ALTER TABLE aaa_plans ADD COLUMN action_1_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN action_1_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN action_1_impact_measures TEXT;

-- Action 2 depth metrics
ALTER TABLE aaa_plans ADD COLUMN action_2_target_attendance INTEGER;
ALTER TABLE aaa_plans ADD COLUMN action_2_engagement_goal TEXT;
ALTER TABLE aaa_plans ADD COLUMN action_2_impact_measures TEXT;

COMMENT ON COLUMN aaa_plans.awareness_1_target_attendance IS 'Expected number of attendees';
COMMENT ON COLUMN aaa_plans.awareness_1_engagement_goal IS 'How attendees will engage (participate, learn, commit)';
COMMENT ON COLUMN aaa_plans.awareness_1_impact_measures IS 'How to measure success (surveys, pledges, follow-ups)';
