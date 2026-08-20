-- ═══════════════════════════════════════════════════════════════════
-- YIP WhatsApp group invite links — parties and committees
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- Every student belongs to one PARTY and one COMMITTEE, and each of those has
-- its own WhatsApp group. When an organiser emails access codes from the
-- Participants tab, the email should also carry the invite links for that
-- student's own party and committee, so a student receives everything they
-- need in one message instead of chasing links on the day.
--
-- Two objects, both additive with safe defaults, so nothing changes for any
-- running event until an organiser types a link in:
--
--   1. yip.parties.whatsapp_invite_url
--        Parties are a real per-event table, so the link is simply a column on
--        the party it belongs to.
--
--   2. yip.events.committee_whatsapp
--        Committees are NOT a table — they live as the keys of
--        events.committee_topics. So the links are a jsonb map on the event,
--        keyed by the committee NUMBER as text: { "1": "https://chat.whatsapp…" }.
--
--        Keyed by NUMBER, deliberately, NOT by committee name. The number is a
--        committee's identity (Director, 2026-08-14): a chapter runs
--        "Committee 1..N" and attributes a ministry to each number later. If
--        these links were keyed by name, attributing "Ministry of Health" to
--        Committee 3 would silently orphan Committee 3's group link. Keyed by
--        number, the link follows the same students through any renaming.
-- ═══════════════════════════════════════════════════════════════════

alter table yip.parties
  add column if not exists whatsapp_invite_url text;

comment on column yip.parties.whatsapp_invite_url is
  'WhatsApp group invite link for this party, sent to its members with their access code. Organiser-entered on the Parties tab.';

alter table yip.events
  add column if not exists committee_whatsapp jsonb not null default '{}'::jsonb;

comment on column yip.events.committee_whatsapp is
  'WhatsApp group invite links for this event''s committees, keyed by committee NUMBER as text: {"1":"https://chat.whatsapp.com/..."}. Keyed by number (not name) so a link survives a chapter attributing or changing the ministry attached to that number.';

-- No RLS change: both live on tables that are already server-action-only for
-- writes, and every write path is gated on getYipEventAccess(eventId).canManage.
