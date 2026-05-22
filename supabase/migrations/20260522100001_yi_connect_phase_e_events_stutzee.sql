-- =============================================================================
-- Yi Connect Phase E: Events / Stutzee feature pack — port to yi_connect schema
-- =============================================================================
-- Ported from origin/master public-schema migrations into the shared platform
-- Supabase project (bkmpbcoxbjyafieabxao), yi_connect schema.
--
-- Source migrations consolidated here:
--   1. 20260418050001_event_sessions.sql       (event_sessions, session_speakers, session_interests)
--   2. 20260418050002_speaker_faqs.sql         (speaker_faqs + ALTER speakers)
--   3. 20260418050003_attendee_ticket_tokens   (ALTER event_rsvps/guest_rsvps ticket_token, uniq event_checkins)
--   4. 20260418050004_sponsorship_tier_ui      (ALTER sponsors, sponsorship_tiers.benefits → JSONB)
--   5. 20260418060001_event_public_slug        (ALTER events public_slug + anon RLS)
--   6. 20260418060002_event_custom_forms       (registration_form_fields + custom_field_responses)
--   7. 20260418060003_sponsor_leads            (sponsor_leads table + trigger)
--   8. 20260418070001_live_dashboard_rls       (event_checkins Chair+ SELECT + realtime publication)
--   9. 20260418070002_member_connections       (member_connections + ALTER members profile_qr_token)
--  10. 20260418080001_event_autopilot          (event_autopilot_runs, chapter_reports, member_points_log)
--  11. 20260129000001_quick_rsvp.sql           (ALTER events rsvp_token + anon RLS policies)
--
-- Porting rules applied:
--   * All `public.*` rewritten as unqualified (resolves to yi_connect via search_path)
--   * `auth.uid()`, `auth.users`, `auth.role()` kept AS-IS (Supabase auth schema)
--   * FK references to `chapters` rewritten to `yi.chapters(id)` (canonical chapter table)
--   * `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency
--   * Enum creation wrapped in DO $$ EXCEPTION duplicate_object NULL
--   * Function/policy/index names kept identical to source for diff parity
-- =============================================================================

SET search_path TO yi_connect, public, extensions;

-- pgcrypto required by ticket_token / profile_qr_token / rsvp_token defaults
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- =========================================================================
-- 0. Preflight: add columns referenced by RLS policies later in this file
--    (Phase E ordering fix — RLS policies in sections 1-2 reference
--     events.rsvp_token, which the source migration #11 adds. We hoist
--     the ALTER+INDEX+backfill here so policies can compile.)
-- =========================================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS rsvp_token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS idx_events_rsvp_token
ON events(rsvp_token)
WHERE status IN ('published', 'ongoing');

UPDATE events
SET rsvp_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE rsvp_token IS NULL;


-- =========================================================================
-- 1. Event Sessions (Stutzee 1A)
--    Source: 20260418050001_event_sessions.sql
-- =========================================================================

-- 1.1 session_type enum
DO $$ BEGIN
  CREATE TYPE session_type AS ENUM (
    'keynote',
    'workshop',
    'panel',
    'networking',
    'break',
    'presentation',
    'qa',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 event_sessions table
CREATE TABLE IF NOT EXISTS event_sessions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT          NOT NULL,
  description       TEXT,
  session_type      session_type  NOT NULL DEFAULT 'presentation',
  start_time        TIMESTAMPTZ   NOT NULL,
  end_time          TIMESTAMPTZ   NOT NULL,
  room_or_track     TEXT,
  capacity          INTEGER,
  current_interest  INTEGER       NOT NULL DEFAULT 0,
  sort_order        INTEGER       NOT NULL DEFAULT 0,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT valid_session_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_event_id ON event_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_start    ON event_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_event_sessions_sort     ON event_sessions(event_id, sort_order);

-- 1.3 session_speakers junction
CREATE TABLE IF NOT EXISTS session_speakers (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID  NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
  speaker_id   UUID  NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  role         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, speaker_id)
);

CREATE INDEX IF NOT EXISTS idx_session_speakers_session ON session_speakers(session_id);
CREATE INDEX IF NOT EXISTS idx_session_speakers_speaker ON session_speakers(speaker_id);

-- 1.4 session_interests table
CREATE TABLE IF NOT EXISTS session_interests (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID  NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
  member_id   UUID  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_session_interests_session ON session_interests(session_id);
CREATE INDEX IF NOT EXISTS idx_session_interests_member  ON session_interests(member_id);

-- 1.5 current_interest counter trigger
CREATE OR REPLACE FUNCTION yi_connect.update_session_interest_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE yi_connect.event_sessions
  SET current_interest = (
    SELECT COUNT(*) FROM yi_connect.session_interests
    WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_session_interest ON session_interests;
CREATE TRIGGER trigger_update_session_interest
AFTER INSERT OR DELETE ON session_interests
FOR EACH ROW EXECUTE FUNCTION yi_connect.update_session_interest_count();

-- 1.6 updated_at trigger
CREATE OR REPLACE FUNCTION yi_connect.touch_event_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_event_sessions_updated ON event_sessions;
CREATE TRIGGER trigger_touch_event_sessions_updated
BEFORE UPDATE ON event_sessions
FOR EACH ROW EXECUTE FUNCTION yi_connect.touch_event_session_updated_at();

-- 1.7 RLS
ALTER TABLE event_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_speakers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_sessions_for_published_events" ON event_sessions;
CREATE POLICY "view_sessions_for_published_events"
ON event_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
      AND (
        e.status IN ('published', 'ongoing', 'completed')
        OR e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

DROP POLICY IF EXISTS "anon_view_sessions_by_token" ON event_sessions;
CREATE POLICY "anon_view_sessions_by_token"
ON event_sessions FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
      AND e.rsvp_token IS NOT NULL
      AND e.status IN ('published', 'ongoing', 'completed')
  )
);

DROP POLICY IF EXISTS "manage_sessions_admin_or_organizer" ON event_sessions;
CREATE POLICY "manage_sessions_admin_or_organizer"
ON event_sessions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

DROP POLICY IF EXISTS "view_session_speakers" ON session_speakers;
CREATE POLICY "view_session_speakers"
ON session_speakers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_sessions s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.status IN ('published', 'ongoing', 'completed')
        OR e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

DROP POLICY IF EXISTS "anon_view_session_speakers" ON session_speakers;
CREATE POLICY "anon_view_session_speakers"
ON session_speakers FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM event_sessions s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND e.rsvp_token IS NOT NULL
      AND e.status IN ('published', 'ongoing', 'completed')
  )
);

DROP POLICY IF EXISTS "manage_session_speakers" ON session_speakers;
CREATE POLICY "manage_session_speakers"
ON session_speakers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_sessions s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM event_sessions s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

DROP POLICY IF EXISTS "view_session_interests" ON session_interests;
CREATE POLICY "view_session_interests"
ON session_interests FOR SELECT
TO authenticated
USING (
  member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM event_sessions s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

DROP POLICY IF EXISTS "insert_own_session_interest" ON session_interests;
CREATE POLICY "insert_own_session_interest"
ON session_interests FOR INSERT
TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM event_sessions s
    JOIN events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND e.status IN ('published', 'ongoing')
  )
);

DROP POLICY IF EXISTS "delete_own_session_interest" ON session_interests;
CREATE POLICY "delete_own_session_interest"
ON session_interests FOR DELETE
TO authenticated
USING (member_id = auth.uid());

-- 1.8 Grants
GRANT SELECT ON event_sessions    TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON event_sessions    TO authenticated;
GRANT SELECT ON session_speakers  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON session_speakers  TO authenticated;
GRANT SELECT, INSERT, DELETE ON session_interests TO authenticated;


-- =========================================================================
-- 2. Speaker FAQs + speakers column drift (Stutzee 1B)
--    Source: 20260418050002_speaker_faqs.sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS speaker_faqs (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id  UUID           NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  question    TEXT           NOT NULL,
  answer      TEXT           NOT NULL,
  sort_order  INTEGER        NOT NULL DEFAULT 0,
  is_public   BOOLEAN        NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_speaker_faqs_speaker    ON speaker_faqs(speaker_id);
CREATE INDEX IF NOT EXISTS idx_speaker_faqs_sort_order ON speaker_faqs(speaker_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_speaker_faqs_public     ON speaker_faqs(speaker_id, is_public) WHERE is_public = true;

DROP TRIGGER IF EXISTS set_speaker_faqs_updated_at ON speaker_faqs;
CREATE TRIGGER set_speaker_faqs_updated_at
  BEFORE UPDATE ON speaker_faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Close type/DB drift on speakers
ALTER TABLE speakers
  ADD COLUMN IF NOT EXISTS social_media_links       JSONB   DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suitable_topics          TEXT[],
  ADD COLUMN IF NOT EXISTS target_audience          TEXT[],
  ADD COLUMN IF NOT EXISTS session_formats          TEXT[],
  ADD COLUMN IF NOT EXISTS years_of_experience      INTEGER,
  ADD COLUMN IF NOT EXISTS organizations_associated TEXT[],
  ADD COLUMN IF NOT EXISTS notable_achievements     TEXT[],
  ADD COLUMN IF NOT EXISTS typical_session_duration TEXT,
  ADD COLUMN IF NOT EXISTS max_audience_size        INTEGER,
  ADD COLUMN IF NOT EXISTS requires_av_equipment    TEXT[],
  ADD COLUMN IF NOT EXISTS language_proficiency     TEXT[],
  ADD COLUMN IF NOT EXISTS charges_fee              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_range                TEXT,
  ADD COLUMN IF NOT EXISTS availability_status      TEXT    DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS blackout_dates           TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_days           TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_time_slots     TEXT[];

ALTER TABLE speaker_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public speaker FAQs" ON speaker_faqs;
CREATE POLICY "Anyone can read public speaker FAQs"
  ON speaker_faqs FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "Chapter members can read speaker FAQs" ON speaker_faqs;
CREATE POLICY "Chapter members can read speaker FAQs"
  ON speaker_faqs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM speakers s
      WHERE s.id = speaker_faqs.speaker_id
        AND user_belongs_to_chapter(s.chapter_id)
    )
  );

DROP POLICY IF EXISTS "Co-Chair+ can insert speaker FAQs" ON speaker_faqs;
CREATE POLICY "Co-Chair+ can insert speaker FAQs"
  ON speaker_faqs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member')
    )
  );

DROP POLICY IF EXISTS "Co-Chair+ can update speaker FAQs" ON speaker_faqs;
CREATE POLICY "Co-Chair+ can update speaker FAQs"
  ON speaker_faqs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member')
    )
  );

DROP POLICY IF EXISTS "Co-Chair+ can delete speaker FAQs" ON speaker_faqs;
CREATE POLICY "Co-Chair+ can delete speaker FAQs"
  ON speaker_faqs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member')
    )
  );

COMMENT ON TABLE speaker_faqs IS 'Speaker profile FAQs; supports public speaker pages via is_public flag.';


-- =========================================================================
-- 3. Per-attendee QR ticket tokens (Stutzee 2A)
--    Source: 20260418050003_attendee_ticket_tokens.sql
-- =========================================================================

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS ticket_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE event_rsvps
SET ticket_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE ticket_token IS NULL;

ALTER TABLE guest_rsvps
  ADD COLUMN IF NOT EXISTS ticket_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE guest_rsvps
SET ticket_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE ticket_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_ticket_token
  ON event_rsvps(ticket_token);

CREATE INDEX IF NOT EXISTS idx_guest_rsvps_ticket_token
  ON guest_rsvps(ticket_token);

-- Dedupe + uniq event_checkins
DELETE FROM event_checkins a
USING event_checkins b
WHERE a.ctid > b.ctid
  AND a.event_id = b.event_id
  AND a.attendee_type = b.attendee_type
  AND a.attendee_id = b.attendee_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_event_checkins_attendee'
  ) THEN
    ALTER TABLE event_checkins
      ADD CONSTRAINT uq_event_checkins_attendee
      UNIQUE (event_id, attendee_type, attendee_id);
  END IF;
END$$;

COMMENT ON COLUMN event_rsvps.ticket_token IS
  'Opaque 128-bit random token for per-attendee QR ticket. Encoded in check-in URL.';
COMMENT ON COLUMN guest_rsvps.ticket_token IS
  'Opaque 128-bit random token for per-attendee QR ticket. Encoded in check-in URL.';


-- =========================================================================
-- 4. Sponsorship Tier UI (Stutzee 3A)
--    Source: 20260418050004_sponsorship_tier_ui.sql
-- =========================================================================

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE sponsorship_tiers
  ADD COLUMN IF NOT EXISTS benefits_structured JSONB DEFAULT '[]'::jsonb;

UPDATE sponsorship_tiers
SET benefits_structured = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('label', b, 'included', true))
    FROM unnest(benefits) AS b
  ),
  '[]'::jsonb
)
WHERE benefits IS NOT NULL AND array_length(benefits, 1) > 0;

ALTER TABLE sponsorship_tiers DROP COLUMN IF EXISTS benefits;
ALTER TABLE sponsorship_tiers RENAME COLUMN benefits_structured TO benefits;

CREATE INDEX IF NOT EXISTS idx_sponsors_logo
  ON sponsors(logo_url)
  WHERE logo_url IS NOT NULL;


-- =========================================================================
-- 5. Event public_slug (Stutzee 2B)
--    Source: 20260418060001_event_public_slug.sql
-- =========================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_events_public_slug
  ON events(public_slug)
  WHERE public_slug IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'yi_connect'
      AND tablename  = 'events'
      AND policyname = 'anon_view_events_by_slug'
  ) THEN
    CREATE POLICY "anon_view_events_by_slug"
      ON events FOR SELECT
      TO anon
      USING (
        public_slug IS NOT NULL
        AND status IN ('published', 'ongoing', 'completed')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'yi_connect'
      AND tablename  = 'speakers'
      AND policyname = 'anon_view_speakers_for_public_events'
  ) THEN
    CREATE POLICY "anon_view_speakers_for_public_events"
      ON speakers FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1
          FROM session_speakers ss
          JOIN event_sessions es ON es.id = ss.session_id
          JOIN events e ON e.id = es.event_id
          WHERE ss.speaker_id = speakers.id
            AND e.public_slug IS NOT NULL
            AND e.status IN ('published', 'ongoing', 'completed')
        )
      );
  END IF;
END $$;


-- =========================================================================
-- 6. Event custom forms (Stutzee 1C)
--    Source: 20260418060002_event_custom_forms.sql
-- =========================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_form_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.registration_form_fields IS
  'Array of CustomFormField objects. Each field: { id, type, label, required, placeholder?, help_text?, options?, sort_order }.';

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN event_rsvps.custom_field_responses IS
  'Map of custom field id -> user response value. Shape: { [field_id]: string | string[] | boolean | number | null }.';

ALTER TABLE guest_rsvps
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN guest_rsvps.custom_field_responses IS
  'Map of custom field id -> user response value. Same shape as event_rsvps.custom_field_responses.';

CREATE INDEX IF NOT EXISTS idx_event_rsvps_custom_responses
  ON event_rsvps USING gin(custom_field_responses);

CREATE INDEX IF NOT EXISTS idx_guest_rsvps_custom_responses
  ON guest_rsvps USING gin(custom_field_responses);


-- =========================================================================
-- 7. Sponsor lead capture (Stutzee 3D)
--    Source: 20260418060003_sponsor_leads.sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS sponsor_leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id            UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  captured_by_user_id   UUID NOT NULL REFERENCES auth.users(id),
  rsvp_id               UUID REFERENCES event_rsvps(id) ON DELETE SET NULL,
  guest_rsvp_id         UUID REFERENCES guest_rsvps(id) ON DELETE SET NULL,
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  company               TEXT,
  designation           TEXT,
  interest_level        TEXT NOT NULL DEFAULT 'medium'
    CHECK (interest_level IN ('hot', 'warm', 'medium', 'cold')),
  interest_areas        TEXT[],
  notes                 TEXT,
  follow_up_requested   BOOLEAN NOT NULL DEFAULT false,
  follow_up_by          DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_event
  ON sponsor_leads(event_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_sponsor
  ON sponsor_leads(sponsor_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_rsvp
  ON sponsor_leads(rsvp_id)
  WHERE rsvp_id IS NOT NULL;

CREATE OR REPLACE FUNCTION yi_connect.set_sponsor_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sponsor_leads_updated_at ON sponsor_leads;
CREATE TRIGGER trg_sponsor_leads_updated_at
  BEFORE UPDATE ON sponsor_leads
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.set_sponsor_leads_updated_at();

ALTER TABLE sponsor_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EC+ manages sponsor leads" ON sponsor_leads;
CREATE POLICY "EC+ manages sponsor leads" ON sponsor_leads FOR ALL
  USING (
    captured_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'Super Admin', 'National Admin')
    )
  );

DROP POLICY IF EXISTS "EC+ inserts sponsor leads" ON sponsor_leads;
CREATE POLICY "EC+ inserts sponsor leads" ON sponsor_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    captured_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Super Admin', 'National Admin')
    )
  );

COMMENT ON TABLE sponsor_leads IS
  'Leads captured at events on behalf of sponsors (Stutzee 3D). EC+ operate portal; no sponsor-rep login.';


-- =========================================================================
-- 8. Live dashboard RLS + realtime publication (Stutzee 2C)
--    Source: 20260418070001_live_dashboard_rls.sql
-- =========================================================================

DROP POLICY IF EXISTS "Chair+ can view all check-ins for their chapter events"
  ON event_checkins;

CREATE POLICY "Chair+ can view all check-ins for their chapter events"
ON event_checkins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
  )
);

COMMENT ON POLICY "Chair+ can view all check-ins for their chapter events"
  ON event_checkins IS
  'Stutzee 2C: required so the live dashboard Supabase Realtime channel '
  'can deliver INSERT events to Chair+ users. Read-only.';

-- Attach to supabase_realtime publication (now schema-qualified)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'yi_connect'
      AND tablename = 'event_checkins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE yi_connect.event_checkins';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'yi_connect'
      AND tablename = 'event_rsvps'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE yi_connect.event_rsvps';
  END IF;
END$$;


-- =========================================================================
-- 9. Member connections + profile_qr_token (Stutzee 4A)
--    Source: 20260418070002_member_connections.sql
-- =========================================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS profile_qr_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS allow_networking_qr BOOLEAN NOT NULL DEFAULT true;

UPDATE members
SET profile_qr_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE profile_qr_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_profile_qr_token
  ON members(profile_qr_token);

COMMENT ON COLUMN members.profile_qr_token IS
  'Opaque 128-bit random token for permanent profile QR. Separate from event ticket_token.';
COMMENT ON COLUMN members.allow_networking_qr IS
  'When false, /connect landing refuses to show the profile (privacy opt-out).';

CREATE TABLE IF NOT EXISTS member_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_member_id, to_member_id, event_id),
  CHECK (from_member_id <> to_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_connections_from
  ON member_connections(from_member_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_to
  ON member_connections(to_member_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_event
  ON member_connections(event_id);

COMMENT ON TABLE member_connections IS
  'One-way member-to-member connections (LinkedIn follow model). Mutual = two rows.';

ALTER TABLE member_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view own connections" ON member_connections;
CREATE POLICY "Members view own connections"
  ON member_connections
  FOR SELECT
  USING (from_member_id = auth.uid() OR to_member_id = auth.uid());

DROP POLICY IF EXISTS "Members create own connections" ON member_connections;
CREATE POLICY "Members create own connections"
  ON member_connections
  FOR INSERT
  WITH CHECK (from_member_id = auth.uid());

DROP POLICY IF EXISTS "Members update own connection notes" ON member_connections;
CREATE POLICY "Members update own connection notes"
  ON member_connections
  FOR UPDATE
  USING (from_member_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own connections" ON member_connections;
CREATE POLICY "Members delete own connections"
  ON member_connections
  FOR DELETE
  USING (from_member_id = auth.uid());


-- =========================================================================
-- 10. Event Auto-Pilot + Quarterly Reports
--     Source: 20260418080001_event_autopilot.sql
-- =========================================================================

-- 10.1 Extend feature_name enum (may not exist yet in yi_connect; tolerate)
DO $$ BEGIN
  ALTER TYPE feature_name ADD VALUE IF NOT EXISTS 'event_autopilot';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 10.2 event_autopilot_runs
CREATE TABLE IF NOT EXISTS event_autopilot_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  chapter_id        UUID NOT NULL REFERENCES yi.chapters(id),
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by      UUID REFERENCES auth.users(id),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  steps_completed   JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_log         TEXT,
  completed_at      TIMESTAMPTZ,
  UNIQUE (event_id, triggered_at)
);

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_event
  ON event_autopilot_runs(event_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_chapter
  ON event_autopilot_runs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_triggered
  ON event_autopilot_runs(triggered_at DESC);

COMMENT ON TABLE event_autopilot_runs IS
  'Audit log of Event Auto-Pilot runs. steps_completed JSONB records which of the 6 pipeline steps succeeded.';

ALTER TABLE event_autopilot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chapter Chair+ view autopilot runs" ON event_autopilot_runs;
CREATE POLICY "Chapter Chair+ view autopilot runs"
  ON event_autopilot_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = event_autopilot_runs.chapter_id
    )
  );

DROP POLICY IF EXISTS "Chapter Chair+ manage autopilot runs" ON event_autopilot_runs;
CREATE POLICY "Chapter Chair+ manage autopilot runs"
  ON event_autopilot_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = event_autopilot_runs.chapter_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = event_autopilot_runs.chapter_id
    )
  );

-- 10.3 chapter_reports
CREATE TABLE IF NOT EXISTS chapter_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id        UUID NOT NULL REFERENCES yi.chapters(id),
  report_type       TEXT NOT NULL
    CHECK (report_type IN ('quarterly', 'monthly', 'annual')),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  fiscal_year       INTEGER NOT NULL,
  generated_by      UUID NOT NULL REFERENCES auth.users(id),
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url           TEXT,
  data_snapshot     JSONB NOT NULL,
  sent_to_national  BOOLEAN NOT NULL DEFAULT false,
  sent_at           TIMESTAMPTZ,
  UNIQUE (chapter_id, report_type, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_chapter_reports_chapter
  ON chapter_reports(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_reports_fiscal_year
  ON chapter_reports(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_chapter_reports_generated
  ON chapter_reports(generated_at DESC);

COMMENT ON TABLE chapter_reports IS
  'Archive of generated chapter reports to Yi National. data_snapshot stores the exact aggregated data at generation time for auditability.';

ALTER TABLE chapter_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chapter Chair+ and National view reports" ON chapter_reports;
CREATE POLICY "Chapter Chair+ and National view reports"
  ON chapter_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND (
          r.hierarchy_level >= 6
          OR (
            r.hierarchy_level >= 4
            AND EXISTS (
              SELECT 1 FROM profiles p
              WHERE p.id = auth.uid()
                AND p.chapter_id = chapter_reports.chapter_id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Chapter Chair+ manage reports" ON chapter_reports;
CREATE POLICY "Chapter Chair+ manage reports"
  ON chapter_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = chapter_reports.chapter_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = chapter_reports.chapter_id
    )
  );

-- 10.4 member_points_log
CREATE TABLE IF NOT EXISTS member_points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chapter_id  UUID NOT NULL REFERENCES yi.chapters(id),
  points      INTEGER NOT NULL CHECK (points <> 0),
  reason      TEXT NOT NULL,
  action_type TEXT NOT NULL,
  source_id   UUID,
  source_type TEXT,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, action_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_points_log_member
  ON member_points_log(member_id);
CREATE INDEX IF NOT EXISTS idx_points_log_chapter
  ON member_points_log(chapter_id);
CREATE INDEX IF NOT EXISTS idx_points_log_awarded
  ON member_points_log(awarded_at DESC);

COMMENT ON TABLE member_points_log IS
  'Minimal gamification points ledger. Full badge/leaderboard UI deferred — this table exists so quarterly reports can rank top engagement-delta members.';

ALTER TABLE member_points_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own points" ON member_points_log;
CREATE POLICY "Members read own points"
  ON member_points_log
  FOR SELECT
  USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = member_points_log.chapter_id
    )
  );

DROP POLICY IF EXISTS "Chapter Chair+ award points" ON member_points_log;
CREATE POLICY "Chapter Chair+ award points"
  ON member_points_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN profiles p ON ur.user_id = p.id
      WHERE ur.user_id = auth.uid()
        AND r.hierarchy_level >= 4
        AND p.chapter_id = member_points_log.chapter_id
    )
  );


-- =========================================================================
-- 11. Quick RSVP — anonymous token-based public RSVP
--     Source: 20260129000001_quick_rsvp.sql
-- =========================================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS rsvp_token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS idx_events_rsvp_token
ON events(rsvp_token)
WHERE status IN ('published', 'ongoing');

UPDATE events
SET rsvp_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE rsvp_token IS NULL;

-- Anon RLS policies (idempotent via DROP IF EXISTS + CREATE)
DROP POLICY IF EXISTS "anon_view_events_by_token" ON events;
CREATE POLICY "anon_view_events_by_token"
ON events FOR SELECT
TO anon
USING (
  rsvp_token IS NOT NULL
  AND status IN ('published', 'ongoing', 'completed')
);

DROP POLICY IF EXISTS "anon_view_rsvps_by_token" ON event_rsvps;
CREATE POLICY "anon_view_rsvps_by_token"
ON event_rsvps FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing', 'completed')
  )
);

DROP POLICY IF EXISTS "anon_upsert_rsvps_by_token" ON event_rsvps;
CREATE POLICY "anon_upsert_rsvps_by_token"
ON event_rsvps FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing')
  )
);

DROP POLICY IF EXISTS "anon_update_rsvps_by_token" ON event_rsvps;
CREATE POLICY "anon_update_rsvps_by_token"
ON event_rsvps FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing')
  )
);

DROP POLICY IF EXISTS "anon_view_members_for_rsvp" ON members;
CREATE POLICY "anon_view_members_for_rsvp"
ON members FOR SELECT
TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "anon_view_profiles_for_rsvp" ON profiles;
CREATE POLICY "anon_view_profiles_for_rsvp"
ON profiles FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "anon_insert_guest_rsvps" ON guest_rsvps;
CREATE POLICY "anon_insert_guest_rsvps"
ON guest_rsvps FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing')
  )
);

DROP POLICY IF EXISTS "anon_view_guest_rsvps_by_token" ON guest_rsvps;
CREATE POLICY "anon_view_guest_rsvps_by_token"
ON guest_rsvps FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing', 'completed')
  )
);

-- =============================================================================
-- End of Phase E migration
-- =============================================================================
