-- ════════════════════════════════════════════════════════════════════════
-- YIP NATIONAL INTELLIGENCE — Government-of-India ministry/scheme TAXONOMY
--
-- Creates yip.gov_taxonomy: the canonical GoI tagging vocabulary the national
-- intelligence layer maps every chapter's deliberation onto. A "parent" row is
-- a ministry (scheme IS NULL); a "child" row is one flagship scheme under a
-- ministry (scheme NOT NULL). ministry+scheme is unique, case-insensitively,
-- treating NULL scheme safely (a ministry can have exactly one parent row).
--
-- Seed priority (per spec):
--   1) The 15 committee ministries that ALREADY exist in yip.topics
--      (category='committee'): title = ministry, linked_scheme = its schemes.
--      Seeded as ministry-parent rows, with linked_scheme snapshotted into
--      aliases[] so the deterministic committee→scheme join keeps working and
--      the admin can see the source schemes at a glance. (Verbatim from live
--      data on 2026-06-26, project bkmpbcoxbjyafieabxao.)
--   2) Well-known major GoI ministries + flagship schemes Claude is confident
--      about. Anything not fully certain is flagged needs_review=true so a human
--      validates before it is trusted in a government-facing rollup (a
--      hallucinated ministry/scheme in a govt doc is fatal).
--
-- ADDITIVE + IDEMPOTENT: CREATE ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS then CREATE, INSERT ... ON CONFLICT DO NOTHING against
-- the case-insensitive expression unique index. Safe to re-run.
--
-- AUTHZ: RLS enabled + REVOKE from anon/authenticated (fail-closed). All reads
-- and writes go through code already gated by requireSuperAdmin() using the
-- service-role client, which bypasses RLS — matching sibling yip master tables.
-- ════════════════════════════════════════════════════════════════════════

create schema if not exists yip;

