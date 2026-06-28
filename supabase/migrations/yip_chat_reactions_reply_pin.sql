-- YIP chat: WhatsApp-style message features (reply, reactions, pin, mentions).
--
-- reply_to_id  — a message can quote another message in the same channel/thread.
-- pinned_at/by — organisers pin a message to the top of a channel (wired in a
--                follow-up PR; columns added here).
-- mentions     — resolved @mention participant ids (wired in a follow-up PR).
-- chat_message_reactions — one row per (message, emoji, reactor); aggregated to
--                emoji+count by the gated chat actions. Service-role only, same
--                as chat_messages (RLS on, no anon/authenticated grants).
--
-- Applied to prod via the Supabase Management API 2026-06-28.
ALTER TABLE yip.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid
  REFERENCES yip.chat_messages(id) ON DELETE SET NULL;
ALTER TABLE yip.chat_messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE yip.chat_messages ADD COLUMN IF NOT EXISTS pinned_by uuid;
ALTER TABLE yip.chat_messages ADD COLUMN IF NOT EXISTS mentions jsonb;

CREATE TABLE IF NOT EXISTS yip.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES yip.chat_messages(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  reactor_kind text NOT NULL,            -- 'student' | 'yuva' | 'admin'
  reactor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_reaction_unique
  ON yip.chat_message_reactions (message_id, emoji, reactor_kind, reactor_id);
CREATE INDEX IF NOT EXISTS chat_reaction_msg
  ON yip.chat_message_reactions (message_id);

ALTER TABLE yip.chat_message_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.chat_message_reactions FROM anon, authenticated;
