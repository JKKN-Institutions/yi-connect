-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Create `yifi` schema + core tables for YiFi 2026
--
-- Context
-- ───────
-- YiFi is Young Indians' national Entrepreneurship & Finance Summit.
-- YiFi Madurai 2026 (17 July) is the first event to use personalised
-- routing, dossiers, and vow tracking — all built inside yi-connect
-- so that members who experience YiFi continue using yi-connect.
--
-- Tables follow the same pattern as future.* (YiFuture) and
-- public.* (YIP). Cross-app identity via yi_directory.people and
-- yi.chapters.
--
-- Strictly additive. Rollback: DROP SCHEMA yifi CASCADE;
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS yifi;

COMMENT ON SCHEMA yifi IS
  'YiFi — Yi national Entrepreneurship & Finance Summit platform. '
  'Personalised routing, dossiers, vows, and follow-ups. '
  'Plugs into yi_directory.people and yi.chapters for cross-app identity.';

-- Grant usage to authenticated & anon roles (RLS will gate access)
GRANT USAGE ON SCHEMA yifi TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA yifi
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA yifi
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA yifi
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA yifi
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ─── Editions (one row per YiFi event — supports multi-year) ────────
CREATE TABLE yifi.editions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,         -- e.g. 'madurai-2026'
  name          text NOT NULL,                -- 'YiFi Madurai 2026'
  tagline       text,                         -- 'Built for Generations'
  theme         text,
  host_chapter_id uuid,                        -- FK to yi.chapters(id) when schema exists
  event_date    date NOT NULL,
  venue         text,
  city          text,
  expected_attendance int DEFAULT 500,
  status        text NOT NULL DEFAULT 'upcoming'
                CHECK (status IN ('upcoming','registration','live','post-event','archived')),
  branding      jsonb DEFAULT '{}',           -- colours, logos, hashtags
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editions_public_read" ON yifi.editions FOR SELECT USING (true);

-- ─── Registrants (members attending a YiFi edition) ─────────────────
CREATE TABLE yifi.registrants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id    uuid NOT NULL REFERENCES yifi.editions(id),
  person_id     uuid,                           -- FK to yi_directory.people(id) when schema exists
  chapter_id    uuid,                           -- FK to yi.chapters(id) when schema exists
  access_code   text UNIQUE NOT NULL,         -- login code for /yifi/me
  full_name     text NOT NULL,
  email         text,
  phone         text,
  photo_url     text,
  member_category text CHECK (member_category IN ('ec','gc','nmt','general','couple')),
  -- Census data (the personalisation vector)
  sector        text,                          -- industry / professional background
  organisation  text,
  designation   text,
  city          text,
  challenges    text[],                        -- top 3 business challenges
  can_offer     jsonb DEFAULT '{}',            -- capital range, hours, distribution, customers
  cluster_colour text,                         -- assigned theme cluster
  census_complete boolean DEFAULT false,
  -- Couple handling
  is_couple     boolean DEFAULT false,
  partner_registrant_id uuid REFERENCES yifi.registrants(id),
  -- Status
  checked_in    boolean DEFAULT false,
  checked_in_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, email)
);

ALTER TABLE yifi.registrants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registrants_read_own" ON yifi.registrants
  FOR SELECT USING (true);
CREATE POLICY "registrants_insert" ON yifi.registrants
  FOR INSERT WITH CHECK (true);
CREATE POLICY "registrants_update_own" ON yifi.registrants
  FOR UPDATE USING (true);

-- ─── Matches (curated 1-on-1 routing pairs) ─────────────────────────
CREATE TABLE yifi.matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id    uuid NOT NULL REFERENCES yifi.editions(id),
  registrant_a  uuid NOT NULL REFERENCES yifi.registrants(id),
  registrant_b  uuid NOT NULL REFERENCES yifi.registrants(id),
  match_reason  text,                          -- one-sentence why
  match_score   real,                          -- algorithm confidence
  slot_time     timestamptz,                   -- scheduled meeting time
  table_number  int,                           -- assigned table
  is_walkup     boolean DEFAULT false,         -- walk-up vs scheduled
  -- Status tracking
  a_confirmed   boolean DEFAULT false,
  b_confirmed   boolean DEFAULT false,
  meeting_happened boolean DEFAULT false,
  notes_a       text,                          -- a's notes about the meeting
  notes_b       text,                          -- b's notes about the meeting
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, registrant_a, registrant_b)
);

ALTER TABLE yifi.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_read" ON yifi.matches FOR SELECT USING (true);
CREATE POLICY "matches_update" ON yifi.matches FOR UPDATE USING (true);

