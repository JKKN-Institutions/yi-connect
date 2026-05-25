-- Fix chapter_track_assignments PK to allow 4 tracks per host chapter
-- Old PK: (edition_id, chapter_id) — only 1 track per chapter
-- New PK: (edition_id, chapter_id, track_id) — multiple tracks per chapter
ALTER TABLE future.chapter_track_assignments DROP CONSTRAINT IF EXISTS chapter_track_assignments_pkey;
ALTER TABLE future.chapter_track_assignments ADD PRIMARY KEY (edition_id, chapter_id, track_id);
