-- Backfill yip.agenda.session_key on scoreable items (BUG-385 per-session scoring).
--
-- The results engine resolves each scored agenda item's session config by
-- session_key FIRST (1:1), falling back to agenda_type. For that to work, every
-- scoreable agenda item must carry the session_key of its matching global
-- session config (yip.session_parameters).
--
-- This maps each event's scoreable agenda items 1:1 to a global session config
-- by TITLE — matching the agenda item title to a session_parameters label
-- (case-insensitive, trimmed). Title is the only signal that distinguishes the
-- duplicated agenda types: the 11 handbook sessions collapse to 8 agenda_types
-- because 3 types repeat (2 Speaker / 2 Opening / 2 Debate sessions). Resolving
-- by agenda_type alone would merge those pairs; the title match keeps them
-- distinct so each session is scored against its own configured max + weight.
--
-- Idempotent + safe: only touches scoreable rows that have no session_key yet,
-- and only when a title exactly matches a label. Items with no matching label
-- are left null and fall back to agenda_type resolution in the engine.

update yip.agenda a
set session_key = sp.session_key
from yip.session_parameters sp
where a.is_scoreable
  and a.session_key is null
  and lower(btrim(a.title)) = lower(btrim(sp.label));
