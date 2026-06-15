-- Bills become per-COMMITTEE instead of per-party-side (interview 2026-06-15).
-- Each topic committee drafts one bill on its topic (handbook model); the old
-- (event_id, party_side) keying didn't match the 5 topic committees students
-- are actually placed in. Safe: 0 bills exist on any event at apply time.
--
-- Applied to live DB (bkmpbcoxbjyafieabxao) via the Management API on 2026-06-15.

alter table yip.bills add column if not exists committee_name text;

-- party_side is no longer the bill's identity (a committee spans both benches).
alter table yip.bills alter column party_side drop not null;

-- One bill per committee per event.
create unique index if not exists bills_event_committee_key
  on yip.bills (event_id, committee_name)
  where committee_name is not null;
