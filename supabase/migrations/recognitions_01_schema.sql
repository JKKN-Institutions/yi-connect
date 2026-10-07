-- =====================================================================
-- recognitions_01_schema — Yi Recognitions (national chapter Take Pride
-- awards). Spec: Piyush Garg's process-flow mail + the "Latest Evaluation
-- Matrix" doc (Layer 1 Health Card 50% / Layer 2 RM 25% / Layer 3 NMT 25%).
--
-- WHY A SIBLING OF MODULE 6 AND NOT AN EXTENSION OF IT
-- --------------------------------------------------------------------
-- Module 6 (yi_connect.award_*) is a per-chapter MEMBER award: nominee is
-- nominee_member_id, jury is one panel, one score. Recognitions nominates a
-- CHAPTER nationally and runs blind two-layer scoring, a moderation stage,
-- a governance decision and append-only re-evaluation. Bolting that onto
-- award_nominations would make every Module 6 column nullable and entangle
-- two flows. Verified 2026-10-07: award_cycles, award_categories and
-- award_nominations all hold ZERO rows in production, so nothing depends on
-- Module 6 today. These tables sit beside it with a recognition_ prefix.
--
-- IDENTITY AND ROLES — yi_directory stays the mother source
-- --------------------------------------------------------------------
-- No recognitions.users / organisers table. Roles are
-- yi_directory.role_assignments rows, app='recognitions':
--   recognitions_super_admin, national_leadership, rm, nmt, nmt_leader.
-- A chapter login is the Yi directory chapter chair (app='yi',
-- chapter_chair / chapter_co_chair) — no seeding, ever.
-- recognition_evaluators below is the per-cycle DUTY ("this person scores
-- the Learning award in cycle 2026, region ER") — the same kind of fact as
-- a YIP event assignment, not a second source of identity. The gate needs
-- BOTH the directory role and the duty row.
--
-- ACCESS: RLS ENABLED with ZERO policies (the YIQ pattern). Every read and
-- write goes through the service client behind lib/recognitions/auth.ts.
-- Blind scoring is enforced in the query layer, not by hiding UI.
--
-- APPEND-ONLY: moderation versions, governance decisions, citation edits,
-- predictions and the audit log are never overwritten. Triggers below make
-- the database refuse an UPDATE on a submitted moderation version, a
-- submitted score or a prediction.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cycles: one per Take Pride year. Holds the timeline and the weightages.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  yi_year integer not null,
  nomination_deadline timestamptz,
  stage1_deadline timestamptz,
  stage2_deadline timestamptz,
  reevaluation_deadline timestamptz,
  -- Weightages & Matrix (Phase 0 preload). Must sum to 100.
  weight_layer1 integer not null default 50,
  weight_layer2 integer not null default 25,
  weight_layer3 integer not null default 25,
  -- Mail 3 says "rank on score, OR convert to percentile in every region".
  -- The latest matrix doc is silent, so this is a switch, not a hard rule.
  layer2_mode text not null default 'raw' check (layer2_mode in ('raw', 'percentile')),
  quiz_open boolean not null default true,
  is_current boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recognition_cycles_weights_ck
    check (weight_layer1 + weight_layer2 + weight_layer3 = 100
           and weight_layer1 >= 0 and weight_layer2 >= 0 and weight_layer3 >= 0)
);

create unique index if not exists recognition_cycles_one_current
  on yi_connect.recognition_cycles (is_current) where is_current;

-- ---------------------------------------------------------------------
-- Awards: one per vertical per cycle. Each award crowns a winner, runner-up
-- and second runner-up in EACH chapter category.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_awards (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references yi_connect.recognition_cycles(id) on delete cascade,
  vertical text not null check (vertical in
    ('membership', 'learning', 'impact', 'future', 'climate', 'rural', 'health')),
  title text not null,
  criteria text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- Stage 2 normally unlocks itself at 100% RM + 100% NMT submission. When it
  -- does, or when a super admin forces it, the moment and reason are kept.
  stage2_unlocked_at timestamptz,
  stage2_unlock_reason text,
  stage2_unlocked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, vertical)
);

