-- Take Pride 2026: tie each real Awards Night reveal to the Recognitions
-- result that was approved when the organiser pressed Reveal.
--
-- moderation_version_id is a yi_connect.recognition_moderation_versions id
-- (no foreign key on purpose: this migration must not lock or touch a
-- non-tp_* table). The hall screen and the chapter page show a real reveal's
-- winner ONLY while that same version is still the approved one. If the award
-- is sent back and re-approved, the winner stays hidden until the organiser
-- reveals again. NULL (rehearsal rows) never matches.
--
-- ADDITIVE ONLY: one nullable column on a tp_* table. RLS / grants unchanged
-- (re-asserted below, same pattern as take_pride_01/02).

alter table yi_connect.tp_award_reveals
  add column if not exists moderation_version_id uuid;

do $$
declare t text;
begin
  foreach t in array array['tp_award_reveals'] loop
    execute format('alter table yi_connect.%I enable row level security', t);
    execute format('revoke all on yi_connect.%I from anon, authenticated, public', t);
    execute format('grant all on yi_connect.%I to service_role', t);
  end loop;
end $$;
