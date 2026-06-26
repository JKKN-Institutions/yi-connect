-- YIP Chapter Round Report — Section 2 (Chief Guests & Jury).
--
-- Adds a per-row flag marking which chief guest attended the VALEDICTORY
-- session, so the report can split "Chief Guests" from "Guest at the
-- Valedictory Session".
--
-- ADDITIVE + IDEMPOTENT: a single new NOT NULL column with a default, so every
-- existing yip.event_chief_guests row gets is_valedictory = false and nothing
-- else changes. The table already has RLS enabled + service_role-only grants
-- (migration 20260615220000), which the new column inherits — no grant changes.

alter table yip.event_chief_guests
  add column if not exists is_valedictory boolean not null default false;
