-- YIP NATIONAL ROUND 2026 (31 Oct - 1 Nov, New Delhi) — scoring sheets, awards
-- and agenda preset, all scoped to level '{national}'.
--
-- STATUS: DRAFT for Maria (National Team) / Director review. NOT applied to any
-- database. Inputs: Maria's Draft Agenda (2026-10-25), her 10-award list + 5
-- special recognitions, Swapnil's 7 bill topics.
--
-- WHY THIS IS NEEDED
-- Before this file, NO session sheet and NO award is scoped to 'national'. The
-- level resolver (lib/yip/round-level.ts pickByLevel) therefore hands a national
-- event the GLOBAL (chapter) set: 15 chapter awards and chapter /100 sheets.
--
-- DESIGN
-- * Sheets copy the LIVE regional sheets (Maria's 10-points-per-student design:
--   a ruling-tagged block, an opposition-tagged block and a common block) with a
--   national family prefix (ngb / nqh / nvn / npb / ncr / nzh), so national can be
--   tuned later WITHOUT re-scoring finished regional rounds (results recompute on
--   demand). NOTE: the Admin > Session Scoring editor rejects dotted criterion
--   keys (session-parameters.ts KEY_PATTERN), as it already does for the live
--   regional sheets, so national sheets are tuned in SQL until that is fixed.
--   Each sheet gains a small `.conduct` criterion so "Excellence in
--   Parliamentary Conduct" has something to rank on.
-- * Two NEW sheets: Voice of the Nation (nvn) and Presiding Officer & House
--   Officials (nof). nof carries criteria tagged by parliament role (speaker /
--   parliamentary_journalist / parliamentary_administrator) so those three
--   awards are scored instead of hand-picked. A hand pin only lands on someone
--   who has a submitted score (results.ts override pass), so this also makes
--   pins safe.
-- * Awards reuse the regional award_keys (so event_award_config /
--   zone_award_config keep meaning the same award) with Maria's labels verbatim.
--   Role-specific awards use eligibility 'all' + rank_keys that only that role
--   can score on: the candidate pool is then tiny, the scarce-first assigner
--   gives them out FIRST, and no award is ever given on a zero. The top award
--   uses the new eligibility 'member' (results.ts) so an official who did NOT
--   win their own award cannot take it on a single 10-point sheet.
-- * King Maker is seeded INACTIVE (hand-pick by the chair from Results): the
--   national agenda has no session that measures coalition strategy. It stays
--   that way until the group answers round-2 Q2/Q3 (Political Acumen sheet +
--   chair weight). The 5 special recognitions are SCORED from marks (Swapnil,
--   26 Oct); their bases await the group's OK (round-2 Q4).
-- * Updated 26 Oct to the Tech Support Committee answers: Committee Reports out
--   of Treasury/Opposition, Conduct = GB+QH+ZH, officials sheet as the
--   Director's group message.
--
-- SAFETY: additive only. New rows scoped '{national}'; no existing row touched;
-- ON CONFLICT DO NOTHING everywhere, so re-running never overwrites an edit made
-- in the admin screens. Idempotent.

BEGIN;

-- ─── 1. Session criteria sheets (yip.session_parameters, levels '{national}') ──
-- total_max = the published sheet total (both benches); each student is marked
-- out of 10 on the subset that matches their bench / role (lib/yip/scoring-roles.ts).

INSERT INTO yip.session_parameters
  (session_key, label, agenda_type, display_order, parameters, total_max, session_weight, is_active, lock_on_submit, levels)
