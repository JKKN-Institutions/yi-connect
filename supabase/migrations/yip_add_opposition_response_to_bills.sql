-- YIP: Leader of Opposition can respond to a government (ruling-side) bill.
--
-- There is exactly one Leader of Opposition per event and at most one official
-- opposition response per bill, so this is two columns on yip.bills (mirroring
-- yip.motions.minister_response), not a separate bill_responses table.
--
-- Security posture: yip.bills has RLS enabled with a SELECT USING(true) policy
-- (bills are House business, already anon-readable) but anon/authenticated have
-- NO write grant, so the response can only be written via the service role behind
-- requireLeadershipRole(['leader_of_opposition']). The new columns inherit the
-- table's existing column grants (SELECT to anon/authenticated; no write) — no
-- extra GRANT/REVOKE needed.

ALTER TABLE yip.bills
  ADD COLUMN IF NOT EXISTS opposition_response text,
  ADD COLUMN IF NOT EXISTS opposition_response_at timestamptz;

COMMENT ON COLUMN yip.bills.opposition_response IS
  'Official Opposition response to this government bill, written by the Leader of Opposition (or organiser overrule).';
COMMENT ON COLUMN yip.bills.opposition_response_at IS
  'When the Opposition response was last saved.';
