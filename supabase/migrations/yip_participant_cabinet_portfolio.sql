-- Cabinet/Shadow Minister portfolio model.
--
-- When an event configures its cabinet on the Cabinet tab (events.cabinet_ministries),
-- a Cabinet Minister / Shadow Minister holds a MINISTRY portfolio that is
-- independent of the committee they sit in (ministries != committees). This
-- column records which ministry label that minister holds. NULL for everyone
-- else and for events still on the legacy committee-scoped model.
--
-- Applied to prod via the Supabase Management API 2026-06-28.
ALTER TABLE yip.participants ADD COLUMN IF NOT EXISTS cabinet_portfolio text;

COMMENT ON COLUMN yip.participants.cabinet_portfolio IS
  'Ministry label held by a cabinet_minister/shadow_minister when the event uses the Cabinet-tab portfolio model (events.cabinet_ministries). NULL otherwise. Decoupled from committee_name.';