VALUES
  ('bill_presentation_voting', 'Government Bills (National)', 'bill_presentation', 200,
   '[
     {"key":"ngb.quality_defense","kind":"evaluation","label":"Quality of Bill & Defence to Questions","weight":1,"max_score":6,"roles":["side:ruling"],"parameters":"Initiative, Research, Public Impact, Objectives, Feasibility"},
     {"key":"ngb.presentation","kind":"evaluation","label":"Parliamentary Presentation","weight":1,"max_score":2,"parameters":"Clarity, Oratory, Structure"},
     {"key":"ngb.conduct","kind":"evaluation","label":"Parliamentary Conduct","weight":1,"max_score":2,"parameters":"Procedure, Decorum, Time Management"},
     {"key":"ngb.question_critic","kind":"evaluation","label":"Question & Critique of the Bill","weight":1,"max_score":6,"roles":["side:opposition"],"parameters":"Subject Knowledge, Relevant Questions, Critical Thinking, Composure"}
   ]'::jsonb, 16, 10, true, false, '{national}'),

  ('voice_of_nation', 'Voice of the Nation (National)', 'opening_speech', 201,
   '[
     {"key":"nvn.vision","kind":"evaluation","label":"Clarity of Vision","weight":1,"max_score":4,"parameters":"Constituency / committee / party / ministry vision stated clearly and concretely"},
     {"key":"nvn.relevance","kind":"evaluation","label":"Relevance to the Central Theme","weight":1,"max_score":3,"parameters":"Link to Viksit Bharat 2047 and the House agenda"},
     {"key":"nvn.delivery","kind":"evaluation","label":"Delivery within Time","weight":1,"max_score":2,"parameters":"Oratory, confidence, finishing inside 30/45/60/90 s"},
     {"key":"nvn.conduct","kind":"evaluation","label":"Parliamentary Conduct","weight":1,"max_score":1,"parameters":"Decorum, quick hand-over of the mic"}
   ]'::jsonb, 10, 10, true, false, '{national}'),

  ('question_hour', 'Question Hour (National)', 'question_hour', 202,
   '[
     {"key":"nqh.questioning","kind":"evaluation","label":"Questioning Skills","weight":1,"max_score":8,"roles":["side:opposition"],"parameters":"Quality of Question, Research & Relevance, Public Significance, Supplementary Questions & Precision"},
     {"key":"nqh.conduct","kind":"evaluation","label":"Conduct & Communication","weight":1,"max_score":2,"parameters":"Parliamentary Procedure, Decorum, Oratory & Time Management"},
     {"key":"nqh.ministerial","kind":"evaluation","label":"Ministerial Competence","weight":1,"max_score":8,"roles":["side:ruling"],"parameters":"Quality of Response, Subject Knowledge, Handling Supplementaries, Evidence-Based Answering"}
   ]'::jsonb, 18, 10, true, false, '{national}'),

  ('private_members_bills', 'Private Members'' Bills (National)', 'private_members_bills', 203,
   '[
     {"key":"npb.quality_defense","kind":"evaluation","label":"Quality of Bill & Defence to Questions","weight":1,"max_score":4,"parameters":"Initiative, Research, Public Impact, Objectives, Feasibility"},
     {"key":"npb.presentation","kind":"evaluation","label":"Parliamentary Presentation","weight":1,"max_score":1,"parameters":"Clarity, Oratory, Structure"},
     {"key":"npb.conduct","kind":"evaluation","label":"Parliamentary Conduct","weight":1,"max_score":1,"parameters":"Procedure, Decorum, Time Management"},
     {"key":"npb.question_critic","kind":"evaluation","label":"Question & Critique of the Bill","weight":1,"max_score":4,"parameters":"Subject Knowledge, Relevant Questions, Critical Thinking, Composure"}
   ]'::jsonb, 10, 10, true, false, '{national}'),

  ('committee_reports', 'Committee Reports (National)', 'committee_reports', 204,
   '[
     {"key":"ncr.research","kind":"evaluation","label":"Research & Relevance","weight":1,"max_score":8,"roles":["side:ruling"],"parameters":"Research, Observation, Feasibility, Impact & Defence"},
     {"key":"ncr.structure","kind":"evaluation","label":"Report Structure & Presentation","weight":1,"max_score":1,"parameters":"Structure, Clarity, Communication"},
     {"key":"ncr.conduct","kind":"evaluation","label":"Parliamentary Conduct","weight":1,"max_score":1,"parameters":"Decorum, Time Management"},
     {"key":"ncr.observation","kind":"evaluation","label":"Observation & Debate","weight":1,"max_score":8,"roles":["side:opposition"],"parameters":"Critical Thinking, Constructive Change & Recommendations"}
   ]'::jsonb, 18, 10, true, false, '{national}'),

  ('zero_hour', 'Zero Hour (National)', 'zero_hour', 205,
   '[
     {"key":"nzh.research","kind":"evaluation","label":"Research","weight":1,"max_score":4,"parameters":"Relevance, Public Significance, Urgency, Facts"},
     {"key":"nzh.presentation","kind":"evaluation","label":"Parliamentary Presentation","weight":1,"max_score":1,"parameters":"Policy Orientation, Communication"},
     {"key":"nzh.conduct","kind":"evaluation","label":"Parliamentary Conduct","weight":1,"max_score":1,"parameters":"Decorum, short and sharp, Time Management"},
     {"key":"nzh.advocacy","kind":"evaluation","label":"Advocacy & Impact","weight":1,"max_score":4,"parameters":"Creativity, Critical Thinking, Problem Solving, Recommendations"}
   ]'::jsonb, 10, 10, true, false, '{national}'),

  -- agenda_type is NULL on purpose: the sheet must match ONLY by session_key, never
  -- by the agenda_type fallback (a hand-added scoreable 'general' item would
  -- otherwise pick it up and leave every MP unmarkable).
  -- Scored ONCE, on the Day-2 "Observations & Closing Remarks" item, by jurors
  -- who watched both days. Every criterion is role-tagged, so an MP has nothing
  -- to be marked on here and each official is marked out of 10.
  ('national_officials', 'Presiding Officer & House Officials (National)', NULL, 206,
   '[
     {"key":"nof.sp_command","kind":"evaluation","label":"Command of the House","weight":1,"max_score":4,"roles":["speaker"],"parameters":"Discipline, confidence, keeping sessions on time"},
     {"key":"nof.sp_impartiality","kind":"evaluation","label":"Impartiality","weight":1,"max_score":3,"roles":["speaker"],"parameters":"Fair recognition of both benches"},
     {"key":"nof.sp_procedure","kind":"evaluation","label":"Procedure","weight":1,"max_score":3,"roles":["speaker"],"parameters":"Rules, order of business, rulings on points of order"},
     {"key":"nof.jr_accuracy_insight","kind":"evaluation","label":"Accuracy & Insight","weight":1,"max_score":4,"roles":["parliamentary_journalist"],"parameters":"Correct reporting, interpretation, balance"},
     {"key":"nof.jr_coverage","kind":"evaluation","label":"Coverage","weight":1,"max_score":3,"roles":["parliamentary_journalist"],"parameters":"Completeness across sessions"},
     {"key":"nof.jr_presentation","kind":"evaluation","label":"Presentation","weight":1,"max_score":3,"roles":["parliamentary_journalist"],"parameters":"Engaging, clear final report / observation"},
     {"key":"nof.ad_observations","kind":"evaluation","label":"Observations","weight":1,"max_score":4,"roles":["parliamentary_administrator"],"parameters":"Quality of observations to the House"},
     {"key":"nof.ad_procedure_records","kind":"evaluation","label":"Procedure & Records","weight":1,"max_score":3,"roles":["parliamentary_administrator"],"parameters":"Order of business, records of bills, votes, questions"},
     {"key":"nof.ad_presentation","kind":"evaluation","label":"Presentation","weight":1,"max_score":3,"roles":["parliamentary_administrator"],"parameters":"Clear, confident delivery"}
   ]'::jsonb, 30, 10, true, false, '{national}')
