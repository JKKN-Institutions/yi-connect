-- Configurable scoring "buckets" — the editable container for the YIP final
-- scoring model. Super-admin edits this in the Scoring Framework admin tab; the
-- results engine will read it (wired in a follow-up). Seeded with Model A
-- (the Yi 2026 Workbook 7-row /100). Additive + INERT until the engine reads it.
create table if not exists yip.scoring_buckets (
  id             uuid primary key default gen_random_uuid(),
  bucket_key     text not null unique,
  label          text not null,
  weightage      smallint not null default 0,
  merit_max      smallint not null default 0,   -- leadership: auto position-merit share
  jury_max       smallint not null default 0,   -- jury-scored share
  day_group      smallint,                       -- 1 | 2 | null (for day subtotals)
  display_order  smallint not null default 0,
  session_keys   text[] not null default '{}',   -- session_parameters.session_key(s) feeding this bucket
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table yip.scoring_buckets enable row level security;
revoke all on yip.scoring_buckets from anon, authenticated;
grant all on yip.scoring_buckets to service_role;

-- Seed Model A (idempotent: only if empty)
insert into yip.scoring_buckets
  (bucket_key, label, weightage, merit_max, jury_max, day_group, display_order, session_keys)
select * from (values
  ('leadership_positions','Leadership & Positions',10,5,5,1,1, array['speaker_candidates_speeches','speaker_election']),
  ('mupi_opening_speech','Matters of Urgent Public Importance / Opening Speech',15,0,15,null,2, array['urgent_public_importance','opening_speeches']),
  ('question_hour','Question Hour Participation & Relevance',20,0,20,2,3, array['question_hour']),
  ('zero_hour','Zero Hour Participation & Understanding',15,0,15,2,4, array['zero_hour']),
  ('political_acumen','Political Acumen & Legislative Strategy',10,0,10,1,5, array['cabinet_party_intros','debate_central_agenda']),
  ('committee_bill_drafting','Committee Discussions & Bill Drafting',15,0,15,1,6, array['committee_bill_drafting']),
  ('bill_presentation_defence','Bill Presentation & Defence',15,0,15,2,7, array['bill_presentation_voting'])
) as v(bucket_key,label,weightage,merit_max,jury_max,day_group,display_order,session_keys)
where not exists (select 1 from yip.scoring_buckets);
