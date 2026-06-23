-- YIP Awards — make the 15 workbook awards admin-configurable + wired to the
-- results engine. The MATH for each award (eligibility + ranking) stays in a
-- code registry keyed by award_key (the workbook formulas are fixed, and
-- exposing arbitrary formula editing would be fragile/unsafe). This table owns
-- everything operationally useful — label, how many recipients, on/off, order —
-- and the engine reads it instead of the old hardcoded calls. Per-event
-- overrides let a chapter "recognise more" (e.g. Best Debater → top 3) on their
-- own event without touching the global defaults.

create table if not exists yip.award_definitions (
  award_key text primary key,
  label text not null,
  basis_description text not null,
  default_recipients smallint not null default 1
    check (default_recipients between 1 and 50),
  is_team boolean not null default false,   -- team award: whole top group co-wins
  is_active boolean not null default true,
  display_order smallint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists yip.event_award_config (
  event_id uuid not null,
  award_key text not null
    references yip.award_definitions(award_key) on delete cascade,
  recipients smallint check (recipients between 1 and 50), -- null = use default
  is_active boolean,                                       -- null = use default
  updated_at timestamptz not null default now(),
  primary key (event_id, award_key)
);

-- Server-only (service client). New yip.* tables ship anon-readable by default.
alter table yip.award_definitions enable row level security;
alter table yip.event_award_config enable row level security;
revoke all on yip.award_definitions from anon, authenticated;
revoke all on yip.event_award_config from anon, authenticated;

-- Seed the 15 awards (matches the current hardcoded engine exactly; recipients=1
-- so nothing changes until a chapter raises a count).
insert into yip.award_definitions
  (award_key, label, basis_description, is_team, display_order)
values
  ('best_parliamentarian','Best Parliamentarian','Highest overall score (top rank).',false,1),
  ('best_debater','Best Debater','Political Acumen + Question Hour.',false,2),
  ('best_research_presentation','Best Research & Presentation','Research across MUPI, Question Hour subject knowledge, Bill understanding and Committee research.',false,3),
  ('mvp','Most Valuable Participant (MVP)','Most consistent across sessions (≥ half), excluding position points.',false,4),
  ('best_constituency_rep','Best Constituency Representative','MUPI + Question Hour + Zero Hour.',false,5),
  ('exemplary_decorum','Exemplary Parliamentary Decorum','Highest parliamentary conduct with zero disciplinary flags.',false,6),
  ('team_spirit','Team Spirit','Top committee''s shared collaboration/evaluation score — the whole committee co-wins (team award).',true,7),
  ('innovative_ideas','Innovative Ideas','Zero Hour creativity + problem solving + policy orientation.',false,8),
  ('community_impact','Community Impact','Policy orientation + Bill feasibility + constituency research.',false,9),
  ('best_speaker','Best Speaker','Speaker only — overall score.',false,10),
  ('leadership_excellence','Leadership Excellence','Leadership roles — 50% position points + 50% participation.',false,11),
  ('best_member_ruling','Best Member — Ruling Bench','Ruling side — Political Acumen + Question Hour + Bill.',false,12),
  ('best_member_opposition','Best Member — Opposition Bench','Opposition side — Question Hour + Zero Hour + Political Acumen.',false,13),
  ('most_persuasive','Most Persuasive Policy Advocate','Political Acumen + Bill Defence.',false,14),
  ('independent_voice','Independent Voice of the House','Independent MP only — Political Acumen + Zero Hour + Question Hour.',false,15)
on conflict (award_key) do nothing;
