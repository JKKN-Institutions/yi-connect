-- YIP: per-participant "90-second speech finished" marker.
-- Every participant gives a 90-second speech; organisers and desk-scoped YUVA
-- volunteers tick each student off as they finish. Reversible (plain boolean).
--
-- Additive only. NOT NULL DEFAULT false is safe on a populated table.
--
-- ACL: yip.participants SELECT grants are COLUMN-scoped (each column granted
-- individually to anon/authenticated; access_code/email/phone are NOT granted).
-- A newly-added column therefore inherits NO grant -> readable only by
-- service_role, which is exactly what we want (this marker is read/written via
-- the event-gated / volunteer-gated server actions only). Do NOT grant it.
-- RLS is already enabled on yip.participants.
--
-- Applied to prod (bkmpbcoxbjyafieabxao) 2026-06-13 via Management API;
-- this file is the record.

ALTER TABLE yip.participants
  ADD COLUMN IF NOT EXISTS speech_finished boolean NOT NULL DEFAULT false;

-- Intentionally NO grant statement: leaving the column ungranted keeps it
-- service-role-only and out of the anon/authenticated PostgREST surface.
