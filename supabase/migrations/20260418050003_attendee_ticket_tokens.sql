-- ============================================================================
-- Migration: Per-Attendee QR Ticket Tokens (Stutzee Feature 2A)
-- ============================================================================
--
-- Adds unique opaque ticket tokens to event_rsvps and guest_rsvps so each
-- attendee gets a personal QR that identifies THEM (not just the event).
--
-- Security:
--   - 128-bit (16 bytes) random, hex-encoded (32 chars)
--   - Not a JWT. Expiry enforced via event.status
--   - UNIQUE index lets us look up by token in O(1)
--
-- Also adds a UNIQUE constraint on event_checkins to prevent double
-- check-in at the database layer (defense-in-depth beyond app idempotency).
-- ============================================================================

-- Require extensions schema for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- event_rsvps.ticket_token
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS ticket_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- Backfill any rows created before the default fired
UPDATE public.event_rsvps
SET ticket_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE ticket_token IS NULL;

-- ----------------------------------------------------------------------------
-- guest_rsvps.ticket_token
-- ----------------------------------------------------------------------------
ALTER TABLE public.guest_rsvps
  ADD COLUMN IF NOT EXISTS ticket_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE public.guest_rsvps
SET ticket_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE ticket_token IS NULL;

-- ----------------------------------------------------------------------------
-- Indexes for scanner lookups
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_event_rsvps_ticket_token
  ON public.event_rsvps(ticket_token);

CREATE INDEX IF NOT EXISTS idx_guest_rsvps_ticket_token
  ON public.guest_rsvps(ticket_token);

-- ----------------------------------------------------------------------------
-- Prevent double check-in at DB level
-- ----------------------------------------------------------------------------
-- First dedupe any existing duplicates (keep earliest)
DELETE FROM public.event_checkins a
USING public.event_checkins b
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
    ALTER TABLE public.event_checkins
      ADD CONSTRAINT uq_event_checkins_attendee
      UNIQUE (event_id, attendee_type, attendee_id);
  END IF;
END$$;

COMMENT ON COLUMN public.event_rsvps.ticket_token IS
  'Opaque 128-bit random token for per-attendee QR ticket. Encoded in check-in URL.';

COMMENT ON COLUMN public.guest_rsvps.ticket_token IS
  'Opaque 128-bit random token for per-attendee QR ticket. Encoded in check-in URL.';
