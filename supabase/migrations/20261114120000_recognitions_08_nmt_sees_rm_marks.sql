-- =====================================================================
-- recognitions_08_nmt_sees_rm_marks — the super admin's switch for whether
-- NMT members see the Regional Mentors' marks.
--
-- Director, 14 Nov 2026: a group member asked to hide the Regional Mentors'
-- (RM) marks from the NMT. The Recognitions super admin (Piyush) turns this
-- on and off himself, per cycle, on the control room's Timeline page.
--
--   true  (default) today's rule, unchanged: an NMT member sees every mark
--         read-only once they have submitted their own sheet, and every
--         evaluator sees them from Stage 2 on.
--   false an NMT member who is NOT the NMT leader never sees the other
--         evaluators' marks (the Stage 2 room stays closed to them). The NMT
--         leader still sees everything (they build the final ranking), and
--         the Regional Mentors keep today's rule.
--
-- ADD-ONLY. One column with a default; no row is changed in meaning.
-- Applied to production on 14 Nov 2026, 10:3x IST (add-only, value true).
-- =====================================================================

alter table yi_connect.recognition_cycles
  add column if not exists nmt_sees_rm_marks boolean not null default true;

comment on column yi_connect.recognition_cycles.nmt_sees_rm_marks is
  'Super admin switch. false = NMT members other than the NMT leader do not see the Regional Mentors'' (or any other evaluator''s) marks. Default true = unchanged.';
