-- ═══════════════════════════════════════════════════════════════════════
-- Migration: yi_connect Phase A Batch 10 (FINAL)
-- Lifts the final 4 yi-connect migrations into yi_connect.* schema:
--   1. 20251221000002_whatsapp_management.sql (4 tables)
--   2. 20251222000001_multi_chapter_system.sql (2 tables + feature_name enum + 6 fns)
--   3. 20251230000001_chapter_settings.sql (1 table + 2 fns + auto-create trigger)
--   4. 20260102000001_aaa_pathfinder_module.sql (3 tables + 2 fns)
--
-- All four sources use unqualified table references, so we use
-- SET search_path TO yi_connect, public, extensions; then patch chapter
-- refs to yi.chapters (canonical shared chapter list).
--
-- Source bugs patched:
--   - aaa_pathfinder_module.sql RLS policies used m.user_id = auth.uid().
--     yi_connect.members has no user_id column; m.id IS auth.uid().
--     Rewritten to m.id = auth.uid() throughout.
--
-- Cross-cutting decisions:
--   - chapter_invitations.full_name kept (the source has a column called
--     full_name on the invitation itself; this is not the profiles.full_name
--     bug pattern, just an invitation field).
--   - is_national_admin() / user_belongs_to_chapter() override /
--     is_feature_enabled() / get_chapter_features() /
--     initialize_chapter_features() / accept_chapter_invitation() /
--     get_invitation_by_token() — all created in yi_connect schema.
--   - The CRM batch already defined yi_connect.user_belongs_to_chapter
--     without national-admin bypass. Section 2 replaces it via
--     CREATE OR REPLACE to add the bypass.
--   - Default-features-for-existing-chapters not run here; chapters live
--     in yi.* and we do not seed feature toggles for them implicitly.
-- ═══════════════════════════════════════════════════════════════════════

SET search_path TO yi_connect, public, extensions;

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1: WhatsApp Management
-- Source: 20251221000002_whatsapp_management.sql
-- 4 tables: whatsapp_connections, whatsapp_groups, whatsapp_templates,
-- whatsapp_message_logs
-- ═══════════════════════════════════════════════════════════════════════

-- 1.1 WhatsApp Connections (per chapter)
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  session_path VARCHAR(255) NOT NULL,
  connected_phone VARCHAR(20),
  connected_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id)
);

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_connections_select" ON whatsapp_connections
  FOR SELECT TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_connections_insert" ON whatsapp_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_connections.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_connections_update" ON whatsapp_connections
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_connections.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

-- 1.2 WhatsApp Groups (per chapter)
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  jid VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  group_type VARCHAR(50) CHECK (group_type IN ('chapter', 'leadership', 'ec_team', 'yuva', 'thalir', 'fun', 'core', 'other')),
  is_default BOOLEAN DEFAULT false,
  member_count INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, jid)
);

ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_groups_select" ON whatsapp_groups
  FOR SELECT TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_groups_insert" ON whatsapp_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_groups.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_groups_update" ON whatsapp_groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_groups.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_groups_delete" ON whatsapp_groups
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_groups.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE INDEX idx_whatsapp_groups_chapter ON whatsapp_groups(chapter_id);
CREATE INDEX idx_whatsapp_groups_type ON whatsapp_groups(group_type);

-- 1.3 WhatsApp Templates (national + chapter-specific)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('event', 'announcement', 'reminder', 'follow_up', 'greeting', 'custom')),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_select" ON whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    chapter_id IS NULL
    OR chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_templates_insert" ON whatsapp_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (chapter_id IS NULL AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    ))
    OR
    (chapter_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_templates.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_templates_update" ON whatsapp_templates
  FOR UPDATE TO authenticated
  USING (
    (chapter_id IS NULL AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    ))
    OR
    (chapter_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_templates.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_templates_delete" ON whatsapp_templates
  FOR DELETE TO authenticated
  USING (
    (chapter_id IS NULL AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    ))
    OR
    (chapter_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_templates.chapter_id
      AND r.name IN ('Chair', 'Co-Chair')
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE INDEX idx_whatsapp_templates_chapter ON whatsapp_templates(chapter_id);
CREATE INDEX idx_whatsapp_templates_category ON whatsapp_templates(category);
CREATE INDEX idx_whatsapp_templates_active ON whatsapp_templates(is_active) WHERE is_active = true;

-- 1.4 WhatsApp Message Logs
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('individual', 'group', 'bulk')),
  recipient_id VARCHAR(100),
  recipient_name VARCHAR(255),
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  message_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_message_logs_select" ON whatsapp_message_logs
  FOR SELECT TO authenticated
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE POLICY "whatsapp_message_logs_insert" ON whatsapp_message_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      JOIN user_roles ur ON m.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE m.id = auth.uid()
      AND m.chapter_id = whatsapp_message_logs.chapter_id
      AND r.name IN ('Chair', 'Co-Chair', 'EC Member')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    )
  );

