-- YIP Selection Questionnaire
--
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- A student who self-nominated for Administrator, Speaker or Party Leader
-- answers a short set of scenario questions from that post's bank inside a
-- 30-minute window. An LLM scores each answer against the rubric in
-- lib/yip/questionnaire.ts and the organiser gets a ranked list — but the
-- ranking only ADVISES. A human confirms the shortlist (Director, 2026-08-15).
--
-- RLS POSTURE: every table below has RLS enabled with NO anon/authenticated
-- policies, i.e. deny-all, exactly like yip.self_nominations and
-- yip.formation_steps. The server actions are the only auth layer. This is what
-- keeps one minor's answers invisible to every other minor even though the
-- students all share an anon key.
--
-- GRANTS: the explicit `grant all ... to service_role` on each table is NOT
-- optional. Tables created through the Management API get no default
-- service_role grant, and without it every service-client read and write fails
-- silently rather than erroring.

-- ─── 1. The question bank ───────────────────────────────────────
-- event_id NULL  = the national set, used by every event by default.
-- event_id set   = that chapter's own set. RULE: if an event has ANY active
--                  rows for a post, they REPLACE the national set for that
--                  post — they do not merge. Keeps "how many questions will I
--                  be asked" answerable without reading two tables.
create table if not exists yip.questionnaire_questions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid null references yip.events(id) on delete cascade,
  post_key      text not null,
  body          text not null,
  display_order int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint yip_questionnaire_questions_post_key_check
    check (post_key in ('parliamentary_administrator','speaker','party_leader')),
  constraint yip_questionnaire_questions_body_len
    check (char_length(btrim(body)) between 10 and 2000)
);

create index if not exists yip_questionnaire_questions_scope
  on yip.questionnaire_questions (post_key, event_id, display_order);
-- Partial index: the national set is read on every draw for an event with no
-- override, so it is worth its own path.
create index if not exists yip_questionnaire_questions_national
  on yip.questionnaire_questions (post_key, display_order) where event_id is null;

-- ─── 2. Per-post window ─────────────────────────────────────────
-- Modelled on yip.formation_steps: one row per (event, post), unique so it can
-- be seeded idempotently and toggled without a "no row yet" branch everywhere.
--
-- status='open' gates who may START. A student already writing keeps their own
-- 30 minutes and finishes (Director, 2026-08-15) — which is why the deadline
-- lives on the attempt, not here.
create table if not exists yip.questionnaire_windows (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references yip.events(id) on delete cascade,
  post_key   text not null,
  status     text not null default 'pending',
  opened_at  timestamptz,
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint yip_questionnaire_windows_post_key_check
    check (post_key in ('parliamentary_administrator','speaker','party_leader')),
  constraint yip_questionnaire_windows_status_check
    check (status in ('pending','open','closed'))
);

create unique index if not exists yip_questionnaire_windows_event_post
  on yip.questionnaire_windows (event_id, post_key);

-- ─── 3. One attempt per student per post ────────────────────────
-- expires_at is written ONCE at start and is the authoritative deadline. The
-- client countdown is display only; every answer write re-checks this column.
create table if not exists yip.questionnaire_attempts (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references yip.events(id)       on delete cascade,
  participant_id uuid not null references yip.participants(id) on delete cascade,
  post_key       text not null,
  started_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  submitted_at   timestamptz,
  scoring_status text not null default 'pending',
  total_score    numeric,
  max_score      numeric,
  pct            numeric,
  scored_at      timestamptz,
  score_error    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint yip_questionnaire_attempts_post_key_check
    check (post_key in ('parliamentary_administrator','speaker','party_leader')),
  constraint yip_questionnaire_attempts_scoring_status_check
    check (scoring_status in ('pending','scoring','scored','failed'))
);

-- Doubles as the ON CONFLICT inference target and as the "one attempt per post"
-- rule. A plain multi-column unique index is valid for inference (only an
-- EXPRESSION index is not).
create unique index if not exists yip_questionnaire_attempts_event_participant_post
  on yip.questionnaire_attempts (event_id, participant_id, post_key);
create index if not exists yip_questionnaire_attempts_event_post
  on yip.questionnaire_attempts (event_id, post_key, submitted_at desc);
