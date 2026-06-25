-- ============================================================================
-- YIP scoring model rework — Director ruling 2026-06-25
-- ============================================================================
-- The Director locked the /90 jury model as:
--   UPI 15 · Political Acumen 10 · Committee 10 · Question Hour 20 ·
--   Zero Hour 15 · Debate 10 · Bill 10  =  90   (+ Position Points 10 = /100,
--   preserved by the live weighted_90 normalization in app/yip/actions/results.ts).
--
-- THREE config changes are encoded here (the engine changes ship separately in
-- the same PR — committee-LEVEL shared-score machinery removed, Team Spirit
-- re-based onto each committee's AVERAGE member committee-session score):
--   1. committee_bill_drafting  — drop the cmte.committee_level element, /15 → /10
--   2. bill_presentation_voting — drop the bill.committee_level element, /15 → /10
--   3. debate_central_agenda    — replace params with a fresh /10 DEBATE rubric
--                                 (it currently carries the Political-Acumen pol.*
--                                  criteria; those move to a new session below).
--   4. political_acumen         — NEW session row (the pol.* criteria, /10) keyed
--                                 to the Government & Opposition Formation session.
--   5. agenda mapping           — make the Government & Opposition Formation item
--                                 (agenda_type='party_formation') a scoreable,
--                                 political_acumen-keyed session, on BOTH the real
--                                 Erode event and the yip.agenda_template.
--
-- IDEMPOTENT: each session's `parameters` is SET to its exact target array (not
-- patched element-by-element), `total_max` is set to its target, the new row is
-- upserted on the unique session_key, and the agenda UPDATEs are plain WHEREs —
-- so re-running this migration converges to the same state.
--
-- DB STATE READ 2026-06-25 (live, before this migration):
--   • committee_bill_drafting  total_max=15, 6 params (incl cmte.committee_level/5)
--   • bill_presentation_voting total_max=15, 6 params (incl bill.committee_level/5)
--   • debate_central_agenda     total_max=10, label 'Political Acumen & Legislative
--                               Strategy', 4 pol.* params (drift — see ruling)
--   • political_acumen          DID NOT EXIST
--   • Erode (170c8e79…) party_formation item: session_key NULL, is_scoreable false
--   • agenda_template party_formation row: session_key NULL, is_scoreable false
--
-- Applied to production via the Supabase Management API by the orchestrator (the
-- agent that wrote this file does NOT apply it; this file is for review + apply).
-- ============================================================================

set search_path to yip, public;

-- ── 1. Committee (Bill Drafting): drop the shared committee-level criterion ──
--    Remaining 5 individual criteria sum to 10.
update yip.session_parameters
set
  parameters = '[
    {"key":"cmte.initiative","label":"Initiative","kind":"evaluation","max_score":2,"weight":1},
    {"key":"cmte.research_contribution","label":"Research Contribution","kind":"evaluation","max_score":2,"weight":1},
    {"key":"cmte.drafting_inputs","label":"Drafting Inputs","kind":"evaluation","max_score":2,"weight":1},
    {"key":"cmte.team_collaboration","label":"Team Collaboration","kind":"participation","max_score":2,"weight":1},
    {"key":"cmte.quality_committee_work","label":"Quality of Committee Work","kind":"evaluation","max_score":2,"weight":1}
  ]'::jsonb,
  total_max = 10,
  updated_at = now()
where session_key = 'committee_bill_drafting';

-- ── 2. Bill Presentation & Defence: drop the shared committee-level criterion ──
--    Remaining 5 individual criteria sum to 10.
update yip.session_parameters
set
  parameters = '[
    {"key":"bill.presentation_quality","label":"Quality of Bill Presentation","kind":"evaluation","max_score":2,"weight":1},
    {"key":"bill.understanding","label":"Understanding of Bill","kind":"evaluation","max_score":2,"weight":1},
    {"key":"bill.defence_questions","label":"Defence Against Questions","kind":"evaluation","max_score":3,"weight":1},
    {"key":"bill.feasibility","label":"Feasibility of Recommendations","kind":"evaluation","max_score":2,"weight":1},
    {"key":"bill.conduct","label":"Parliamentary Conduct","kind":"evaluation","max_score":1,"weight":1}
  ]'::jsonb,
  total_max = 10,
  updated_at = now()
