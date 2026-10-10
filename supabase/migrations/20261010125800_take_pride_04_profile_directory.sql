-- Take Pride 2026: richer delegate profiles + the delegate directory.
--
-- ADDITIVE ONLY. Seven new columns on yi_connect.tp_delegates. The table keeps
-- its access model from take_pride_01: RLS ENABLED with ZERO policies, only
-- the service client reads it, behind the delegate's secret pass token
-- (lib/take-pride/directory.ts). No contact details are added.
--
--   working_on, ask_me_about, pledge  short free text (140 chars max)
--   yi_vertical                       the delegate's own Yi vertical
--   chapter_strengths, chapter_wants  Yi verticals their chapter does well /
--                                     wants help with (up to 3 each); the
--                                     "Chapter twins" panel matches these
--   directory_visible                 opt-in to be listed in the directory.
--                                     Default FALSE: real delegates choose.
--
-- The UPDATE at the end touches SAMPLE rows only (is_sample = true): it lists
-- them in the directory and fills example text so the demo is not empty.
-- It is deterministic (hash of the row id / chapter), uses no AI, and only
-- fills rows whose working_on is still empty, so re-running it changes nothing.

alter table yi_connect.tp_delegates
  add column if not exists working_on text check (working_on is null or char_length(working_on) <= 140),
  add column if not exists ask_me_about text check (ask_me_about is null or char_length(ask_me_about) <= 140),
  add column if not exists yi_vertical text,
  add column if not exists pledge text check (pledge is null or char_length(pledge) <= 140),
  add column if not exists chapter_strengths text[] not null default '{}',
  add column if not exists chapter_wants text[] not null default '{}',
  add column if not exists directory_visible boolean not null default false;

create index if not exists tp_delegates_directory_idx
  on yi_connect.tp_delegates (directory_visible)
  where directory_visible;

