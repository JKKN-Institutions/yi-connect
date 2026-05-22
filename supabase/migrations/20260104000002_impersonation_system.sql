-- User Impersonation System Migration
-- Allows National/Super Admins to temporarily assume any user's identity
-- for debugging, QA testing, real-time support, and permission verification

-- ============================================================================
-- TABLES
-- ============================================================================

-- Impersonation sessions table
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  timeout_minutes INTEGER NOT NULL DEFAULT 30,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (end_reason IN ('manual', 'timeout', 'new_session', 'logout')),
  pages_visited INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT no_self_impersonation CHECK (admin_id != target_user_id)
);

-- Action audit log - records every action taken during impersonation
CREATE TABLE IF NOT EXISTS impersonation_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES impersonation_sessions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'other')),
  table_name TEXT NOT NULL,
  record_id UUID,
  payload_summary JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recent impersonations for quick access dropdown
CREATE TABLE IF NOT EXISTS admin_recent_impersonations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_impersonated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  impersonation_count INTEGER DEFAULT 1,
  UNIQUE(admin_id, target_user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin
  ON impersonation_sessions(admin_id);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target
  ON impersonation_sessions(target_user_id);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
  ON impersonation_sessions(ended_at)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_started
  ON impersonation_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_action_log_session
  ON impersonation_action_log(session_id);

CREATE INDEX IF NOT EXISTS idx_impersonation_action_log_executed
  ON impersonation_action_log(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_recent_impersonations_admin
  ON admin_recent_impersonations(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_recent_impersonations_last
  ON admin_recent_impersonations(last_impersonated_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Check if user can impersonate another user
CREATE OR REPLACE FUNCTION can_impersonate_user(
  impersonator_id UUID,
  target_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  impersonator_level INTEGER;
  target_level INTEGER;
BEGIN
  -- Can't impersonate self
  IF impersonator_id = target_id THEN
    RETURN FALSE;
  END IF;

  -- Get impersonator's hierarchy level
  impersonator_level := get_user_hierarchy_level(impersonator_id);

  -- Must be National Admin (6) or Super Admin (7)
  IF impersonator_level < 6 THEN
    RETURN FALSE;
  END IF;

  -- Get target's hierarchy level
  target_level := get_user_hierarchy_level(target_id);

  -- Can only impersonate users with lower hierarchy level
  IF target_level >= impersonator_level THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active impersonation session for an admin
CREATE OR REPLACE FUNCTION get_active_impersonation(p_admin_id UUID)
RETURNS TABLE (
  session_id UUID,
  target_user_id UUID,
  target_user_name TEXT,
  target_user_email TEXT,
  target_user_role TEXT,
  started_at TIMESTAMPTZ,
  timeout_minutes INTEGER,
  remaining_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.target_user_id,
    COALESCE(p.full_name, 'Unknown User') AS target_user_name,
    COALESCE(p.email, '') AS target_user_email,
    COALESCE(
      (
        SELECT r.name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = s.target_user_id
        ORDER BY r.hierarchy_level DESC
        LIMIT 1
      ),
      'Member'
    ) AS target_user_role,
    s.started_at,
    s.timeout_minutes,
    GREATEST(
      0,
      s.timeout_minutes - EXTRACT(EPOCH FROM (now() - s.started_at)) / 60
    )::INTEGER AS remaining_minutes
  FROM impersonation_sessions s
  LEFT JOIN profiles p ON s.target_user_id = p.id
  WHERE s.admin_id = p_admin_id
    AND s.ended_at IS NULL
    AND s.started_at + (s.timeout_minutes || ' minutes')::INTERVAL > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start impersonation session
CREATE OR REPLACE FUNCTION start_impersonation(
  p_admin_id UUID,
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_timeout_minutes INTEGER DEFAULT 30
) RETURNS UUID AS $$
DECLARE
  new_session_id UUID;
BEGIN
  -- Validate impersonation is allowed
  IF NOT can_impersonate_user(p_admin_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Not authorized to impersonate this user';
  END IF;

  -- End any existing active sessions for this admin
  UPDATE impersonation_sessions
  SET
    ended_at = now(),
    end_reason = 'new_session'
  WHERE admin_id = p_admin_id
    AND ended_at IS NULL;

  -- Create new session
  INSERT INTO impersonation_sessions (
    admin_id,
    target_user_id,
    reason,
    timeout_minutes
  ) VALUES (
    p_admin_id,
    p_target_user_id,
    p_reason,
    p_timeout_minutes
  ) RETURNING id INTO new_session_id;

  -- Update recent impersonations
  INSERT INTO admin_recent_impersonations (
    admin_id,
    target_user_id,
    last_impersonated_at,
    impersonation_count
  ) VALUES (
    p_admin_id,
    p_target_user_id,
    now(),
    1
  )
  ON CONFLICT (admin_id, target_user_id) DO UPDATE SET
    last_impersonated_at = now(),
    impersonation_count = admin_recent_impersonations.impersonation_count + 1;

  RETURN new_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End impersonation session
CREATE OR REPLACE FUNCTION end_impersonation(
  p_session_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT 'manual'
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE impersonation_sessions
  SET
    ended_at = now(),
    end_reason = p_reason
  WHERE id = p_session_id
    AND admin_id = p_admin_id
    AND ended_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log action during impersonation
CREATE OR REPLACE FUNCTION log_impersonation_action(
  p_session_id UUID,
  p_action_type TEXT,
  p_table_name TEXT,
  p_record_id UUID DEFAULT NULL,
  p_payload_summary JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  action_id UUID;
BEGIN
  INSERT INTO impersonation_action_log (
    session_id,
    action_type,
    table_name,
    record_id,
    payload_summary
  ) VALUES (
    p_session_id,
    p_action_type,
    p_table_name,
    p_record_id,
    p_payload_summary
  ) RETURNING id INTO action_id;

  -- Update action count in session
  UPDATE impersonation_sessions
  SET actions_taken = actions_taken + 1
  WHERE id = p_session_id;

  RETURN action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment page visit count
CREATE OR REPLACE FUNCTION increment_impersonation_page_visit(
  p_session_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE impersonation_sessions
  SET pages_visited = pages_visited + 1
  WHERE id = p_session_id
    AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent impersonations for quick access
CREATE OR REPLACE FUNCTION get_recent_impersonations(
  p_admin_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  target_user_id UUID,
  target_user_name TEXT,
  target_user_email TEXT,
  target_user_role TEXT,
  target_chapter_name TEXT,
  last_impersonated_at TIMESTAMPTZ,
  impersonation_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ri.target_user_id,
    COALESCE(p.full_name, 'Unknown User') AS target_user_name,
    COALESCE(p.email, '') AS target_user_email,
    COALESCE(
      (
        SELECT r.name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ri.target_user_id
        ORDER BY r.hierarchy_level DESC
        LIMIT 1
      ),
      'Member'
    ) AS target_user_role,
    COALESCE(c.name, 'No Chapter') AS target_chapter_name,
    ri.last_impersonated_at,
    ri.impersonation_count
  FROM admin_recent_impersonations ri
  LEFT JOIN profiles p ON ri.target_user_id = p.id
  LEFT JOIN members m ON ri.target_user_id = m.id
  LEFT JOIN chapters c ON m.chapter_id = c.id
  WHERE ri.admin_id = p_admin_id
  ORDER BY ri.last_impersonated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_recent_impersonations ENABLE ROW LEVEL SECURITY;

-- Impersonation sessions: Only National Admin+ can view all sessions
CREATE POLICY "National Admin can view impersonation sessions"
ON impersonation_sessions FOR SELECT
USING (get_user_hierarchy_level(auth.uid()) >= 6);

-- Only the impersonating admin can update their session
CREATE POLICY "Admin can update own impersonation session"
ON impersonation_sessions FOR UPDATE
USING (admin_id = auth.uid());

-- Only National Admin+ can start impersonation (via function, but need insert policy)
CREATE POLICY "National Admin can start impersonation"
ON impersonation_sessions FOR INSERT
WITH CHECK (
  get_user_hierarchy_level(auth.uid()) >= 6
  AND admin_id = auth.uid()
);

-- Action log: Only National Admin+ can view
CREATE POLICY "National Admin can view action log"
ON impersonation_action_log FOR SELECT
USING (
  get_user_hierarchy_level(auth.uid()) >= 6
);

-- Action log: Insert via function only
CREATE POLICY "System can insert action log"
ON impersonation_action_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM impersonation_sessions s
    WHERE s.id = session_id
    AND s.admin_id = auth.uid()
  )
);

-- Recent impersonations: Admin can manage their own
CREATE POLICY "Admin can view own recent impersonations"
ON admin_recent_impersonations FOR SELECT
USING (admin_id = auth.uid());

CREATE POLICY "Admin can insert own recent impersonations"
ON admin_recent_impersonations FOR INSERT
WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admin can update own recent impersonations"
ON admin_recent_impersonations FOR UPDATE
USING (admin_id = auth.uid());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE impersonation_sessions IS 'Tracks admin impersonation sessions for audit purposes';
COMMENT ON TABLE impersonation_action_log IS 'Immutable log of actions taken during impersonation';
COMMENT ON TABLE admin_recent_impersonations IS 'Quick access list of recently impersonated users per admin';

COMMENT ON FUNCTION can_impersonate_user IS 'Validates if an admin can impersonate a target user';
COMMENT ON FUNCTION get_active_impersonation IS 'Returns the current active impersonation session for an admin';
COMMENT ON FUNCTION start_impersonation IS 'Starts a new impersonation session, ending any existing ones';
COMMENT ON FUNCTION end_impersonation IS 'Ends an active impersonation session';
COMMENT ON FUNCTION log_impersonation_action IS 'Records an action taken during impersonation for audit';
