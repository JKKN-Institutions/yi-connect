-- Take Pride 2026: Awards Night reveals.
--
-- One row per (Recognitions award, chapter category) that the organiser desk
-- has put on the hall screen. ADDITIVE ONLY: a new tp_* table, nothing else.
--
--   is_rehearsal = true   a practice reveal. The screen shows a placeholder
--                         ("Chapter to be announced"), never a real chapter.
--   is_rehearsal = false  the real reveal. Allowed only when Recognitions has
--                         an APPROVED result for the award (checked by the
--                         desk action AND again by the screen feed at read
--                         time, so a reveal row alone never shows a winner).
--
-- award_id is a yi_connect.recognition_awards id. No foreign key on purpose:
-- this migration must not take a lock on, or otherwise touch, a
-- non-tp_* table. The bridge (lib/take-pride/recognitions-bridge.ts) ignores
-- a reveal whose award no longer exists.
--
-- RLS ON, ZERO policies, service_role only — same as take_pride_01.

create table if not exists yi_connect.tp_award_reveals (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null,
  category text not null check (category in ('pioneers', 'trailblazers', 'sparks')),
  revealed_at timestamptz not null default now(),
  revealed_by uuid,
  is_rehearsal boolean not null default false,
  unique (award_id, category)
);

create index if not exists tp_award_reveals_revealed_at_idx
  on yi_connect.tp_award_reveals (revealed_at desc);

do $$
declare t text;
begin
  foreach t in array array['tp_award_reveals'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;
