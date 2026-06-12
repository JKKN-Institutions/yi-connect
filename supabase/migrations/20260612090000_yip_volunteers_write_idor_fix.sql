-- Close the yip.volunteers authenticated write-IDOR (found by the 2026-06-12
-- Layer-3 QA sweep; the open #324/#328 follow-up). The table had INSERT/UPDATE/
-- DELETE granted to `authenticated`, gated only by a policy checking
-- `auth.uid() IS NOT NULL` (no event/chapter ownership) — so any logged-in Yi
-- user could write volunteer rows (incl. access_code) for ANY event via raw
-- PostgREST. All legitimate volunteer mutations go through canManage-gated
-- server actions on the service-role client, so revoking the direct grant makes
-- volunteers service-role-only for writes, matching every other yip.* table.
-- Applied to the live DB 2026-06-12.

REVOKE INSERT, UPDATE, DELETE ON yip.volunteers FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON yip.volunteers FROM anon;
DROP POLICY IF EXISTS "Volunteers manageable by organizer" ON yip.volunteers;