-- The scoring drain reads exactly this.
create index if not exists yip_questionnaire_attempts_scoring_queue
  on yip.questionnaire_attempts (scoring_status, submitted_at)
  where submitted_at is not null;

-- ─── 4. Answers ─────────────────────────────────────────────────
-- Rows are created AT START, one per drawn question, with question_text
-- snapshotted. Two reasons: a resume after a dropped connection returns exactly
-- the same paper, and an answer can never be orphaned by a question being
-- edited or removed later.
--
-- red_flag_penalty is stored POSITIVE (0-3) and subtracted at aggregation.
-- lib/yip/rubric.ts rejects negative scores outright, and this rubric must not
-- entangle with the jury scoring engine.
create table if not exists yip.questionnaire_answers (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references yip.questionnaire_attempts(id) on delete cascade,
  question_id      uuid null references yip.questionnaire_questions(id) on delete set null,
  question_text    text not null,
  position         int  not null,
  answer_text      text,
  answered_at      timestamptz,
  grounding        int,
  depth            int,
  voice            int,
  red_flag_penalty int,
  score            int,
  flags            jsonb not null default '[]'::jsonb,
  scored_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint yip_questionnaire_answers_grounding_range  check (grounding        is null or grounding        between 0 and 3),
  constraint yip_questionnaire_answers_depth_range      check (depth            is null or depth            between 0 and 4),
  constraint yip_questionnaire_answers_voice_range      check (voice            is null or voice            between 0 and 3),
  constraint yip_questionnaire_answers_penalty_range    check (red_flag_penalty is null or red_flag_penalty between 0 and 3),
  constraint yip_questionnaire_answers_score_range      check (score            is null or score            between 0 and 10)
);

create unique index if not exists yip_questionnaire_answers_attempt_position
  on yip.questionnaire_answers (attempt_id, position);

-- ─── RLS + grants ───────────────────────────────────────────────
alter table yip.questionnaire_questions enable row level security;
alter table yip.questionnaire_windows   enable row level security;
alter table yip.questionnaire_attempts  enable row level security;
alter table yip.questionnaire_answers   enable row level security;

grant all on yip.questionnaire_questions to service_role;
grant all on yip.questionnaire_windows   to service_role;
grant all on yip.questionnaire_attempts  to service_role;
grant all on yip.questionnaire_answers   to service_role;

-- ─── Seed: the 60 national questions ────────────────────────────
-- 20 per post, from "YiP 2026 – Regional Round Selection Questionnaires (20
-- Questions per Role)" as carried in the reference build. Idempotent: the guard
-- is per post, so re-running adds nothing and a chapter override is untouched.
--
-- ⚠️ These still need a content review by someone who knows YIP before students
-- see them — the reference file states some were drafted in the style of the
-- originals rather than taken from them.

