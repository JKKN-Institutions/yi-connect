-- =====================================================================
-- recognitions_09_stage2_attendance — who attended the Stage 2 meeting.
--
-- Piyush (Recognitions super admin), 16 Nov 2026 07:52: "for stage 2 can we
-- add checkboxes for attendance. As in who all attended the meeting. NMT and
-- RM name and also add an NEM box. The NMT checks all this before
-- submission. And this data is reflected in the report for that vertical."
--
-- One nullable jsonb column on the moderation version, written with the
-- leader's draft / submit. Shape (lib/recognitions/attendance.ts):
--   { "evaluator_ids": ["<recognition_evaluators.id>", ...],
--     "nem": true|false,
--     "nobody": true|false }
-- NULL = not recorded (every version saved before this column existed).
-- A submitted version is already frozen by the recognition_moderation_freeze trigger,
-- so the attendance is frozen with the ranking. No new trigger needed.
--
-- ADD-ONLY. No default, no row changed, nothing dropped.
-- Applied to production on 16 Nov 2026, 15:4x IST (add-only, empty). Apply before the code that writes it is merged: the
-- moderation draft/submit actions write this column, so they fail until it
-- exists.
-- =====================================================================

alter table yi_connect.recognition_moderation_versions
  add column if not exists attendance jsonb;

comment on column yi_connect.recognition_moderation_versions.attendance is
  'Stage 2 meeting attendance confirmed by the NMT leader: {evaluator_ids: uuid[] of recognition_evaluators, nem: bool, nobody: bool}. NULL = not recorded (older versions).';

notify pgrst, 'reload schema';
