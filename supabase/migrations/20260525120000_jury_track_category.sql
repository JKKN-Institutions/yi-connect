-- Add track_id to jury_assignments so jury can be categorized by track
-- This enables track-based auto-assignment: all jury in a track evaluate all teams in that track.

ALTER TABLE future.jury_assignments
  ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES future.tracks(id) ON DELETE SET NULL;

-- Index for fast lookup of jury by track
CREATE INDEX IF NOT EXISTS idx_jury_assignments_track_id
  ON future.jury_assignments(track_id)
  WHERE track_id IS NOT NULL;

COMMENT ON COLUMN future.jury_assignments.track_id IS
  'Track/category assignment for this jury member. When set, auto-assign gives them all teams in this track.';