-- Administrator — 20 questions
insert into yip.questionnaire_questions (event_id, post_key, body, display_order)
select * from (values
  (null::uuid, 'parliamentary_administrator'::text, 'Zero Hour is happening and a Member starts speaking without being called by the Speaker. As Administrator, what do you do in the next 10 seconds — and why does that matter for how a real Parliament functions?'::text, 1::int),
  (null::uuid, 'parliamentary_administrator'::text, 'During the Government Bills session, two Ministers arrive with printed copies of the same Bill number but different content. Walk through exactly how you resolve this before the Speaker calls it for reading.'::text, 2::int),
  (null::uuid, 'parliamentary_administrator'::text, 'You''re asked to announce a vote result, but your count and the Speaker''s count differ by one. What do you do — and what does this reveal about why the Administrator must stay neutral even under pressure?'::text, 3::int),
  (null::uuid, 'parliamentary_administrator'::text, 'In your own words: what''s the difference between what a Speaker does and what an Administrator does in this Parliament? Give one concrete example from the two-day schedule where their jobs visibly overlap.'::text, 4::int),
  (null::uuid, 'parliamentary_administrator'::text, 'During Concluding Remarks on Day 2, you have three minutes to summarise "the quality of parliamentary discussions and conduct of the House" — without naming or criticising any individual. Draft the opening two sentences.'::text, 5::int),
  (null::uuid, 'parliamentary_administrator'::text, 'Young Indians describes YiP as a platform to build future-ready leaders through hands-on legislative experience. As Administrator, where in your day-to-day role do you see that leadership-building actually happening — beyond just keeping records straight?'::text, 6::int),
  (null::uuid, 'parliamentary_administrator'::text, 'A Member hands you a printed speech to read into the record for an absent colleague. What do you check before allowing it, and why does that check matter for the credibility of YiP as a serious, CII-backed initiative?'::text, 7::int),
  (null::uuid, 'parliamentary_administrator'::text, 'The Speaker asks you to confirm quorum before a vote begins. Walk through exactly how you''d verify and report this number.'::text, 8::int),
  (null::uuid, 'parliamentary_administrator'::text, 'Two identical-looking amendment slips arrive for the same Bill, submitted by different Members minutes apart. How do you determine which one is in order?'::text, 9::int),
  (null::uuid, 'parliamentary_administrator'::text, 'During Question Hour, a Minister''s written answer doesn''t match what they say aloud. As Administrator, what''s your responsibility in that moment?'::text, 10::int),
  (null::uuid, 'parliamentary_administrator'::text, 'It''s 15 minutes before Zero Hour ends and three Members are still queued to speak. What do you do, and what do you tell the Speaker?'::text, 11::int),
  (null::uuid, 'parliamentary_administrator'::text, 'A Member accuses you directly of bias in how you tracked speaking time. How do you respond in the House, and what would you actually change (if anything) afterward?'::text, 12::int),
  (null::uuid, 'parliamentary_administrator'::text, 'YiP brings together students from very different schools, colleges, and backgrounds as part of Young Indians'' youth leadership initiative. How does the Administrator''s neutrality help make that mix actually work in the House, rather than becoming a source of friction?'::text, 13::int),
  (null::uuid, 'parliamentary_administrator'::text, 'The printed Order of Business for Day 2 has a typo that changes the sequence of two agenda items. When do you catch this, and what''s the fix?'::text, 14::int),
  (null::uuid, 'parliamentary_administrator'::text, 'A vote is called by voice ("Ayes and Noes") but the result sounds close to you. What''s the correct procedure to follow before announcing a result?'::text, 15::int),
  (null::uuid, 'parliamentary_administrator'::text, 'You''re asked to read out the names of newly appointed Ministers at the start of Day 1. One name is mispronounced in your briefing notes. What do you do in the seconds before you''re due to read it?'::text, 16::int),
  (null::uuid, 'parliamentary_administrator'::text, 'During a Private Member''s Bill debate, a Member submits a written question to be recorded but never actually asks it aloud. Does it go into the official record? Justify your answer.'::text, 17::int),
  (null::uuid, 'parliamentary_administrator'::text, 'What records is the Administrator responsible for maintaining across the full two-day YiP event, and which one would you consider most critical to get right?'::text, 18::int),
  (null::uuid, 'parliamentary_administrator'::text, 'A Member walks out mid-session in visible frustration. Is this something the Administrator needs to log or act on? Explain your reasoning.'::text, 19::int),
  (null::uuid, 'parliamentary_administrator'::text, 'YiP is meant to be a stepping stone toward real civic and policy engagement as you grow into your career, not just a two-day event. What''s one habit or discipline from being Administrator that you think would actually carry over into whatever you do next?'::text, 20::int)
) as v(event_id, post_key, body, display_order)
where not exists (
  select 1 from yip.questionnaire_questions
   where event_id is null and post_key = 'parliamentary_administrator'
);