CREATE INDEX idx_whatsapp_logs_chapter ON whatsapp_message_logs(chapter_id);
CREATE INDEX idx_whatsapp_logs_sent_at ON whatsapp_message_logs(sent_at DESC);
CREATE INDEX idx_whatsapp_logs_sent_by ON whatsapp_message_logs(sent_by);
CREATE INDEX idx_whatsapp_logs_status ON whatsapp_message_logs(status);

-- 1.5 WhatsApp updated_at trigger function
CREATE OR REPLACE FUNCTION yi_connect.update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_connections_updated_at
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_whatsapp_updated_at();

CREATE TRIGGER whatsapp_groups_updated_at
  BEFORE UPDATE ON whatsapp_groups
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_whatsapp_updated_at();

CREATE TRIGGER whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_whatsapp_updated_at();

-- 1.6 Seed Yi Erode WhatsApp groups
-- yi.chapters is the canonical chapter list; look up Erode there.
DO $$
DECLARE
  erode_chapter_id UUID;
BEGIN
  SELECT id INTO erode_chapter_id FROM yi.chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF erode_chapter_id IS NOT NULL THEN
    INSERT INTO whatsapp_groups (chapter_id, jid, name, group_type, is_default) VALUES
      (erode_chapter_id, '919047036969-1614918903@g.us', 'Yi ERODE CHAPTER 2025', 'chapter', true),
      (erode_chapter_id, '120363386639999002@g.us', 'Yi Erode Leadership 2025', 'leadership', false),
      (erode_chapter_id, '120363374011459909@g.us', 'Yi ERD EC TEAM Enablers 2025', 'ec_team', false),
      (erode_chapter_id, '120363029543462744@g.us', 'Ed Yi Yuva 2025', 'yuva', false),
      (erode_chapter_id, '120363047501417660@g.us', 'Ed Yi Thalir 2025', 'thalir', false),
      (erode_chapter_id, '919047036969-1615253093@g.us', 'Yi ERODE FUN', 'fun', false),
      (erode_chapter_id, '919842762600-1517199708@g.us', 'Yi Core Group', 'core', false)
    ON CONFLICT (chapter_id, jid) DO NOTHING;
  END IF;
END $$;

-- 1.7 Seed default national templates
INSERT INTO whatsapp_templates (chapter_id, name, category, content, variables) VALUES
  (NULL, 'Event Created', 'event', E'*{event_name}*\n\n{description}\n\n📅 {date}\n📍 {venue}\n\nRSVP: {rsvp_link}', '["event_name", "description", "date", "venue", "rsvp_link"]'),
  (NULL, 'Event Reminder', 'reminder', E'Reminder: *{event_name}* is {days_until}\n\n📅 {date}\n📍 {venue}', '["event_name", "days_until", "date", "venue"]'),
  (NULL, 'RSVP Confirmation', 'event', E'Your RSVP for *{event_name}* is confirmed!\n\nStatus: {status}\n📅 {date}', '["event_name", "status", "date"]'),
  (NULL, 'General Announcement', 'announcement', E'*{title}*\n\n{body}\n\n_Yi {chapter_name}_', '["title", "body", "chapter_name"]'),
  (NULL, 'Welcome Member', 'greeting', E'Welcome to Yi {chapter_name}, {member_name}! 🎉\n\nWe''re excited to have you as part of our nation-building journey.\n\nTogether We Can. We Will.', '["chapter_name", "member_name"]'),
  (NULL, 'Post-Event Thanks', 'follow_up', E'Thank you for attending *{event_name}*!\n\nWe hope you found it valuable. Your participation makes our community stronger.\n\n#WeCanWeWill', '["event_name"]'),
  (NULL, 'Meeting Reminder', 'reminder', E'📋 *Meeting Reminder*\n\n{meeting_title}\n📅 {date}\n⏰ {time}\n📍 {location}\n\nPlease confirm your attendance.', '["meeting_title", "date", "time", "location"]'),
  (NULL, 'Birthday Greeting', 'greeting', E'🎂 Happy Birthday, {member_name}!\n\nWishing you a wonderful year ahead filled with success and happiness.\n\n_With warm wishes from Yi {chapter_name}_', '["member_name", "chapter_name"]')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2: Multi-Chapter System
