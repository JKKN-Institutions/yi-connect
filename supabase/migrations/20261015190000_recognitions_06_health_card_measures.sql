-- =====================================================================
-- recognitions_06_health_card_measures — Layer 1 (Health Card) per measure.
--
-- Until now Layer 1 was ONE 0-100 number per award and chapter
-- (recognition_layer1), read from an uploaded Excel. Piyush (Director
-- approved, 2026-10-15): the Health Card arrives per chapter PER MEASURE,
-- four measures per table of the Evaluation Matrix:
--   Table A "Activity Score – Projects & Initiatives"
--     Activity Volume · Stakeholder Reach · Activity Balance Index ·
--     Institutional Reach
--   Table B "Activity Score – Stakeholders"
--     Activity Volume · Stakeholder Engagement · Institutional Units ·
--     Stakeholder Acquisition
--
-- Layer 1 for a nomination = weighted average of its table's four measure
-- scores (sum(weight*score) / sum(weight); default weights 25 each, so the
-- four make the whole Layer 1), then the cycle's weight_layer1 applies as
-- before. A chapter with NO per-measure score for that table falls back to
-- its recognition_layer1 row, which is unchanged and still written by the
-- single-score upload and the hand correction.
--
-- Which table an award uses is DATA: recognition_health_card_kind_tables
-- maps recognition_awards.kind (added by recognitions_04) to 'A' or 'B'.
-- Sports and Branding are an open question and default to A. The app reads
-- kind tolerantly: a missing column, a null kind or an unmapped kind = A.
--
-- The measure text (label, definition, indicators, purpose, impact) is per
-- cycle AND per table, so the super admin can word table A and table B
-- differently. Seeded verbatim from the matrix; indicators and impact keep
-- one bullet per line.
--
-- ACCESS: RLS on, zero policies, service_role only (same as recognitions_01).
-- =====================================================================

