-- YIP participant web-push subscriptions.
--
-- Students authenticate with an access code (no Supabase Auth user), so they
-- can't use the user_id-keyed yi_connect push store. This table keys a browser
-- push subscription to a participant id, so @-mentions can reach their phone.
-- Service-role only (RLS on, no anon/authenticated grants) — written only via
-- the gated actions in app/yip/actions/push.ts. endpoint is UNIQUE so a device
-- re-subscribing (or a new student on a shared device) upserts cleanly.
--
-- (chat_messages.mentions was added in yip_chat_reactions_reply_pin.sql.)
-- Applied to prod via the Supabase Management API 2026-06-28.
CREATE TABLE IF NOT EXISTS yip.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES yip.participants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS yip_push_participant
  ON yip.push_subscriptions (participant_id) WHERE is_active;
ALTER TABLE yip.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.push_subscriptions FROM anon, authenticated;
