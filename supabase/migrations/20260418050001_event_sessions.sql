-- =============================================================================
-- Event Sessions: Multi-session agenda for events (Stutzee Feature 1A)
-- =============================================================================
-- Adds structured session schedule to events with speaker assignments and
-- member interest tracking. Event RSVP flow is unchanged; per-session
-- interest is lightweight (no capacity enforcement).
-- =============================================================================

-- 1. Session type enum
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

-- 2. event_sessions table
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_event_sessions_event_id ON public.event_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_start    ON public.event_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_event_sessions_sort     ON public.event_sessions(event_id, sort_order);

-- 3. session_speakers junction (speakers table already exists in stakeholder CRM)
CREATE TABLE IF NOT EXISTS public.session_speakers (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID  NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  speaker_id   UUID  NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  role         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, speaker_id)
);

CREATE INDEX IF NOT EXISTS idx_session_speakers_session ON public.session_speakers(session_id);
CREATE INDEX IF NOT EXISTS idx_session_speakers_speaker ON public.session_speakers(speaker_id);

-- 4. session_interests table (lightweight per-session interest signal)
CREATE TABLE IF NOT EXISTS public.session_interests (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID  NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  member_id   UUID  NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_session_interests_session ON public.session_interests(session_id);
CREATE INDEX IF NOT EXISTS idx_session_interests_member  ON public.session_interests(member_id);

-- 5. Trigger to maintain current_interest counter
CREATE OR REPLACE FUNCTION public.update_session_interest_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.event_sessions
  SET current_interest = (
    SELECT COUNT(*) FROM public.session_interests
    WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_session_interest ON public.session_interests;
CREATE TRIGGER trigger_update_session_interest
AFTER INSERT OR DELETE ON public.session_interests
FOR EACH ROW EXECUTE FUNCTION public.update_session_interest_count();

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_event_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_event_sessions_updated ON public.event_sessions;
CREATE TRIGGER trigger_touch_event_sessions_updated
BEFORE UPDATE ON public.event_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_event_session_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE public.event_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_speakers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_interests ENABLE ROW LEVEL SECURITY;

-- Helper: admin-or-organizer check
-- Co-Chair+ hierarchy_level >= 4 OR event organizer can manage sessions

-- event_sessions: SELECT (authenticated)
DROP POLICY IF EXISTS "view_sessions_for_published_events" ON public.event_sessions;
CREATE POLICY "view_sessions_for_published_events"
ON public.event_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND (
        e.status IN ('published', 'ongoing', 'completed')
        OR e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

-- event_sessions: SELECT (anon - public events by rsvp_token)
DROP POLICY IF EXISTS "anon_view_sessions_by_token" ON public.event_sessions;
CREATE POLICY "anon_view_sessions_by_token"
ON public.event_sessions FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND e.rsvp_token IS NOT NULL
      AND e.status IN ('published', 'ongoing', 'completed')
  )
);

-- event_sessions: INSERT / UPDATE / DELETE (Co-Chair+ or organizer)
DROP POLICY IF EXISTS "manage_sessions_admin_or_organizer" ON public.event_sessions;
CREATE POLICY "manage_sessions_admin_or_organizer"
ON public.event_sessions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

-- session_speakers: SELECT
DROP POLICY IF EXISTS "view_session_speakers" ON public.session_speakers;
CREATE POLICY "view_session_speakers"
ON public.session_speakers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.status IN ('published', 'ongoing', 'completed')
        OR e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

-- session_speakers: anon (via rsvp_token)
DROP POLICY IF EXISTS "anon_view_session_speakers" ON public.session_speakers;
CREATE POLICY "anon_view_session_speakers"
ON public.session_speakers FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.event_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND e.rsvp_token IS NOT NULL
      AND e.status IN ('published', 'ongoing', 'completed')
  )
);

-- session_speakers: manage (organizer or Co-Chair+)
DROP POLICY IF EXISTS "manage_session_speakers" ON public.session_speakers;
CREATE POLICY "manage_session_speakers"
ON public.session_speakers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

-- session_interests: members can view their own + organizer can see all for the event
DROP POLICY IF EXISTS "view_session_interests" ON public.session_interests;
CREATE POLICY "view_session_interests"
ON public.session_interests FOR SELECT
TO authenticated
USING (
  member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.event_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND (
        e.organizer_id = auth.uid()
        OR COALESCE(public.get_user_hierarchy_level(auth.uid()), 0) >= 4
      )
  )
);

-- session_interests: member manages their own interest rows
DROP POLICY IF EXISTS "insert_own_session_interest" ON public.session_interests;
CREATE POLICY "insert_own_session_interest"
ON public.session_interests FOR INSERT
TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.event_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id
      AND e.status IN ('published', 'ongoing')
  )
);

DROP POLICY IF EXISTS "delete_own_session_interest" ON public.session_interests;
CREATE POLICY "delete_own_session_interest"
ON public.session_interests FOR DELETE
TO authenticated
USING (member_id = auth.uid());

-- =============================================================================
-- Grants
-- =============================================================================
GRANT SELECT ON public.event_sessions    TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_sessions    TO authenticated;
GRANT SELECT ON public.session_speakers  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.session_speakers  TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.session_interests TO authenticated;
