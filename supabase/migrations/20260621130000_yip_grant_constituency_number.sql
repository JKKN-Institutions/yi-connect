-- Column-scoped SELECT grant for participants.constituency_number.
--
-- yip.participants has COLUMN-level SELECT grants for authenticated/anon (a
-- prior security fix replaced table-wide SELECT with an explicit column list).
-- A new column is therefore NOT readable by those roles until granted — and the
-- allocation page selects constituency_number via the USER (authenticated)
-- client, so without this grant the whole participants query fails and every
-- event shows "No Participants Yet". Match the sibling constituency_name/
-- committee_number columns, which are already granted to both roles.

grant select (constituency_number) on yip.participants to authenticated;
grant select (constituency_number) on yip.participants to anon;
