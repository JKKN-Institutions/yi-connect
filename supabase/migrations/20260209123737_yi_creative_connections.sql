-- ============================================================================
-- Yi Creative Studio Connections
-- ============================================================================
-- Allows each chapter to connect their own Yi Creative Studio organization
-- through OAuth-style flow. Stores connection credentials per chapter.
-- ============================================================================

-- Create yi_creative_connections table
CREATE TABLE yi_creative_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- Yi Creative Organization Info
  organization_id TEXT NOT NULL,
  organization_name TEXT,

  -- Connection Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  connected_by UUID NOT NULL REFERENCES profiles(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- OAuth tokens (encrypted at application level before storage)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Webhook configuration
  webhook_secret TEXT,

  -- SSO configuration
  -- Each chapter can have their own key pair for SSO
  sso_private_key TEXT,  -- Base64 encoded, encrypted at app level
  sso_public_key TEXT,   -- Base64 encoded, shared with Yi Creative

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One connection per chapter
  UNIQUE(chapter_id)
);

-- Add index for faster lookups
CREATE INDEX idx_yi_creative_connections_chapter_id ON yi_creative_connections(chapter_id);
CREATE INDEX idx_yi_creative_connections_status ON yi_creative_connections(status);

-- Enable RLS
ALTER TABLE yi_creative_connections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Chapter members with Chair+ level can view their chapter's connection
CREATE POLICY "Chapter admins can view own connection"
  ON yi_creative_connections
  FOR SELECT
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

-- Chapter Chair+ can insert connection for their chapter
CREATE POLICY "Chapter chair can create connection"
  ON yi_creative_connections
  FOR INSERT
  WITH CHECK (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

-- Chapter Chair+ can update their chapter's connection
CREATE POLICY "Chapter chair can update connection"
  ON yi_creative_connections
  FOR UPDATE
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    AND get_user_hierarchy_level(auth.uid()) >= 4
  )
  WITH CHECK (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

-- Chapter Chair+ can delete their chapter's connection
CREATE POLICY "Chapter chair can delete connection"
  ON yi_creative_connections
  FOR DELETE
  USING (
    chapter_id IN (
      SELECT chapter_id FROM members WHERE id = auth.uid()
    )
    AND get_user_hierarchy_level(auth.uid()) >= 4
  );

-- Super Admin can manage all connections
CREATE POLICY "Super admin can manage all connections"
  ON yi_creative_connections
  FOR ALL
  USING (get_user_hierarchy_level(auth.uid()) >= 6)
  WITH CHECK (get_user_hierarchy_level(auth.uid()) >= 6);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER trigger_yi_creative_connections_updated_at
  BEFORE UPDATE ON yi_creative_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE yi_creative_connections IS 'Stores Yi Creative Studio OAuth connections per chapter';
COMMENT ON COLUMN yi_creative_connections.organization_id IS 'Yi Creative Studio organization UUID';
COMMENT ON COLUMN yi_creative_connections.status IS 'Connection status: active, disconnected, expired';
COMMENT ON COLUMN yi_creative_connections.sso_private_key IS 'Base64 encoded RSA private key for signing SSO tokens';
COMMENT ON COLUMN yi_creative_connections.sso_public_key IS 'Base64 encoded RSA public key shared with Yi Creative';
