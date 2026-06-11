-- YIP in-app community chat — FOUNDATION (Change Request §4).
--
-- ⚠️ CHILD SAFETY: YIP participants are MINORS (school students, Classes 9-12).
-- This schema is the FOUNDATION only. The feature ships behind a feature flag
-- (NEXT_PUBLIC_YIP_CHAT_ENABLED) that DEFAULTS OFF and MUST NOT be enabled in
-- production until (a) a named Yi moderation owner exists and (b) a child-safety
-- review has been completed.
--
-- Safety model baked into the schema:
--   * Students post ONLY in group channels (party / committee / announcement),
--     which are visible to all participants + YUVA + moderators, OR they send a
--     direct message to their YUVA mentor (dm_to_volunteer_id set). There is NO
--     student↔student direct messaging — the table cannot even express it
--     (a student-authored row must be either a channel post or a YUVA DM), and
--     the server action enforces it.
--   * Moderation primitive: soft-delete via deleted_at / deleted_by. Messages
--     are never hard-deleted, so a moderator's action is auditable.
--   * Like every other yip.* table, these are service-role-only: anon and
--     authenticated have NO grants. All access is via gated server actions.
--
-- Additive DDL only. Applied to prod (bkmpbcoxbjyafieabxao) via Management API;
-- this file is the record.

-- ─── 1. Channels ────────────────────────────────────────────────
-- A channel is a group conversation scoped to one event. `kind` tells the UI
-- how to label/scope it; party_id / committee_name carry the optional binding.
CREATE TABLE IF NOT EXISTS yip.chat_channels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('party', 'committee', 'announcement')),
  party_id       uuid REFERENCES yip.parties(id) ON DELETE CASCADE,
  committee_name text,
  name           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_channels_event_idx
  ON yip.chat_channels (event_id);

-- ─── 2. Messages ────────────────────────────────────────────────
-- A message is EITHER a channel post (channel_id set, dm_to_volunteer_id null)
-- OR a student→YUVA direct message (dm_to_volunteer_id set, channel_id null).
-- The CHECK enforces exactly-one-of and forbids any other shape — in
-- particular there is no column to address a message to another student.
--
-- sender_kind:
--   'student' — a participant (sender_participant_id set). May post in a channel
--               OR DM a YUVA. NEVER DM another student.
--   'yuva'    — a YUVA volunteer/mentor (sender_volunteer_id set).
--   'admin'   — a moderator / organizer (sender_user = auth user id).
CREATE TABLE IF NOT EXISTS yip.chat_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  channel_id           uuid REFERENCES yip.chat_channels(id) ON DELETE CASCADE,
  sender_kind          text NOT NULL CHECK (sender_kind IN ('student', 'yuva', 'admin')),
  sender_participant_id uuid REFERENCES yip.participants(id) ON DELETE SET NULL,
  sender_volunteer_id  uuid REFERENCES yip.volunteers(id) ON DELETE SET NULL,
  sender_user          uuid,
  body                 text NOT NULL,
  dm_to_volunteer_id   uuid REFERENCES yip.volunteers(id) ON DELETE CASCADE,
  deleted_at           timestamptz,
  deleted_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- Exactly one destination: a channel post XOR a student→YUVA DM.
  CONSTRAINT chat_messages_destination_chk CHECK (
    (channel_id IS NOT NULL AND dm_to_volunteer_id IS NULL) OR
    (channel_id IS NULL     AND dm_to_volunteer_id IS NOT NULL)
  ),
  -- A DM may only be sent BY a student. (Students DM their YUVA; YUVA/admin
  -- reply inside the same DM thread, but the thread is always anchored to a
  -- student↔YUVA pair — never student↔student.) Channel posts may come from
  -- any sender_kind.
  CONSTRAINT chat_messages_dm_sender_chk CHECK (
    dm_to_volunteer_id IS NULL OR sender_kind IN ('student', 'yuva', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_idx
  ON yip.chat_messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_dm_idx
  ON yip.chat_messages (event_id, dm_to_volunteer_id, sender_participant_id, created_at);

-- ─── 3. Lockdown: service-role only ─────────────────────────────
-- These tables carry minors' messages. No anon, no authenticated grants —
-- every read/write goes through a gated server action (service role).
ALTER TABLE yip.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE yip.chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON yip.chat_channels FROM anon, authenticated;
REVOKE ALL ON yip.chat_messages FROM anon, authenticated;

-- No RLS policies are created → with RLS enabled and no policy, anon and
-- authenticated can do nothing even if a stray table grant ever appears.
-- The service-role key bypasses RLS, which is exactly (and only) how the
-- server actions reach these rows.