-- ---------------------------------------------------------------------
-- Chapter categories (Phase 0 preload): Pioneers / Trailblazers / Sparks.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_chapter_categories (
  cycle_id uuid not null references yi_connect.recognition_cycles(id) on delete cascade,
  chapter_id uuid not null references yi.chapters(id) on delete cascade,
  category text not null check (category in ('pioneers', 'trailblazers', 'sparks')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (cycle_id, chapter_id)
);

-- ---------------------------------------------------------------------
-- Evaluator duty per award. person_id is a yi_directory.people row.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_evaluators (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  person_id uuid not null references yi_directory.people(id) on delete cascade,
  layer text not null check (layer in ('rm', 'nmt')),
  -- RM only: the Yi zone code (ER, NER, NR, SRTKKA, SRTN, WR) — same key as
  -- yi.chapters.region and yi_directory.role_assignments.yi_zone.
  region text,
  is_nmt_leader boolean not null default false,
  -- Declared conflicts on top of the automatic one (any directory role the
  -- person holds in that chapter).
  conflict_chapter_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (award_id, person_id, layer),
  constraint recognition_evaluators_region_ck
    check ((layer = 'rm' and region is not null and btrim(region) <> '')
        or (layer = 'nmt' and region is null)),
  constraint recognition_evaluators_leader_ck
    check (not is_nmt_leader or layer = 'nmt')
);

-- At most one active NMT leader per award.
create unique index if not exists recognition_evaluators_one_leader
  on yi_connect.recognition_evaluators (award_id)
  where is_nmt_leader and is_active;

-- ---------------------------------------------------------------------
-- Nominations (Phase 1). Sections A-D of the spec.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_nominations (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  chapter_id uuid not null references yi.chapters(id) on delete cascade,
  -- Snapshots at submission so a later reclassification never moves a
  -- submitted nomination between races.
  category text not null check (category in ('pioneers', 'trailblazers', 'sparks')),
  region text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  -- Section A: five reasons, 50 words each.
  reasons text[] not null default array['', '', '', '', '']::text[],
  -- Section B: one flagship event, name & impact, 50 words.
  flagship_event text not null default '',
  -- Section C: hosted national / regional event.
  hosted_event boolean not null default false,
  hosted_event_name text,
  hosted_event_type text check (hosted_event_type in ('national', 'regional')),
  -- Section D: announcement draft, 100 words.
  announcement_draft text not null default '',
  submitted_at timestamptz,
  submitted_by uuid,
  -- Mail 1: RM "can recommend a chapter for nomination to NMT"; NMT "can
  -- approve a nomination by the RM". The spec never says these gate
  -- scoring, so they are flags, not blockers.
  rm_recommended_by uuid,
  rm_recommended_at timestamptz,
  nmt_approved_by uuid,
  nmt_approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (award_id, chapter_id),
  constraint recognition_nominations_reasons_ck check (array_length(reasons, 1) = 5)
);

create index if not exists recognition_nominations_chapter
  on yi_connect.recognition_nominations (chapter_id);

-- ---------------------------------------------------------------------
-- Stage 1 scores. One row per (nomination, evaluator duty).
-- params: {"p1":0-5,...,"p5":0-5}. Layer 2 and Layer 3 have different
-- parameter labels; the keys are positional and the labels live in code.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_scores (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references yi_connect.recognition_nominations(id) on delete cascade,
  evaluator_id uuid not null references yi_connect.recognition_evaluators(id) on delete cascade,
  layer text not null check (layer in ('rm', 'nmt')),
  params jsonb not null default '{}'::jsonb,
  reasons text[] not null default array['', '', '', '', '']::text[],
  additional_comments text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nomination_id, evaluator_id),
  constraint recognition_scores_reasons_ck check (array_length(reasons, 1) = 5)
);

