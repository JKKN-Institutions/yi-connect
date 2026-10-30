-- YIP National Finals 2026: Student Journalist marking sheet, 4 x 25 = 100.
-- Criteria verbatim from Sadaf (YIP Tech Support Committee, 30 Oct 2026).
--
-- REPLACES the three journalist criteria on the national Duty Roles sheet
-- (Accuracy & Insight 4, Coverage 3, Presentation 3 = 10). Adding a second
-- sheet instead would double-count the journalist and the award would never
-- see it. Speaker and Administrator criteria are untouched.
--
-- Also points the national "Best Parliamentary Journalist – National Finals"
-- award at the four new criteria. The chapter award row is not touched.
--
-- Safe to re-run: only acts while the old journalist keys are still present.
-- Refuses to run if any score already uses the old journalist keys.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM yip.scores WHERE criteria_scores::text LIKE '%dr.journalist_%') THEN
    RAISE EXCEPTION 'Journalist scores already exist; renaming criteria would orphan them';
  END IF;
END $$;

UPDATE yip.session_parameters sp
SET parameters =
      (SELECT COALESCE(jsonb_agg(e ORDER BY o), '[]'::jsonb)
         FROM jsonb_array_elements(sp.parameters) WITH ORDINALITY t(e, o)
        WHERE e->>'key' LIKE 'dr.speaker_%')
   || '[
        {"key":"dr.journalist_research","kind":"evaluation","label":"Research & Subject Knowledge","roles":["parliamentary_journalist"],"weight":1,"max_score":25,"parameters":"Depth of research; accurate, credible sources; context and relevance to Viksit Bharat @ 2047"},
        {"key":"dr.journalist_storytelling","kind":"evaluation","label":"Storytelling & Content Development","roles":["parliamentary_journalist"],"weight":1,"max_score":25,"parameters":"Clear story and purpose; creativity and originality; value to the Newsroom audience"},
        {"key":"dr.journalist_interviews","kind":"evaluation","label":"Interviews & Engagement","roles":["parliamentary_journalist"],"weight":1,"max_score":25,"parameters":"Prepared, relevant questions; engages parliamentarians; listens and draws insights"},
        {"key":"dr.journalist_critical","kind":"evaluation","label":"Critical Thinking & Questioning","roles":["parliamentary_journalist"],"weight":1,"max_score":25,"parameters":"Probing questions; spots gaps and implications; goes beyond announcements"}
      ]'::jsonb
   || (SELECT COALESCE(jsonb_agg(e ORDER BY o), '[]'::jsonb)
         FROM jsonb_array_elements(sp.parameters) WITH ORDINALITY t(e, o)
        WHERE e->>'key' LIKE 'dr.admin_%'),
    total_max = 120,  -- speaker 10 + journalist 100 + administrator 10
    updated_at = now()
WHERE sp.session_key = 'national_duty_roles'
  AND sp.levels = '{national}'
  AND sp.parameters @> '[{"key":"dr.journalist_reporting"}]';

UPDATE yip.award_definitions
SET rank_keys = ARRAY['dr.journalist_research','dr.journalist_storytelling','dr.journalist_interviews','dr.journalist_critical'],
    basis_description = 'Highest Student Journalist mark on four criteria of 25 each (100): Research & Subject Knowledge, Storytelling & Content Development, Interviews & Engagement, Critical Thinking & Questioning.'
WHERE award_key = 'best_parliamentary_journalist'
  AND levels = '{national}';
