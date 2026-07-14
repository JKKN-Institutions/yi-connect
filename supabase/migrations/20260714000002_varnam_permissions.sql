-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Varnam Vizha — varnam_permissions (E2 Paperwork Engine)
--
-- In 2025 the committee hand-wrote permission letters per event per
-- authority (Collector / Police / Corporation) and hand-built an Excel
-- sheet for the Collectorate. This table tracks one permission request per
-- (event × authority) with a generated letter body and a simple status
-- pipeline: needed → drafted → submitted → approved.
--
-- authority stores the stable key from lib/varnam/letters.ts AUTHORITIES
-- ('collector' | 'police' | 'corporation'); display names live in code so
-- new authorities can be added without a migration (hence no CHECK on it).
--
-- RLS: enabled with NO anon policies — committee data flows exclusively
-- through the service-role client in server actions, gated app-side by
-- getVarnamAccess().canManage. Closed by default.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.varnam_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  authority   text NOT NULL,
  status      text NOT NULL DEFAULT 'needed'
                CHECK (status IN ('needed','drafted','submitted','approved')),
  letter_body text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_varnam_permissions_event_authority UNIQUE (event_id, authority)
);

COMMENT ON TABLE yi_connect.varnam_permissions IS
  'Varnam Vizha permission-letter tracker: one row per festival event per authority (collector/police/corporation). letter_body holds the generated plain-text letter; status walks needed → drafted → submitted → approved.';

CREATE INDEX IF NOT EXISTS idx_varnam_permissions_event
  ON yi_connect.varnam_permissions (event_id);

-- ── RLS ────────────────────────────────────────────────────────────────
-- No anon/authenticated policies on purpose: reads and writes go through
-- the admin (service-role) client inside role-gated server actions only.
ALTER TABLE yi_connect.varnam_permissions ENABLE ROW LEVEL SECURITY;

-- updated_at is maintained by the application layer (server actions set it on write).