ON CONFLICT (session_key, levels) DO NOTHING;

-- ─── 2. Award set (yip.award_definitions, levels '{national}') ──────────────
-- Labels are Maria's verbatim (25 Oct 2026). Keep lib/yip/awards.ts
-- NATIONAL_AWARD_LABELS in sync — the chair's manual-pin path validates on it.

INSERT INTO yip.award_definitions
  (award_key, label, basis_description, default_recipients, is_team, is_active, display_order, eligibility, rank_mode, rank_keys, levels)
VALUES
  ('best_parliamentarian','National Best Parliamentarian Award','Strongest overall parliamentarian across both days: Government Bills, Voice of the Nation, Question Hour, Private Members'' Bills, Committee Reports and Zero Hour. Members only: the Speaker and House officials are not eligible.',1,false,true,1,'member','overall_total','{}','{national}'),
  ('best_speaker','Best Speaker of the House Award','Impartial, confident conduct of proceedings: command of the House, impartiality and procedure. Scored on the Presiding Officer sheet.',1,false,true,2,'speaker','family_sum','{nof.sp_command,nof.sp_impartiality,nof.sp_procedure}','{national}'),
  ('leadership_excellence','National Parliamentary Leadership Award','Outstanding leadership by the PM, LoP, Ministers, Shadow Ministers, Party Leaders and Committee Chairs: half position held, half session scores.',1,false,true,3,'leadership','leadership_blend','{}','{national}'),
  ('best_member_ruling','Best Treasury Bench Parliamentarian Award','The ruling-bench member who best presents and defends Government positions across Government Bills and Question Hour.',1,false,true,4,'ruling','family_sum','{ngb,nqh}','{national}'),
  ('best_member_opposition','Best Opposition Parliamentarian Award','The opposition member who best holds the Government to account across Government Bills, Question Hour and Zero Hour.',1,false,true,5,'opposition','family_sum','{ngb,nqh,nzh}','{national}'),
  ('exemplary_decorum','Excellence in Parliamentary Conduct Award','Exemplary decorum, procedure and time discipline: the sum of the Conduct marks in Government Bills, Question Hour and Zero Hour. Members with a disciplinary flag are not eligible.',1,false,true,6,'no_disciplinary','family_sum','{ngb.conduct,nqh.conduct,nzh.conduct}','{national}'),
  ('best_parliamentary_journalist','Best Parliamentary Journalist – National Finals','Accurate, insightful and engaging coverage of the proceedings. Scored on the House Officials sheet.',1,false,true,7,'all','family_sum','{nof.jr_accuracy_insight,nof.jr_coverage,nof.jr_presentation}','{national}'),
  ('best_parliamentary_administrator','Best Parliamentary Administrator – National Finals','Observations, procedure and records, and presentation. Scored on the House Officials sheet.',1,false,true,8,'all','family_sum','{nof.ad_observations,nof.ad_procedure_records,nof.ad_presentation}','{national}'),
  ('best_private_members_bill','Best Private Member''s Bill Award','Strongest Private Member''s Bill on relevance, originality, legislative quality, practicality and defence. Ranked on the Bill Quality + Presentation marks, so jurors must give those marks only to the member presenting the bill. One winner per award: co-authors cannot share it.',1,false,true,9,'all','family_sum','{npb.quality_defense,npb.presentation}','{national}'),
  ('political_strategist','King Maker Award (Political Strategist)','Coalition-building, floor strategy and vote mobilisation. No national session measures this, so it is chosen by hand: pin the winner from the event''s Results page.',1,false,false,10,'all','family_sum','{}','{national}'),
  -- Special recognitions: scored from marks (Swapnil, 26 Oct, option 4b). The
  -- basis of each is the desk's proposal, awaiting the group's OK (round 2, Q4).
  ('best_debater','Best Debater – National Finals','Strongest debating: questioning, critique and presentation in Government Bills and Private Members'' Bills.',1,false,true,11,'all','family_sum','{ngb.question_critic,ngb.presentation,npb.question_critic,npb.presentation}','{national}'),
  ('best_zero_hour','Best Zero Hour – National Finals','Strongest Zero Hour interventions.',1,false,true,12,'all','family_sum','{nzh}','{national}'),
  ('best_question_hour','Best Question Hour – National Finals','Strongest Question Hour performance, questions or ministerial answers.',1,false,true,13,'all','family_sum','{nqh}','{national}'),
  ('best_minister','Best Minister – National Finals','Ministers and leaders: presenting bills, Question Hour answers and Zero Hour.',1,false,true,14,'leadership','family_sum','{ngb.quality_defense,nqh.ministerial,nzh}','{national}'),
  ('outstanding_committee_member','Best Committee Member – National Finals','Strongest Committee Report presentation and debate.',1,false,true,15,'all','family_sum','{ncr}','{national}')
