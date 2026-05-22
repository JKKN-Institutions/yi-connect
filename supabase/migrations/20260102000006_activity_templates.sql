-- ============================================================================
-- ACTIVITY TEMPLATES
-- Pre-defined templates for quick activity logging
-- ============================================================================

-- Activity templates table
CREATE TABLE IF NOT EXISTS activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL,

  -- Default values for health card entry
  default_title VARCHAR(255),
  default_activity_type VARCHAR(100),
  default_aaa_classification VARCHAR(50) CHECK (default_aaa_classification IN ('awareness', 'action', 'advocacy')),
  default_target_audience VARCHAR(255),
  default_duration_hours DECIMAL(4,1),

  -- Expected metrics
  expected_participants INTEGER,
  expected_ec_count INTEGER,

  -- Template metadata
  icon VARCHAR(50), -- lucide icon name
  color VARCHAR(7), -- hex color code
  tags TEXT[], -- searchable tags

  -- Scope
  is_national BOOLEAN DEFAULT true, -- Available nationally or chapter-specific
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "activity_templates_select_authenticated"
  ON activity_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "activity_templates_insert_admin"
  ON activity_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair')
    )
  );

CREATE POLICY "activity_templates_update_admin"
  ON activity_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair')
    )
  );

CREATE POLICY "activity_templates_delete_admin"
  ON activity_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'National Admin', 'Chair')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_templates_vertical ON activity_templates(vertical_id);
CREATE INDEX IF NOT EXISTS idx_activity_templates_active ON activity_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_activity_templates_national ON activity_templates(is_national);
CREATE INDEX IF NOT EXISTS idx_activity_templates_tags ON activity_templates USING GIN(tags);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_activity_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_templates_updated_at
  BEFORE UPDATE ON activity_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_templates_updated_at();

-- Increment usage count function
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE activity_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_template_usage TO authenticated;

-- ============================================================================
-- SEED DEFAULT TEMPLATES
-- ============================================================================

-- Insert default Yi activity templates
INSERT INTO activity_templates (
  name, description, default_aaa_classification, default_activity_type,
  expected_participants, expected_ec_count, icon, tags, is_national
) VALUES
  -- MASOOM Templates
  ('MASOOM Workshop', 'Child safety awareness session in schools', 'awareness', 'Workshop',
   100, 5, 'Shield', ARRAY['masoom', 'child-safety', 'school'], true),
  ('MASOOM Teacher Training', 'Training teachers on child protection', 'action', 'Training',
   30, 3, 'GraduationCap', ARRAY['masoom', 'training', 'teachers'], true),
  ('MASOOM Policy Advocacy', 'Meeting with officials for child safety policies', 'advocacy', 'Meeting',
   10, 4, 'Landmark', ARRAY['masoom', 'policy', 'advocacy'], true),

  -- Climate Action Templates
  ('Tree Plantation Drive', 'Community tree planting activity', 'action', 'Drive',
   50, 10, 'TreePine', ARRAY['climate', 'trees', 'environment'], true),
  ('Climate Awareness Session', 'Session on climate change and sustainability', 'awareness', 'Session',
   80, 5, 'Leaf', ARRAY['climate', 'awareness', 'sustainability'], true),
  ('Clean Energy Workshop', 'Workshop on solar and renewable energy', 'awareness', 'Workshop',
   40, 5, 'Zap', ARRAY['climate', 'renewable', 'energy'], true),

  -- Road Safety Templates
  ('Road Safety Awareness', 'Traffic rules and safety awareness session', 'awareness', 'Session',
   100, 5, 'Car', ARRAY['road-safety', 'traffic', 'awareness'], true),
  ('Helmet Distribution', 'Distributing helmets to two-wheeler riders', 'action', 'Distribution',
   50, 8, 'HardHat', ARRAY['road-safety', 'helmet', 'distribution'], true),

  -- Health Templates
  ('Health Camp', 'Free health checkup camp', 'action', 'Camp',
   200, 10, 'Heart', ARRAY['health', 'camp', 'checkup'], true),
  ('Blood Donation Drive', 'Blood donation camp for the community', 'action', 'Drive',
   100, 15, 'Droplet', ARRAY['health', 'blood-donation', 'drive'], true),
  ('Mental Health Workshop', 'Awareness session on mental health', 'awareness', 'Workshop',
   50, 5, 'Brain', ARRAY['health', 'mental-health', 'workshop'], true),

  -- Yuva/Thalir Templates
  ('Yuva Leadership Session', 'Leadership development for college students', 'awareness', 'Session',
   60, 5, 'Users', ARRAY['yuva', 'leadership', 'students'], true),
  ('Thalir School Visit', 'Engaging school students in nation building', 'awareness', 'Visit',
   100, 5, 'School', ARRAY['thalir', 'school', 'students'], true),
  ('Skill Development Workshop', 'Practical skills training for youth', 'action', 'Workshop',
   40, 5, 'Wrench', ARRAY['yuva', 'skills', 'training'], true),

  -- General Templates
  ('Community Service', 'General community service activity', 'action', 'Service',
   30, 8, 'HeartHandshake', ARRAY['community', 'service', 'general'], true),
  ('Guest Speaker Session', 'Session with industry/thought leader', 'awareness', 'Session',
   80, 10, 'Mic', ARRAY['speaker', 'session', 'learning'], true),
  ('Industry Visit', 'Visit to local industry/factory', 'awareness', 'Visit',
   25, 5, 'Factory', ARRAY['industry', 'visit', 'learning'], true)

ON CONFLICT DO NOTHING;
