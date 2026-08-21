-- ═══════════════════════════════════════════════════════════════════
-- YIP Prime Minister & Leader of Opposition — self-nomination + papers
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- Adds the LATER-STAGE pair. Both values already exist in the
-- public.parliament_role enum, so there is no enum change here — only the
-- CHECK constraints that narrow the enum down to the self-nominable /
-- questionnaire-able sets.
--
-- These two differ from the four earlier roles in one important way: they are
-- NOT open to everyone. This window runs AFTER Government Formation, so every
-- Member already knows their bench, and eligibility is decided from it:
--
--   Ruling bench      ⇒ Prime Minister only
--   Opposition bench  ⇒ Leader of Opposition only
--   Party / Coalition Leader ⇒ NEITHER (they already hold a mandate)
--
-- That rule lives in eligibleSelfNominationRoles() / assertEligibleRoles() in
-- lib/yip/self-nomination.ts and is enforced inside submitSelfNomination,
-- server-side, from the Member's OWN participants row. It is deliberately NOT
-- expressed here: a CHECK constraint cannot see the participant's bench (no
-- subqueries), so the database bound stays "one of the six roles" and the
-- bench rule is applied in code. Fails closed — an unallocated Member (null
-- party_side) gets no later-stage role at all.
--
-- Banks: 20 questions per post, drawn 6 per candidate, 30-minute window
-- (Director, 2026-08-21). Note the source document's own header reads "all 20
-- questions ... Max Possible Score 200" — the Director's 6-of-20 ruling
-- supersedes that line, and questionsPerAttempt in lib/yip/questionnaire.ts is
-- the single place that decides it.
--
-- All 40 question bodies below are VERBATIM from "YiP 2026 – Regional Round
-- Selection Questionnaires — Prime Minister & Leader of Opposition
-- (20 Questions per Role)".
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Self-nomination: allow the two later-stage roles ───────────
-- Cardinality 4 → 6. A Member can only ever be eligible for ONE of the new
-- pair, but the bound is the catalogue size, not the eligible size — the bench
-- rule is code-side (see the header note).
alter table yip.self_nominations
  drop constraint if exists yip_self_nominations_roles_valid;
alter table yip.self_nominations
  add constraint yip_self_nominations_roles_valid check (
    cardinality(roles) between 1 and 6
    and roles <@ array[
      'parliamentary_administrator',
      'speaker',
      'party_leader',
      'parliamentary_journalist',
      'prime_minister',
      'leader_of_opposition'
    ]::text[]
  );

-- ─── 2. Questionnaire: allow the two posts on all three tables ─────
alter table yip.questionnaire_questions
  drop constraint if exists yip_questionnaire_questions_post_key_check;
alter table yip.questionnaire_questions
  add constraint yip_questionnaire_questions_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader',
                 'parliamentary_journalist','prime_minister','leader_of_opposition')
  );

alter table yip.questionnaire_windows
  drop constraint if exists yip_questionnaire_windows_post_key_check;
alter table yip.questionnaire_windows
  add constraint yip_questionnaire_windows_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader',
                 'parliamentary_journalist','prime_minister','leader_of_opposition')
  );

alter table yip.questionnaire_attempts
  drop constraint if exists yip_questionnaire_attempts_post_key_check;
alter table yip.questionnaire_attempts
  add constraint yip_questionnaire_attempts_post_key_check check (
    post_key in ('parliamentary_administrator','speaker','party_leader',
                 'parliamentary_journalist','prime_minister','leader_of_opposition')
  );

