-- =============================================================================
-- Migration: yi_connect Phase E — Misc consolidated port
-- =============================================================================
-- Consolidates 10 misc public-schema migrations from origin/master into the
-- yi_connect schema:
--   1.  20260104000002_impersonation_system.sql
--   2.  20260125000001_add_director_chair_role.sql
--   3.  20260126000001_move_demo_accounts_to_yi_erode.sql
--   4.  20260206035218_fix_user_roles_rls_policies.sql
--   5.  20260207100000_add_get_user_roles_detailed_function.sql
--   6.  20260209123737_yi_creative_connections.sql
--   7.  20260210000001_add_can_manage_role_function.sql
--   8.  20260210000002_improve_role_management_constraints.sql
--   9.  20260315000001_oauth_state_store.sql
--   10. 20260315000002_atomic_payment_default.sql
--
-- All public.X references are dropped/unqualified. FKs to chapters go to
-- yi.chapters. auth.X references stay as-is.
-- =============================================================================

SET search_path TO yi_connect, public, extensions;

-- =============================================================================
-- PART 1 — IMPERSONATION SYSTEM (from 20260104000002)
-- =============================================================================

-- Tables -----------------------------------------------------------------------
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
  CONSTRAINT no_self_impersonation CHECK (admin_id != target_user_id)
);

CREATE TABLE IF NOT EXISTS impersonation_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES impersonation_sessions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'other')),
  table_name TEXT NOT NULL,
  record_id UUID,
  payload_summary JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_recent_impersonations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_impersonated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  impersonation_count INTEGER DEFAULT 1,
  UNIQUE(admin_id, target_user_id)
);

-- Indexes ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin
  ON impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target
  ON impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
  ON impersonation_sessions(ended_at) WHERE ended_at IS NULL;
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

-- Functions --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_impersonate_user(
  impersonator_id UUID,
  target_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  impersonator_level INTEGER;
  target_level INTEGER;
BEGIN
  IF impersonator_id = target_id THEN
    RETURN FALSE;
  END IF;
  impersonator_level := get_user_hierarchy_level(impersonator_id);
  IF impersonator_level < 6 THEN
    RETURN FALSE;
  END IF;
  target_level := get_user_hierarchy_level(target_id);
  IF target_level >= impersonator_level THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
      (SELECT r.name FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = s.target_user_id
        ORDER BY r.hierarchy_level DESC LIMIT 1),
      'Member'
    ) AS target_user_role,
    s.started_at,
    s.timeout_minutes,
    GREATEST(0, s.timeout_minutes - EXTRACT(EPOCH FROM (now() - s.started_at)) / 60)::INTEGER AS remaining_minutes
  FROM impersonation_sessions s
  LEFT JOIN profiles p ON s.target_user_id = p.id
  WHERE s.admin_id = p_admin_id
    AND s.ended_at IS NULL
    AND s.started_at + (s.timeout_minutes || ' minutes')::INTERVAL > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION start_impersonation(
  p_admin_id UUID,
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_timeout_minutes INTEGER DEFAULT 30
) RETURNS UUID AS $$
DECLARE
  new_session_id UUID;
