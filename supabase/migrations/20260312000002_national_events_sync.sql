-- ============================================================================
-- National Events & Sync Tables
-- ============================================================================
-- Module 10: National Integration Layer
-- Creates tables for sync configuration, sync logs, national events,
-- event registrations, and data conflicts.
-- ============================================================================

-- ============================================================================
-- 1. national_sync_config - per-chapter sync configuration
-- ============================================================================
CREATE TABLE national_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- API connection settings
  api_endpoint TEXT,
  api_version TEXT DEFAULT 'v1',
  auth_token_encrypted TEXT,

  -- Sync toggles
  sync_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'manual')),

  -- Per-entity sync settings stored as JSONB
  entity_sync_settings JSONB NOT NULL DEFAULT '{
    "members": {"enabled": false, "frequency": "daily"},
    "events": {"enabled": false, "frequency": "daily"},
    "financials": {"enabled": false, "frequency": "weekly"},
    "awards": {"enabled": false, "frequency": "weekly"},
    "projects": {"enabled": false, "frequency": "weekly"}
  }'::jsonb,

  -- Connection health
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'unstable', 'error')),
  last_connection_test TIMESTAMPTZ,
  last_successful_sync TIMESTAMPTZ,
  last_failed_sync TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One config per chapter
  UNIQUE(chapter_id)
);

-- ============================================================================
-- 2. national_sync_logs - log of sync operations
-- ============================================================================
CREATE TABLE national_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Sync details
  sync_type TEXT NOT NULL
    CHECK (sync_type IN ('members', 'events', 'financials', 'awards', 'projects', 'verticals', 'leadership')),
  sync_direction TEXT NOT NULL
    CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'partial', 'cancelled')),

  -- Record counts
  total_records INTEGER NOT NULL DEFAULT 0,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Error info
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  failed_records JSONB DEFAULT '[]'::jsonb,

  -- Trigger info
  triggered_by TEXT NOT NULL DEFAULT 'system',
  triggered_by_user UUID REFERENCES profiles(id),
  request_id TEXT,
  api_response_code INTEGER,
  api_response_time_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. national_events - events from national Yi
-- ============================================================================
CREATE TABLE national_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  national_event_id TEXT NOT NULL UNIQUE,

  -- Event info
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'other'
    CHECK (event_type IN ('rcm', 'summit', 'yuva_conclave', 'national_meet', 'training', 'workshop', 'conference', 'other')),

  -- Dates
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  early_bird_deadline TIMESTAMPTZ,

  -- Venue
  venue_name TEXT,
  venue_address TEXT,
  city TEXT,
  state TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  virtual_link TEXT,

  -- Capacity & registrations
  max_participants INTEGER,
  current_registrations INTEGER NOT NULL DEFAULT 0,
  waitlist_count INTEGER NOT NULL DEFAULT 0,

  -- Pricing
  registration_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  early_bird_fee NUMERIC(10,2),
  member_fee NUMERIC(10,2),

  -- Eligibility
  eligible_roles TEXT[] DEFAULT '{}',
  min_chapter_quota INTEGER,
  max_chapter_quota INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled')),
  is_featured BOOLEAN NOT NULL DEFAULT false,

  -- Rich content (JSONB)
  agenda JSONB,
  speakers JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,

  -- Sync metadata
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed', 'partial', 'cancelled')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. national_event_registrations - chapter registrations for national events
-- ============================================================================
CREATE TABLE national_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  national_event_id TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Registration info
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show')),
  registration_number TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  attended_at TIMESTAMPTZ,

  -- Payment
  payment_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded')),
  payment_amount NUMERIC(10,2),
  payment_reference TEXT,

  -- Travel & accommodation
  requires_accommodation BOOLEAN NOT NULL DEFAULT false,
  accommodation_status TEXT,
  travel_mode TEXT,
  arrival_date TIMESTAMPTZ,
  departure_date TIMESTAMPTZ,
  special_requirements TEXT,

  -- Attendance
  attendance_verified BOOLEAN NOT NULL DEFAULT false,
  attendance_verified_by UUID REFERENCES profiles(id),

  -- Feedback
  feedback_submitted BOOLEAN NOT NULL DEFAULT false,
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comments TEXT,

  -- Certificate
  certificate_eligible BOOLEAN NOT NULL DEFAULT false,
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  certificate_url TEXT,
  certificate_issued_at TIMESTAMPTZ,

  -- Sync
  national_registration_id TEXT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One registration per member per event
  UNIQUE(national_event_id, member_id)
);

