-- ============================================================================
-- WhatsApp Management Module
-- ============================================================================
-- Creates tables for chapter-aware WhatsApp communication management
-- Supports: connections, groups, templates, and message logs
-- ============================================================================

-- ============================================================================
-- 1. WhatsApp Connections (per chapter)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  session_path VARCHAR(255) NOT NULL,
  connected_phone VARCHAR(20),
  connected_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id)
);

-- Enable RLS
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_connections
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

-- ============================================================================
-- 2. WhatsApp Groups (per chapter, replaces hardcoded array)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_groups
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

-- Index for performance
CREATE INDEX idx_whatsapp_groups_chapter ON whatsapp_groups(chapter_id);
CREATE INDEX idx_whatsapp_groups_type ON whatsapp_groups(group_type);

-- ============================================================================
-- 3. WhatsApp Templates (national + chapter-specific)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE, -- NULL = national template
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('event', 'announcement', 'reminder', 'follow_up', 'greeting', 'custom')),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- e.g., ["member_name", "event_name", "date"]
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_templates
-- Everyone can see national templates (chapter_id IS NULL) and their chapter's templates
CREATE POLICY "whatsapp_templates_select" ON whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    chapter_id IS NULL -- National templates visible to all
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

-- Only admins can create national templates, chapter leaders can create chapter templates
CREATE POLICY "whatsapp_templates_insert" ON whatsapp_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    -- National templates: only Super/National Admin
    (chapter_id IS NULL AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    ))
    OR
    -- Chapter templates: chapter leaders
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
    -- National templates: only Super/National Admin
    (chapter_id IS NULL AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    ))
    OR
    -- Chapter templates: chapter leaders
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
    -- National templates: only Super/National Admin
    (chapter_id IS NULL AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin')
    ))
    OR
    -- Chapter templates: chapter leaders
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

-- Indexes
CREATE INDEX idx_whatsapp_templates_chapter ON whatsapp_templates(chapter_id);
CREATE INDEX idx_whatsapp_templates_category ON whatsapp_templates(category);
CREATE INDEX idx_whatsapp_templates_active ON whatsapp_templates(is_active) WHERE is_active = true;

-- ============================================================================
-- 4. WhatsApp Message Logs (for tracking/history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('individual', 'group', 'bulk')),
  recipient_id VARCHAR(100), -- phone or group JID
  recipient_name VARCHAR(255),
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  message_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB -- additional context (event_id, bulk_count, etc.)
);

-- Enable RLS
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_message_logs
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

-- Indexes for performance
CREATE INDEX idx_whatsapp_logs_chapter ON whatsapp_message_logs(chapter_id);
CREATE INDEX idx_whatsapp_logs_sent_at ON whatsapp_message_logs(sent_at DESC);
CREATE INDEX idx_whatsapp_logs_sent_by ON whatsapp_message_logs(sent_by);
CREATE INDEX idx_whatsapp_logs_status ON whatsapp_message_logs(status);

-- ============================================================================
-- 5. Updated_at Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_connections_updated_at
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER whatsapp_groups_updated_at
  BEFORE UPDATE ON whatsapp_groups
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

-- ============================================================================
-- 6. Seed Data: Yi Erode Groups (from hardcoded array)
-- ============================================================================

-- Note: This requires knowing the Yi Erode chapter_id
-- We'll insert conditionally if the chapter exists

DO $$
DECLARE
  erode_chapter_id UUID;
BEGIN
  -- Get Yi Erode chapter ID
  SELECT id INTO erode_chapter_id FROM chapters WHERE name ILIKE '%erode%' LIMIT 1;

  IF erode_chapter_id IS NOT NULL THEN
    -- Insert Yi Erode WhatsApp groups
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

-- ============================================================================
-- 7. Seed Data: Default National Templates
-- ============================================================================

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

-- ============================================================================
-- Done!
-- ============================================================================