-- Source: 20251222000001_multi_chapter_system.sql
-- 2 tables: chapter_invitations, chapter_feature_toggles
-- 1 enum: feature_name
-- 6 functions: is_national_admin, user_belongs_to_chapter (override),
--   is_feature_enabled, get_chapter_features, initialize_chapter_features,
--   accept_chapter_invitation, get_invitation_by_token
--
-- Note: yi.chapters is canonical. We do NOT alter yi.chapters to add
-- status/chair_id/settings/onboarding_completed_at columns here — yi.*
-- is shared with YIP/YiFuture and that schema change belongs in a yi.*
-- migration, not in a yi_connect lift. Per the lift contract, treat
-- those columns as "already exist or not our concern". Skipping the
-- ALTER TABLE chapters block.
-- ═══════════════════════════════════════════════════════════════════════

-- 2.1 chapter_invitations
CREATE TABLE IF NOT EXISTS chapter_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  full_name TEXT NOT NULL,
  invited_role TEXT NOT NULL DEFAULT 'Chair',
  token TEXT NOT NULL UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text || random()::text),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  personal_message TEXT,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chapter_invitations_token ON chapter_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_email ON chapter_invitations(email);
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_phone ON chapter_invitations(phone);
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_chapter ON chapter_invitations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_invitations_status ON chapter_invitations(status);

