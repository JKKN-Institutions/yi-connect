-- Make the "Party Leader Selections" rename permanent in the setup files.
--
-- Context: the scoring session label for `cabinet_party_intros` was renamed in
-- the LIVE database on 2026-06-25 ("Party Leader Introductions" ->
-- "Party Leader Selections") via a direct admin update. The original seed
-- (20260602120000_yip_session_parameters.sql) still carries the old label, so a
-- rebuild-from-scratch would silently restore the old wording. This migration
-- runs after the seed and corrects it, so a fresh build ends with the right name.
--
-- Idempotent: on the live DB the row already holds the new label, so this is a
-- harmless no-op (it only bumps updated_at).

update yip.session_parameters
set label = 'Party Leader Selections',
    updated_at = now()
where session_key = 'cabinet_party_intros';
