-- ============================================================================
-- Yi-Future Experts — make the registry functional  (Feature #3, 2026-06-29)
--
-- Before: future.experts was an inert registry (no login, no assignment;
-- phase_events.expert_id existed but was never set or read).
-- After: experts get a 6-char access_code (login → /yi-future/expert portal,
-- mirroring Mentors) and an is_active flag. Assignment to a chapter session
-- reuses the EXISTING future.phase_events.expert_id column (no new table) —
-- chapter admins set expert_id on an Expert Talk / phase event.
-- ============================================================================

alter table future.experts
  add column if not exists access_code text;

alter table future.experts
  add column if not exists is_active boolean not null default true;

-- Access codes are unique among experts (the login resolver matches by code).
-- Partial index: only enforce uniqueness on assigned (non-null) codes.
create unique index if not exists uq_future_experts_access_code
  on future.experts (access_code)
  where access_code is not null;
