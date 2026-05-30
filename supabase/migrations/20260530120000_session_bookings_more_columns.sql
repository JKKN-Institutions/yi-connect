-- Coordinator / Sub-Chapter real-user drift sweep (2026-05-30, Agent A)
--
-- The coordinator + sub-chapter portals were folded into the main dashboard
-- with 0 real users, so the real-data write-paths had never executed. The
-- complete-session flow (app/actions/session-bookings.ts -> completeSession)
-- increments trainer_profiles.total_students_impacted, but that column does
-- not exist on the live yi_connect.trainer_profiles table. Add it idempotently
-- so the (non-critical) trainer-stats update succeeds instead of silently
-- erroring.
--
-- All other drifted references in the coordinator/sub-chapter domain were
-- resolved by code-fixing to the correct existing column names (e.g.
-- is_trainer_eligible -> is_active, eligible_session_types -> service_types,
-- sub_chapters.type -> chapter_type, sub_chapter_members.events_participated
-- -> events_attended, etc.). This migration only adds the one column that is
-- genuinely missing and genuinely written by the code.

ALTER TABLE yi_connect.trainer_profiles
  ADD COLUMN IF NOT EXISTS total_students_impacted integer NOT NULL DEFAULT 0;
