-- ═══════════════════════════════════════════════════════════════════════
-- Migration: yi_connect Phase E — National Integration + Notifications +
--            Finance payment_methods enhancements
--
-- Ports four legacy migrations from public schema into yi_connect:
--   1. 20260312000001_national_broadcasts_benchmarks.sql (3 tables)
--   2. 20260312000002_national_events_sync.sql (5 tables + helper fn)
--   3. 20260312000003_notifications.sql (1 table)
--   4. 20260312000004_finance_payment_audit.sql (ALTER payment_methods +
--      additional indexes on financial_audit_logs + insert RLS policy)
--
-- Porting decisions:
--   - SET search_path TO yi_connect, public, extensions
--   - chapters FKs → yi.chapters(id) (canonical shared list)
--   - members/profiles/payment_methods/financial_audit_logs unqualified
--     (resolved by search_path to yi_connect.*)
--   - auth.* kept cross-schema as-is
--   - yi_connect.members has NO user_id column; m.id IS auth.uid().
--     All "members m WHERE m.user_id = auth.uid()" rewritten to m.id.
--   - Migration #4 was named "audit_logs" but operates on
--     financial_audit_logs (already present in yi_connect from Phase A).
--     Apply enhancements there; do NOT create a separate audit_logs table.
--   - Idempotency: IF NOT EXISTS on tables/indexes, DO $$ blocks on
--     policies and triggers, ADD COLUMN IF NOT EXISTS on ALTER.
-- ═══════════════════════════════════════════════════════════════════════

SET search_path TO yi_connect, public, extensions;


-- ═══════════════════════════════════════════════════════════════════════
-- PART 1: national_broadcasts, national_broadcast_receipts, national_benchmarks
-- ═══════════════════════════════════════════════════════════════════════

-- ── national_broadcasts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_broadcasts (
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

COMMENT ON TABLE national_broadcasts IS 'Broadcast messages and announcements from Yi National to chapters';

-- ── national_broadcast_receipts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_broadcast_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  broadcast_id uuid NOT NULL REFERENCES national_broadcasts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  response_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, member_id)
);

COMMENT ON TABLE national_broadcast_receipts IS 'Tracks read/acknowledgment status of national broadcasts per member';

-- ── national_benchmarks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
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

COMMENT ON TABLE national_benchmarks IS 'Benchmark metrics comparing chapter performance against regional and national averages';

-- ── Indexes (Part 1) ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_national_broadcasts_published_at
  ON national_broadcasts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_national_broadcasts_priority
  ON national_broadcasts (priority);
CREATE INDEX IF NOT EXISTS idx_national_broadcasts_type
  ON national_broadcasts (broadcast_type);

