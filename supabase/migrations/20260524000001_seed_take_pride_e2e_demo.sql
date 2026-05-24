-- Seed Take Pride Award E2E demo data so TSTJRY jury can score a real ballot.
--
-- Bootstraps a fully-populated scenario in the Siliguri chapter under the
-- existing Future 6.0 edition:
--   - 1 chapter_final event
--   - 4 additional teams (Smart Warriors already exists)
--   - 3 demo delegate captains for the new teams
--   - 5 jury_team_assignments linking TSTJRY -> every Siliguri team
--
-- Before this seed: TSTJRY logs in and sees "No event configured yet"
-- After this seed:  TSTJRY logs in -> 5 pending teams -> score -> leaderboard works
--
-- Idempotent via ON CONFLICT DO NOTHING + deterministic UUIDs prefixed 5eeed00d-*
-- so re-runs are safe and rows are recognisable as seed data.

BEGIN;

-- Existing entities referenced (all already in production):
--   edition   878ec4a0-0573-4df1-b659-ef7fe2ca2823  Future 6.0
--   chapter   c201f9a5-de89-4cbf-bea8-300f7f6e3cea  Siliguri
--   jury      91e301ee-fa2b-41ab-943d-3b729110c4b1  TSTJRY (jury_assignments row)
--   team_sw   93af41a5-8afa-47e7-bbd8-8fe0d9d47c6a  The Smart Warriors
--   track     e8382589-8118-4ad1-8e58-9a478e0d4462  climate_change
--   delegate  41c337a8-9768-4744-baae-9a3d22cae619  Meera Krishnan (DEMO28)

-- 1. Chapter final event for Siliguri
INSERT INTO future.events (
  id, edition_id, chapter_id, track_id, type,
  name, tagline, start_date, end_date, venue, is_published
) VALUES (
  '5eeed00d-e0e0-4001-aaaa-000000000001',
  '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
  'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
  'e8382589-8118-4ad1-8e58-9a478e0d4462',
  'chapter_final',
  'Siliguri Chapter Final 2026',
  'Yi Future 6.0 — Chapter showcase',
  '2026-07-20',
  '2026-07-20',
  'Siliguri Convention Centre',
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Wire TSTJRY jury assignment to this event
UPDATE future.jury_assignments
   SET event_id = '5eeed00d-e0e0-4001-aaaa-000000000001'
 WHERE id = '91e301ee-fa2b-41ab-943d-3b729110c4b1'
   AND event_id IS NULL;

-- 3. Seed 3 demo captains so we have enough delegates to lead 4 new teams
--    (Meera Krishnan already exists and captains one of the new teams)
INSERT INTO future.delegates (
  id, edition_id, chapter_id, full_name, course, year_of_study,
  home_state, is_active, preferred_track_slug, profile_completion_pct,
  points, badges, interest_internships, interest_jobs, interest_workshops
) VALUES
  ('5eeed00d-de1e-4001-bbbb-000000000001',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Aisha Roy (Demo Captain)', 'BA Public Policy', 3,
   'West Bengal', true, 'climate_change', 60,
   25, '["joined"]'::jsonb, false, false, false),
  ('5eeed00d-de1e-4001-bbbb-000000000002',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Rohan Das (Demo Captain)', 'MBBS', 2,
   'West Bengal', true, 'road_safety', 60,
   25, '["joined"]'::jsonb, false, false, false),
  ('5eeed00d-de1e-4001-bbbb-000000000003',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Sneha Kapoor (Demo Captain)', 'BBA', 1,
   'West Bengal', true, 'public_health', 60,
   25, '["joined"]'::jsonb, false, false, false)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed 4 new Siliguri teams (Smart Warriors already exists at 93af41a5)
--    Problem statements chosen to span 3 tracks (climate, road safety, health)
--    so the demo shows topical variety on the jury dashboard.
INSERT INTO future.teams (
  id, edition_id, chapter_id, team_name,
  problem_statement_id, captain_id, status, is_frozen
) VALUES
  ('5eeed00d-7ea3-4001-cccc-000000000001',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Heat Shield Innovators',
   '62d6a997-1df1-4451-b847-33fe939d9ccf',     -- Urban Heat Islands
   '41c337a8-9768-4744-baae-9a3d22cae619',     -- Meera (existing)
   'problem_selected', false),
  ('5eeed00d-7ea3-4001-cccc-000000000002',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Carbon Cutters',
   '703af497-861a-4da3-a25f-420fd58acf1e',     -- SME Emissions Reduction
   '5eeed00d-de1e-4001-bbbb-000000000001',     -- Aisha (demo)
   'problem_selected', false),
  ('5eeed00d-7ea3-4001-cccc-000000000003',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Safe Roads Brigade',
   '5b98f3f8-4f50-4afe-9908-a88c73ff42de',     -- Pedestrian Fatality Reduction
   '5eeed00d-de1e-4001-bbbb-000000000002',     -- Rohan (demo)
   'problem_selected', false),
  ('5eeed00d-7ea3-4001-cccc-000000000004',
   '878ec4a0-0573-4df1-b659-ef7fe2ca2823',
   'c201f9a5-de89-4cbf-bea8-300f7f6e3cea',
   'Wellness Warriors',
   'db128699-11f9-4e28-9e5c-753b04330217',     -- NCD Prevention in Youth
   '5eeed00d-de1e-4001-bbbb-000000000003',     -- Sneha (demo)
   'problem_selected', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Captains as team_members
INSERT INTO future.team_members (team_id, delegate_id, role_in_team) VALUES
  ('5eeed00d-7ea3-4001-cccc-000000000001', '41c337a8-9768-4744-baae-9a3d22cae619', 'captain'),
  ('5eeed00d-7ea3-4001-cccc-000000000002', '5eeed00d-de1e-4001-bbbb-000000000001', 'captain'),
  ('5eeed00d-7ea3-4001-cccc-000000000003', '5eeed00d-de1e-4001-bbbb-000000000002', 'captain'),
  ('5eeed00d-7ea3-4001-cccc-000000000004', '5eeed00d-de1e-4001-bbbb-000000000003', 'captain')
ON CONFLICT (team_id, delegate_id) DO NOTHING;

-- 6. TSTJRY jury assigned to all 5 Siliguri teams
INSERT INTO future.jury_team_assignments (jury_id, team_id) VALUES
  ('91e301ee-fa2b-41ab-943d-3b729110c4b1', '93af41a5-8afa-47e7-bbd8-8fe0d9d47c6a'),  -- Smart Warriors
  ('91e301ee-fa2b-41ab-943d-3b729110c4b1', '5eeed00d-7ea3-4001-cccc-000000000001'),
  ('91e301ee-fa2b-41ab-943d-3b729110c4b1', '5eeed00d-7ea3-4001-cccc-000000000002'),
  ('91e301ee-fa2b-41ab-943d-3b729110c4b1', '5eeed00d-7ea3-4001-cccc-000000000003'),
  ('91e301ee-fa2b-41ab-943d-3b729110c4b1', '5eeed00d-7ea3-4001-cccc-000000000004')
ON CONFLICT (jury_id, team_id) DO NOTHING;

COMMIT;
