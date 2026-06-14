-- YIP bug-sweep: live-DB security hygiene (defense-in-depth).
--
-- Found by an anon-key pentest of the live DB:
--  1. vote_audit + position_bonus_config had RLS DISABLED — only an absent anon
--     grant was stopping a leak. Enable RLS (deny-by-default; service-role
--     bypasses, so app reads are unaffected).
--  2. anon held vestigial INSERT/UPDATE/DELETE/TRUNCATE grants on 5 content
--     tables (writes were blocked by RLS row policies, but the grant should not
--     exist — one stray permissive policy would make them anon-writable). The
--     app writes these via the service role, so revoking anon writes is safe.

ALTER TABLE yip.vote_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE yip.position_bonus_config ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON yip.agenda_speakers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON yip.event_topics   FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON yip.media          FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON yip.topics         FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON yip.constituencies FROM anon;