CREATE INDEX IF NOT EXISTS idx_national_broadcast_receipts_broadcast_id
  ON national_broadcast_receipts (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_national_broadcast_receipts_chapter_id
  ON national_broadcast_receipts (chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_broadcast_receipts_member_id
  ON national_broadcast_receipts (member_id);

CREATE INDEX IF NOT EXISTS idx_national_benchmarks_chapter_id
  ON national_benchmarks (chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_metric_type
  ON national_benchmarks (metric_type);
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_period
  ON national_benchmarks (period_type, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_national_benchmarks_chapter_period
  ON national_benchmarks (chapter_id, period_type, period_end DESC);

-- ── RLS (Part 1) ───────────────────────────────────────────────────────
ALTER TABLE national_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_broadcast_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_benchmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read broadcasts"
    ON national_broadcasts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can read own broadcast receipts"
    ON national_broadcast_receipts FOR SELECT TO authenticated
    USING (member_id IN (SELECT m.id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can create own broadcast receipts"
    ON national_broadcast_receipts FOR INSERT TO authenticated
    WITH CHECK (member_id IN (SELECT m.id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can update own broadcast receipts"
    ON national_broadcast_receipts FOR UPDATE TO authenticated
    USING (member_id IN (SELECT m.id FROM members m WHERE m.id = auth.uid()))
    WITH CHECK (member_id IN (SELECT m.id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can read own chapter benchmarks"
    ON national_benchmarks FOR SELECT TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Triggers (Part 1) ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_national_broadcasts_updated_at') THEN
    CREATE TRIGGER set_national_broadcasts_updated_at
      BEFORE UPDATE ON national_broadcasts
      FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_national_benchmarks_updated_at') THEN
    CREATE TRIGGER set_national_benchmarks_updated_at
      BEFORE UPDATE ON national_benchmarks
      FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- PART 2: National Events & Sync (5 tables + helper function)
-- ═══════════════════════════════════════════════════════════════════════

-- ── national_sync_config ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

  api_endpoint TEXT,
  api_version TEXT DEFAULT 'v1',
  auth_token_encrypted TEXT,

  sync_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'manual')),

  entity_sync_settings JSONB NOT NULL DEFAULT '{
    "members": {"enabled": false, "frequency": "daily"},
    "events": {"enabled": false, "frequency": "daily"},
    "financials": {"enabled": false, "frequency": "weekly"},
    "awards": {"enabled": false, "frequency": "weekly"},
    "projects": {"enabled": false, "frequency": "weekly"}
  }'::jsonb,

  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'unstable', 'error')),
  last_connection_test TIMESTAMPTZ,
  last_successful_sync TIMESTAMPTZ,
  last_failed_sync TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(chapter_id)
);

-- ── national_sync_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

  sync_type TEXT NOT NULL
    CHECK (sync_type IN ('members', 'events', 'financials', 'awards', 'projects', 'verticals', 'leadership')),
  sync_direction TEXT NOT NULL
    CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'partial', 'cancelled')),

  total_records INTEGER NOT NULL DEFAULT 0,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  failed_records JSONB DEFAULT '[]'::jsonb,

  triggered_by TEXT NOT NULL DEFAULT 'system',
  triggered_by_user UUID REFERENCES profiles(id),
  request_id TEXT,
  api_response_code INTEGER,
  api_response_time_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── national_events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  national_event_id TEXT NOT NULL UNIQUE,

  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'other'
    CHECK (event_type IN ('rcm', 'summit', 'yuva_conclave', 'national_meet', 'training', 'workshop', 'conference', 'other')),

  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  early_bird_deadline TIMESTAMPTZ,

  venue_name TEXT,
  venue_address TEXT,
  city TEXT,
  state TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  virtual_link TEXT,

  max_participants INTEGER,
  current_registrations INTEGER NOT NULL DEFAULT 0,
  waitlist_count INTEGER NOT NULL DEFAULT 0,

  registration_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  early_bird_fee NUMERIC(10,2),
  member_fee NUMERIC(10,2),

  eligible_roles TEXT[] DEFAULT '{}',
  min_chapter_quota INTEGER,
  max_chapter_quota INTEGER,

  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'cancelled')),
  is_featured BOOLEAN NOT NULL DEFAULT false,

  agenda JSONB,
  speakers JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,

  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed', 'partial', 'cancelled')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── national_event_registrations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  national_event_id TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no_show')),
  registration_number TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  attended_at TIMESTAMPTZ,

  payment_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded')),
  payment_amount NUMERIC(10,2),
  payment_reference TEXT,

  requires_accommodation BOOLEAN NOT NULL DEFAULT false,
  accommodation_status TEXT,
  travel_mode TEXT,
  arrival_date TIMESTAMPTZ,
  departure_date TIMESTAMPTZ,
  special_requirements TEXT,

  attendance_verified BOOLEAN NOT NULL DEFAULT false,
  attendance_verified_by UUID REFERENCES profiles(id),

  feedback_submitted BOOLEAN NOT NULL DEFAULT false,
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comments TEXT,

  certificate_eligible BOOLEAN NOT NULL DEFAULT false,
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  certificate_url TEXT,
  certificate_issued_at TIMESTAMPTZ,

  national_registration_id TEXT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(national_event_id, member_id)
);