-- Sample data only ---------------------------------------------------------
with
verticals(list) as (
  select array[
    'Membership', 'Learning', 'Climate Change', 'Health', 'Road Safety',
    'Rural Initiatives', 'Innovation & Entrepreneurship', 'Sports', 'Masoom',
    'Thalir', 'Yuva', 'Accessibility', 'Branding'
  ]
),
working(industry, n, txt) as (values
  ('Finance', 0, 'Launching a small-business credit line for first-time borrowers'),
  ('Finance', 1, 'Building a GST and cash-flow dashboard for our MSME clients'),
  ('Finance', 2, 'Setting up a family office desk for second-generation founders'),
  ('Real estate', 0, 'Turning an old textile mill into a co-working space'),
  ('Real estate', 1, 'Getting our first green-certified housing project approved'),
  ('Real estate', 2, 'Building plug-and-play warehouses near the ring road'),
  ('Logistics', 0, 'Adding cold-chain trucks on the Chennai to Bengaluru route'),
  ('Logistics', 1, 'Moving our whole fleet onto one tracking app'),
  ('Logistics', 2, 'Opening a last-mile hub for tier-2 towns'),
  ('Pharma', 0, 'Getting WHO-GMP approval for our second plant'),
  ('Pharma', 1, 'Taking our ayurvedic range to pharmacies in the Gulf'),
  ('Pharma', 2, 'Cutting batch testing time in our quality lab'),
  ('IT and software', 0, 'Building a billing app for kirana stores'),
  ('IT and software', 1, 'Moving three factory clients to the cloud'),
  ('IT and software', 2, 'Hiring our first 20 engineers outside the metros'),
  ('Agriculture', 0, 'Linking 400 farmers directly to hotel kitchens'),
  ('Agriculture', 1, 'A solar-powered cold room for our farmer producer company'),
  ('Agriculture', 2, 'Trying drip irrigation on our turmeric farms'),
  ('Energy', 0, 'Rooftop solar for 50 factories in our industrial estate'),
  ('Energy', 1, 'A biogas plant that runs on vegetable market waste'),
  ('Energy', 2, 'EV charging points along the state highway'),
  ('Hospitality', 0, 'Opening a 30-room boutique hotel near the temple town'),
  ('Hospitality', 1, 'Training local youth for front-office jobs'),
  ('Hospitality', 2, 'Cutting food waste in our banquet kitchens'),
  ('Manufacturing', 0, 'Automating our CNC line for export orders'),
  ('Manufacturing', 1, 'Getting our first defence supplier approval'),
  ('Manufacturing', 2, 'Bringing scrap down by 30% in the press shop'),
  ('Textiles', 0, 'Launching a direct-to-customer handloom label'),
  ('Textiles', 1, 'Moving our dye house to zero liquid discharge'),
  ('Textiles', 2, 'Finding a buyer in Europe for organic cotton yarn'),
  ('Construction', 0, 'Using precast walls to finish homes faster'),
  ('Construction', 1, 'Bidding for our first smart-city road project'),
  ('Construction', 2, 'Training site supervisors on safety audits'),
  ('Healthcare', 0, 'Opening a day-care surgery centre'),
  ('Healthcare', 1, 'Tele-consults for patients in nearby villages'),
  ('Healthcare', 2, 'A diagnostics van for industrial estates'),
  ('Retail', 0, 'Taking our two stores online with WhatsApp ordering'),
  ('Retail', 1, 'Opening a franchise outlet in the next district'),
  ('Retail', 2, 'A loyalty card that works across local shops'),
  ('Food processing', 0, 'Getting our millet snacks into supermarkets'),
  ('Food processing', 1, 'A new packing line for ready-to-cook mixes'),
  ('Food processing', 2, 'Export approval for our pickles and podis'),
  ('Education', 0, 'A skilling centre for electricians and plumbers'),
  ('Education', 1, 'Bringing coding classes to government schools'),
  ('Education', 2, 'Evening classes for working diploma students')
),
ask(list) as (
  select array[
    'Raising a first bank loan', 'Family business succession', 'Exporting to the Middle East',
    'Hiring good people in a small town', 'Getting GST refunds faster', 'Starting a Yi project in schools',
    'Spending a CSR budget well', 'Pricing for big B2B buyers', 'Selling on Amazon and Flipkart',
    'Solar subsidies for factories', 'Winning government tenders', 'Building a brand on Instagram',
    'Managing a team of 100+', 'Getting ISO certified', 'Startup India and DPIIT recognition',
    'Road safety drives in colleges', 'Running a 500-person event', 'Leading a Yi vertical',
    'Negotiating with large retailers', 'Cutting the electricity bill'
  ]
),
pledges(list) as (
  select array[
    'Reply to every customer within one working day',
    'Spend one hour a week mentoring a first-time founder',
    'Buy 1% more from women-led suppliers every quarter',
    'Plant a tree for every new person we hire',
    'Pay every small supplier within 15 days',
    'Hire one apprentice from the nearby ITI every quarter',
    'Wear a helmet and seat belt on every ride, and ask my team to',
    'Move 1% of our packaging to recycled material each month',
    'Call one customer a week just to listen',
    'Give one Saturday a month to a Yi school project',
    'Switch our office to LED lights this quarter',
    'Share our monthly numbers with the whole team',
    'Remove single-use plastic from our canteen',
    'Walk the shop floor every morning before emails',
    'Say thank you to one team member every day',
    'Visit one Yi chapter outside my zone this year',
    'Track our water use every month and cut it by 1%',
    'Read for 20 minutes every day instead of scrolling',
    'Bring one new member into Yi this year',
    'Take one full day off every week for family'
  ]
),
chapter_order as (
  -- One fixed shuffle of the verticals per chapter: the first three are what
  -- the chapter does well, the next three what it wants help with.
  select c.chapter,
         array(
           select v from unnest((select list from verticals)) as v
           order by hashtext(c.chapter || '|' || v)
         ) as shuffled
  from (select distinct chapter from yi_connect.tp_delegates where is_sample) c
),
fill as (
  select d.id,
         coalesce(
           (select w.txt from working w
             where w.industry = d.industry
               and w.n = mod(abs(hashtext(d.id::text || '|work')::bigint), 3)),
           'Growing the family business into a second city'
         ) as working_on,
         (select list[1 + mod(abs(hashtext(d.id::text || '|ask')::bigint), array_length(list, 1))] from ask) as ask_me_about,
         (select list[1 + mod(abs(hashtext(d.id::text || '|vert')::bigint), array_length(list, 1))] from verticals) as yi_vertical,
         (select list[1 + mod(abs(hashtext(d.id::text || '|pledge')::bigint), array_length(list, 1))] from pledges) as pledge,
         -- Most delegates name all three; about a third name only two.
         case when mod(abs(hashtext(d.id::text || '|s')::bigint), 3) = 0
              then co.shuffled[1:2] else co.shuffled[1:3] end as chapter_strengths,
         case when mod(abs(hashtext(d.id::text || '|w')::bigint), 3) = 0
              then co.shuffled[4:5] else co.shuffled[4:6] end as chapter_wants
  from yi_connect.tp_delegates d
  join chapter_order co on co.chapter = d.chapter
  where d.is_sample and d.working_on is null
    and d.full_name not like 'QA %'  -- test rows are left alone
)
update yi_connect.tp_delegates t
   set working_on = f.working_on,
       ask_me_about = f.ask_me_about,
       yi_vertical = f.yi_vertical,
       pledge = f.pledge,
       chapter_strengths = f.chapter_strengths,
       chapter_wants = f.chapter_wants,
       directory_visible = true
  from fill f
 where t.id = f.id
   and t.is_sample;
