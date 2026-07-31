-- ============================================================================
-- yip.topics — add 4 missing committee ministries (national catalogue)
-- ----------------------------------------------------------------------------
-- Reported from a chapter: "some committees are missing, LIKE Ministry of
-- Defence. There is no option to add a custom list or Ministry." The committee
-- catalogue shipped with 15 ministries and had no Defence, Home Affairs,
-- External Affairs or Law & Justice. Only a super-admin can add to it
-- (adminCreateTopic is requireSuperAdmin-gated) and there is no per-event
-- "add a committee" affordance, so chapters could not work around it.
--
-- Director decision 2026-07-31: add these four to the NATIONAL catalogue.
-- yip.topics has no event/chapter scoping column, so the committee catalogue
-- is global — these appear in every chapter's Committees picker. Adding rows
-- does NOT alter any event's existing selection (each event keeps its own
-- committee_topics map); verified after applying: 72 events with a selection,
-- 0 auto-changed.
--
-- Applied directly to live 2026-07-31 (same as the original 15, which were
-- seeded straight into the database). This file mirrors that for the record
-- and is idempotent, so re-running is safe.
--
-- Descriptions and linked schemes below were drafted to match the existing
-- rows' register (a youth/school-facing debate question + a real government
-- scheme) and are editable at Admin -> Topics.
-- ============================================================================

insert into yip.topics (
  category, zone, topic_number, title, description,
  sub_points, handbook_page, linked_scheme, is_active
)
select
  v.category::public.topic_category, null, v.topic_number, v.title, v.description,
  '[]'::jsonb, null, v.linked_scheme, true
from (values
  ('committee', 16, 'Ministry of Defence',
     'Should Military Training Be Part of School Education?',
     'Agnipath Scheme, NCC'),
  ('committee', 17, 'Ministry of Home Affairs',
     'Cyber Safety for Young Citizens - Whose Responsibility?',
     'Cyber Crime Reporting Portal, I4C'),
  ('committee', 18, 'Ministry of External Affairs',
     'Studying Abroad vs Building Careers in India',
     'Study in India'),
  ('committee', 19, 'Ministry of Law & Justice',
     'Should Legal Awareness Be Compulsory in Schools?',
     'Tele-Law, NALSA')
) as v(category, topic_number, title, description, linked_scheme)
where not exists (
  select 1 from yip.topics t
  where t.category = 'committee' and t.title = v.title
);

-- NOTE: topics_category_zone_topic_number_key is UNIQUE (category, zone,
-- topic_number), and committee rows have zone IS NULL. Postgres treats NULLs
-- as distinct in a UNIQUE constraint, so that index does NOT prevent duplicate
-- committee topic_numbers — hence the explicit numbers and the title guard
-- above rather than relying on ON CONFLICT.
