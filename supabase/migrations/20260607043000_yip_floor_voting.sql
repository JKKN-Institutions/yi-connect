-- YIP floor voting: volunteer kiosk capture + vote provenance + corrections audit
-- (Director decision 2026-06-06: 100% vote coverage — device-less students vote
-- via YUVA volunteer kiosks or organizer roll-call; every vote final once cast.)
--
-- Applied to prod 2026-06-07 via Management API; this file is the record.

-- 1. Volunteers get access codes (same login pattern as participants/jury).
--    Codes are credentials: volunteers had no anon grants; vote_audit is
--    locked to service-role only (defense per the anon-leak rule).
ALTER TABLE yip.volunteers ADD COLUMN IF NOT EXISTS access_code text;
CREATE UNIQUE INDEX IF NOT EXISTS volunteers_event_access_code_key
  ON yip.volunteers (event_id, access_code)
  WHERE access_code IS NOT NULL;

-- 2. Vote provenance: how a vote entered the system.
--    'self'      — student cast it from their own login (default, existing rows)
--    'kiosk'     — student tapped it on a volunteer's device (self-cast, carried)
--    'organizer' — organizer roll-call entry on the student's behalf
ALTER TABLE yip.votes ADD COLUMN IF NOT EXISTS entry_method text NOT NULL DEFAULT 'self';
ALTER TABLE yip.votes ADD COLUMN IF NOT EXISTS recorded_by_volunteer_id uuid REFERENCES yip.volunteers(id);
ALTER TABLE yip.votes ADD COLUMN IF NOT EXISTS recorded_by_user uuid;

-- 3. Corrections audit: organizer-only fixes of manual entries while a vote
--    session is still open. Once closed, nothing changes for anyone.
CREATE TABLE IF NOT EXISTS yip.vote_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES yip.votes(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON yip.vote_audit FROM anon, authenticated;
REVOKE ALL ON yip.volunteers FROM anon;