-- ---------------------------------------------------------------------
-- Layer 1: the National Health Card. Yi National keeps it as an Excel per
-- vertical; the super admin uploads it. The original file stays
-- downloadable for evaluators (Phase 0: "National Health Card Excel
-- (Download)"). Parsed rows land in recognition_layer1 with a 0-100 score.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_health_card_files (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

create table if not exists yi_connect.recognition_layer1 (
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  chapter_id uuid not null references yi.chapters(id) on delete cascade,
  score numeric(6, 2) not null check (score >= 0 and score <= 100),
  raw jsonb not null default '{}'::jsonb,
  source text not null check (source in ('excel', 'manual')),
  source_file_id uuid references yi_connect.recognition_health_card_files(id) on delete set null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (award_id, chapter_id)
);

-- ---------------------------------------------------------------------
-- Stage 2 moderation + Stage 3 re-evaluation. APPEND-ONLY by version.
-- rankings: [{nomination_id, final_score, final_rank}]   (all nominations)
-- top3:     [{category, rank (1-3), nomination_id, rationale, citation}]
-- A draft row may be edited; once submitted it is frozen by trigger. A
-- re-evaluation opens version N+1 as a draft copy of version N.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_moderation_versions (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  rankings jsonb not null default '[]'::jsonb,
  top3 jsonb not null default '[]'::jsonb,
  responds_to_decision_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  submitted_by uuid,
  submitted_at timestamptz,
  unique (award_id, version)
);

-- ---------------------------------------------------------------------
-- Phase 4 governance decisions. Append-only.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_governance_decisions (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  moderation_version_id uuid not null
    references yi_connect.recognition_moderation_versions(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reevaluate')),
  reason text,
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  constraint recognition_governance_reason_ck
    check (decision = 'approve' or (reason is not null and btrim(reason) <> ''))
);

alter table yi_connect.recognition_moderation_versions
  drop constraint if exists recognition_moderation_responds_fk;
alter table yi_connect.recognition_moderation_versions
  add constraint recognition_moderation_responds_fk
  foreign key (responds_to_decision_id)
  references yi_connect.recognition_governance_decisions(id) on delete set null;

-- ---------------------------------------------------------------------
-- Super admin polish of citations / announcement text / ceremony script,
-- WITHOUT touching rankings. Append-only; latest row per key wins.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_citation_edits (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  moderation_version_id uuid
    references yi_connect.recognition_moderation_versions(id) on delete cascade,
  category text check (category in ('pioneers', 'trailblazers', 'sparks')),
  rank integer check (rank between 1 and 3),
  field text not null check (field in ('citation', 'announcement', 'ceremony_script')),
  body text not null,
  edited_by uuid not null,
  edited_at timestamptz not null default now(),
  constraint recognition_citation_scope_ck
    check ((field = 'ceremony_script' and category is null and rank is null)
        or (field <> 'ceremony_script' and category is not null and rank is not null))
);

-- ---------------------------------------------------------------------
-- Phase 1B prediction quiz. Not used in scoring. Locked after submission.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_predictions (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references yi_connect.recognition_awards(id) on delete cascade,
  category text not null check (category in ('pioneers', 'trailblazers', 'sparks')),
  predictor_chapter_id uuid not null references yi.chapters(id) on delete cascade,
  predicted_chapter_id uuid not null references yi.chapters(id) on delete cascade,
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  unique (award_id, category, predictor_chapter_id)
);

-- ---------------------------------------------------------------------
-- Audit trail (Phase 4 "Audit trail"). Append-only.
-- ---------------------------------------------------------------------
create table if not exists yi_connect.recognition_audit_log (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references yi_connect.recognition_cycles(id) on delete cascade,
  award_id uuid references yi_connect.recognition_awards(id) on delete cascade,
  actor_person_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index if not exists recognition_audit_award
  on yi_connect.recognition_audit_log (award_id, at desc);

-- ---------------------------------------------------------------------
-- Freeze rules. The database, not the UI, refuses to rewrite history.
-- ---------------------------------------------------------------------
create or replace function yi_connect.recognition_refuse_rewrite()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'recognition_moderation_versions' and old.status = 'submitted' then
    raise exception 'recognition: a submitted moderation version is frozen (version %)', old.version;
  end if;
  if tg_table_name = 'recognition_scores' and old.status = 'submitted' then
    raise exception 'recognition: a submitted score is frozen';
  end if;
  if tg_table_name in ('recognition_predictions', 'recognition_governance_decisions',
                       'recognition_citation_edits', 'recognition_audit_log') then
    raise exception 'recognition: % is append-only', tg_table_name;
  end if;
  return new;
end;
$$;

drop trigger if exists recognition_moderation_freeze on yi_connect.recognition_moderation_versions;
create trigger recognition_moderation_freeze
  before update on yi_connect.recognition_moderation_versions
  for each row execute function yi_connect.recognition_refuse_rewrite();

drop trigger if exists recognition_scores_freeze on yi_connect.recognition_scores;
create trigger recognition_scores_freeze
  before update on yi_connect.recognition_scores
  for each row execute function yi_connect.recognition_refuse_rewrite();

drop trigger if exists recognition_predictions_freeze on yi_connect.recognition_predictions;
create trigger recognition_predictions_freeze
  before update on yi_connect.recognition_predictions
  for each row execute function yi_connect.recognition_refuse_rewrite();

drop trigger if exists recognition_decisions_freeze on yi_connect.recognition_governance_decisions;
create trigger recognition_decisions_freeze
  before update on yi_connect.recognition_governance_decisions
  for each row execute function yi_connect.recognition_refuse_rewrite();

drop trigger if exists recognition_citations_freeze on yi_connect.recognition_citation_edits;
create trigger recognition_citations_freeze
  before update on yi_connect.recognition_citation_edits
  for each row execute function yi_connect.recognition_refuse_rewrite();

drop trigger if exists recognition_audit_freeze on yi_connect.recognition_audit_log;
create trigger recognition_audit_freeze
  before update on yi_connect.recognition_audit_log
  for each row execute function yi_connect.recognition_refuse_rewrite();

-- ---------------------------------------------------------------------
-- RLS on, zero policies; explicit service_role grant (tables created via
-- the Management API get no default service_role grant).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'recognition_cycles', 'recognition_awards', 'recognition_chapter_categories',
    'recognition_evaluators', 'recognition_nominations', 'recognition_scores',
    'recognition_health_card_files', 'recognition_layer1',
    'recognition_moderation_versions', 'recognition_governance_decisions',
    'recognition_citation_edits', 'recognition_predictions', 'recognition_audit_log'
  ] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end;
$$;

-- Private bucket for the Health Card Excel files. Served only through
-- short-lived signed URLs minted behind the evaluator gate.
insert into storage.buckets (id, name, public)
values ('recognitions', 'recognitions', false)
on conflict (id) do nothing;
