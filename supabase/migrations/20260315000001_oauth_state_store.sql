-- ================================================
-- MIGRATION: OAuth State Store
-- ================================================
-- Replaces in-memory Map with a database table for OAuth state storage.
-- Critical for Vercel serverless where each request may hit a different isolate.
-- States auto-expire after 10 minutes via a cleanup function.
-- ================================================

-- Create oauth_states table
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Index for nonce lookups
CREATE INDEX idx_oauth_states_nonce ON oauth_states(nonce);

-- Index for cleanup of expired states
CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Enable RLS
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can insert their own states
CREATE POLICY "Users can insert own oauth states"
  ON oauth_states FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only the user who created the state can read it
CREATE POLICY "Users can read own oauth states"
  ON oauth_states FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only the user who created the state can delete it
CREATE POLICY "Users can delete own oauth states"
  ON oauth_states FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to clean up expired states (called periodically or on each verify)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM oauth_states WHERE expires_at < NOW();
$$;

COMMENT ON TABLE oauth_states IS 'Stores OAuth state for Yi Creative Studio connection flow. States expire after 10 minutes.';

-- ================================================
-- END OF MIGRATION
-- ================================================