-- ── national_data_conflicts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS national_data_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('members', 'events', 'financials', 'awards', 'projects', 'verticals', 'leadership')),
  local_entity_id TEXT NOT NULL,
  national_entity_id TEXT,
  sync_entity_id UUID,

  conflict_type TEXT NOT NULL
    CHECK (conflict_type IN ('data_mismatch', 'version_conflict', 'missing_local', 'missing_national', 'schema_change')),
  conflict_fields TEXT[] DEFAULT '{}',
  local_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  national_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_data JSONB,

  resolution_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending', 'keep_local', 'accept_national', 'merged', 'ignored')),
  resolution_notes TEXT,
  resolved_data JSONB,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN NOT NULL DEFAULT false,

  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  detected_in_sync_log_id UUID REFERENCES national_sync_logs(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes (Part 2) ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_national_sync_config_chapter ON national_sync_config(chapter_id);

CREATE INDEX IF NOT EXISTS idx_national_sync_logs_chapter ON national_sync_logs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_sync_logs_status ON national_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_national_sync_logs_sync_type ON national_sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_national_sync_logs_started_at ON national_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_national_sync_logs_chapter_started ON national_sync_logs(chapter_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_national_events_status ON national_events(status);
CREATE INDEX IF NOT EXISTS idx_national_events_event_type ON national_events(event_type);
CREATE INDEX IF NOT EXISTS idx_national_events_start_date ON national_events(start_date);
CREATE INDEX IF NOT EXISTS idx_national_events_featured ON national_events(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_national_events_national_id ON national_events(national_event_id);

CREATE INDEX IF NOT EXISTS idx_national_event_reg_event ON national_event_registrations(national_event_id);
CREATE INDEX IF NOT EXISTS idx_national_event_reg_chapter ON national_event_registrations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_event_reg_member ON national_event_registrations(member_id);
CREATE INDEX IF NOT EXISTS idx_national_event_reg_status ON national_event_registrations(status);

CREATE INDEX IF NOT EXISTS idx_national_conflicts_chapter ON national_data_conflicts(chapter_id);
CREATE INDEX IF NOT EXISTS idx_national_conflicts_status ON national_data_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_national_conflicts_entity_type ON national_data_conflicts(entity_type);
CREATE INDEX IF NOT EXISTS idx_national_conflicts_detected ON national_data_conflicts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_national_conflicts_chapter_pending ON national_data_conflicts(chapter_id, resolution_status)
  WHERE resolution_status = 'pending';

-- ── RLS (Part 2) ───────────────────────────────────────────────────────
-- Note: yi_connect.members has NO user_id column; m.id IS auth.uid().
-- Original migration used "m.id = auth.uid()" already in this file.

ALTER TABLE national_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_data_conflicts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sync_config_select" ON national_sync_config FOR SELECT TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sync_config_update" ON national_sync_config FOR UPDATE TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sync_config_insert" ON national_sync_config FOR INSERT TO authenticated
    WITH CHECK (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sync_logs_select" ON national_sync_logs FOR SELECT TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sync_logs_insert" ON national_sync_logs FOR INSERT TO authenticated
    WITH CHECK (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "national_events_select" ON national_events FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_reg_select_own" ON national_event_registrations FOR SELECT TO authenticated
    USING (member_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_reg_select_chapter" ON national_event_registrations FOR SELECT TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_reg_insert" ON national_event_registrations FOR INSERT TO authenticated
    WITH CHECK (member_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_reg_update" ON national_event_registrations FOR UPDATE TO authenticated
    USING (member_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "conflicts_select" ON national_data_conflicts FOR SELECT TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "conflicts_update" ON national_data_conflicts FOR UPDATE TO authenticated
    USING (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "conflicts_insert" ON national_data_conflicts FOR INSERT TO authenticated
    WITH CHECK (chapter_id IN (SELECT m.chapter_id FROM members m WHERE m.id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Triggers (Part 2) ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_national_sync_config_updated_at') THEN
    CREATE TRIGGER update_national_sync_config_updated_at
      BEFORE UPDATE ON national_sync_config
      FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_national_events_updated_at') THEN
    CREATE TRIGGER update_national_events_updated_at
      BEFORE UPDATE ON national_events
      FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_national_event_registrations_updated_at') THEN
    CREATE TRIGGER update_national_event_registrations_updated_at
      BEFORE UPDATE ON national_event_registrations
      FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_national_data_conflicts_updated_at') THEN
    CREATE TRIGGER update_national_data_conflicts_updated_at
      BEFORE UPDATE ON national_data_conflicts
      FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;

-- ── Helper function: get_sync_health_status ────────────────────────────
CREATE OR REPLACE FUNCTION yi_connect.get_sync_health_status(p_chapter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = yi_connect, public, extensions
AS $$
DECLARE
  v_config yi_connect.national_sync_config%ROWTYPE;
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
  SELECT * INTO v_config
  FROM yi_connect.national_sync_config
  WHERE chapter_id = p_chapter_id;

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

  SELECT
    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'completed' THEN records_succeeded ELSE 0 END), 0),
    COALESCE(SUM(records_failed), 0)
  INTO v_24h_successful, v_24h_failed, v_24h_in_progress, v_24h_records_synced, v_24h_records_failed
  FROM yi_connect.national_sync_logs
  WHERE chapter_id = p_chapter_id
    AND started_at >= NOW() - INTERVAL '24 hours';

  SELECT COUNT(*)
  INTO v_pending_conflicts
  FROM yi_connect.national_data_conflicts
  WHERE chapter_id = p_chapter_id
    AND resolution_status = 'pending';

  SELECT COALESCE(SUM(records_succeeded), 0)
  INTO v_entities_synced
  FROM yi_connect.national_sync_logs
  WHERE chapter_id = p_chapter_id
    AND status = 'completed';

  v_health_score := 0;
  IF v_config.sync_enabled THEN
    v_health_score := CASE v_config.connection_status
      WHEN 'connected' THEN 50
      WHEN 'unstable' THEN 30
      WHEN 'error' THEN 10
      ELSE 0
    END;

    IF (v_24h_successful + v_24h_failed) > 0 THEN
      v_health_score := v_health_score + (v_24h_successful * 40 / (v_24h_successful + v_24h_failed));
    END IF;

    v_health_score := GREATEST(0, v_health_score - (v_config.consecutive_failures * 10));
    v_health_score := GREATEST(0, v_health_score - (v_pending_conflicts * 2));

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


-- ═══════════════════════════════════════════════════════════════════════
-- PART 3: notifications table
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES yi.chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  category text,
  read boolean NOT NULL DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_chapter_id ON notifications(chapter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(member_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT
    USING (member_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
    USING (member_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service can insert notifications" ON notifications FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- PART 4: Finance payment_methods + financial_audit_logs enhancements
-- ═══════════════════════════════════════════════════════════════════════
-- payment_methods and financial_audit_logs already exist in yi_connect
-- (created in 20260522000008_yi_connect_finance.sql). This part adds:
--   - account_details JSONB column on payment_methods (+ backfill)
--   - additional indexes on financial_audit_logs
--   - updated_at trigger on payment_methods
--   - INSERT policy on financial_audit_logs
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS account_details JSONB DEFAULT '{}'::jsonb;

-- Backfill account_details from existing normalized columns
UPDATE payment_methods
SET account_details = jsonb_strip_nulls(jsonb_build_object(
    'account_number', account_number,
    'bank_name', bank_name,
    'ifsc_code', ifsc_code,
    'upi_id', upi_id
))
WHERE account_details IS NULL OR account_details = '{}'::jsonb;

COMMENT ON COLUMN payment_methods.account_details IS
  'Flexible JSONB storage for payment account details (bank info, UPI, etc.)';

-- Additional indexes on financial_audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
  ON financial_audit_logs(entity_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON financial_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_chapter_created
  ON financial_audit_logs(chapter_id, created_at DESC);

-- Auto-update trigger for payment_methods
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_payment_methods_updated_at') THEN
    CREATE TRIGGER trigger_payment_methods_updated_at
      BEFORE UPDATE ON payment_methods
      FOR EACH ROW
      EXECUTE FUNCTION yi_connect.update_updated_at_column();
  END IF;
END $$;

-- INSERT policy so server actions can write audit log entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'yi_connect'
      AND tablename = 'financial_audit_logs'
      AND policyname = 'Authenticated users can insert audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert audit logs"
      ON financial_audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (performed_by = auth.uid());
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════
