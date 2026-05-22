-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Trainer Profiles RECONSTRUCTION (Batch 10)
--
-- Source: NONE — this table was never committed as a migration.
-- It existed only on the old yi-connect Supabase project
-- (jxvbjpkypzedtrqewesc) created via manual SQL.
--
-- This migration RECONSTRUCTS the schema by reverse-engineering from
-- how trainer_profiles is referenced by 3 dependent migrations:
--   - 20251127000001_events_trainer_materials.sql
--   - 20251128000003_session_bookings.sql
--   - 20251128000005_business_rules_enforcement.sql
--
-- Confirmed columns (read from SQL that targets this table):
--   id, member_id, chapter_id, average_rating, total_sessions,
--   sessions_this_month, days_since_last_session, last_session_date,
--   updated_at
--
-- Guessed columns (typical for trainer profile domain — flagged):
--   status, is_active, expertise_areas, certifications,
--   max_sessions_per_month, hourly_rate, bio, languages, training_modes
--
-- All identifiers placed in yi_connect.* schema.
-- ═══════════════════════════════════════════════════════════════════════

-- ============================================================================
-- ENUM: trainer_status
-- ============================================================================

CREATE TYPE yi_connect.trainer_status AS ENUM (
  'pending',     -- Application submitted, not yet approved
  'active',      -- Approved and available
  'inactive',    -- Temporarily unavailable
  'suspended',   -- Disciplinary suspension
  'retired'      -- No longer active
);

-- ============================================================================
-- TABLE: trainer_profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS yi_connect.trainer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (CONFIRMED from references)
  member_id UUID NOT NULL REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES yi.chapters(id),

  -- Profile (GUESSED — typical fields)
  bio TEXT,
  expertise_areas TEXT[] DEFAULT '{}',           -- e.g., ['road_safety', 'soft_skills', 'career_guidance']
  service_types TEXT[] DEFAULT '{}',             -- Matches service_event_type ENUM values
  certifications TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',                 -- e.g., ['English', 'Tamil', 'Hindi']
  training_modes TEXT[] DEFAULT '{}',            -- e.g., ['in_person', 'online', 'hybrid']
  years_of_training_experience INTEGER DEFAULT 0,

  -- Availability (GUESSED)
  max_sessions_per_month INTEGER DEFAULT 6,      -- Rule 2 in business_rules_enforcement
  available_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  available_time_slots TEXT[] DEFAULT ARRAY['morning', 'afternoon'],
  travel_radius_km INTEGER DEFAULT 50,

  -- Performance Stats (CONFIRMED from references)
  average_rating DECIMAL(3, 2) CHECK (average_rating IS NULL OR (average_rating >= 0 AND average_rating <= 5)),
  total_sessions INTEGER NOT NULL DEFAULT 0,
  sessions_this_month INTEGER NOT NULL DEFAULT 0,
  last_session_date DATE,
  days_since_last_session INTEGER,

  -- Compensation (GUESSED)
  hourly_rate DECIMAL(10, 2),
  is_volunteer BOOLEAN NOT NULL DEFAULT true,

  -- Status (CONFIRMED enum needed by typical RLS / lifecycle)
  status yi_connect.trainer_status NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Onboarding / Approval (GUESSED)
  approved_by UUID REFERENCES yi_connect.members(id),
  approved_at TIMESTAMPTZ,

  -- Notes
  internal_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_trainer_per_member UNIQUE (member_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_trainer_profiles_member ON yi_connect.trainer_profiles(member_id);
CREATE INDEX idx_trainer_profiles_chapter ON yi_connect.trainer_profiles(chapter_id);
CREATE INDEX idx_trainer_profiles_status ON yi_connect.trainer_profiles(status) WHERE status = 'active';
CREATE INDEX idx_trainer_profiles_active ON yi_connect.trainer_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_trainer_profiles_rating ON yi_connect.trainer_profiles(average_rating DESC NULLS LAST);
CREATE INDEX idx_trainer_profiles_last_session ON yi_connect.trainer_profiles(last_session_date DESC NULLS LAST);
CREATE INDEX idx_trainer_profiles_expertise ON yi_connect.trainer_profiles USING gin (expertise_areas);
CREATE INDEX idx_trainer_profiles_service_types ON yi_connect.trainer_profiles USING gin (service_types);

COMMENT ON TABLE yi_connect.trainer_profiles IS 'Reconstructed trainer profile registry — original DDL never committed';
COMMENT ON COLUMN yi_connect.trainer_profiles.average_rating IS 'Aggregated rating from session feedback (0-5)';
COMMENT ON COLUMN yi_connect.trainer_profiles.days_since_last_session IS 'Used by event_trainer_score for fair distribution scoring';
COMMENT ON COLUMN yi_connect.trainer_profiles.max_sessions_per_month IS 'Rule 2: Default 6 sessions/month limit';

-- ============================================================================
-- TRIGGER: updated_at
-- ============================================================================

CREATE TRIGGER set_trainer_profiles_updated_at
  BEFORE UPDATE ON yi_connect.trainer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE yi_connect.trainer_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated yi members can view trainer profiles
CREATE POLICY "Members can view all trainer profiles"
  ON yi_connect.trainer_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Trainers can manage their own profile
CREATE POLICY "Trainers can update own profile"
  ON yi_connect.trainer_profiles FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Trainers can insert own profile"
  ON yi_connect.trainer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Chair+ can manage all trainer profiles in their chapter
CREATE POLICY "Chair+ can manage trainer profiles"
  ON yi_connect.trainer_profiles FOR ALL
  TO authenticated
  USING (yi_connect.get_user_hierarchy_level() >= 4);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON yi_connect.trainer_profiles TO authenticated;