create table if not exists yi_connect.recognition_health_card_measures (
  cycle_id uuid not null references yi_connect.recognition_cycles(id) on delete cascade,
  table_key text not null check (table_key in ('A', 'B')),
  measure_key text not null check (measure_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (length(btrim(label)) between 1 and 80),
  definition text not null default '',
  -- One indicator per line.
  indicators text not null default '',
  purpose text not null default '',
  -- One impact per line.
  impact text not null default '',
  sort_order integer not null default 0,
  -- Share of Layer 1. The four weights of one table are seeded to sum to 100;
  -- the app divides by their sum, so Layer 1 stays a 0-100 number either way.
  weight numeric(5, 2) not null default 25 check (weight >= 0 and weight <= 100),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (cycle_id, table_key, measure_key)
);

create table if not exists yi_connect.recognition_health_card_scores (
  cycle_id uuid not null,
  chapter_id uuid not null references yi.chapters(id) on delete cascade,
  table_key text not null,
  measure_key text not null,
  score numeric(6, 2) not null check (score >= 0 and score <= 100),
  source_file_id uuid references yi_connect.recognition_health_card_files(id) on delete set null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (cycle_id, chapter_id, table_key, measure_key),
  foreign key (cycle_id, table_key, measure_key)
    references yi_connect.recognition_health_card_measures (cycle_id, table_key, measure_key)
    on delete cascade
);

create index if not exists recognition_health_card_scores_table
  on yi_connect.recognition_health_card_scores (cycle_id, table_key);

-- kind -> table. Data, not code: change a row to move an award type.
create table if not exists yi_connect.recognition_health_card_kind_tables (
  kind text primary key,
  table_key text not null check (table_key in ('A', 'B')),
  note text,
  updated_at timestamptz not null default now()
);

insert into yi_connect.recognition_health_card_kind_tables (kind, table_key, note) values
  ('project', 'A', null),
  ('initiative', 'A', null),
  ('stakeholder', 'B', null),
  ('sports', 'A', 'Open question: table A until Piyush decides.'),
  ('branding', 'A', 'Open question: table A until Piyush decides.')
on conflict (kind) do nothing;

-- ---------------------------------------------------------------------
-- Seed the eight measures for one cycle. Never overwrites: a re-run keeps
-- the super admin's edits. Called below for every existing cycle and by a
-- trigger for every new one.
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_seed_health_card_measures(p_cycle_id uuid)
returns void
language sql
set search_path = yi_connect, pg_temp
as $$
  insert into yi_connect.recognition_health_card_measures
    (cycle_id, table_key, measure_key, label, definition, indicators, purpose, impact, sort_order, weight)
  values
    (p_cycle_id, 'A', 'activity_volume', 'Activity Volume',
     'Measures the quantum of projects and initiatives undertaken by the chapter.',
     E'Number of activities conducted\nFrequency of activities\nActivities across identified verticals',
     'To objectively measure the chapter’s level of activity and execution.',
     E'Demonstrates consistency\nEncourages active chapters\nProvides a measurable base for comparison',
     1, 25),
    (p_cycle_id, 'A', 'stakeholder_reach', 'Stakeholder Reach',
     'Measures the breadth of stakeholders engaged through projects and initiatives.',
     E'Number of stakeholders reached\nNumber of unique stakeholders engaged\nStakeholder mix',
     'To assess whether activities extend beyond a limited beneficiary group.',
     E'Broader outreach\nGreater inclusivity\nWider organizational impact',
     2, 25),
    (p_cycle_id, 'A', 'activity_balance_index', 'Activity Balance Index',
     'Measures the extent to which activities engage different Yi stakeholder groups.',
     E'4 stakeholders active = 100%\n3 stakeholders = 75%\n2 stakeholders = 50%\n1 stakeholder = 25%',
     'To reward chapters that create balanced engagement across stakeholders rather than concentrating on one group.',
     E'Balanced chapter development\nGreater ecosystem engagement\nReduced stakeholder concentration',
     3, 25),
    (p_cycle_id, 'A', 'institutional_reach', 'Institutional Reach',
     'Measures the number of institutions or institutional units reached through initiatives.',
     E'Schools\nColleges\nInstitutions\nOrganizations/communities, as applicable',
     'To distinguish broad institutional outreach from merely high participant numbers.',
     E'Greater scalability\nStronger institutional relationships\nWider footprint',
     4, 25),
    (p_cycle_id, 'B', 'activity_volume', 'Activity Volume',
     'Measures the number of activities undertaken specifically for or through stakeholder groups.',
     E'Number of activities\nFrequency of engagement\nDistribution across stakeholder groups',
     'To objectively measure stakeholder-focused engagement.',
     E'Stronger stakeholder connect\nConsistent engagement',
     1, 25),
    (p_cycle_id, 'B', 'stakeholder_engagement', 'Stakeholder Engagement',
     'Measures the number and diversity of stakeholders actively engaged.',
     E'Number of stakeholders engaged\nNumber of unique stakeholders\nStakeholder diversity',
     'To measure breadth of engagement rather than activity count alone.',
     E'Wider participation\nStronger ecosystem',
     2, 25),
    (p_cycle_id, 'B', 'institutional_units', 'Institutional Units',
     'Measures the number of institutional units activated or engaged through the chapter.',
     E'Schools\nColleges\nInstitutions\nOrganizations\nCommunities, as applicable',
     'To measure the institutional depth of outreach.',
     E'Creates scalable networks\nStrengthens institutional partnerships',
     3, 25),
    (p_cycle_id, 'B', 'stakeholder_acquisition', 'Stakeholder Acquisition',
     'Measures the chapter’s ability to convert outreach into new stakeholder participation or membership.',
     E'New members acquired\nNew Yuva/Thalir institutions or participants\nNew Rural Initiative stakeholders\nGrowth over previous period',
     'To measure whether engagement results in sustainable growth.',
     E'Expands the Yi ecosystem\nCreates future leadership pipeline\nStrengthens long-term sustainability',
     4, 25)
  on conflict (cycle_id, table_key, measure_key) do nothing;
$$;

revoke all on function yi_connect.recognition_seed_health_card_measures(uuid) from public;
grant execute on function yi_connect.recognition_seed_health_card_measures(uuid) to service_role;

select yi_connect.recognition_seed_health_card_measures(id) from yi_connect.recognition_cycles;

create or replace function yi_connect.recognition_cycles_seed_health_card()
returns trigger
language plpgsql
set search_path = yi_connect, pg_temp
as $$
begin
  perform yi_connect.recognition_seed_health_card_measures(new.id);
  return new;
end;
$$;

revoke all on function yi_connect.recognition_cycles_seed_health_card() from public;

drop trigger if exists recognition_cycles_seed_health_card on yi_connect.recognition_cycles;
create trigger recognition_cycles_seed_health_card
  after insert on yi_connect.recognition_cycles
  for each row execute function yi_connect.recognition_cycles_seed_health_card();

do $$
declare t text;
begin
  foreach t in array array[
    'recognition_health_card_measures', 'recognition_health_card_scores', 'recognition_health_card_kind_tables'
  ] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end;
$$;
