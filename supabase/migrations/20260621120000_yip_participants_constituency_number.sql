-- YIP: add participants.constituency_number (the MP's seat number).
--
-- Standardised across BOTH allocation paths:
--   • Manual upload (the National Team's 5-column sheet) supplies it per row.
--   • Auto-allocate assigns a sequential seat number (1..N) — our constituency
--     list carries names but no official Lok Sabha numbers.
--
-- Nullable: older events + students with no constituency yet simply have null.

alter table yip.participants add column if not exists constituency_number integer;
