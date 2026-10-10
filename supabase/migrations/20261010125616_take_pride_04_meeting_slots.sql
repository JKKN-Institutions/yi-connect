-- Take Pride 2026: a time and a table for each accepted meeting.
--
-- ADDITIVE ONLY. Two new nullable columns on each meeting table:
--   slot_key  which 15-minute networking slot, e.g. 'd1-13:15' (day 1, 13:15).
--             Slots are computed from tp_agenda rows of kind 'meetings'
--             (lib/take-pride/slots.ts), so nothing else is stored.
--   table_no  meeting point: Table 1..40 in the Partner lounge.
-- tp_meetings.slot (text) already exists and is left untouched.
--
-- One partial unique index per table stops a table being booked twice in
-- the same slot WITHIN that table. A table shared ACROSS both tables, and a
-- person double-booked, are checked by the app (re-check after write, take
-- the change back on a clash). Only ACCEPTED meetings hold a slot, so a
-- meeting declined later never blocks a table.
-- Same access model as take_pride_01: RLS ENABLED, ZERO policies,
-- service client only. No new tables, so no grants change.

alter table yi_connect.tp_delegate_meetings
  add column if not exists slot_key text,
  add column if not exists table_no integer check (table_no is null or table_no > 0);

alter table yi_connect.tp_meetings
  add column if not exists slot_key text,
  add column if not exists table_no integer check (table_no is null or table_no > 0);

create unique index if not exists tp_delegate_meetings_slot_table_key
  on yi_connect.tp_delegate_meetings (slot_key, table_no)
  where slot_key is not null and status = 'accepted';

create unique index if not exists tp_meetings_slot_table_key
  on yi_connect.tp_meetings (slot_key, table_no)
  where slot_key is not null and status = 'accepted';
