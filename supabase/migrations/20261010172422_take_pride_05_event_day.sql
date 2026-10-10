-- Take Pride 2026: event-day gate and help desk.
--
-- ADDITIVE ONLY. No new tables, no backfill.
--
-- 1. tp_delegates.checked_in_method: how a delegate got through the gate.
--    'name' = a volunteer found them by name (no badge) after checking their
--    face and chapter. 'badge' = scanned or typed badge code. NULL = an
--    older check-in, or the badge path, which does not set it yet.
-- 2. tp_delegates.directory_visible now defaults to TRUE (Director, 10 Oct:
--    real delegates are listed in the delegate directory by default and can
--    hide themselves on their profile). Only the default changes: existing
--    rows keep their value. At the time of writing there are 0 real
--    delegates and all 80 sample delegates are already listed.

alter table yi_connect.tp_delegates
  add column if not exists checked_in_method text
    check (checked_in_method is null or checked_in_method in ('badge', 'name'));

alter table yi_connect.tp_delegates
  alter column directory_visible set default true;