-- ─── 3. Seed the two national banks (20 + 20) ──────────────────────
-- Guarded: re-running this migration will not double the banks.
insert into yip.questionnaire_questions (event_id, post_key, body, display_order)
select v.event_id, v.post_key, v.body, v.display_order
from (values
  (null::uuid, 'prime_minister'::text, 'You''ve just been declared Prime Minister (20 Aug). Within the next 24 hours, before Day 1 even begins, what are the first three things you need to do?'::text, 1::int),
  (null::uuid, 'prime_minister'::text, 'During the Best Parliamentarian Debate on Day 2, you are not the one debating. What is your actual role in that session, if any?'::text, 2::int),
  (null::uuid, 'prime_minister'::text, 'A Cabinet Minister''s Bill is getting heavily criticised during Question Hour. As PM, do you step in to defend it? Why or why not — and what does that decision say about how Cabinet responsibility works?'::text, 3::int),
  (null::uuid, 'prime_minister'::text, 'What''s the difference between your closing remarks on Day 2 and the Speaker''s closing remarks? What should you say that only the PM can say?'::text, 4::int),
  (null::uuid, 'prime_minister'::text, 'Name one real Indian Prime Minister''s decision (past or present, any party) that you personally disagree with, and explain why in 3–4 sentences.'::text, 5::int),
  (null::uuid, 'prime_minister'::text, 'If the Leader of Opposition asks you a tough supplementary question you don''t have a good answer for, what do you actually say in the House?'::text, 6::int),
  (null::uuid, 'prime_minister'::text, 'Coalition partners helped you become PM, but your own party holds only a plurality, not a majority. When you assign the ten Cabinet posts right after Government Formation, how do you balance your own party''s Members against your coalition partners'' expectations?'::text, 7::int),
  (null::uuid, 'prime_minister'::text, 'Midway through Day 2, one of your Cabinet Ministers is clearly struggling in the House — weak answers, low energy. Do you reshuffle them out mid-event, or let them finish their term? Walk through your reasoning.'::text, 8::int),
  (null::uuid, 'prime_minister'::text, 'A Zero Hour topic put forward by an Opposition Member turns out to be a genuinely good idea. Do you publicly credit them for it in the House? Why or why not?'::text, 9::int),
  (null::uuid, 'prime_minister'::text, 'Your Government''s Bill fails to pass a close vote. What do you say to the House immediately afterward, and what do you do differently for the next Bill?'::text, 10::int),
  (null::uuid, 'prime_minister'::text, 'An Opposition Member''s Private Member''s Bill addresses an issue your own Government cares about. Do you fold the idea into your own agenda, publicly support their Bill as-is, or leave it alone? Justify your choice.'::text, 11::int),
  (null::uuid, 'prime_minister'::text, 'A coalition partner''s Minister wants to introduce a Bill your own party privately disagrees with. Do you let it come to the House? Why or why not?'::text, 12::int),
  (null::uuid, 'prime_minister'::text, 'Your Government''s first Bill of Day 1 is ready to be tabled, but a strong Zero Hour topic from your own backbenchers is also ready. Which gets House time first, and why?'::text, 13::int),
  (null::uuid, 'prime_minister'::text, 'During the Best Parliamentarian Debate on Day 2, a first-year Opposition Member gives one of the strongest speeches of the two days. As PM, do you acknowledge that in the House? Why or why not?'::text, 14::int),
  (null::uuid, 'prime_minister'::text, 'What''s one thing you would deliberately NOT centralise in your own office as PM, even though you could, and why?'::text, 15::int),
  (null::uuid, 'prime_minister'::text, 'A rival Party Leader accuses your Government of "doing nothing" in the first half of Day 1. Give your actual response, in the words you''d use.'::text, 16::int),
  (null::uuid, 'prime_minister'::text, 'If you had to explain to a Member outside your coalition why your Government deserves their vote of confidence, in three sentences, what would you say?'::text, 17::int),
  (null::uuid, 'prime_minister'::text, 'If your Government''s Day 2 agenda has to drop one planned Bill to make time for an urgent Zero Hour matter, which goes, and how do you explain that choice to your Cabinet?'::text, 18::int),
  (null::uuid, 'prime_minister'::text, 'Describe the single hardest judgment call a Prime Minister has to make in a two-day YiP House like this one — not a rule question, a judgment one — and how you''d approach it.'::text, 19::int),
  (null::uuid, 'prime_minister'::text, 'Right after Concluding Remarks on Day 2, what''s the one thing about how you ran your Cabinet this House that you''d want the record to reflect — good or bad?'::text, 20::int),

  (null::uuid, 'leader_of_opposition'::text, 'Your job is to hold the Government accountable without opposing everything. Give one example of a Government Bill you might actually SUPPORT, and explain why saying yes sometimes makes you a stronger Opposition Leader.'::text, 1::int),
  (null::uuid, 'leader_of_opposition'::text, 'During Question Hour, what makes a Starred Question "good" versus just an attack on the Minister? Write one example question you''d actually submit.'::text, 2::int),
  (null::uuid, 'leader_of_opposition'::text, 'At the end of Day 2, you give the final Opposition reflections before the Speaker adjourns sine die. In 3–4 sentences, what''s your closing message?'::text, 3::int),
  (null::uuid, 'leader_of_opposition'::text, 'If your own coalition partners disagree on how hard to push back on a Government Bill, how do you decide the Opposition''s official position?'::text, 4::int),
  (null::uuid, 'leader_of_opposition'::text, 'What''s the difference between opposing a Bill''s content and opposing the Minister personally? Why does that distinction matter in a real Parliament?'::text, 5::int),
  (null::uuid, 'leader_of_opposition'::text, 'Name a real, current Indian Opposition leader (any party) whose style you''d want to imitate as LOP, and say specifically what you''d copy from them.'::text, 6::int),
  (null::uuid, 'leader_of_opposition'::text, 'Government Formation talks happen entirely online before the event. If your coalition ends up in Opposition instead of Government, what''s the first message you send your coalition partners once results are final?'::text, 7::int),
  (null::uuid, 'leader_of_opposition'::text, 'Right after Government Formation, you appoint your Shadow Cabinet — one Opposition Member "shadowing" each real Ministry. What do you actually look for in picking someone to shadow a Ministry, beyond loyalty to you?'::text, 8::int),
  (null::uuid, 'leader_of_opposition'::text, 'Your Shadow Finance Minister and Shadow Health Minister disagree publicly on which issue to prioritise during Question Hour. As LOP, how do you settle it?'::text, 9::int),
  (null::uuid, 'leader_of_opposition'::text, 'A Government Bill is popular with the House but you believe it''s genuinely flawed. Do you vote against it anyway, knowing it will pass regardless? Justify your choice.'::text, 10::int),
  (null::uuid, 'leader_of_opposition'::text, 'One of your own Opposition Members wants to launch a personal attack on a Minister during Question Hour. Do you let them? What do you say to them beforehand?'::text, 11::int),
  (null::uuid, 'leader_of_opposition'::text, 'During Zero Hour, you raise a topic critical of the Government. A Minister accuses you of "just opposing for the sake of opposing." What''s your actual reply?'::text, 12::int),
  (null::uuid, 'leader_of_opposition'::text, 'The PM publicly credits you or your coalition for a good idea raised during Zero Hour. How do you respond in that moment?'::text, 13::int),
  (null::uuid, 'leader_of_opposition'::text, 'A Private Member''s Bill from your own coalition is competing for House time with a bigger Opposition strategy priority. Which do you push, and why?'::text, 14::int),
  (null::uuid, 'leader_of_opposition'::text, 'If a coalition partner wants to soften your Opposition''s stance on a Government Bill to stay on good terms for future coalition talks, how do you handle that internally?'::text, 15::int),
  (null::uuid, 'leader_of_opposition'::text, 'What''s one question you''d want every Cabinet Minister to be able to answer under pressure, and why would you make that question part of your Question Hour strategy?'::text, 16::int),
  (null::uuid, 'leader_of_opposition'::text, 'A journalist (in-simulation) asks if your Opposition is "just there to block Government business." What''s your actual on-record response?'::text, 17::int),
  (null::uuid, 'leader_of_opposition'::text, 'Describe how you''d brief your Shadow Cabinet before Day 1 — what two or three things would you most want them to already agree on before entering the House?'::text, 18::int),
  (null::uuid, 'leader_of_opposition'::text, 'If the Government''s Bill fails and the PM publicly takes responsibility, does that change how hard you push in your next Question Hour session? Why or why not?'::text, 19::int),
  (null::uuid, 'leader_of_opposition'::text, 'Describe the single hardest judgment call a Leader of Opposition has to make in a two-day YiP House like this one — not a rule question, a judgment one — and how you''d approach it.'::text, 20::int)
) as v(event_id, post_key, body, display_order)
where not exists (
  select 1 from yip.questionnaire_questions q
  where q.event_id is null and q.post_key = v.post_key
);
