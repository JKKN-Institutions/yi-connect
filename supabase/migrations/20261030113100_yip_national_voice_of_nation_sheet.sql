-- YIP National Finals 2026: Voice of the Nation marking sheet, 3 criteria, 10 points.
--
-- PENDING GROUP AGREEMENT. The YIP Tech Support group (30 Oct, 09:08-09:10)
-- asked for the chapter-round criteria consolidated from 6 to 3. Nobody has
-- named the 3 yet; these are the draft from the "yip all" tab:
--   Content & relevance to the central agenda 4, Communication & delivery 4,
--   Within 30 seconds 2.
-- Do not apply until the Director confirms the three.
--
-- Supersedes the 'voice_of_nation' row in draft PR #1090 (10 points + Conduct).
-- That PR inserts with ON CONFLICT DO NOTHING, so applying this first wins.
--
-- Also makes the Finals Day 1 "Voice of the Nation" session markable. Today it
-- has no sheet and is not scoreable, so jurors do not see it.
-- Voting at the Finals is by raise of hands; no app vote is added.

INSERT INTO yip.session_parameters
  (session_key, label, agenda_type, display_order, parameters, total_max,
   session_weight, is_active, lock_on_submit, levels)
VALUES
  ('voice_of_nation', 'Voice of the Nation (National)', 'opening_speech', 205,
   '[
     {"key":"nvn.content","kind":"evaluation","label":"Content & Relevance to Central Agenda","weight":1,"max_score":4,"parameters":"Substance of the point; tied to the national agenda"},
     {"key":"nvn.delivery","kind":"evaluation","label":"Communication & Delivery","weight":1,"max_score":4,"parameters":"Clarity, confidence, voice"},
     {"key":"nvn.time","kind":"evaluation","label":"Within 30 Seconds","weight":1,"max_score":2,"parameters":"Finished inside the 30-second limit"}
   ]'::jsonb,
   10, 10, true, false, '{national}')
ON CONFLICT (session_key, levels) DO NOTHING;

UPDATE yip.agenda
SET session_key = 'voice_of_nation',
    is_scoreable = true,
    updated_at = now()
WHERE event_id = 'd12b4bb7-5f76-4187-bec8-7f642c53ccee'   -- YIP National Finals 2026
  AND agenda_type = 'opening_speech'
  AND title = 'Voice of the Nation'
  AND session_key IS NULL;
