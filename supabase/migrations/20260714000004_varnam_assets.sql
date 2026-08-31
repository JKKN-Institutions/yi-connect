-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Varnam Vizha — varnam_assets (link-based content pipeline)
--
-- WHY: 62% of ALL 2025 organiser WhatsApp traffic (1,660 messages) was the
-- branding group — poster iterations and approvals flying around as Google
-- Drive links with no home. This table gives every poster/reel/video/script
-- a title, a link, and an approval status (draft → review → approved →
-- published) so the committee stops digging through WhatsApp scrollback.
--
-- Link-based by design: NO file uploads. `url` points at Drive/Canva/etc.
--
-- Scoping: every asset belongs to a festival edition (NOT NULL) and may
-- optionally point at one edition event (nullable; survives event deletion
-- via ON DELETE SET NULL).
--
-- Access: committee-only data. RLS is ENABLED with NO anon policies — all
-- reads/writes flow through the service-role admin client inside server
-- actions, gated in app-layer auth (getVarnamAccess, app='varnam').
--
-- Idempotent: IF NOT EXISTS everywhere; no seed data.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.varnam_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id  uuid NOT NULL REFERENCES yi_connect.festival_editions(id),
  event_id    uuid REFERENCES yi_connect.events(id) ON DELETE SET NULL,
  title       text NOT NULL CHECK (char_length(btrim(title)) > 0),
  kind        text NOT NULL DEFAULT 'poster'
                CHECK (kind IN ('poster','reel','video','script','photo','other')),
  url         text CHECK (url IS NULL OR url ~ '^https://'),
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','review','approved','published')),
  notes       text,
  created_by  uuid,                                   -- auth.users.id of the adder
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE yi_connect.varnam_assets IS
  'Varnam Vizha content library — link-based creative assets (posters, reels, videos, scripts, photos) with an approval pipeline (draft/review/approved/published). No file storage: url points at Drive/Canva/etc. Committee-only via server actions; RLS closed.';

CREATE INDEX IF NOT EXISTS idx_varnam_assets_edition
  ON yi_connect.varnam_assets (edition_id);
CREATE INDEX IF NOT EXISTS idx_varnam_assets_event
  ON yi_connect.varnam_assets (event_id);
CREATE INDEX IF NOT EXISTS idx_varnam_assets_status
  ON yi_connect.varnam_assets (status);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Closed by default: enable RLS and add NO policies. The anon/authenticated
-- roles can neither read nor write; the committee dashboard uses the
-- service-role client behind getVarnamAccess checks.
ALTER TABLE yi_connect.varnam_assets ENABLE ROW LEVEL SECURITY;

-- updated_at is maintained by the application layer (server actions set it on write).
