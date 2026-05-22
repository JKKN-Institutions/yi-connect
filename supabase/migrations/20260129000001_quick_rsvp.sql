-- Quick RSVP: Token-based public event RSVP
-- Allows anonymous access to RSVP pages via unique tokens

-- 0. Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Add rsvp_token column to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS rsvp_token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- 2. Index for fast token lookups (only published events)
CREATE INDEX IF NOT EXISTS idx_events_rsvp_token
ON public.events(rsvp_token)
WHERE status IN ('published', 'ongoing');

-- 3. Backfill existing events with tokens
UPDATE public.events
SET rsvp_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE rsvp_token IS NULL;

-- 4. RLS Policies for anonymous (anon) access

-- Allow anon to read published events by token
CREATE POLICY "anon_view_events_by_token"
ON public.events FOR SELECT
TO anon
USING (
  rsvp_token IS NOT NULL
  AND status IN ('published', 'ongoing', 'completed')
);

-- Allow anon to read event_rsvps for events they can see by token
CREATE POLICY "anon_view_rsvps_by_token"
ON public.event_rsvps FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing', 'completed')
  )
);

-- Allow anon to insert/update event_rsvps (for tap-to-RSVP)
CREATE POLICY "anon_upsert_rsvps_by_token"
ON public.event_rsvps FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing')
  )
);

CREATE POLICY "anon_update_rsvps_by_token"
ON public.event_rsvps FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing')
  )
);

-- Allow anon to read members (names + avatars only for RSVP display)
CREATE POLICY "anon_view_members_for_rsvp"
ON public.members FOR SELECT
TO anon
USING (is_active = true);

-- Allow anon to read profiles (names + avatars for RSVP display)
CREATE POLICY "anon_view_profiles_for_rsvp"
ON public.profiles FOR SELECT
TO anon
USING (true);

-- Allow anon to insert guest_rsvps (for non-member guests)
CREATE POLICY "anon_insert_guest_rsvps"
ON public.guest_rsvps FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing')
  )
);

-- Allow anon to read guest_rsvps for token-accessible events
CREATE POLICY "anon_view_guest_rsvps_by_token"
ON public.guest_rsvps FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id
    AND e.rsvp_token IS NOT NULL
    AND e.status IN ('published', 'ongoing', 'completed')
  )
);
