-- 20260703100000_yip_volunteer_station_speaker_desk.sql
--
-- "Now Speaking" becomes an explicitly ASSIGNABLE volunteer station instead of an
-- event-wide tool any volunteer could open. Adds the `speaker_desk` value to the
-- public.volunteer_station enum so:
--   * organisers can assign "Now Speaking (Speaker's aide)" from the event
--     Volunteers roster (the dropdown reads VOLUNTEER_STATIONS), and
--   * the Now Speaking console gates FAIL-CLOSED to it via
--     requireVolunteerStation(eventId, ["speaker_desk"]).
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block and the
-- new value cannot be used in the same transaction. The Management API runs each
-- statement as its own autocommit txn. Placed AFTER 'stage_manager' to match the
-- VOLUNTEER_STATIONS ordering in lib/yip/volunteers.ts.
ALTER TYPE public.volunteer_station
  ADD VALUE IF NOT EXISTS 'speaker_desk' AFTER 'stage_manager';
