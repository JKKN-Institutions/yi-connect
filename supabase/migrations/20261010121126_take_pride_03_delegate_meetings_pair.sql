-- Take Pride 2026: one meeting request per PAIR of delegates, whichever way.
--
-- ADDITIVE ONLY: one new unique index on tp_delegate_meetings. The existing
-- unique (from_delegate_id, to_delegate_id) stops repeats in one direction;
-- this stops A->B and B->A both existing, even when both delegates tap
-- "Ask to meet" at the same moment (the app's reverse check is not atomic).
-- Matches the app's design: a request between two delegates, once answered
-- either way, is the one record for that pair.

create unique index if not exists tp_delegate_meetings_pair_key
  on yi_connect.tp_delegate_meetings (
    least(from_delegate_id, to_delegate_id),
    greatest(from_delegate_id, to_delegate_id)
  );