ON CONFLICT (award_key, levels) DO NOTHING;

-- ─── 3. Agenda preset "National Round 2026 (2-day)" (yip.agenda_presets) ────
-- Durations are the agenda's clock times. Sub-phase timers (present / debate /
-- vote) are NOT carried by presets; set them on each live item in Control.

INSERT INTO yip.agenda_presets (chapter_name, yi_chapter_id, name, is_global, items)
VALUES ('National', NULL, 'National Round 2026 (2-day)', true, '[
  {"day":1,"sequence_order":1,"title":"Registration & Breakfast","agenda_type":"registration","duration_minutes":60,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":1,"sequence_order":2,"title":"Inaugural Session","agenda_type":"inaugural","duration_minutes":30,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":"Lighting of the lamp; opening remarks, address, keynote, vote of thanks."},
  {"day":1,"sequence_order":3,"title":"Oath of Affirmation & Constitution of the House","agenda_type":"oath_taking","duration_minutes":30,"mode":"party","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":"Oath of Members; announcement of Speaker, PM, LoP, Cabinet, Shadow Cabinet, Party Leaders and Officials."},
  {"day":1,"sequence_order":4,"title":"Government Bills","agenda_type":"bill_presentation","duration_minutes":165,"mode":"party","is_scoreable":true,"session_key":"bill_presentation_voting","use_for_voting":true,"description":"10:00–12:45 with Tea Break 11:30–11:45. 20 min per bill: 3 min Minister presents, 16 min debate, 1 min vote. Kept as ONE scored item so Government Bills counts once in each student's total."},
  {"day":1,"sequence_order":5,"title":"Lunch Break","agenda_type":"break","duration_minutes":30,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":1,"sequence_order":6,"title":"Voice of the Nation","agenda_type":"opening_speech","duration_minutes":90,"mode":"party","is_scoreable":true,"session_key":"voice_of_nation","use_for_voting":false,"description":"MPs 30 s each (no roll call); Committee Chairs 45 s; Party Leaders 60 s (Opposition, then Ruling); Shadow Minister then Cabinet Minister 60 s each; LoP 90 s; PM concludes."},
  {"day":1,"sequence_order":7,"title":"Tea Break","agenda_type":"break","duration_minutes":15,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":1,"sequence_order":8,"title":"Question Hour","agenda_type":"question_hour","duration_minutes":120,"mode":"party","is_scoreable":true,"session_key":"question_hour","use_for_voting":false,"description":"15 starred questions + 5–6 surprise draws, 6 min each: 60 s question, 60 s Minister reply, 120 s follow-up and rebuttal."},
  {"day":1,"sequence_order":9,"title":"High Tea & Adjournment","agenda_type":"adjournment","duration_minutes":15,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":2,"sequence_order":1,"title":"Private Members'' Bills","agenda_type":"private_members_bills","duration_minutes":90,"mode":"party","is_scoreable":true,"session_key":"private_members_bills","use_for_voting":true,"description":"5–6 bills, 15 min each: 3 min present, 11 min debate, 1 min vote."},
  {"day":2,"sequence_order":2,"title":"Committee Reports","agenda_type":"committee_reports","duration_minutes":135,"mode":"committee","is_scoreable":true,"session_key":"committee_reports","use_for_voting":false,"description":"12 min per report: 3 min presentation, then debate on the merits of each point."},
  {"day":2,"sequence_order":3,"title":"Lunch Break","agenda_type":"break","duration_minutes":30,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":2,"sequence_order":4,"title":"Zero Hour","agenda_type":"zero_hour","duration_minutes":45,"mode":"party","is_scoreable":true,"session_key":"zero_hour","use_for_voting":false,"description":"Breaking news circulated; short, sharp interventions; Minister and Shadow Minister views; PM final remarks."},
  {"day":2,"sequence_order":5,"title":"Administrator Observations & Closing Remarks","agenda_type":"general","duration_minutes":90,"mode":"mixed","is_scoreable":true,"session_key":"national_officials","use_for_voting":false,"description":"Observations by Administrators and Journalists; closing remarks by LoP, PM and Speakers (1 min each). Jurors score the Speaker, Journalists and Administrators here."},
  {"day":2,"sequence_order":6,"title":"Tea Break","agenda_type":"break","duration_minutes":15,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":2,"sequence_order":7,"title":"Concluding Remarks","agenda_type":"valedictory","duration_minutes":15,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":null},
  {"day":2,"sequence_order":8,"title":"Valedictory Session & Recognition to Winners","agenda_type":"valedictory","duration_minutes":90,"mode":"mixed","is_scoreable":false,"session_key":null,"use_for_voting":false,"description":"Remarks, special remarks, Chief Guest valedictory address, vote of thanks, awards."}
]'::jsonb)
ON CONFLICT (chapter_name, name) DO NOTHING;

COMMIT;
