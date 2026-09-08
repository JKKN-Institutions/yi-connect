-- ═══════════════════════════════════════════════════════════════════
-- YIP Cabinet / Shadow Minister — two-portfolio nomination + 12-question paper
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- The last of the three later-stage selections. Two Director decisions shape
-- the schema here, and both are why this migration is bigger than the other two:
--
--   1. A nominee picks EXACTLY TWO portfolios, so a nomination now carries
--      WHICH ministries — a new `ministries text[]` on yip.self_nominations.
--   2. The paper is 6 questions from EACH of those two portfolios (12 total,
--      60 minutes), so a question now carries WHICH ministry it belongs to —
--      a new `ministry text` on yip.questionnaire_questions, null for the
--      five non-portfolio posts.
--
-- Cabinet vs Shadow is a LABEL, not a choice: the same portfolios are open on
-- both benches and cabinetRoleForSide() computes which of the two roles the
-- Member's bench gives them. There is deliberately only ONE questionnaire post
-- ('cabinet_minister') — the portfolio questions are identical whether you run
-- Finance or shadow it, so a Shadow nominee sits the same paper.
--
-- Unlike PM/LOP there is NO Party-Leader bar on this stage: no such
-- restriction was specified, so a Party Leader may still stand for a portfolio.
--
-- WHICH portfolios exist is the CHAPTER'S choice, not a fixed twelve:
-- events.cabinet_ministries, resolved by effectiveMinistries() in
-- lib/yip/cabinet.ts, which falls back to the 8 platform defaults when a
-- chapter has not configured its own. The 240 questions seeded below cover the
-- 12 portfolios in the source document; a chapter that picks a portfolio with
-- no bank gets a visibly short paper rather than a blank screen, and can seed
-- its own event-scoped rows.
--
-- All 240 question bodies are VERBATIM from "YiP 2026 – Regional Round
-- Selection Questionnaires — Cabinet Ministers (20 Questions per Portfolio)".
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Nomination carries the two portfolios ──────────────────────
alter table yip.self_nominations
  add column if not exists ministries text[] null;

alter table yip.self_nominations
  drop constraint if exists yip_self_nominations_roles_valid;
alter table yip.self_nominations
  add constraint yip_self_nominations_roles_valid check (
    cardinality(roles) between 1 and 8
    and roles <@ array[
      'parliamentary_administrator','speaker','party_leader',
      'parliamentary_journalist','prime_minister','leader_of_opposition',
      'cabinet_minister','shadow_minister'
    ]::text[]
  );

-- A Cabinet/Shadow nomination MUST carry exactly two portfolios, and any other
-- nomination must carry none. Expressible as a plain CHECK because both
-- columns live on this row — this backs up normalizeCabinetMinistries() rather
-- than replacing it (the code still owns "is this portfolio offered HERE",
-- which needs the event row and so cannot live in a CHECK).
alter table yip.self_nominations
  drop constraint if exists yip_self_nominations_ministries_valid;
alter table yip.self_nominations
  add constraint yip_self_nominations_ministries_valid check (
    case
      when roles && array['cabinet_minister','shadow_minister']::text[]
        then cardinality(coalesce(ministries, '{}'::text[])) = 2
      else coalesce(cardinality(ministries), 0) = 0
    end
  );

-- ─── 2. Questions carry their portfolio ────────────────────────────
alter table yip.questionnaire_questions
  add column if not exists ministry text null;

-- Only the cabinet post may carry a ministry, and it always must.
alter table yip.questionnaire_questions
  drop constraint if exists yip_questionnaire_questions_ministry_valid;
alter table yip.questionnaire_questions
  add constraint yip_questionnaire_questions_ministry_valid check (
    (post_key = 'cabinet_minister' and ministry is not null)
    or (post_key <> 'cabinet_minister' and ministry is null)
  );

alter table yip.questionnaire_questions
  drop constraint if exists yip_questionnaire_questions_post_key_check;
alter table yip.questionnaire_questions
  add constraint yip_questionnaire_questions_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader',
                 'parliamentary_journalist','prime_minister','leader_of_opposition',
                 'cabinet_minister')
  );