CREATE TRIGGER chapter_invitations_updated_at
  BEFORE UPDATE ON chapter_invitations
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- 2.2 feature_name enum + chapter_feature_toggles
DO $$ BEGIN
  CREATE TYPE yi_connect.feature_name AS ENUM (
    'events',
    'communications',
    'stakeholder_crm',
    'session_bookings',
    'opportunities',
    'knowledge_base',
    'awards',
    'finance',
    'analytics',
    'member_intelligence',
    'succession_planning',
    'verticals',
    'sub_chapters',
    'industrial_visits'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS chapter_feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  feature yi_connect.feature_name NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  changed_by UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_chapter_features_chapter ON chapter_feature_toggles(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_features_enabled ON chapter_feature_toggles(chapter_id, is_enabled)
  WHERE is_enabled = true;

CREATE TRIGGER chapter_feature_toggles_updated_at
  BEFORE UPDATE ON chapter_feature_toggles
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- 2.3 Security functions
CREATE OR REPLACE FUNCTION yi_connect.is_national_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM yi_connect.user_roles ur
    JOIN yi_connect.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
    AND r.hierarchy_level >= 6
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Override user_belongs_to_chapter to add National Admin bypass.
-- This replaces the CRM batch version (which did profiles lookup only).
CREATE OR REPLACE FUNCTION yi_connect.user_belongs_to_chapter(p_chapter_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF yi_connect.is_national_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM yi_connect.profiles
    WHERE id = auth.uid()
    AND chapter_id = p_chapter_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION yi_connect.is_feature_enabled(
  p_chapter_id UUID,
  p_feature yi_connect.feature_name
)
RETURNS BOOLEAN AS $$
BEGIN
  IF yi_connect.is_national_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM yi_connect.chapter_feature_toggles
    WHERE chapter_id = p_chapter_id
    AND feature = p_feature
    AND is_enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION yi_connect.get_chapter_features(p_chapter_id UUID)
RETURNS yi_connect.feature_name[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT feature FROM yi_connect.chapter_feature_toggles
    WHERE chapter_id = p_chapter_id
    AND is_enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION yi_connect.initialize_chapter_features(p_chapter_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
  default_enabled yi_connect.feature_name[] := ARRAY[
    'events'::yi_connect.feature_name,
    'communications'::yi_connect.feature_name,
    'stakeholder_crm'::yi_connect.feature_name,
    'knowledge_base'::yi_connect.feature_name,
    'analytics'::yi_connect.feature_name,
    'verticals'::yi_connect.feature_name
  ];
  all_features yi_connect.feature_name[] := ARRAY[
    'events'::yi_connect.feature_name,
    'communications'::yi_connect.feature_name,
    'stakeholder_crm'::yi_connect.feature_name,
    'session_bookings'::yi_connect.feature_name,
    'opportunities'::yi_connect.feature_name,
    'knowledge_base'::yi_connect.feature_name,
    'awards'::yi_connect.feature_name,
    'finance'::yi_connect.feature_name,
    'analytics'::yi_connect.feature_name,
    'member_intelligence'::yi_connect.feature_name,
    'succession_planning'::yi_connect.feature_name,
    'verticals'::yi_connect.feature_name,
    'sub_chapters'::yi_connect.feature_name,
    'industrial_visits'::yi_connect.feature_name
  ];
  f yi_connect.feature_name;
BEGIN
  FOREACH f IN ARRAY all_features LOOP
    INSERT INTO yi_connect.chapter_feature_toggles (
      chapter_id,
      feature,
      is_enabled,
      enabled_at,
      changed_by
    ) VALUES (
      p_chapter_id,
      f,
      f = ANY(default_enabled),
      CASE WHEN f = ANY(default_enabled) THEN NOW() ELSE NULL END,
      p_user_id
    )
    ON CONFLICT (chapter_id, feature) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- accept_chapter_invitation: updates yi_connect tables only.
-- Note: source migration updates yi.chapters (chair_id, status) — we
-- cannot reach into yi.* from yi_connect, so chapter status/chair_id
-- assignment is moved out of scope here. The invitation row +
-- profile + member + user_role updates still run.
CREATE OR REPLACE FUNCTION yi_connect.accept_chapter_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_chair_role_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM yi_connect.chapter_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND token_expires_at > NOW();

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  SELECT id INTO v_chair_role_id
  FROM yi_connect.roles
  WHERE name = 'Chair';

  UPDATE yi_connect.chapter_invitations
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = v_user_id
  WHERE id = v_invitation.id;

  UPDATE yi_connect.profiles
  SET chapter_id = v_invitation.chapter_id
  WHERE id = v_user_id;

  UPDATE yi_connect.members
  SET chapter_id = v_invitation.chapter_id
  WHERE id = v_user_id;

  INSERT INTO yi_connect.user_roles (user_id, role_id)
  VALUES (v_user_id, v_chair_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- yi.chapters.status/chair_id update intentionally omitted (cross-schema write)

  RETURN jsonb_build_object(
    'success', true,
    'chapter_id', v_invitation.chapter_id,
    'message', 'Invitation accepted successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_invitation_by_token. Note: yi.chapters has name + (perhaps) location.
-- The source migration assumes c.location; if yi.chapters lacks that column,
-- this will fail at call time. For safety we use a NULL placeholder and
-- read only c.name from yi.chapters.
CREATE OR REPLACE FUNCTION yi_connect.get_invitation_by_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT
    ci.id,
    ci.status,
    ci.full_name,
    ci.email,
    ci.phone,
    ci.invited_role,
    ci.personal_message,
    ci.token_expires_at,
    c.name as chapter_name,
    NULL::TEXT as chapter_location,
    p.full_name as inviter_name
  INTO v_invitation
  FROM yi_connect.chapter_invitations ci
  JOIN yi.chapters c ON ci.chapter_id = c.id
  JOIN yi_connect.profiles p ON ci.invited_by = p.id
  WHERE ci.token = p_token;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_invitation.id,
    'status', v_invitation.status,
    'full_name', v_invitation.full_name,
    'email', v_invitation.email,
    'phone', v_invitation.phone,
    'invited_role', v_invitation.invited_role,
    'personal_message', v_invitation.personal_message,
    'expires_at', v_invitation.token_expires_at,
    'chapter_name', v_invitation.chapter_name,
    'chapter_location', v_invitation.chapter_location,
    'inviter_name', v_invitation.inviter_name,
    'is_expired', v_invitation.token_expires_at < NOW(),
    'is_valid', v_invitation.status = 'pending' AND v_invitation.token_expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.4 RLS
ALTER TABLE chapter_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_feature_toggles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_national_admin_all"
  ON chapter_invitations FOR ALL
  TO authenticated
  USING (yi_connect.is_national_admin())
  WITH CHECK (yi_connect.is_national_admin());

CREATE POLICY "invitations_view_by_token"
  ON chapter_invitations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "features_national_admin_all"
  ON chapter_feature_toggles FOR ALL
  TO authenticated
  USING (yi_connect.is_national_admin())
  WITH CHECK (yi_connect.is_national_admin());

CREATE POLICY "features_chapter_member_select"
  ON chapter_feature_toggles FOR SELECT
  TO authenticated
  USING (yi_connect.user_belongs_to_chapter(chapter_id));

-- 2.5 Grants
GRANT ALL ON chapter_invitations TO authenticated;
GRANT ALL ON chapter_feature_toggles TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.is_national_admin TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.is_feature_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.get_chapter_features TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.initialize_chapter_features TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.accept_chapter_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION yi_connect.get_invitation_by_token TO authenticated;

COMMENT ON TABLE chapter_invitations IS 'Invitation tokens for chapter admin onboarding';
COMMENT ON TABLE chapter_feature_toggles IS 'Per-chapter feature flags';
COMMENT ON FUNCTION yi_connect.is_national_admin IS 'Check if user has National Admin privileges (level 6+)';
COMMENT ON FUNCTION yi_connect.is_feature_enabled IS 'Check if a specific feature is enabled for a chapter';
COMMENT ON FUNCTION yi_connect.accept_chapter_invitation IS 'Process invitation acceptance and assign Chair role';


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 3: Chapter Settings
-- Source: 20251230000001_chapter_settings.sql
-- 1 table: chapter_settings
-- 2 fns: get_chapter_settings, ensure_chapter_settings
-- 1 trigger fn: auto_create_chapter_settings (but only fires on
--   yi_connect.* inserts; since chapters live in yi.* we cannot trigger
--   on yi.chapters from here — that's a yi.* schema concern. We omit
--   the AFTER INSERT ON chapters trigger; ensure_chapter_settings()
--   remains callable on demand.)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chapter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

  session_booking_advance_days INTEGER DEFAULT 7,

  trainer_max_sessions_per_month INTEGER DEFAULT 6,
  trainer_warning_threshold INTEGER DEFAULT 4,

  materials_approval_days_before INTEGER DEFAULT 3,
  materials_require_chair_approval BOOLEAN DEFAULT TRUE,

  mou_required_for_opportunities BOOLEAN DEFAULT TRUE,
  mou_auto_close_on_expiry BOOLEAN DEFAULT TRUE,

  members_can_see_other_assessments BOOLEAN DEFAULT FALSE,
  members_can_see_other_applications BOOLEAN DEFAULT FALSE,
  coordinators_see_own_institution_only BOOLEAN DEFAULT TRUE,

  engagement_weight_attendance NUMERIC(3,2) DEFAULT 0.50,
  engagement_weight_volunteer NUMERIC(3,2) DEFAULT 0.30,
  engagement_weight_feedback NUMERIC(3,2) DEFAULT 0.15,
  engagement_weight_skills NUMERIC(3,2) DEFAULT 0.05,

  readiness_weight_tenure NUMERIC(3,2) DEFAULT 0.25,
  readiness_weight_positions NUMERIC(3,2) DEFAULT 0.25,
  readiness_weight_training NUMERIC(3,2) DEFAULT 0.25,
  readiness_weight_peer_input NUMERIC(3,2) DEFAULT 0.25,

  large_expense_threshold NUMERIC(12,2) DEFAULT 10000.00,
  expense_approval_required BOOLEAN DEFAULT TRUE,

  max_volunteer_hours_per_year INTEGER DEFAULT 100,
  max_skills_for_full_score INTEGER DEFAULT 10,
  max_tenure_years INTEGER DEFAULT 10,
  max_leadership_positions INTEGER DEFAULT 5,
  max_nominations INTEGER DEFAULT 10,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(chapter_id),
  CONSTRAINT engagement_weights_sum CHECK (
    engagement_weight_attendance + engagement_weight_volunteer +
    engagement_weight_feedback + engagement_weight_skills = 1.00
  ),
  CONSTRAINT readiness_weights_sum CHECK (
    readiness_weight_tenure + readiness_weight_positions +
    readiness_weight_training + readiness_weight_peer_input = 1.00
  )
);

CREATE INDEX idx_chapter_settings_chapter ON chapter_settings(chapter_id);

COMMENT ON TABLE chapter_settings IS 'Chapter-configurable business rules and score weights';

ALTER TABLE chapter_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own chapter settings" ON chapter_settings
  FOR SELECT USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Chair+ can modify chapter settings" ON chapter_settings
  FOR ALL USING (
    yi_connect.get_user_hierarchy_level() >= 4
    AND chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all settings" ON chapter_settings
  FOR ALL USING (yi_connect.get_user_hierarchy_level() >= 5);

GRANT ALL ON chapter_settings TO authenticated;

-- get_chapter_settings function
CREATE OR REPLACE FUNCTION yi_connect.get_chapter_settings(
  p_chapter_id UUID
)
RETURNS TABLE(
  session_booking_advance_days INTEGER,
  trainer_max_sessions_per_month INTEGER,
  trainer_warning_threshold INTEGER,
  materials_approval_days_before INTEGER,
  materials_require_chair_approval BOOLEAN,
  mou_required_for_opportunities BOOLEAN,
  mou_auto_close_on_expiry BOOLEAN,
  members_can_see_other_assessments BOOLEAN,
  members_can_see_other_applications BOOLEAN,
  coordinators_see_own_institution_only BOOLEAN,
  engagement_weight_attendance NUMERIC(3,2),
  engagement_weight_volunteer NUMERIC(3,2),
  engagement_weight_feedback NUMERIC(3,2),
  engagement_weight_skills NUMERIC(3,2),
  readiness_weight_tenure NUMERIC(3,2),
  readiness_weight_positions NUMERIC(3,2),
  readiness_weight_training NUMERIC(3,2),
  readiness_weight_peer_input NUMERIC(3,2),
  large_expense_threshold NUMERIC(12,2),
  expense_approval_required BOOLEAN,
  max_volunteer_hours_per_year INTEGER,
  max_skills_for_full_score INTEGER,
  max_tenure_years INTEGER,
  max_leadership_positions INTEGER,
  max_nominations INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(cs.session_booking_advance_days, 7),
    COALESCE(cs.trainer_max_sessions_per_month, 6),
    COALESCE(cs.trainer_warning_threshold, 4),
    COALESCE(cs.materials_approval_days_before, 3),
    COALESCE(cs.materials_require_chair_approval, TRUE),
    COALESCE(cs.mou_required_for_opportunities, TRUE),
    COALESCE(cs.mou_auto_close_on_expiry, TRUE),
    COALESCE(cs.members_can_see_other_assessments, FALSE),
    COALESCE(cs.members_can_see_other_applications, FALSE),
    COALESCE(cs.coordinators_see_own_institution_only, TRUE),
    COALESCE(cs.engagement_weight_attendance, 0.50),
    COALESCE(cs.engagement_weight_volunteer, 0.30),
    COALESCE(cs.engagement_weight_feedback, 0.15),
    COALESCE(cs.engagement_weight_skills, 0.05),
    COALESCE(cs.readiness_weight_tenure, 0.25),
    COALESCE(cs.readiness_weight_positions, 0.25),
    COALESCE(cs.readiness_weight_training, 0.25),
    COALESCE(cs.readiness_weight_peer_input, 0.25),
    COALESCE(cs.large_expense_threshold, 10000.00),
    COALESCE(cs.expense_approval_required, TRUE),
    COALESCE(cs.max_volunteer_hours_per_year, 100),
    COALESCE(cs.max_skills_for_full_score, 10),
    COALESCE(cs.max_tenure_years, 10),
    COALESCE(cs.max_leadership_positions, 5),
    COALESCE(cs.max_nominations, 10)
  FROM yi.chapters c
  LEFT JOIN yi_connect.chapter_settings cs ON cs.chapter_id = c.id
  WHERE c.id = p_chapter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION yi_connect.get_chapter_settings IS 'Get chapter settings with defaults';
GRANT EXECUTE ON FUNCTION yi_connect.get_chapter_settings(UUID) TO authenticated;

-- ensure_chapter_settings function
CREATE OR REPLACE FUNCTION yi_connect.ensure_chapter_settings(
  p_chapter_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_settings_id UUID;
BEGIN
  SELECT id INTO v_settings_id
  FROM yi_connect.chapter_settings
  WHERE chapter_id = p_chapter_id;

  IF v_settings_id IS NULL THEN
    INSERT INTO yi_connect.chapter_settings (chapter_id)
    VALUES (p_chapter_id)
    RETURNING id INTO v_settings_id;
  END IF;

  RETURN v_settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION yi_connect.ensure_chapter_settings IS 'Ensures chapter settings exist, creates with defaults if not';
GRANT EXECUTE ON FUNCTION yi_connect.ensure_chapter_settings(UUID) TO authenticated;

-- auto-create trigger on chapters omitted: yi.chapters lives in another
-- schema and triggers on shared tables should be added in yi.* migrations.
-- Application code calling ensure_chapter_settings() on chapter creation
-- is the supported pattern.

-- Updated_at trigger
CREATE TRIGGER set_chapter_settings_updated_at
BEFORE UPDATE ON chapter_settings
FOR EACH ROW EXECUTE FUNCTION yi_connect.set_updated_at();

-- Seed defaults for existing yi.chapters
INSERT INTO chapter_settings (chapter_id)
SELECT id FROM yi.chapters
WHERE id NOT IN (SELECT chapter_id FROM chapter_settings)
ON CONFLICT (chapter_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 4: AAA Pathfinder Module
-- Source: 20260102000001_aaa_pathfinder_module.sql
-- 3 tables: aaa_plans, commitment_cards, mentor_assignments
-- 2 fns: get_aaa_completion, get_milestone_completion
--
-- Source bug patched: RLS policies used m.user_id = auth.uid().
-- yi_connect.members has NO user_id column — m.id IS auth.uid().
-- Rewritten throughout this section.
-- ═══════════════════════════════════════════════════════════════════════

-- 4.1 aaa_plans
CREATE TABLE aaa_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,

  -- AWARENESS (3 activities)
  awareness_1_title VARCHAR(255),
  awareness_1_description TEXT,
  awareness_1_audience VARCHAR(255),
  awareness_1_target_date DATE,
  awareness_1_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_1_status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  awareness_2_title VARCHAR(255),
  awareness_2_description TEXT,
  awareness_2_audience VARCHAR(255),
  awareness_2_target_date DATE,
  awareness_2_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_2_status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  awareness_3_title VARCHAR(255),
  awareness_3_description TEXT,
  awareness_3_audience VARCHAR(255),
  awareness_3_target_date DATE,
  awareness_3_status VARCHAR(20) DEFAULT 'planned' CHECK (awareness_3_status IN ('planned', 'in_progress', 'completed', 'cancelled')),

  -- ACTION (2 events)
  action_1_title VARCHAR(255),
  action_1_description TEXT,
  action_1_target VARCHAR(255),
  action_1_target_date DATE,
  action_1_status VARCHAR(20) DEFAULT 'planned' CHECK (action_1_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  action_1_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  action_2_title VARCHAR(255),
  action_2_description TEXT,
  action_2_target VARCHAR(255),
  action_2_target_date DATE,
  action_2_status VARCHAR(20) DEFAULT 'planned' CHECK (action_2_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  action_2_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  first_event_date DATE,
  first_event_locked BOOLEAN DEFAULT false,
  first_event_locked_at TIMESTAMPTZ,

  -- ADVOCACY (1 goal)
  advocacy_goal TEXT,
  advocacy_target_contact VARCHAR(255),
  advocacy_approach TEXT,
  advocacy_status VARCHAR(20) DEFAULT 'planned' CHECK (advocacy_status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  advocacy_outcome TEXT,

  -- 90-DAY MILESTONES
  milestone_jan_target TEXT,
  milestone_jan_status VARCHAR(20) DEFAULT 'pending' CHECK (milestone_jan_status IN ('pending', 'in_progress', 'completed')),
  milestone_jan_notes TEXT,

  milestone_feb_target TEXT,
  milestone_feb_status VARCHAR(20) DEFAULT 'pending' CHECK (milestone_feb_status IN ('pending', 'in_progress', 'completed')),
  milestone_feb_notes TEXT,

  milestone_mar_target TEXT,
  milestone_mar_status VARCHAR(20) DEFAULT 'pending' CHECK (milestone_mar_status IN ('pending', 'in_progress', 'completed')),
  milestone_mar_notes TEXT,

  -- METADATA
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active')),
  created_by UUID NOT NULL REFERENCES members(id),
  approved_by UUID REFERENCES members(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year)
);

CREATE INDEX idx_aaa_plans_vertical_id ON aaa_plans(vertical_id);
CREATE INDEX idx_aaa_plans_fiscal_year ON aaa_plans(fiscal_year);
CREATE INDEX idx_aaa_plans_chapter_id ON aaa_plans(chapter_id);
CREATE INDEX idx_aaa_plans_status ON aaa_plans(status);

COMMENT ON TABLE aaa_plans IS 'AAA Framework plans: 3 Awareness, 2 Action, 1 Advocacy per vertical per year';

-- 4.2 commitment_cards
CREATE TABLE commitment_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  aaa_plan_id UUID REFERENCES aaa_plans(id) ON DELETE SET NULL,
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  pathfinder_year INT NOT NULL,

  commitment_1 TEXT NOT NULL,
  commitment_2 TEXT,
  commitment_3 TEXT,

  signed_at TIMESTAMPTZ,
  signature_data TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(member_id, pathfinder_year)
);

CREATE INDEX idx_commitment_cards_member_id ON commitment_cards(member_id);
CREATE INDEX idx_commitment_cards_chapter_id ON commitment_cards(chapter_id);
CREATE INDEX idx_commitment_cards_pathfinder_year ON commitment_cards(pathfinder_year);

COMMENT ON TABLE commitment_cards IS 'Digital commitment cards signed by EC Chairs at Pathfinder events';

-- 4.3 mentor_assignments
CREATE TABLE mentor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ec_chair_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL,
  pathfinder_year INT NOT NULL,

  mentor_name VARCHAR(255),
  mentor_title VARCHAR(255),
  mentor_expertise TEXT,

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,

  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(ec_chair_id, pathfinder_year)
);

CREATE INDEX idx_mentor_assignments_ec_chair_id ON mentor_assignments(ec_chair_id);
CREATE INDEX idx_mentor_assignments_mentor_id ON mentor_assignments(mentor_id);
CREATE INDEX idx_mentor_assignments_chapter_id ON mentor_assignments(chapter_id);

COMMENT ON TABLE mentor_assignments IS 'Mentor-mentee assignments for EC Chairs from Pathfinder';

-- 4.4 RLS Policies (PATCHED: source had m.user_id = auth.uid(); correct is m.id = auth.uid())
ALTER TABLE aaa_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chapter AAA plans" ON aaa_plans
  FOR SELECT USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "EC and above can insert AAA plans" ON aaa_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = auth.uid()
      AND m.chapter_id = aaa_plans.chapter_id
      AND yi_connect.get_user_hierarchy_level(m.id) >= 3
    )
  );

CREATE POLICY "EC and above can update AAA plans" ON aaa_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = auth.uid()
      AND m.chapter_id = aaa_plans.chapter_id
      AND yi_connect.get_user_hierarchy_level(m.id) >= 3
    )
  );

CREATE POLICY "Members can view own commitment cards" ON commitment_cards
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE id = auth.uid())
    OR chapter_id IN (
      SELECT chapter_id FROM yi_connect.members WHERE id = auth.uid() AND yi_connect.get_user_hierarchy_level() >= 4
    )
  );

CREATE POLICY "Members can insert own commitment cards" ON commitment_cards
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM members WHERE id = auth.uid())
  );

CREATE POLICY "Members can update own commitment cards" ON commitment_cards
  FOR UPDATE USING (
    member_id IN (SELECT id FROM members WHERE id = auth.uid())
  );

CREATE POLICY "Members can view chapter mentor assignments" ON mentor_assignments
  FOR SELECT USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Chair can manage mentor assignments" ON mentor_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = auth.uid()
      AND m.chapter_id = mentor_assignments.chapter_id
      AND yi_connect.get_user_hierarchy_level(m.id) >= 4
    )
  );

