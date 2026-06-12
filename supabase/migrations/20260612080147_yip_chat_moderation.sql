-- YIP in-app community chat — MODERATION layer (pre-event security sweep).
--
-- The chat feature sits behind NEXT_PUBLIC_YIP_CHAT_ENABLED (enabled in prod
-- 2026-06-12). This migration adds the moderation primitives — moderators are
-- the chapter chair + organisers (canManage):
--   * freeze a channel        → chat_channels.frozen_at
--   * student report button   → chat_messages.reported_at / reported_by_participant_id
--   * mute a student          → yip.chat_mutes (one row per event+participant)
--
-- Retention policy note (no cron needed now): chat messages are retained for
-- the duration of the event + 90 days, after which they may be purged by an
-- operational job. Soft-deleted messages (deleted_at) are part of the audit
-- trail and follow the same retention window.
--
-- Additive DDL only. APPLIED to prod 2026-06-12 via the Management API.

-- ─── 1. Channel freeze ──────────────────────────────────────────
-- frozen_at non-null ⇒ the channel is paused: no new posts are accepted by the
-- server actions. Stamp is kept (not boolean) so the action is auditable.
ALTER TABLE yip.chat_channels
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

-- ─── 2. Student reports ─────────────────────────────────────────
-- First report wins: reported_at / reported_by_participant_id are set once and
-- later reports are no-ops. ON DELETE SET NULL keeps the report flag even if
-- the reporting participant row is removed.
ALTER TABLE yip.chat_messages
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS reported_by_participant_id uuid
    REFERENCES yip.participants(id) ON DELETE SET NULL;

-- Moderation queue lookup: undeleted reported messages per event.
CREATE INDEX IF NOT EXISTS chat_messages_reported_idx
  ON yip.chat_messages (event_id, reported_at)
  WHERE reported_at IS NOT NULL;

-- ─── 3. Mutes ───────────────────────────────────────────────────
-- One row = this participant may not post (channels OR YUVA DMs) in this
-- event. muted_by is the acting organiser's auth user id (audit stamp).
CREATE TABLE IF NOT EXISTS yip.chat_mutes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES yip.participants(id) ON DELETE CASCADE,
  muted_by       uuid,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, participant_id)
);

CREATE INDEX IF NOT EXISTS chat_mutes_event_idx
  ON yip.chat_mutes (event_id);

-- ─── 4. Lockdown: service-role only ─────────────────────────────
-- Same posture as 20260611140000_yip_chat.sql: RLS on, zero anon/authenticated
-- grants, no policies. The ONLY access path is the gated server actions
-- (service role bypasses RLS).
ALTER TABLE yip.chat_mutes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON yip.chat_mutes FROM anon, authenticated;

-- No RLS policies are created → with RLS enabled and no policy, anon and
-- authenticated can do nothing even if a stray table grant ever appears.