-- ─── Vows (closing ritual commitments) ──────────────────────────────
CREATE TABLE yifi.vows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id    uuid NOT NULL REFERENCES yifi.editions(id),
  registrant_id uuid NOT NULL REFERENCES yifi.registrants(id),
  category      text NOT NULL CHECK (category IN ('business','family_health','yi')),
  vow_text      text NOT NULL,
  witness_id    uuid REFERENCES yifi.registrants(id),  -- AI-recommended witness
  witness_accepted boolean DEFAULT false,
  -- Follow-up tracking
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','in_progress','completed','expired')),
  completion_date timestamptz,
  completion_notes text,
  -- Tile tracking (physical vow wall)
  tile_engraved boolean DEFAULT false,
  tile_placed   boolean DEFAULT false,
  tile_reclaimed boolean DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, registrant_id, category)
);

ALTER TABLE yifi.vows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vows_read" ON yifi.vows FOR SELECT USING (true);
CREATE POLICY "vows_insert" ON yifi.vows FOR INSERT WITH CHECK (true);
CREATE POLICY "vows_update" ON yifi.vows FOR UPDATE USING (true);

-- ─── Follow-ups (30/60/90/180/365 day touchpoints) ─────────────────
CREATE TABLE yifi.follow_ups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vow_id        uuid NOT NULL REFERENCES yifi.vows(id),
  day_mark      int NOT NULL CHECK (day_mark IN (30, 60, 90, 180, 365)),
  scheduled_at  timestamptz NOT NULL,
  sent_at       timestamptz,
  member_response text,
  witness_response text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','responded','skipped')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_ups_read" ON yifi.follow_ups FOR SELECT USING (true);

-- ─── Sessions (speaker sessions for dossier generation) ─────────────
CREATE TABLE yifi.sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id    uuid NOT NULL REFERENCES yifi.editions(id),
  title         text NOT NULL,
  speaker_name  text,
  speaker_bio   text,
  session_type  text CHECK (session_type IN ('keynote','panel','fireside','workshop','tour','peer')),
  start_time    timestamptz,
  end_time      timestamptz,
  consent_archiving boolean DEFAULT false,     -- speaker consent for dossier use
  transcript_url text,                         -- raw transcript storage
  themes        text[],                        -- extracted themes
  concepts      jsonb DEFAULT '[]',            -- extracted concepts
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_read" ON yifi.sessions FOR SELECT USING (true);

-- ─── Dossiers (personalised per-member post-event deliverable) ──────
CREATE TABLE yifi.dossiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id    uuid NOT NULL REFERENCES yifi.editions(id),
  registrant_id uuid NOT NULL REFERENCES yifi.registrants(id),
  -- Personalised content (generated by AI pipeline)
  top_quotes    jsonb DEFAULT '[]',            -- ranked quotes with video clip refs
  takeaways     jsonb DEFAULT '[]',            -- per-session takeaways
  speaker_ranking jsonb DEFAULT '[]',          -- speakers ranked by relevance
  action_plan   jsonb DEFAULT '[]',            -- 8 dated action items
  tour_cards    jsonb DEFAULT '[]',            -- experiential visit personalised cards
  -- Delivery
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','generating','ready','delivered','viewed')),
  delivered_at  timestamptz,
  viewed_at     timestamptz,
  view_count    int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, registrant_id)
);

ALTER TABLE yifi.dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dossiers_read" ON yifi.dossiers FOR SELECT USING (true);

-- ─── Event stats (live counters for the reveal screen) ──────────────
CREATE TABLE yifi.event_stats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id    uuid NOT NULL REFERENCES yifi.editions(id) UNIQUE,
  total_registrants int DEFAULT 0,
  total_capacity_cr numeric(10,2) DEFAULT 0,
  problem_clusters int DEFAULT 0,
  sectors       int DEFAULT 0,
  introductions_made int DEFAULT 0,
  meetings_happened int DEFAULT 0,
  vows_made     int DEFAULT 0,
  witnesses_named int DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.event_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_stats_read" ON yifi.event_stats FOR SELECT USING (true);

-- ─── Indexes ────────────────────────────────────────────────────────
CREATE INDEX idx_registrants_edition ON yifi.registrants(edition_id);
CREATE INDEX idx_registrants_access_code ON yifi.registrants(access_code);
CREATE INDEX idx_registrants_chapter ON yifi.registrants(chapter_id);
CREATE INDEX idx_registrants_cluster ON yifi.registrants(edition_id, cluster_colour);
CREATE INDEX idx_matches_edition ON yifi.matches(edition_id);
CREATE INDEX idx_matches_registrant_a ON yifi.matches(registrant_a);
CREATE INDEX idx_matches_registrant_b ON yifi.matches(registrant_b);
CREATE INDEX idx_vows_registrant ON yifi.vows(registrant_id);
CREATE INDEX idx_vows_witness ON yifi.vows(witness_id);
CREATE INDEX idx_follow_ups_vow ON yifi.follow_ups(vow_id);
CREATE INDEX idx_follow_ups_scheduled ON yifi.follow_ups(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_dossiers_registrant ON yifi.dossiers(registrant_id);
CREATE INDEX idx_sessions_edition ON yifi.sessions(edition_id);
