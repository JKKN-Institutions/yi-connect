-- Migration: session_bookings_add_missing_columns
-- Adds the 5 columns referenced in app/actions/session-bookings.ts and
-- lib/data/session-bookings.ts that are absent from yi_connect.session_bookings.
-- Table has 0 rows — no data migration needed. All columns are nullable / have
-- safe defaults so existing inserts are unaffected.
--
-- PR #237 diagnosis: status_history, assigned_trainer_id, attendance_count,
-- feedback_score, expected_participants were missing from the live schema.
-- Additional columns also referenced by the code are added here for completeness
-- so the booking workflow does not silently drop data at runtime.

-- 1. status_history  — JSONB audit trail of every status transition
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. assigned_trainer_id  — FK to trainer_profiles (nullable; assigned post-booking)
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS assigned_trainer_id UUID
    REFERENCES yi_connect.trainer_profiles(id)
    ON DELETE SET NULL;

-- 3. attendance_count  — Actual headcount recorded when session is completed
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS attendance_count INTEGER;

-- 4. feedback_score  — Post-session rating (numeric, e.g. 1–5 or 1–10)
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS feedback_score NUMERIC;

-- 5. expected_participants  — Estimated headcount at booking time
--    Note: schema already has expected_students (same semantic) but code uses
--    expected_participants consistently. Adding the expected_participants column
--    avoids touching app code; both columns coexist, both nullable.
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS expected_participants INTEGER;

-- ── Additional columns referenced in the same action/data files ─────────────
-- These were also absent and would cause silent runtime failures. Added here
-- under the same idempotent guard rather than a separate migration.

-- session_type_id  — FK to session_types for structured type lookup
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS session_type_id UUID;

-- preferred_time_slot / alternate_time_slot  — "HH:MM-HH:MM" time window text
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS preferred_time_slot TEXT;

ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS alternate_time_slot TEXT;

-- confirmed_time_start / confirmed_time_end  — Confirmed session window
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS confirmed_time_start TEXT;

ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS confirmed_time_end TEXT;

-- assigned_at / assigned_by  — When and who assigned the trainer
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS assigned_by UUID;

-- completed_at  — Timestamp when session was marked completed
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- participant_details  — Free-text or JSONB notes about participants
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS participant_details TEXT;

-- topics_requested  — Free-text topic requests from coordinator
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS topics_requested TEXT;

-- custom_requirements  — Any special logistics notes
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS custom_requirements TEXT;

-- materials_provided  — What materials were delivered during session
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS materials_provided TEXT;

-- session_notes  — Trainer/coordinator notes post-session
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS session_notes TEXT;

-- venue  — Single-field venue name (code uses this; schema has venue_name separately)
ALTER TABLE yi_connect.session_bookings
  ADD COLUMN IF NOT EXISTS venue TEXT;

-- Index for common filter: bookings by assigned trainer
CREATE INDEX IF NOT EXISTS session_bookings_assigned_trainer_id_idx
  ON yi_connect.session_bookings(assigned_trainer_id);