-- Speaker — 20 questions
insert into yip.questionnaire_questions (event_id, post_key, body, display_order)
select * from (values
  (null::uuid, 'speaker'::text, 'A Minister is replying during Question Hour and clearly hasn''t answered the actual question — 90 seconds in on a related but different topic. As Speaker, what do you say, in the actual words you''d use, to bring them back on point?'::text, 1::int),
  (null::uuid, 'speaker'::text, 'Two Members stand up at the same time to ask a supplementary question. How do you decide who goes first, and what do you say to the one who doesn''t get called?'::text, 2::int),
  (null::uuid, 'speaker'::text, 'During Zero Hour, a Breaking News scenario touches a sensitive topic and the House starts getting loud and disorderly. What specific action do you take as Speaker in that moment?'::text, 3::int),
  (null::uuid, 'speaker'::text, 'What is the Speaker''s role during the announcement of appointments at the start of Day 1, and why does the Order of Business get announced before any actual debate happens?'::text, 4::int),
  (null::uuid, 'speaker'::text, 'If a Bill''s vote is extremely close, what steps do you take as Speaker to make sure the result is beyond dispute?'::text, 5::int),
  (null::uuid, 'speaker'::text, 'In one sentence each: what makes a strong Speaker different from a strong debater?'::text, 6::int),
  (null::uuid, 'speaker'::text, 'A Member repeatedly interrupts another Member mid-speech despite two warnings. What''s your escalation path as Speaker, step by step?'::text, 7::int),
  (null::uuid, 'speaker'::text, 'You''ve allotted 3 minutes per speaker for a Government Bill debate, but the House is engaged and several Members want more time. Do you extend it? What do you weigh in that decision?'::text, 8::int),
  (null::uuid, 'speaker'::text, 'A Member uses parliamentary language that''s technically permitted but clearly meant to provoke. Do you intervene? Why or why not?'::text, 9::int),
  (null::uuid, 'speaker'::text, 'During Zero Hour, a Member raises a topic that wasn''t on the pre-submitted list. What''s your ruling, and what do you say to the House to explain it?'::text, 10::int),
  (null::uuid, 'speaker'::text, 'The Leader of Opposition formally moves a motion you believe is out of order. Walk through how you handle this in real time, including what you actually say.'::text, 11::int),
  (null::uuid, 'speaker'::text, 'A point of order is raised mid-debate on a Bill. What''s the correct sequence of events from the moment it''s raised to when normal business resumes?'::text, 12::int),
  (null::uuid, 'speaker'::text, 'You need to call a division (formal vote count) because a voice vote result is disputed. Describe exactly how you conduct it.'::text, 13::int),
  (null::uuid, 'speaker'::text, 'Young Indians runs YiP to model the standard of debate it wants young people across the country to aspire to. Concretely, what would you do differently as Speaker if this session were being filmed for a wider Yi audience, versus if no one outside the room were watching?'::text, 14::int),
  (null::uuid, 'speaker'::text, 'It''s late in Day 2, energy in the House is low, and speeches are running short and low-effort. Does the Speaker do anything about the quality of debate, or is that outside your role?'::text, 15::int),
  (null::uuid, 'speaker'::text, 'A Member asks to withdraw a statement they made moments earlier, calling it a mistake. What''s the correct procedure for striking something from the record?'::text, 16::int),
  (null::uuid, 'speaker'::text, 'Two Ministers from the same party contradict each other''s statements on the same Bill within the same session. As Speaker, is this something you address? If so, how?'::text, 17::int),
  (null::uuid, 'speaker'::text, 'If you, as Speaker, personally disagree with a Bill being debated, how do you make sure that doesn''t show in how you run the session?'::text, 18::int),
  (null::uuid, 'speaker'::text, 'A first-time Member looks visibly nervous and freezes mid-sentence during their first speech. Part of YiP''s purpose is building confidence in young leaders, not just enforcing rules — what, if anything, do you do as Speaker in that moment?'::text, 19::int),
  (null::uuid, 'speaker'::text, 'Describe the single hardest judgment call a Speaker has to make in a two-day YiP House like this one — not a rule question, a judgment one — and how you''d approach it.'::text, 20::int)
) as v(event_id, post_key, body, display_order)
where not exists (
  select 1 from yip.questionnaire_questions
   where event_id is null and post_key = 'speaker'
);

