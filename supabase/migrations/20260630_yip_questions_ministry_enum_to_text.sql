-- yip_questions_ministry_enum_to_text.sql (2026-06-30)
--
-- Flip the 3 ministry-ROUTING columns from the fixed 8-value `ministry_type`
-- enum -> text, so Question Hour / Zero Hour / cabinet-minister assignment can
-- use per-event CUSTOM cabinet portfolios. Those portfolios live in
-- events.cabinet_ministries (jsonb [{key,label}], up to 30 arbitrary names,
-- e.g. Tirupur runs 15: Agriculture, Environment, MSME, Jal Shakti, ...).
--
-- The static 8-value enum could only represent the handbook default cabinet, so
-- a question/motion could never be directed to a custom portfolio and a custom
-- portfolio minister could never be assigned. text is the only shape that lets
-- these three columns track the cabinet's chosen ministry KEYS.
--
-- All existing rows hold ONLY the 8 standard enum values (verified: questions
-- 97 rows, participants 7 rows, motions 0 rows) -> they cast cleanly to text,
-- NO data loss. One-way by design (do not recreate the enum on these columns).
--
-- The `ministry_type` enum TYPE is intentionally KEPT: the generated TS types
-- still surface it (Database["public"]["Enums"]["ministry_type"]) and several
-- non-routing references rely on it. These 3 columns simply stop using it.
--
-- Server-side validation of submitted ministry keys against the event's
-- effective cabinet portfolios moves to the app layer (submitQuestion,
-- raiseMotion) since text accepts any string.

ALTER TABLE yip.questions    ALTER COLUMN directed_to_ministry TYPE text USING directed_to_ministry::text;
ALTER TABLE yip.motions      ALTER COLUMN directed_to_ministry TYPE text USING directed_to_ministry::text;
ALTER TABLE yip.participants ALTER COLUMN ministry             TYPE text USING ministry::text;