where session_key = 'bill_presentation_voting';

-- ── 3. Debate on Central Agenda: install the fresh /10 DEBATE rubric ──
--    The pol.* criteria that currently sit on this row move to political_acumen
--    (step 4). debate.* (5 criteria) sum to 10. Re-label + agenda_type 'debate'.
update yip.session_parameters
set
  label = 'Debate on Central Agenda',
  agenda_type = 'debate',
  is_active = true,
  parameters = '[
    {"key":"debate.arguments","label":"Quality of Arguments (logic, policy, evidence)","kind":"evaluation","max_score":3,"weight":1},
    {"key":"debate.relevance","label":"Relevance to the Central Agenda","kind":"evaluation","max_score":2,"weight":1},
    {"key":"debate.rebuttal","label":"Rebuttal & Questioning","kind":"evaluation","max_score":2,"weight":1},
    {"key":"debate.communication","label":"Communication & Delivery","kind":"evaluation","max_score":2,"weight":1},
    {"key":"debate.conduct","label":"Parliamentary Conduct","kind":"evaluation","max_score":1,"weight":1}
  ]'::jsonb,
  total_max = 10,
  updated_at = now()
where session_key = 'debate_central_agenda';

-- ── 4. NEW: Political Acumen & Legislative Strategy (/10) ──
--    The 4 pol.* criteria previously carried on debate_central_agenda, now their
--    own session keyed to the Government & Opposition Formation agenda item.
--    Upsert on the unique session_key so re-runs converge.
insert into yip.session_parameters
  (session_key, label, agenda_type, display_order, parameters, total_max, session_weight, is_active)
values (
  'political_acumen',
  'Political Acumen & Legislative Strategy',
  'party_formation',
  5,
  '[
    {"key":"pol.coalition_building","label":"Coalition Building & Alliance Management","kind":"evaluation","max_score":3,"weight":1},
    {"key":"pol.parliamentary_strategy","label":"Parliamentary Strategy & Procedural Use","kind":"evaluation","max_score":3,"weight":1},
    {"key":"pol.influence_negotiation","label":"Influence, Negotiation & Vote Mobilisation","kind":"evaluation","max_score":2,"weight":1},
    {"key":"pol.floor_presence","label":"Political Communication & Floor Presence","kind":"evaluation","max_score":2,"weight":1}
  ]'::jsonb,
  10,
  10,
  true
)
on conflict (session_key) do update set
  label          = excluded.label,
  agenda_type    = excluded.agenda_type,
  display_order  = excluded.display_order,
  parameters     = excluded.parameters,
  total_max      = excluded.total_max,
  session_weight = excluded.session_weight,
  is_active      = excluded.is_active,
  updated_at     = now();

-- ── 5. Agenda mapping: make Gov/Opp Formation a scoreable political_acumen session ──
--    a) Real Erode event.
update yip.agenda
set
  session_key = 'political_acumen',
  is_scoreable = true,
  updated_at = now()
where event_id = '170c8e79-5e27-4831-ace2-cea1782a971f'
  and agenda_type = 'party_formation';

--    b) The agenda template (so every future event's Gov/Opp Formation item is
--       seeded scoreable + political_acumen-keyed). Guarded by to_regclass so the
--       migration is safe if the template table is ever absent.
do $$
begin
  if to_regclass('yip.agenda_template') is not null then
    update yip.agenda_template
    set
      session_key = 'political_acumen',
      is_scoreable = true,
      updated_at = now()
    where agenda_type = 'party_formation';
  end if;
end $$;

-- ============================================================================
-- END — YIP scoring model rework (Director ruling 2026-06-25)
-- ============================================================================