-- Party Leader — 20 questions
insert into yip.questionnaire_questions (event_id, post_key, body, display_order)
select * from (values
  (null::uuid, 'party_leader'::text, 'Government Formation happens entirely online before the event (coalition talks, 19 Aug). If your party doesn''t get enough seats to form Government alone, what''s the FIRST message you''d actually send to another Party Leader to open coalition talks?'::text, 1::int),
  (null::uuid, 'party_leader'::text, 'Name one real, current issue in India today. Would your party bring it to the House as a Government Bill (if in power) or a Private Member''s Bill (if not)? Justify in 3–4 sentences.'::text, 2::int),
  (null::uuid, 'party_leader'::text, 'One of your own party''s Members disagrees publicly with your party''s stance during a debate. As Party Leader, how do you handle this in the House versus how you''d handle it privately afterward?'::text, 3::int),
  (null::uuid, 'party_leader'::text, 'What''s the difference between your job as Party Leader and the Prime Minister''s job, if your party wins Government? Where exactly does your authority end and the PM''s begin?'::text, 4::int),
  (null::uuid, 'party_leader'::text, 'Party Leader candidate videos are posted before voting on 16 Aug so the whole House can watch before they vote. In 3 sentences, what would your 90-second pitch actually say?'::text, 5::int),
  (null::uuid, 'party_leader'::text, 'Why does campaigning for PM & LOP (21–23 Aug) happen through the Party Leaders'' network rather than candidates campaigning individually?'::text, 6::int),
  (null::uuid, 'party_leader'::text, 'Coalition talks are happening online before the event. What''s one thing you would NOT agree to, even if it meant losing a coalition partner? Why?'::text, 7::int),
  (null::uuid, 'party_leader'::text, 'Your party wins enough seats to form Government alone, no coalition needed. Does your strategy for picking a PM candidate change compared to if you needed a coalition partner? How?'::text, 8::int),
  (null::uuid, 'party_leader'::text, 'A rival Party Leader publicly criticizes your party''s manifesto position on a specific issue. Do you respond publicly, privately, or not at all? Justify your choice.'::text, 9::int),
  (null::uuid, 'party_leader'::text, 'Give one policy position your party would take that you personally disagree with, but would still lead your party into debate on. How do you reconcile that as Party Leader?'::text, 10::int),
  (null::uuid, 'party_leader'::text, 'Your party is in Opposition. What''s your actual strategy for the two-day event — what does "effective opposition" look like in practice, beyond just disagreeing with the Government?'::text, 11::int),
  (null::uuid, 'party_leader'::text, 'If a coalition partner threatens to walk away from your coalition mid-event over a Bill your party wants to pass, what do you do?'::text, 12::int),
  (null::uuid, 'party_leader'::text, 'YiP brings together students from different schools, colleges, and states across India. How would you use that real diversity within your own party''s Members to actually shape your party''s manifesto, instead of it being a formality?'::text, 13::int),
  (null::uuid, 'party_leader'::text, 'You''ve been given the chance to nominate one of your own party''s Members for a Cabinet post if your party wins Government. What do you look for in that person, beyond loyalty to you?'::text, 14::int),
  (null::uuid, 'party_leader'::text, 'Describe how you''d brief your own party''s Members before Day 1 — what are the two or three things you''d most want them to already agree on before entering the House?'::text, 15::int),
  (null::uuid, 'party_leader'::text, 'If your party loses the Government Formation stage entirely, what''s your role for the remaining two days? What are you actually there to do?'::text, 16::int),
  (null::uuid, 'party_leader'::text, 'A journalist (in-simulation) asks you to comment on a rumor that your coalition talks fell apart. How do you respond, on or off the record?'::text, 17::int),
  (null::uuid, 'party_leader'::text, 'What''s one question you''d want to ask a rival Party Leader''s candidate video before deciding whether your party would ever coalition with them?'::text, 18::int),
  (null::uuid, 'party_leader'::text, 'If two Members from your own party want to contest for the same Ministry post, how do you resolve that before it becomes public?'::text, 19::int),
  (null::uuid, 'party_leader'::text, 'Young Indians frames YiP as practice for real leadership, not just a debate competition. In your own words, what''s one real skill from running a coalition or a party at YiP that you''d actually use in college, your career, or your community later on?'::text, 20::int)
) as v(event_id, post_key, body, display_order)
where not exists (
  select 1 from yip.questionnaire_questions
   where event_id is null and post_key = 'party_leader'
);