alter table yip.questionnaire_windows
  drop constraint if exists yip_questionnaire_windows_post_key_check;
alter table yip.questionnaire_windows
  add constraint yip_questionnaire_windows_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader',
                 'parliamentary_journalist','prime_minister','leader_of_opposition',
                 'cabinet_minister')
  );

alter table yip.questionnaire_attempts
  drop constraint if exists yip_questionnaire_attempts_post_key_check;
alter table yip.questionnaire_attempts
  add constraint yip_questionnaire_attempts_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader',
                 'parliamentary_journalist','prime_minister','leader_of_opposition',
                 'cabinet_minister')
  );

-- The per-portfolio draw reads (post_key, ministry) for one event scope.
create index if not exists yip_questionnaire_questions_post_ministry
  on yip.questionnaire_questions (post_key, ministry, display_order);

-- ─── 3. Seed the 12 national portfolio banks (12 × 20 = 240) ───────
insert into yip.questionnaire_questions (event_id, post_key, ministry, body, display_order)
select v.event_id, v.post_key, v.ministry, v.body, v.display_order
from (values
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Name one real Indian government scheme related to school education (Centre or Tamil Nadu) and say whether you''d expand, fix, or scrap it — with one specific reason.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Draft the opening line — the "Statement of Objects" — of a Bill you''d introduce as Education Minister.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'A Member asks during Question Hour: "Why hasn''t your Ministry fixed the shortage of trained teachers in rural schools?" Give your actual reply.'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'If you only have budget for ONE: mid-day meals or free textbooks. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Zero Hour scenario: a viral video shows a government school in poor condition. What''s your first public statement as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'A Starred Question submitted for Question Hour asks pointedly why your Ministry''s mid-day meal quality varies so much between schools. Give your actual reply, on the record.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'An Opposition MP tables a Private Member''s Bill proposing free public Wi-Fi in every government school library. It overlaps with a plan your own Ministry was quietly working on. Do you support it, block it, or fold the idea into your own Government Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'A last-minute amendment is proposed to your education Bill just before the Speaker calls it for reading, changing which grade levels it covers. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Your education Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on standardised testing during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'During Zero Hour, a Member raises exam stress among students, a topic that wasn''t on the pre-submitted list. As Education Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific education issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'An in-simulation Parliamentary Journalist asks you directly why your Ministry hasn''t acted on the rural digital divide in classrooms yet. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Your Bill on vocational subjects in schools overlaps with the Skill Development Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Education Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Besides the scheme you named in Question 1, name one more real Indian education policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'A Member from your own party quietly tells you they think your Bill''s testing reforms go too far. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Education'::text, 'Describe the single hardest judgment call an Education Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Name one real, current tax or budget policy in India you''d change if you were Finance Minister, and why.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Draft the opening line of a Bill that changes how your Government spends money on one specific sector.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'A Member accuses your Ministry of "wasteful spending" during Question Hour. What''s your reply, with one specific defense?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'If tax revenue falls short this year, do you cut spending or borrow more? Defend your choice in 3–4 sentences.'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Zero Hour scenario: a sudden economic crisis hits (e.g. a major industry shuts down). What''s your Ministry''s first move?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'A Starred Question asks why your Ministry''s GST-related decisions haven''t reduced prices for small traders. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'An Opposition MP tables a Private Member''s Bill proposing a cap on wasteful government advertising spend. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'A last-minute amendment is proposed to your Finance Bill just before the Speaker calls it, changing a subsidy figure. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Your Finance Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s borrowing plan during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'During Zero Hour, a Member raises rising fuel prices, a topic that wasn''t pre-submitted. As Finance Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific fiscal issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'An in-simulation Parliamentary Journalist asks why your Ministry hasn''t cut its own administrative costs before asking citizens to tighten their belts. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Your Bill on rural credit access overlaps with the Agriculture Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Finance Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Besides the policy you named in Question 1, name one more real Indian fiscal policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'A Member from your own party quietly tells you they think your Bill''s spending cuts go too far. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Finance'::text, 'Describe the single hardest judgment call a Finance Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Name one real public health scheme in India (e.g. Ayushman Bharat, or a Tamil Nadu scheme) and say what you''d improve about it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Draft the opening line of a Bill addressing one specific health issue you think is being ignored.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'A Member asks why rural hospitals are understaffed. Give your actual reply during Question Hour.'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'If you only have budget for ONE: more hospital beds or more doctors'' salaries. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Zero Hour: a disease outbreak is reported in one district. What''s your first public statement as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'A Starred Question asks why your Ministry''s health insurance scheme still leaves many rural families paying out of pocket. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'An Opposition MP tables a Private Member''s Bill proposing free annual health check-ups in government schools. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'A last-minute amendment is proposed to your health Bill just before the Speaker calls it, changing which districts it covers first. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Your health Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on private hospital regulation during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'During Zero Hour, a Member raises the shortage of ambulances in a specific district, a topic that wasn''t pre-submitted. As Health Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific public health issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'An in-simulation Parliamentary Journalist asks why your Ministry hasn''t fixed rural hospital staffing despite repeated promises. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Your Bill on maternal health overlaps with the Women & Child Development Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Health Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Besides the scheme you named in Question 1, name one more real Indian public health policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'A Member from your own party quietly tells you they think your Bill''s hospital regulations go too far. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Health & Family Welfare'::text, 'Describe the single hardest judgment call a Health Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Name one real issue Indian farmers currently face, and one specific policy you''d propose to address it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Draft the opening line of a Bill you''d introduce to help farmers.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'A Member asks why crop prices crashed this season and what your Ministry did about it. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'If you can only fund ONE: fertilizer subsidies or crop insurance. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Zero Hour: unseasonal rain destroys a major crop right before harvest. What''s your first move as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'A Starred Question asks why your Ministry''s crop insurance payouts are so delayed after a bad season. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'An Opposition MP tables a Private Member''s Bill proposing guaranteed minimum prices for a specific crop. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'A last-minute amendment is proposed to your agriculture Bill just before the Speaker calls it, changing which farmers qualify for a subsidy. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Your agriculture Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on farm-loan waivers during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'During Zero Hour, a Member raises a sudden pest outbreak affecting a specific crop, a topic that wasn''t pre-submitted. As Agriculture Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific farming issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'An in-simulation Parliamentary Journalist asks why farmer distress remains a crisis despite your Ministry''s schemes. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Your Bill on sustainable farming practices overlaps with the Environment Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Agriculture Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Besides the issue you named in Question 1, name one more real Indian agricultural policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'A Member from your own party quietly tells you they think your Bill favours large farmers over small ones. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Agriculture'::text, 'Describe the single hardest judgment call an Agriculture Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Name one real environmental issue in Tamil Nadu or India, and one specific policy you''d propose.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Draft the opening line of a Bill balancing industrial growth with environmental protection.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'A Member says your Ministry is "blocking development" with environmental clearances. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Forced choice: stricter pollution rules that could cost jobs, or looser rules that protect jobs but harm air quality. Which do you pick, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Zero Hour: a factory is caught illegally dumping waste into a river. What''s your first public statement?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'A Starred Question asks why your Ministry keeps clearing industrial projects near ecologically sensitive areas. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'An Opposition MP tables a Private Member''s Bill proposing a statewide ban on single-use plastics. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'A last-minute amendment is proposed to your environment Bill just before the Speaker calls it, softening one of its clearance rules. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Your environment Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on a proposed industrial project during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'During Zero Hour, a Member raises a sudden spike in air pollution readings in one city, a topic that wasn''t pre-submitted. As Environment Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific environmental issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'An in-simulation Parliamentary Journalist asks why your Ministry approved a project environmental groups strongly opposed. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Your Bill on water conservation overlaps with the Agriculture Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Environment Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Besides the issue you named in Question 1, name one more real Indian environmental policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'A Member from your own party quietly tells you they think your Bill''s industry restrictions go too far. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Environment'::text, 'Describe the single hardest judgment call an Environment Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Name one real digital/tech policy issue in India (data privacy, AI regulation, digital divide, etc.) and your stance on it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Draft the opening line of a Bill regulating one specific tech issue.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'A Member asks what your Ministry is doing about rural areas with no internet access. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'If you can only fund ONE: subsidised smartphones/internet for students, or cybersecurity infrastructure. Which do you protect?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Zero Hour: a major data breach affecting citizens is reported. What''s your first move as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'A Starred Question asks what your Ministry is actually doing to protect citizens'' personal data beyond announcements. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'An Opposition MP tables a Private Member''s Bill proposing mandatory digital literacy classes in every government school. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'A last-minute amendment is proposed to your tech Bill just before the Speaker calls it, changing its data-storage requirements. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Your tech Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on AI regulation during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'During Zero Hour, a Member raises a viral scam targeting students online, a topic that wasn''t pre-submitted. As Electronics & IT Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific digital-policy issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'An in-simulation Parliamentary Journalist asks why rural internet access still lags despite your Ministry''s promises. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Your Bill on digital skilling for jobseekers overlaps with the Skill Development Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Electronics & IT Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Besides the issue you named in Question 1, name one more real Indian tech policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'A Member from your own party quietly tells you they think your Bill''s data rules are too strict for small businesses. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Electronics & IT'::text, 'Describe the single hardest judgment call an Electronics & IT Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Name one real issue facing Indian youth or sports today, and one policy you''d propose.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Draft the opening line of a Bill supporting youth employment or sports development.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'A Member asks why India underperforms at the Olympics despite its population. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'If you can only fund ONE: grassroots sports infrastructure or elite athlete training. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Zero Hour: a national sports team faces a major scandal. What''s your first public statement?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'A Starred Question asks why your Ministry''s sports scholarships rarely reach small-town athletes. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'An Opposition MP tables a Private Member''s Bill proposing free access to public sports grounds for all students. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'A last-minute amendment is proposed to your sports Bill just before the Speaker calls it, changing which age group it targets. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Your sports Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s funding split between sports and youth employment during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'During Zero Hour, a Member raises the case of a promising young athlete who dropped out due to lack of support, a topic that wasn''t pre-submitted. As Youth Affairs & Sports Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific youth or sports issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'An in-simulation Parliamentary Journalist asks why India still underperforms at major international sporting events. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Your Bill on college sports quotas overlaps with the Education Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Youth Affairs & Sports Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Besides the issue you named in Question 1, name one more real Indian youth or sports policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'A Member from your own party quietly tells you they think your Bill favours elite athletes over grassroots players. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Youth Affairs & Sports'::text, 'Describe the single hardest judgment call a Youth Affairs & Sports Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Name one real scheme for women/child welfare in India, and what you''d improve about it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Draft the opening line of a Bill addressing one specific issue affecting women or children.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'A Member asks why child malnutrition rates remain high despite existing schemes. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'If you can only fund ONE: anganwadi (childcare centre) infrastructure or women''s skill-training programs. Which do you protect?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Zero Hour: a viral report exposes unsafe conditions at a state-run children''s shelter. What''s your first move?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'A Starred Question asks why your Ministry''s anganwadi centres remain understaffed in many districts. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'An Opposition MP tables a Private Member''s Bill proposing paid menstrual leave for working women. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'A last-minute amendment is proposed to your Bill just before the Speaker calls it, changing which age group of children it covers. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Your Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on child labour enforcement during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'During Zero Hour, a Member raises unsafe conditions at a private daycare, a topic that wasn''t pre-submitted. As Women & Child Development Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific women''s or child welfare issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'An in-simulation Parliamentary Journalist asks why child malnutrition numbers haven''t improved despite your Ministry''s schemes. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Your Bill on maternal nutrition overlaps with the Health Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Women & Child Development Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Besides the scheme you named in Question 1, name one more real Indian women''s or child welfare policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'A Member from your own party quietly tells you they think your Bill''s compliance requirements are too heavy for small welfare centres. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Women & Child Development'::text, 'Describe the single hardest judgment call a Women & Child Development Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Name one real skill-gap issue in India''s job market, and one policy you''d propose to fix it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Draft the opening line of a Bill creating a new skill-training initiative.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'A Member asks why so many skill-training graduates remain unemployed. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'If you can only fund ONE: training for traditional trades (weaving, carpentry, etc.) or training for modern tech jobs. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Zero Hour: a major industry announces layoffs due to automation. What''s your first move as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'A Starred Question asks why so many of your Ministry''s certified trainees still can''t find jobs. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'An Opposition MP tables a Private Member''s Bill proposing skill-training stipends for trainees from low-income families. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'A last-minute amendment is proposed to your Bill just before the Speaker calls it, changing which trades it prioritises. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Your Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s funding split between traditional trades and tech skilling during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'During Zero Hour, a Member raises a local factory''s mass layoffs due to automation, a topic that wasn''t pre-submitted. As Skill Development Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific skilling issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'An in-simulation Parliamentary Journalist asks why skill-certification numbers look good on paper but employment numbers don''t. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Your Bill on industry-linked apprenticeships overlaps with the Electronics & IT Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Skill Development Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Besides the issue you named in Question 1, name one more real Indian skilling or employment policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'A Member from your own party quietly tells you they think your Bill neglects traditional trades in favour of tech skills. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Skill Development'::text, 'Describe the single hardest judgment call a Skill Development Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Name one real heritage site or cultural tradition in Tamil Nadu/India that you think is under-promoted, and your plan for it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Draft the opening line of a Bill to boost tourism or protect cultural heritage.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'A Member asks why tourism revenue hasn''t grown despite India''s rich heritage. Your reply?'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'If you can only fund ONE: restoring a historic monument or building new tourist infrastructure. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Zero Hour: a fire damages a famous heritage site. What''s your first public statement as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'A Starred Question asks why a well-known heritage site in your state remains poorly maintained despite tourism revenue targets. Give your actual reply.'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'An Opposition MP tables a Private Member''s Bill proposing free entry to state museums for students. Do you support it, block it, or fold it into your own Bill?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'A last-minute amendment is proposed to your Bill just before the Speaker calls it, changing which heritage sites get priority funding. Do you accept it on the spot, or ask for time?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Your Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s plan to build new tourist infrastructure near a heritage site during debate. How do you handle it — in the House and privately afterward?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'During Zero Hour, a Member raises encroachment near a protected monument, a topic that wasn''t pre-submitted. As Tourism & Culture Minister, what''s your response?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific tourism or heritage issue would you use to make your strongest case, and why?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'An in-simulation Parliamentary Journalist asks why tourism revenue hasn''t matched the promotion budget your Ministry has spent. Your on-record reply?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Your Bill on eco-tourism overlaps with the Environment Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Tourism & Culture Minister you''d want on the record?'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Besides the site or tradition you named in Question 1, name one more real Indian tourism or cultural policy debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'A Member from your own party quietly tells you they think your Bill spends too much on restoration and not enough on new infrastructure. Do you change anything before it''s tabled?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Tourism & Culture'::text, 'Describe the single hardest judgment call a Tourism & Culture Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Name one real law-and-order or internal-security issue in India today, and one specific policy you''d propose to address it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Draft the opening line — the "Statement of Objects" — of a Bill you''d introduce as Home Affairs Minister.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'A Starred Question asks why response times for local police helplines remain slow in many areas. Give your actual reply.'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'If you can only fund ONE: more police personnel on the ground, or better crime-reporting technology. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Zero Hour scenario: a viral video shows visible unrest breaking out at a public gathering in your state. What''s your first public statement as Minister?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'An Opposition MP tables a Private Member''s Bill proposing mandatory community-policing programmes in every district. Do you support it, block it, or fold it into your own Bill?'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'A last-minute amendment is proposed to your Bill just before the Speaker calls it, changing which districts get priority for new police recruitment. Do you accept it on the spot, or ask for time?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Your Home Affairs Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s stance on state versus central control of policing during debate. How do you handle it — in the House and privately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'During Zero Hour, a Member raises a spike in cybercrime complaints from students, a topic that wasn''t pre-submitted. As Home Affairs Minister, what''s your response?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific internal-security issue would you use to make your strongest case, and why?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'An in-simulation Parliamentary Journalist asks why your Ministry hasn''t done more to prevent repeated communal tension in one district. Your on-record reply?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Your Bill on disaster-response coordination overlaps with the Defence Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Home Affairs Minister you''d want on the record?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Name one real Indian policing or internal-security reform debate you have a strong personal opinion on, and state your stance in one sentence.'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'A Member from your own party quietly tells you they think your Bill gives police too much power without enough oversight. Do you change anything before it''s tabled?'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'A natural disaster strikes a district right before Day 2 begins (in-simulation scenario). What''s your Ministry''s first coordinated move?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Home Affairs'::text, 'Describe the single hardest judgment call a Home Affairs Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Name one real, current defence or national-security policy debate in India, and your stance on it.'::text, 1::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Draft the opening line — the "Statement of Objects" — of a Bill you''d introduce as Defence Minister.'::text, 2::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'A Starred Question asks what your Ministry is doing to improve conditions for veterans and their families. Give your actual reply.'::text, 3::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'If you can only fund ONE: modernising military equipment, or improving veteran welfare and pensions. Which do you protect, and why?'::text, 4::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Zero Hour scenario: a border-area village reports unusual tension near a national boundary. What''s your first public statement as Minister, staying measured and non-alarmist?'::text, 5::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'An Opposition MP tables a Private Member''s Bill proposing better healthcare access for the families of armed forces personnel. Do you support it, block it, or fold it into your own Bill?'::text, 6::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'A last-minute amendment is proposed to your Bill just before the Speaker calls it, changing its funding timeline. Do you accept it on the spot, or ask for time?'::text, 7::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Your Defence Bill passes by only a narrow margin. What do you say to the House immediately afterward?'::text, 8::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'A coalition partner''s MP publicly disagrees with your Ministry''s spending priorities during debate. How do you handle it — in the House and privately afterward?'::text, 9::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'During Zero Hour, a Member raises the topic of jointness (coordination) between the Army, Navy, and Air Force, a topic that wasn''t pre-submitted. As Defence Minister, what''s your response?'::text, 10::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'If you were selected to speak in the Best Parliamentarian Debate on Day 2, what specific defence issue would you use to make your strongest case, and why?'::text, 11::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Your Ministry''s Bill debate time on Day 2 is being cut to make room for another Ministry''s Bill. What do you say to the PM to try to keep it?'::text, 12::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'An in-simulation Parliamentary Journalist asks why domestic defence manufacturing still lags behind imports. Your on-record reply?'::text, 13::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'If the PM asked you, at the end of Day 1, what you''d do differently on Day 2 for your Ministry, what''s your honest answer?'::text, 14::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Your Bill on disaster-relief deployment overlaps with the Home Affairs Ministry''s portfolio. How do you decide who tables it, and how do you coordinate beforehand?'::text, 15::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'In your closing reflection at the end of Day 2, what''s the one achievement from your two days as Defence Minister you''d want on the record?'::text, 16::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Name one real Indian defence-modernisation or recruitment policy (e.g. Agnipath/Agniveer) you have a strong personal opinion on, and state your stance in one sentence.'::text, 17::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'A Member from your own party quietly tells you they think your Bill''s spending increase is unaffordable. Do you change anything before it''s tabled?'::text, 18::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Armed forces personnel are deployed to assist with disaster relief in a flood-hit district (in-simulation scenario). What''s your Ministry''s first coordinated move, alongside the Home Affairs Ministry?'::text, 19::int),
  (null::uuid, 'cabinet_minister'::text, 'Defence'::text, 'Describe the single hardest judgment call a Defence Minister has to make in a two-day YiP House like this one — not a policy question, a judgment one — and how you''d approach it.'::text, 20::int)) as v(event_id, post_key, ministry, body, display_order)
where not exists (
  select 1 from yip.questionnaire_questions q
  where q.event_id is null and q.post_key = 'cabinet_minister' and q.ministry = v.ministry
);
