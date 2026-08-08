-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Varnam Vizha — varnam_event_roster (day-of volunteer roster)
--
-- E5 Day-of Ops. In 2025 the festival coordinated 145 volunteers, duty
-- stations and 2 ambulances by hand (WhatsApp + paper lists). This table
-- gives each festival event a volunteer roster the run-sheet page renders
-- and prints: who, reachable at what phone, doing which duty, at which
-- station.
--
-- One row = one person on one event's roster. Rows die with the event
-- (ON DELETE CASCADE) — a roster has no meaning without its event.
--
-- Access: committee-only. Reads/writes flow through the service-role admin
-- client in server actions, gated app-side by getVarnamAccess().canManage.
-- RLS is ENABLED with NO anon/authenticated policies → closed by default.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.varnam_event_roster (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES yi_connect.events(id) ON DELETE CASCADE,
  person_name  text NOT NULL CHECK (length(btrim(person_name)) > 0),
  phone        text,
  duty         text,          -- plain language: "First aid", "Stage manager"
  station      text,          -- where they stand: "Main gate", "Ambulance 1"
  notes        text,
  sort         integer NOT NULL DEFAULT 0,  -- manual ordering on the run sheet
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE yi_connect.varnam_event_roster IS
  'Day-of volunteer roster for a Varnam Vizha festival event (run-sheet page). One row per person per event; committee-only via admin client (RLS closed).';

CREATE INDEX IF NOT EXISTS idx_varnam_event_roster_event
  ON yi_connect.varnam_event_roster (event_id);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Closed by default: no anon or authenticated policies. The committee
-- dashboard reads/writes via the service-role client after the app-layer
-- role gate (chair/co-chair/organizer/forum lead), matching the rest of
-- the Varnam committee tables.
ALTER TABLE yi_connect.varnam_event_roster ENABLE ROW LEVEL SECURITY;

-- updated_at is maintained by the application layer (server actions set it on write).
