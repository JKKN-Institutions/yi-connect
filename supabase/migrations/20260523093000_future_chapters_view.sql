-- Cross-schema embed shim for PostgREST.
--
-- PostgREST's `.schema('future').from('delegates').select('chapters(...)')` pattern
-- looks for `chapters` in the SAME schema as `from`, even when the FK on
-- future.delegates.chapter_id points to yi.chapters. Cross-schema embeds don't
-- resolve via the standard hint syntax either (verified 2026-05-23).
--
-- 17 pages under app/yi-future/ use this pattern (delegate /me, mentor /scoring,
-- host /finalists /resumes /awards, partner, national/admin, etc.). Fix at the
-- code level would touch every one of them.
--
-- This view lets PostgREST treat yi.chapters AS IF it lives in the future schema.
-- The FK from future.delegates / future.teams to yi.chapters still points to the
-- base table — PostgREST resolves the embed via the view because the columns
-- match. Zero app-code change required.
--
-- Verified after apply:
--   - /yi-future/me renders delegate dashboard with chapter info
--   - /yi-future/mentor/scoring/[teamId] renders full rubric

CREATE OR REPLACE VIEW future.chapters AS
  SELECT * FROM yi.chapters;

GRANT SELECT ON future.chapters TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