-- ─── Table ────────────────────────────────────────────────────────────────
create table if not exists yip.gov_taxonomy (
  id            uuid primary key default gen_random_uuid(),
  ministry      text not null,
  scheme        text,
  official_name text,
  aliases       text[] not null default '{}',
  category      text,
  notes         text,
  needs_review  boolean not null default false,
  sort_order    int,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Unique key (treats NULL scheme safely + case-insensitive) ─────────────
-- A plain UNIQUE(ministry, scheme) would let multiple ministry-parent rows in
-- (two NULLs compare distinct in SQL). An expression index over
-- lower(ministry), lower(coalesce(scheme,'')) makes the parent row unique per
-- ministry AND prevents "Ministry of X" duplicating by case. Every seed/insert
-- (here and in the admin actions) MUST target this same expression so
-- ON CONFLICT resolves.
create unique index if not exists gov_taxonomy_ministry_scheme_key
  on yip.gov_taxonomy (lower(ministry), lower(coalesce(scheme, '')));

create index if not exists gov_taxonomy_ministry_idx
  on yip.gov_taxonomy (lower(ministry));
create index if not exists gov_taxonomy_active_idx
  on yip.gov_taxonomy (is_active);

-- ─── updated_at trigger ────────────────────────────────────────────────────
create or replace function yip.gov_taxonomy_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_gov_taxonomy_touch on yip.gov_taxonomy;
create trigger trg_gov_taxonomy_touch
  before update on yip.gov_taxonomy
  for each row execute function yip.gov_taxonomy_touch_updated_at();

-- ─── RLS: fail-closed ──────────────────────────────────────────────────────
alter table yip.gov_taxonomy enable row level security;
-- No anon/authenticated policies → those roles see nothing. service_role
-- (behind requireSuperAdmin) bypasses RLS. Revoke direct grants for defence.
revoke all on yip.gov_taxonomy from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- SEED 1 — the 15 committee ministries already present in yip.topics.
--
-- Sourced verbatim from the live committee topic catalogue (title=ministry,
-- linked_scheme=schemes). These are authoritative (already validated in YIP
-- 2026), so needs_review=false. The comma/semicolon-separated linked_scheme is
-- snapshotted into aliases[] for visibility; the live deterministic join still
-- reads yip.topics.linked_scheme directly at query time.
-- sort_order 100..114 keeps these committee ministries grouped at the top.
-- ════════════════════════════════════════════════════════════════════════
insert into yip.gov_taxonomy
  (ministry, scheme, official_name, aliases, category, needs_review, sort_order)
values
  ('Ministry of Education',               null, 'Ministry of Education',               array['NEP 2020','PM eVidya'],                    'committee', false, 100),
  ('Ministry of Finance',                 null, 'Ministry of Finance',                 array['RBI Financial Literacy Initiatives'],      'committee', false, 101),
  ('Ministry of Youth Affairs & Sports',  null, 'Ministry of Youth Affairs & Sports',  array['Khelo India'],                             'committee', false, 102),
  ('Ministry of Health & Family Welfare', null, 'Ministry of Health & Family Welfare', array['National Mental Health Programme'],         'committee', false, 103),
  ('Ministry of Electronics & IT',        null, 'Ministry of Electronics & IT',        array['Digital India Programme'],                 'committee', false, 104),
  ('Ministry of Environment',             null, 'Ministry of Environment',             array['Swachh Bharat Mission'],                   'committee', false, 105),
  ('Ministry of Agriculture',             null, 'Ministry of Agriculture',             array['Digital Agriculture Mission'],             'committee', false, 106),
  ('Ministry of Road Transport',          null, 'Ministry of Road Transport',          array['Motor Vehicles Act'],                      'committee', false, 107),
  ('Ministry of Housing & Urban Affairs', null, 'Ministry of Housing & Urban Affairs', array['Smart Cities Mission'],                    'committee', false, 108),
  ('Ministry of Skill Development',        null, 'Ministry of Skill Development',       array['Skill India Mission'],                     'committee', false, 109),
  ('Ministry of Women & Child Development',null, 'Ministry of Women & Child Development',array['POCSO Act','BBBP'],                       'committee', false, 110),
  ('Ministry of Labour & Employment',     null, 'Ministry of Labour & Employment',     array['Labour Codes'],                            'committee', false, 111),
  ('Ministry of Tourism & Culture',       null, 'Ministry of Tourism & Culture',       array['Dekho Apna Desh'],                         'committee', false, 112),
  ('Ministry of Jal Shakti',              null, 'Ministry of Jal Shakti',              array['Jal Jeevan Mission'],                      'committee', false, 113),
  ('Ministry of MSME',                    null, 'Ministry of MSME',                    array['Startup India'],                           'committee', false, 114)
on conflict (lower(ministry), lower(coalesce(scheme, ''))) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- SEED 2 — flagship GoI schemes as CHILD rows (scheme NOT NULL) under the
-- committee ministries above, so the taxonomy carries the actual scheme names
-- (not just a ministry shell). These are well-known and high-confidence, so
-- needs_review=false; sort_order mirrors the parent. The admin can add more
-- child schemes later via the editor.
-- ════════════════════════════════════════════════════════════════════════
insert into yip.gov_taxonomy
  (ministry, scheme, official_name, category, needs_review, sort_order)
values
  ('Ministry of Education',               'NEP 2020',                          'National Education Policy 2020',                   'scheme', false, 100),
  ('Ministry of Education',               'PM eVidya',                         'PM eVidya',                                        'scheme', false, 100),
  ('Ministry of Youth Affairs & Sports',  'Khelo India',                       'Khelo India Programme',                            'scheme', false, 102),
  ('Ministry of Health & Family Welfare', 'Ayushman Bharat',                   'Ayushman Bharat (PM-JAY)',                         'scheme', false, 103),
  ('Ministry of Health & Family Welfare', 'National Mental Health Programme',  'National Mental Health Programme',                 'scheme', false, 103),
  ('Ministry of Electronics & IT',        'Digital India',                     'Digital India Programme',                          'scheme', false, 104),
  ('Ministry of Environment',             'Swachh Bharat Mission',             'Swachh Bharat Mission',                            'scheme', false, 105),
  ('Ministry of Agriculture',             'PM-KISAN',                          'Pradhan Mantri Kisan Samman Nidhi',                'scheme', false, 106),
  ('Ministry of Housing & Urban Affairs', 'Smart Cities Mission',             'Smart Cities Mission',                              'scheme', false, 108),
  ('Ministry of Housing & Urban Affairs', 'PMAY (Urban)',                      'Pradhan Mantri Awas Yojana (Urban)',               'scheme', false, 108),
  ('Ministry of Skill Development',        'Skill India',                       'Skill India Mission',                              'scheme', false, 109),
  ('Ministry of Skill Development',        'PMKVY',                             'Pradhan Mantri Kaushal Vikas Yojana',              'scheme', false, 109),
  ('Ministry of Women & Child Development','Beti Bachao Beti Padhao',           'Beti Bachao Beti Padhao',                          'scheme', false, 110),
  ('Ministry of Jal Shakti',              'Jal Jeevan Mission',                'Jal Jeevan Mission',                               'scheme', false, 113),
  ('Ministry of MSME',                    'Startup India',                     'Startup India',                                    'scheme', false, 114)
on conflict (lower(ministry), lower(coalesce(scheme, ''))) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- SEED 3 — additional major GoI ministries NOT in the committee catalogue,
-- with one flagship scheme each. These broaden the tagging vocabulary so a
-- chapter that runs a committee outside the standard 15 still resolves to a
-- known ministry. Confidence is high on the ministry names; each flagship
-- scheme below is well-established, so needs_review=false. Ministries with no
-- flagship scheme listed are flagged needs_review=true so a human confirms
-- whether to attach one. sort_order 200+ keeps these below the committee set.
-- ════════════════════════════════════════════════════════════════════════
insert into yip.gov_taxonomy
  (ministry, scheme, official_name, category, needs_review, sort_order)
values
  ('Ministry of Rural Development',             null,                    'Ministry of Rural Development',             'ministry', false, 200),
  ('Ministry of Rural Development',             'MGNREGA',               'Mahatma Gandhi National Rural Employment Guarantee Act', 'scheme', false, 200),
  ('Ministry of Rural Development',             'PMAY (Gramin)',         'Pradhan Mantri Awas Yojana (Gramin)',       'scheme', false, 200),
  ('Ministry of Consumer Affairs, Food & Public Distribution', null,    'Ministry of Consumer Affairs, Food & Public Distribution', 'ministry', false, 201),
  ('Ministry of Consumer Affairs, Food & Public Distribution', 'One Nation One Ration Card', 'One Nation One Ration Card', 'scheme', false, 201),
  ('Ministry of Power',                         null,                    'Ministry of Power',                         'ministry', false, 202),
  ('Ministry of Power',                         'Saubhagya',             'Pradhan Mantri Sahaj Bijli Har Ghar Yojana (Saubhagya)', 'scheme', false, 202),
  ('Ministry of New & Renewable Energy',        null,                    'Ministry of New & Renewable Energy',        'ministry', false, 203),
  ('Ministry of New & Renewable Energy',        'PM Surya Ghar',         'PM Surya Ghar: Muft Bijli Yojana',          'scheme', false, 203),
  ('Ministry of Tribal Affairs',               null,                    'Ministry of Tribal Affairs',                'ministry', false, 204),
  ('Ministry of Tribal Affairs',               'Eklavya Model Residential Schools', 'Eklavya Model Residential Schools', 'scheme', false, 204),
  ('Ministry of Social Justice & Empowerment', null,                    'Ministry of Social Justice & Empowerment',  'ministry', true,  205),
  ('Ministry of Commerce & Industry',          null,                    'Ministry of Commerce & Industry',           'ministry', false, 206),
  ('Ministry of Commerce & Industry',          'Make in India',         'Make in India',                             'scheme', false, 206),
  ('Ministry of External Affairs',             null,                    'Ministry of External Affairs',              'ministry', true,  207),
  ('Ministry of Defence',                      null,                    'Ministry of Defence',                       'ministry', true,  208),
  ('Ministry of Home Affairs',                 null,                    'Ministry of Home Affairs',                  'ministry', true,  209),
  ('Ministry of Law & Justice',                null,                    'Ministry of Law & Justice',                 'ministry', true,  210),
  ('Ministry of Railways',                     null,                    'Ministry of Railways',                      'ministry', true,  211),
  ('Ministry of Petroleum & Natural Gas',      null,                    'Ministry of Petroleum & Natural Gas',       'ministry', false, 212),
  ('Ministry of Petroleum & Natural Gas',      'Ujjwala Yojana',        'Pradhan Mantri Ujjwala Yojana',             'scheme', false, 212)
on conflict (lower(ministry), lower(coalesce(scheme, ''))) do nothing;
