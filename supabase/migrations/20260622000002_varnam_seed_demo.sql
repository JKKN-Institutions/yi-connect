-- ═══════════════════════════════════════════════════════════════════════
-- Varnam Vizha — demo/sample seed (P1).
--
-- Seeds festival_editions for 2021–2026 (2026 'live', rest 'completed') and the
-- 2026 signature sub-events (yi_connect.events linked via festival_edition_id).
-- Idempotent: editions upsert on (festival_key, year); events upsert on the
-- unique public_slug. Chapter = Erode (fe71c429-2647-4262-b35b-e356c960903d).
--
-- NOTE: 2026 sub-event dates are the tentative planned slate (Sept 5–16 pattern,
-- culminating on Erode Day Sept 16) drawn from the 2025 catalogue — the committee
-- finalises actual dates. Real committee identities are seeded later (placeholders
-- for now per Director decision 2026-06-22).
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO yi_connect.festival_editions
  (festival_key, chapter_id, year, name, slug, status, theme, start_date, end_date, summary)
VALUES
  ('varnam-vizha','fe71c429-2647-4262-b35b-e356c960903d'::uuid,2021,'Varnam Vizha 2021','varnam-vizha-2021','completed',NULL,'2021-09-05','2021-09-16','Post-pandemic edition under Chair Priya Navin — stakeholder-focused events.'),
  ('varnam-vizha','fe71c429-2647-4262-b35b-e356c960903d'::uuid,2022,'Varnam Vizha 2022','varnam-vizha-2022','completed',NULL,'2022-09-05','2022-09-16','Chair Gomathi Srikalyan — Varnam Chithiram art activity, grooming sessions.'),
  ('varnam-vizha','fe71c429-2647-4262-b35b-e356c960903d'::uuid,2023,'Varnam Vizha 2023','varnam-vizha-2023','completed',NULL,'2023-09-05','2023-09-16','Night Market at Tex Valley, Silambam competition, Erode Day with the Collector.'),
  ('varnam-vizha','fe71c429-2647-4262-b35b-e356c960903d'::uuid,2024,'Varnam Vizha 2024','varnam-vizha-2024','completed',NULL,'2024-09-05','2024-09-16','Chair Yadhavi Yogesh — Nila Soru, Thiran Ottam, Heritage Walk with the Collector.'),
  ('varnam-vizha','fe71c429-2647-4262-b35b-e356c960903d'::uuid,2025,'Varnam Vizha 2025','varnam-vizha-2025','completed','Heritage · Innovation · Nature & Sport · Unite','2025-09-05','2025-09-16','Largest edition — 11 days, 2,000+ participants, 30 planned events, Jolly Jam concert, anthem video.'),
  ('varnam-vizha','fe71c429-2647-4262-b35b-e356c960903d'::uuid,2026,'Varnam Vizha 2026','varnam-vizha-2026','live','Erode''s Festival of Colour','2026-09-05','2026-09-16','Yi Erode''s flagship 11-day cultural festival, culminating on Erode Day (Sept 16). Co-chairs Deepak & Senthil. The 2026 programme is the planned slate — dates tentative, being finalised by the committee.')
ON CONFLICT (festival_key, year) DO UPDATE
  SET name = EXCLUDED.name, status = EXCLUDED.status, theme = EXCLUDED.theme,
      start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, summary = EXCLUDED.summary;

-- Link the already-imported 2025 event to the 2025 edition.
UPDATE yi_connect.events
  SET festival_edition_id = (SELECT id FROM yi_connect.festival_editions WHERE festival_key='varnam-vizha' AND year=2025)
  WHERE title ILIKE '%Varnam Vizha 2025 - Thiran Ottam%' AND festival_edition_id IS NULL;

-- 2026 signature sub-events.
INSERT INTO yi_connect.events
  (chapter_id, festival_edition_id, title, description, category, status,
   start_date, end_date, venue_address, public_slug, is_featured, is_active, event_scope, tags)
SELECT
  'fe71c429-2647-4262-b35b-e356c960903d'::uuid, fe.id, v.title, v.description,
  v.category::yi_connect.event_category, 'published'::yi_connect.event_status,
  v.start_ts::timestamptz, v.end_ts::timestamptz, v.venue, v.slug, v.feat, true, 'chapter',
  ARRAY['varnam-vizha','2026', v.category]
FROM yi_connect.festival_editions fe
CROSS JOIN (VALUES
  ('Inauguration & Anthem Launch','Festival opening with the District Collector, MPs and police; the Varnam Vizha anthem launch.','cultural','2026-09-05T07:15:00+05:30','2026-09-05T10:00:00+05:30','Erode Collectorate','varnam-2026-inauguration',true),
  ('5K Awareness Run','Erode Runners Club community run — free tees for the first 300 runners.','sports','2026-09-05T06:30:00+05:30','2026-09-05T08:30:00+05:30','Erode Collectorate','varnam-2026-awareness-run',false),
  ('Kolam Contest','Traditional rangoli competition across the city.','cultural','2026-09-07T09:00:00+05:30','2026-09-07T12:00:00+05:30','Erode (multiple)','varnam-2026-kolam',false),
  ('Women''s Carnival','Celebrating women entrepreneurs and the IWN community.','cultural','2026-09-07T16:00:00+05:30','2026-09-07T20:00:00+05:30','Erode','varnam-2026-womens-carnival',false),
  ('Inter-Forum Turf Cricket','Cricket tournament across Yi, Rotary, JCI, BNI and partner forums.','sports','2026-09-08T17:00:00+05:30','2026-09-08T21:00:00+05:30','Tex Valley Turf','varnam-2026-turf-cricket',false),
  ('Heritage Walk with the Collector','Guided walk of Erode''s historic landmarks, hosted by the District Collector.','cultural','2026-09-13T08:45:00+05:30','2026-09-13T11:00:00+05:30','Old Erode','varnam-2026-heritage-walk',false),
  ('Jolly Jam — Music Concert','The flagship ticketed concert — a 90s vs Gen Z musical night.','cultural','2026-09-14T18:00:00+05:30','2026-09-14T22:00:00+05:30','Vellalar College, Thindal','varnam-2026-jolly-jam',true),
  ('Valedictory — Erode Day','Grand finale on Erode Day, with the Collector as chief guest.','cultural','2026-09-16T09:00:00+05:30','2026-09-16T12:00:00+05:30','Kongu Engineering College, Perundurai','varnam-2026-valedictory',true)
) AS v(title, description, category, start_ts, end_ts, venue, slug, feat)
WHERE fe.festival_key = 'varnam-vizha' AND fe.year = 2026
ON CONFLICT (public_slug) DO NOTHING;
