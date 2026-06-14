-- YIP: lock students' private demographics from the public (anon) key.
--
-- The public projector reads participants.full_name / school_name /
-- parliament_role / party_side / constituency via the anon key (names + the
-- parliament seat are shown on a public screen by design), so those stay
-- readable. But class / section / city / home_state have NO public reader, and
-- qualified_for_next is result data (results are a super-admin-tier surface) —
-- revoke anon SELECT on these so they are no longer exposed to the internet.
-- (access_code / phone / email / parent_phone were already revoked earlier.)

REVOKE SELECT (class, section, city, home_state, qualified_for_next)
  ON yip.participants FROM anon;
