-- ============================================================================
-- Migration: Live Event Big-Screen Dashboard (Stutzee Feature 2C)
-- ============================================================================
--
-- Enables Chair+ (hierarchy_level >= 3) to SELECT all check-ins so the live
-- kiosk dashboard can subscribe to INSERTs via Supabase Realtime.
--
-- Realtime `postgres_changes` respects RLS on the SUBSCRIBER's connection —
-- without this policy a Chair's browser WebSocket would never receive any
-- INSERT events for rows they don't "own" per the baseline RLS.
--
-- Also ensures `event_checkins` + `event_rsvps` are attached to the default
-- `supabase_realtime` publication so INSERT/UPDATE events are streamed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Chair+ SELECT policy on event_checkins
-- ----------------------------------------------------------------------------
-- Any user whose highest role hierarchy_level >= 3 (Co-Chair, Chair,
-- Executive Member, National Admin, Super Admin) can read every check-in row.
-- Chapter scoping is enforced by the dashboard page's eventId filter; this
-- policy only governs raw table visibility for the Realtime subscription.
DROP POLICY IF EXISTS "Chair+ can view all check-ins for their chapter events"
  ON public.event_checkins;

CREATE POLICY "Chair+ can view all check-ins for their chapter events"
ON public.event_checkins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
  )
);

COMMENT ON POLICY "Chair+ can view all check-ins for their chapter events"
  ON public.event_checkins IS
  'Stutzee 2C: required so the live dashboard Supabase Realtime channel '
  'can deliver INSERT events to Chair+ users. Read-only.';

-- ----------------------------------------------------------------------------
-- 2. Add tables to supabase_realtime publication (idempotent)
-- ----------------------------------------------------------------------------
-- Supabase Realtime only replicates rows from tables explicitly listed in
-- the `supabase_realtime` publication. Prior migrations did not add these.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_checkins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checkins';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_rsvps'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps';
  END IF;
END$$;