BEGIN
  IF NOT can_impersonate_user(p_admin_id, p_target_user_id) THEN
    RAISE EXCEPTION 'Not authorized to impersonate this user';
  END IF;
  UPDATE impersonation_sessions
    SET ended_at = now(), end_reason = 'new_session'
    WHERE admin_id = p_admin_id AND ended_at IS NULL;
  INSERT INTO impersonation_sessions (admin_id, target_user_id, reason, timeout_minutes)
    VALUES (p_admin_id, p_target_user_id, p_reason, p_timeout_minutes)
    RETURNING id INTO new_session_id;
  INSERT INTO admin_recent_impersonations (admin_id, target_user_id, last_impersonated_at, impersonation_count)
    VALUES (p_admin_id, p_target_user_id, now(), 1)
    ON CONFLICT (admin_id, target_user_id) DO UPDATE SET
      last_impersonated_at = now(),
      impersonation_count = admin_recent_impersonations.impersonation_count + 1;
  RETURN new_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION end_impersonation(
  p_session_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT 'manual'
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE impersonation_sessions
    SET ended_at = now(), end_reason = p_reason
    WHERE id = p_session_id AND admin_id = p_admin_id AND ended_at IS NULL;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  INSERT INTO impersonation_action_log (session_id, action_type, table_name, record_id, payload_summary)
    VALUES (p_session_id, p_action_type, p_table_name, p_record_id, p_payload_summary)
    RETURNING id INTO action_id;
  UPDATE impersonation_sessions SET actions_taken = actions_taken + 1 WHERE id = p_session_id;
  RETURN action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_impersonation_page_visit(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE impersonation_sessions
    SET pages_visited = pages_visited + 1
    WHERE id = p_session_id AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_recent_impersonations(
  p_admin_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
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
      (SELECT r.name FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ri.target_user_id
        ORDER BY r.hierarchy_level DESC LIMIT 1),
      'Member'
    ) AS target_user_role,
    COALESCE(c.name, 'No Chapter') AS target_chapter_name,
    ri.last_impersonated_at,
    ri.impersonation_count
  FROM admin_recent_impersonations ri
  LEFT JOIN profiles p ON ri.target_user_id = p.id
  LEFT JOIN members m ON ri.target_user_id = m.id
  LEFT JOIN yi.chapters c ON m.chapter_id = c.id
  WHERE ri.admin_id = p_admin_id
  ORDER BY ri.last_impersonated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS --------------------------------------------------------------------------
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_recent_impersonations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "National Admin can view impersonation sessions" ON impersonation_sessions;
CREATE POLICY "National Admin can view impersonation sessions"
  ON impersonation_sessions FOR SELECT
  USING (get_user_hierarchy_level(auth.uid()) >= 6);

DROP POLICY IF EXISTS "Admin can update own impersonation session" ON impersonation_sessions;
CREATE POLICY "Admin can update own impersonation session"
  ON impersonation_sessions FOR UPDATE
  USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "National Admin can start impersonation" ON impersonation_sessions;
CREATE POLICY "National Admin can start impersonation"
  ON impersonation_sessions FOR INSERT
  WITH CHECK (get_user_hierarchy_level(auth.uid()) >= 6 AND admin_id = auth.uid());

DROP POLICY IF EXISTS "National Admin can view action log" ON impersonation_action_log;
CREATE POLICY "National Admin can view action log"
  ON impersonation_action_log FOR SELECT
  USING (get_user_hierarchy_level(auth.uid()) >= 6);

DROP POLICY IF EXISTS "System can insert action log" ON impersonation_action_log;
CREATE POLICY "System can insert action log"
  ON impersonation_action_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM impersonation_sessions s
      WHERE s.id = session_id AND s.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can view own recent impersonations" ON admin_recent_impersonations;
CREATE POLICY "Admin can view own recent impersonations"
  ON admin_recent_impersonations FOR SELECT
  USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Admin can insert own recent impersonations" ON admin_recent_impersonations;
CREATE POLICY "Admin can insert own recent impersonations"
  ON admin_recent_impersonations FOR INSERT
  WITH CHECK (admin_id = auth.uid());

DROP POLICY IF EXISTS "Admin can update own recent impersonations" ON admin_recent_impersonations;
CREATE POLICY "Admin can update own recent impersonations"
  ON admin_recent_impersonations FOR UPDATE
  USING (admin_id = auth.uid());

-- =============================================================================
-- PART 2 — DIRECTOR CHAIR ROLE (from 20260125000001)
-- =============================================================================
DO $$
DECLARE
  v_chair_role_id UUID;
  v_director_user_id UUID;
  v_erode_chapter_id UUID;
BEGIN
  SELECT id INTO v_chair_role_id FROM roles WHERE name = 'Chair' LIMIT 1;
  SELECT id INTO v_director_user_id FROM profiles WHERE email = 'director@jkkn.ac.in' LIMIT 1;
  SELECT id INTO v_erode_chapter_id FROM yi.chapters
    WHERE name ILIKE '%erode%' OR name ILIKE '%Yi Erode%' LIMIT 1;

  IF v_chair_role_id IS NULL THEN
    RAISE NOTICE 'Chair role not found — skipping director Chair assignment';
    RETURN;
  END IF;

  IF v_director_user_id IS NULL THEN
    RAISE NOTICE 'Director user not yet provisioned — Chair role will be assigned on first login via trigger.';
    RETURN;
  END IF;

  -- Idempotent profile chapter update
  IF v_erode_chapter_id IS NOT NULL THEN
    UPDATE profiles
      SET chapter_id = v_erode_chapter_id, updated_at = NOW()
      WHERE id = v_director_user_id
        AND (chapter_id IS NULL OR chapter_id != v_erode_chapter_id);
  END IF;

  INSERT INTO user_roles (user_id, role_id)
    VALUES (v_director_user_id, v_chair_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
END $$;

-- Trigger function to ensure director gets all 3 roles + Erode chapter on signup
CREATE OR REPLACE FUNCTION assign_director_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_super_admin_role_id UUID;
  v_national_admin_role_id UUID;
  v_chair_role_id UUID;
  v_erode_chapter_id UUID;
BEGIN
  IF NEW.email = 'director@jkkn.ac.in' THEN
    SELECT id INTO v_super_admin_role_id FROM roles WHERE name = 'Super Admin' LIMIT 1;
    SELECT id INTO v_national_admin_role_id FROM roles WHERE name = 'National Admin' LIMIT 1;
    SELECT id INTO v_chair_role_id FROM roles WHERE name = 'Chair' LIMIT 1;
    SELECT id INTO v_erode_chapter_id FROM yi.chapters
      WHERE name ILIKE '%erode%' OR name ILIKE '%Yi Erode%' LIMIT 1;

    IF v_super_admin_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
        VALUES (NEW.id, v_super_admin_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;

    IF v_national_admin_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
        VALUES (NEW.id, v_national_admin_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;

    IF v_chair_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
        VALUES (NEW.id, v_chair_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;

    IF v_erode_chapter_id IS NOT NULL THEN
      UPDATE profiles SET chapter_id = v_erode_chapter_id WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_director_super_admin() IS
  'Auto-assigns Super Admin, National Admin, and Chair roles to director@jkkn.ac.in on first login; sets chapter to Yi Erode.';

-- =============================================================================
-- PART 3 — MOVE DEMO ACCOUNTS TO YI ERODE (from 20260126000001)
-- Idempotent: UPDATEs are conditional, INSERTs use NOT EXISTS / ON CONFLICT.
-- =============================================================================
DO $$
DECLARE
  v_erode_chapter_id UUID;
  v_demo_emails TEXT[] := ARRAY[
    'demo-chair@yi-demo.com',
    'demo-cochair@yi-demo.com',
    'demo-ec@yi-demo.com'
  ];
BEGIN
  SELECT id INTO v_erode_chapter_id FROM yi.chapters
    WHERE name ILIKE '%erode%' LIMIT 1;

  IF v_erode_chapter_id IS NULL THEN
    RAISE NOTICE 'Yi Erode chapter not found — demo account move skipped.';
    RETURN;
  END IF;

  -- 1. approved_emails (only update rows not already correct)
  UPDATE approved_emails
    SET assigned_chapter_id = v_erode_chapter_id
    WHERE email = ANY(v_demo_emails)
      AND (assigned_chapter_id IS NULL OR assigned_chapter_id != v_erode_chapter_id);

  -- 2. profiles
  UPDATE profiles
    SET chapter_id = v_erode_chapter_id
    WHERE email = ANY(v_demo_emails)
      AND (chapter_id IS NULL OR chapter_id != v_erode_chapter_id);

  -- 3. existing members
  UPDATE members m
    SET chapter_id = v_erode_chapter_id
    FROM profiles p
    WHERE m.id = p.id
      AND p.email = ANY(v_demo_emails)
      AND (m.chapter_id IS NULL OR m.chapter_id != v_erode_chapter_id);

  -- 4. create member rows for profiles that have none
  INSERT INTO members (id, chapter_id, membership_status, member_since, is_active)
  SELECT p.id, v_erode_chapter_id, 'active', CURRENT_DATE, TRUE
  FROM profiles p
  WHERE p.email = ANY(v_demo_emails)
    AND NOT EXISTS (SELECT 1 FROM members m WHERE m.id = p.id)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- =============================================================================
-- PART 4 — FIX USER_ROLES RLS POLICIES (from 20260206035218)
-- =============================================================================
DROP POLICY IF EXISTS "User roles are manageable by Executive Members and above" ON user_roles;
DROP POLICY IF EXISTS "User roles insertable by Executive Members and above" ON user_roles;
DROP POLICY IF EXISTS "User roles updatable by Executive Members and above" ON user_roles;
DROP POLICY IF EXISTS "User roles deletable by Executive Members and above" ON user_roles;

CREATE POLICY "User roles insertable by Executive Members and above"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_user_hierarchy_level(auth.uid())) >= 5);

CREATE POLICY "User roles updatable by Executive Members and above"
  ON user_roles FOR UPDATE TO authenticated
  USING ((SELECT get_user_hierarchy_level(auth.uid())) >= 5)
  WITH CHECK ((SELECT get_user_hierarchy_level(auth.uid())) >= 5);

CREATE POLICY "User roles deletable by Executive Members and above"
  ON user_roles FOR DELETE TO authenticated
  USING ((SELECT get_user_hierarchy_level(auth.uid())) >= 5);

-- =============================================================================
-- PART 5 — get_user_roles_detailed (from 20260207100000)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_roles_detailed(p_user_id UUID)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  hierarchy_level INTEGER,
  permissions TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = yi_connect, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS role_id,
    r.name AS role_name,
    r.hierarchy_level,
    r.permissions
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
  ORDER BY r.hierarchy_level DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_roles_detailed(UUID) TO authenticated;
COMMENT ON FUNCTION get_user_roles_detailed IS 'Returns detailed role info for a user (SSO integration).';

-- =============================================================================
-- PART 6 — YI CREATIVE CONNECTIONS (from 20260209123737)
-- =============================================================================
CREATE TABLE IF NOT EXISTS yi_creative_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  organization_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  connected_by UUID NOT NULL REFERENCES profiles(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_secret TEXT,
  sso_private_key TEXT,
  sso_public_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_yi_creative_connections_chapter_id
  ON yi_creative_connections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_yi_creative_connections_status
  ON yi_creative_connections(status);

ALTER TABLE yi_creative_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chapter admins can view own connection" ON yi_creative_connections;
CREATE POLICY "Chapter admins can view own connection"
  ON yi_creative_connections FOR SELECT
  USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

DROP POLICY IF EXISTS "Chapter chair can create connection" ON yi_creative_connections;
CREATE POLICY "Chapter chair can create connection"
  ON yi_creative_connections FOR INSERT
  WITH CHECK (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

DROP POLICY IF EXISTS "Chapter chair can update connection" ON yi_creative_connections;
CREATE POLICY "Chapter chair can update connection"
  ON yi_creative_connections FOR UPDATE
  USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND get_user_hierarchy_level(auth.uid()) >= 4
  )
  WITH CHECK (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

DROP POLICY IF EXISTS "Chapter chair can delete connection" ON yi_creative_connections;
CREATE POLICY "Chapter chair can delete connection"
  ON yi_creative_connections FOR DELETE
  USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

DROP POLICY IF EXISTS "Super admin can manage all connections" ON yi_creative_connections;
CREATE POLICY "Super admin can manage all connections"
  ON yi_creative_connections FOR ALL
  USING (get_user_hierarchy_level(auth.uid()) >= 6)
  WITH CHECK (get_user_hierarchy_level(auth.uid()) >= 6);

DROP TRIGGER IF EXISTS trigger_yi_creative_connections_updated_at ON yi_creative_connections;
CREATE TRIGGER trigger_yi_creative_connections_updated_at
  BEFORE UPDATE ON yi_creative_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PART 7 — can_manage_role (from 20260210000001)
-- =============================================================================
CREATE OR REPLACE FUNCTION can_manage_role(
  manager_id UUID,
  target_role_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_manager_level INTEGER;
  v_target_role_level INTEGER;
BEGIN
  IF manager_id IS NULL OR target_role_id IS NULL THEN
    RETURN FALSE;
  END IF;
  v_manager_level := get_user_hierarchy_level(manager_id);
  SELECT hierarchy_level INTO v_target_role_level FROM roles WHERE id = target_role_id;
  IF v_target_role_level IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN v_manager_level > v_target_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION can_manage_role(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION can_manage_role IS 'Checks if manager can assign/remove target role based on hierarchy.';

-- =============================================================================
-- PART 8 — ROLE MANAGEMENT CONSTRAINTS (from 20260210000002)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_unique_user_role'
      AND conrelid = 'yi_connect.user_roles'::regclass
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_unique_user_role UNIQUE (user_id, role_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_self_demotion()
RETURNS TRIGGER AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  IF OLD.user_id = auth.uid() THEN
    SELECT name INTO v_role_name FROM roles WHERE id = OLD.role_id;
    IF v_role_name = 'Super Admin' THEN
      RAISE EXCEPTION 'Cannot remove your own Super Admin role. This is a security protection.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_self_demotion ON user_roles;
CREATE TRIGGER check_self_demotion
  BEFORE DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_demotion();

COMMENT ON FUNCTION prevent_self_demotion IS 'Prevents users from removing their own Super Admin role.';
COMMENT ON TRIGGER check_self_demotion ON user_roles IS 'Enforces self-demotion prevention.';

-- Seed Super Admin role
INSERT INTO roles (name, description, hierarchy_level, permissions, created_at)
VALUES (
  'Super Admin',
  'System super administrator with unrestricted access to all features and settings',
  7,
  ARRAY['ALL', 'manage_system', 'manage_roles', 'manage_users', 'manage_chapters',
        'manage_settings', 'view_audit_logs', 'manage_integrations'],
  NOW()
)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    hierarchy_level = EXCLUDED.hierarchy_level,
    permissions = EXCLUDED.permissions;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

GRANT EXECUTE ON FUNCTION prevent_self_demotion() TO authenticated;

-- =============================================================================
-- PART 9 — OAUTH STATE STORE (from 20260315000001)
-- =============================================================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_nonce ON oauth_states(nonce);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own oauth states" ON oauth_states;
CREATE POLICY "Users can insert own oauth states"
  ON oauth_states FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own oauth states" ON oauth_states;
CREATE POLICY "Users can read own oauth states"
  ON oauth_states FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own oauth states" ON oauth_states;
CREATE POLICY "Users can delete own oauth states"
  ON oauth_states FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM oauth_states WHERE expires_at < NOW();
$$;

COMMENT ON TABLE oauth_states IS 'Stores OAuth state for Yi Creative Studio connection flow. States expire after 10 minutes.';

-- =============================================================================
-- PART 10 — ATOMIC PAYMENT METHOD DEFAULT (from 20260315000002)
-- =============================================================================
CREATE OR REPLACE FUNCTION set_default_payment_method(
  p_method_id UUID,
  p_chapter_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE payment_methods
    SET is_default = (id = p_method_id)
    WHERE chapter_id = p_chapter_id
      AND is_active = true;
END;
$$;

COMMENT ON FUNCTION set_default_payment_method IS
  'Atomically sets a payment method as the default for a chapter, unsetting all others in one operation.';

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
