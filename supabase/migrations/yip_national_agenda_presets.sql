-- National (global) agenda presets — so the national team can publish agenda
-- orderings that EVERY chapter can pick from (Maria's "let each chapter decide"
-- resolution to the default-order question). Reuses yip.agenda_presets; a global
-- preset lives in the reserved chapter_name 'National' with is_global=true and is
-- visible + applicable to all chapters (chapter presets stay private).

alter table yip.agenda_presets
  add column if not exists is_global boolean not null default false;

-- ── Seed 1: Standard YIP Agenda (2-day) — the canonical central template verbatim.
insert into yip.agenda_presets (chapter_name, yi_chapter_id, name, is_global, items)
select 'National', null, 'Standard YIP Agenda (2-day)', true,
  coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.sequence_order), '[]'::jsonb)
from (
  select day, sequence_order, title, description, agenda_type, duration_minutes,
         mode, is_scoreable, session_key, use_for_voting
  from yip.agenda_template
) t
on conflict (chapter_name, name)
  do update set items = excluded.items, is_global = true, updated_at = now();

-- ── Seed 2: Shortened Flow — party/government formation moved BEFORE the Speaker
-- nomination block (Maria's 2026-06-23 call). The exact split of "party
-- formation" vs "government formation" and whether MuPI is 90s or 90min are still
-- to be confirmed with Maria; it is an opt-in option, not the default, and is
-- refined via Save-as-National.
insert into yip.agenda_presets (chapter_name, yi_chapter_id, name, is_global, items)
select 'National', null, 'Shortened Flow', true,
  coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.sequence_order), '[]'::jsonb)
from (
  select day,
    (case when day = 1 and sequence_order = 8 then 9   -- Speaker Speeches  → 9
          when day = 1 and sequence_order = 9 then 10  -- Speaker Election  → 10
          when day = 1 and sequence_order = 10 then 8  -- Govt/Party Form'n → 8 (first)
          else sequence_order end) as sequence_order,
    title, description, agenda_type, duration_minutes, mode, is_scoreable,
    session_key, use_for_voting
  from yip.agenda_template
) t
on conflict (chapter_name, name)
  do update set items = excluded.items, is_global = true, updated_at = now();
