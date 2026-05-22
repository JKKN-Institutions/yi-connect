-- ============================================================================
-- Migration: Member-to-Member Scan-to-Connect Networking (Stutzee Feature 4A)
-- ============================================================================
--
-- Adds:
--   1. Permanent per-member profile QR token (distinct from event ticket_token)
--   2. Networking opt-out flag on members
--   3. member_connections table (one-way, LinkedIn follow-style)
--
-- Design: One-way. If both sides scan each other at the same event, two rows
-- exist and the UI surfaces it as "mutual". No pending/accept flow — avoids
-- friction at live networking events. A separate accepted_at column can be
-- added later to upgrade to mutual-required without data loss.
-- ============================================================================

-- Required for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- members.profile_qr_token + allow_networking_qr
-- ----------------------------------------------------------------------------
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS profile_qr_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS allow_networking_qr BOOLEAN NOT NULL DEFAULT true;

-- Backfill any rows created before the default fired
UPDATE public.members
SET profile_qr_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE profile_qr_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_profile_qr_token
  ON public.members(profile_qr_token);

COMMENT ON COLUMN public.members.profile_qr_token IS
  'Opaque 128-bit random token for permanent profile QR. Separate from event ticket_token.';
COMMENT ON COLUMN public.members.allow_networking_qr IS
  'When false, /connect landing refuses to show the profile (privacy opt-out).';

-- ----------------------------------------------------------------------------
-- member_connections (one-way follow model)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  to_member_id    UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_member_id, to_member_id, event_id),
  CHECK (from_member_id <> to_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_connections_from
  ON public.member_connections(from_member_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_to
  ON public.member_connections(to_member_id);
CREATE INDEX IF NOT EXISTS idx_member_connections_event
  ON public.member_connections(event_id);

COMMENT ON TABLE public.member_connections IS
  'One-way member-to-member connections (LinkedIn follow model). Mutual = two rows.';

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.member_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view own connections" ON public.member_connections;
CREATE POLICY "Members view own connections"
  ON public.member_connections
  FOR SELECT
  USING (from_member_id = auth.uid() OR to_member_id = auth.uid());

DROP POLICY IF EXISTS "Members create own connections" ON public.member_connections;
CREATE POLICY "Members create own connections"
  ON public.member_connections
  FOR INSERT
  WITH CHECK (from_member_id = auth.uid());

DROP POLICY IF EXISTS "Members update own connection notes" ON public.member_connections;
CREATE POLICY "Members update own connection notes"
  ON public.member_connections
  FOR UPDATE
  USING (from_member_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own connections" ON public.member_connections;
CREATE POLICY "Members delete own connections"
  ON public.member_connections
  FOR DELETE
  USING (from_member_id = auth.uid());