-- ============================================================================
-- 5. national_data_conflicts - data conflicts during sync
-- ============================================================================
CREATE TABLE national_data_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Entity reference
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('members', 'events', 'financials', 'awards', 'projects', 'verticals', 'leadership')),
  local_entity_id TEXT NOT NULL,
  national_entity_id TEXT,
  sync_entity_id UUID,

  -- Conflict details
  conflict_type TEXT NOT NULL
    CHECK (conflict_type IN ('data_mismatch', 'version_conflict', 'missing_local', 'missing_national', 'schema_change')),
  conflict_fields TEXT[] DEFAULT '{}',
  local_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  national_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_data JSONB,

  -- Resolution
  resolution_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending', 'keep_local', 'accept_national', 'merged', 'ignored')),
  resolution_notes TEXT,
  resolved_data JSONB,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN NOT NULL DEFAULT false,

  -- Priority
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  -- Detection
  detected_in_sync_log_id UUID REFERENCES national_sync_logs(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- national_sync_config
CREATE INDEX idx_national_sync_config_chapter ON national_sync_config(chapter_id);

-- national_sync_logs
CREATE INDEX idx_national_sync_logs_chapter ON national_sync_logs(chapter_id);
CREATE INDEX idx_national_sync_logs_status ON national_sync_logs(status);
CREATE INDEX idx_national_sync_logs_sync_type ON national_sync_logs(sync_type);
CREATE INDEX idx_national_sync_logs_started_at ON national_sync_logs(started_at DESC);
CREATE INDEX idx_national_sync_logs_chapter_started ON national_sync_logs(chapter_id, started_at DESC);

-- national_events
CREATE INDEX idx_national_events_status ON national_events(status);
CREATE INDEX idx_national_events_event_type ON national_events(event_type);
CREATE INDEX idx_national_events_start_date ON national_events(start_date);
CREATE INDEX idx_national_events_featured ON national_events(is_featured) WHERE is_featured = true;
CREATE INDEX idx_national_events_national_id ON national_events(national_event_id);

-- national_event_registrations
CREATE INDEX idx_national_event_reg_event ON national_event_registrations(national_event_id);
CREATE INDEX idx_national_event_reg_chapter ON national_event_registrations(chapter_id);
CREATE INDEX idx_national_event_reg_member ON national_event_registrations(member_id);
CREATE INDEX idx_national_event_reg_status ON national_event_registrations(status);

-- national_data_conflicts
CREATE INDEX idx_national_conflicts_chapter ON national_data_conflicts(chapter_id);
CREATE INDEX idx_national_conflicts_status ON national_data_conflicts(resolution_status);
CREATE INDEX idx_national_conflicts_entity_type ON national_data_conflicts(entity_type);
CREATE INDEX idx_national_conflicts_detected ON national_data_conflicts(detected_at DESC);
CREATE INDEX idx_national_conflicts_chapter_pending ON national_data_conflicts(chapter_id, resolution_status)
  WHERE resolution_status = 'pending';


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE national_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_data_conflicts ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- national_sync_config policies
-- --------------------------------------------------------------------------

-- Authenticated users can read sync config for their own chapter
CREATE POLICY "sync_config_select"
  ON national_sync_config
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- Authenticated users can update sync config for their own chapter
CREATE POLICY "sync_config_update"
  ON national_sync_config
  FOR UPDATE
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- Authenticated users can insert sync config for their own chapter
CREATE POLICY "sync_config_insert"
  ON national_sync_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- national_sync_logs policies
-- --------------------------------------------------------------------------

-- Authenticated users can read sync logs for their own chapter
CREATE POLICY "sync_logs_select"
  ON national_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- System/service can insert sync logs (via service role or trigger)
CREATE POLICY "sync_logs_insert"
  ON national_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- national_events policies
-- --------------------------------------------------------------------------

-- All authenticated users can read national events
CREATE POLICY "national_events_select"
  ON national_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert/update restricted to service role (handled via admin client)
-- No insert/update policy for regular authenticated users

-- --------------------------------------------------------------------------
-- national_event_registrations policies
-- --------------------------------------------------------------------------

-- Users can read their own registrations
CREATE POLICY "event_reg_select_own"
  ON national_event_registrations
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Chapter members can read all registrations for their chapter
CREATE POLICY "event_reg_select_chapter"
  ON national_event_registrations
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- Users can insert their own registrations
CREATE POLICY "event_reg_insert"
  ON national_event_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Users can update their own registrations
CREATE POLICY "event_reg_update"
  ON national_event_registrations
  FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid());

-- --------------------------------------------------------------------------
-- national_data_conflicts policies
-- --------------------------------------------------------------------------