-- 4.5 Triggers
CREATE OR REPLACE FUNCTION yi_connect.update_aaa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aaa_plans_updated_at
  BEFORE UPDATE ON aaa_plans
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_aaa_updated_at();

CREATE TRIGGER commitment_cards_updated_at
  BEFORE UPDATE ON commitment_cards
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_aaa_updated_at();

CREATE TRIGGER mentor_assignments_updated_at
  BEFORE UPDATE ON mentor_assignments
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_aaa_updated_at();

-- 4.6 Helper Functions
CREATE OR REPLACE FUNCTION yi_connect.get_aaa_completion(plan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_items INT := 6;
  completed_items INT := 0;
  plan_record RECORD;
BEGIN
  SELECT * INTO plan_record FROM yi_connect.aaa_plans WHERE id = plan_id;

  IF plan_record IS NULL THEN
    RETURN 0;
  END IF;

  IF plan_record.awareness_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.awareness_3_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_1_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.action_2_status = 'completed' THEN completed_items := completed_items + 1; END IF;
  IF plan_record.advocacy_status = 'completed' THEN completed_items := completed_items + 1; END IF;

  RETURN ROUND((completed_items::NUMERIC / total_items) * 100, 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION yi_connect.get_milestone_completion(plan_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_milestones INT := 3;
  completed_milestones INT := 0;
  plan_record RECORD;
BEGIN
  SELECT * INTO plan_record FROM yi_connect.aaa_plans WHERE id = plan_id;

  IF plan_record IS NULL THEN
    RETURN 0;
  END IF;

  IF plan_record.milestone_jan_status = 'completed' THEN completed_milestones := completed_milestones + 1; END IF;
  IF plan_record.milestone_feb_status = 'completed' THEN completed_milestones := completed_milestones + 1; END IF;
  IF plan_record.milestone_mar_status = 'completed' THEN completed_milestones := completed_milestones + 1; END IF;

  RETURN ROUND((completed_milestones::NUMERIC / total_milestones) * 100, 1);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION yi_connect.get_aaa_completion IS 'Calculate AAA plan completion percentage (0-100)';
COMMENT ON FUNCTION yi_connect.get_milestone_completion IS 'Calculate 90-day milestone completion percentage (0-100)';

-- ═══════════════════════════════════════════════════════════════════════
-- END Batch 10
-- ═══════════════════════════════════════════════════════════════════════
