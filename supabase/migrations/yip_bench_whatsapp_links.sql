-- Bench WhatsApp groups.
--
-- A regional round splits the House into a ruling and an opposition bench, and
-- each bench runs its own WhatsApp group. A student already gets their PARTY
-- group (yip.parties.whatsapp_invite_url) and their COMMITTEE group
-- (yip.events.committee_whatsapp, keyed by committee number); this adds the
-- third, keyed by the side.
--
-- Shape mirrors committee_whatsapp deliberately: there are exactly two benches
-- per event, so both links live in one jsonb on the event rather than on a row
-- of their own. Keys are 'ruling' and 'opposition'.
--
-- NULL / absent = no bench group for that side, which is how every existing
-- event already behaves. Nothing is backfilled and nothing changes for any
-- round until an organiser types a link on the Parties tab.
--
-- A student is shown the link matching their own yip.participants.party_side.
-- A student with no bench recorded sees no bench group — never a guessed one.

alter table yip.events
  add column if not exists bench_whatsapp jsonb;

comment on column yip.events.bench_whatsapp is
  'WhatsApp group invite links per bench, keyed by side: {"ruling": url, "opposition": url}. NULL = none set. Shown to a student whose participants.party_side matches.';