-- Authenticated users can read conflicts for their own chapter
CREATE POLICY "conflicts_select"
  ON national_data_conflicts
  FOR SELECT
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- Authenticated users can update conflicts for their own chapter (resolve)
CREATE POLICY "conflicts_update"
  ON national_data_conflicts
  FOR UPDATE
  TO authenticated
  USING (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );

-- Insert policy for system/manual conflict creation
CREATE POLICY "conflicts_insert"
  ON national_data_conflicts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chapter_id IN (
      SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()
    )
  );


-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

-- Trigger function (reuse if it exists, otherwise create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_national_sync_config_updated_at
  BEFORE UPDATE ON national_sync_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_national_events_updated_at
  BEFORE UPDATE ON national_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_national_event_registrations_updated_at
  BEFORE UPDATE ON national_event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_national_data_conflicts_updated_at
  BEFORE UPDATE ON national_data_conflicts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- HELPER FUNCTION: get_sync_health_status
-- ============================================================================
-- Returns sync health metrics for a chapter's dashboard
CREATE OR REPLACE FUNCTION get_sync_health_status(p_chapter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config national_sync_config%ROWTYPE;
  v_result JSONB;
  v_24h_successful INTEGER;
  v_24h_failed INTEGER;
  v_24h_in_progress INTEGER;
  v_24h_records_synced INTEGER;
  v_24h_records_failed INTEGER;
  v_pending_conflicts INTEGER;
  v_entities_synced INTEGER;
  v_health_score INTEGER;
BEGIN
  -- Get config
  SELECT * INTO v_config
  FROM national_sync_config
  WHERE chapter_id = p_chapter_id;

  -- If no config, return defaults
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sync_enabled', false,
      'connection_status', 'disconnected',
      'last_successful_sync', NULL,
      'consecutive_failures', 0,
      'last_24h', jsonb_build_object(
        'successful_syncs', 0,
        'failed_syncs', 0,
        'in_progress', 0,
        'records_synced', 0,
        'records_failed', 0
      ),
      'pending_conflicts', 0,
      'entities_synced', 0,
      'health_score', 0
    );
  END IF;

  -- Last 24h stats
  SELECT
    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'completed' THEN records_succeeded ELSE 0 END), 0),
    COALESCE(SUM(records_failed), 0)
  INTO v_24h_successful, v_24h_failed, v_24h_in_progress, v_24h_records_synced, v_24h_records_failed
  FROM national_sync_logs
  WHERE chapter_id = p_chapter_id
    AND started_at >= NOW() - INTERVAL '24 hours';

  -- Pending conflicts
  SELECT COUNT(*)
  INTO v_pending_conflicts
  FROM national_data_conflicts
  WHERE chapter_id = p_chapter_id
    AND resolution_status = 'pending';

  -- Total synced records (from last completed logs per entity type)
  SELECT COALESCE(SUM(records_succeeded), 0)
  INTO v_entities_synced
  FROM national_sync_logs
  WHERE chapter_id = p_chapter_id
    AND status = 'completed';

  -- Calculate health score (0-100)
  v_health_score := 0;
  IF v_config.sync_enabled THEN
    -- Base score from connection status
    v_health_score := CASE v_config.connection_status
      WHEN 'connected' THEN 50
      WHEN 'unstable' THEN 30
      WHEN 'error' THEN 10
      ELSE 0
    END;

    -- Bonus for successful syncs
    IF (v_24h_successful + v_24h_failed) > 0 THEN
      v_health_score := v_health_score + (v_24h_successful * 40 / (v_24h_successful + v_24h_failed));
    END IF;

    -- Penalty for consecutive failures
    v_health_score := GREATEST(0, v_health_score - (v_config.consecutive_failures * 10));

    -- Penalty for pending conflicts
    v_health_score := GREATEST(0, v_health_score - (v_pending_conflicts * 2));

    -- Bonus for no failures
    IF v_24h_failed = 0 AND v_24h_successful > 0 THEN
      v_health_score := LEAST(100, v_health_score + 10);
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'sync_enabled', v_config.sync_enabled,
    'connection_status', v_config.connection_status,
    'last_successful_sync', v_config.last_successful_sync,
    'consecutive_failures', v_config.consecutive_failures,
    'last_24h', jsonb_build_object(
      'successful_syncs', v_24h_successful,
      'failed_syncs', v_24h_failed,
      'in_progress', v_24h_in_progress,
      'records_synced', v_24h_records_synced,
      'records_failed', v_24h_records_failed
    ),
    'pending_conflicts', v_pending_conflicts,
    'entities_synced', v_entities_synced,
    'health_score', v_health_score
  );

  RETURN v_result;
END;
$$;
