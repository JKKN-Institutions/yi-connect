-- ═══════════════════════════════════════════════════════════════════
-- YIP participants — which Yi CHAPTER did this student come from
-- ───────────────────────────────────────────────────────────────────
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually.
--
-- At a REGIONAL round every Yi chapter in the zone sends candidates, but the
-- platform has no idea which chapter any given student belongs to. Verified on
-- the live SRTN Regional round (af931446-…) on 2026-08-29:
--
--   196 participants · school_id 0 populated · yi_institution_id 0 populated
--
-- The event's own `chapter_name` is the HOST chapter (Erode), not the
-- participants' — so per-chapter recognition cannot be computed at all today.
--
-- One nullable column fixes that. Deliberately additive:
--   • Nullable, no default — every existing row stays valid and unchanged.
--   • No FK to yi.chapters. Same house style as bills.mover_participant_id:
--     cross-schema FKs are avoided here, and the write path
--     (app/yip/actions/chapter-assign.ts) already refuses any chapter that is
--     not active AND not in the EVENT'S OWN zone, which is a stricter check
--     than a plain FK would give.
--   • Nothing reads it until organisers populate it, so applying this cannot
--     change any existing screen, score, or award.
--
-- The organiser UI (/yip/dashboard/events/[id]/chapters) ships alongside this
-- and degrades gracefully: until the column exists it detects the missing
-- column, shows a plain "not applied yet" notice, and refuses to write.
-- ═══════════════════════════════════════════════════════════════════

alter table yip.participants
  add column if not exists yi_chapter_id uuid;

comment on column yip.participants.yi_chapter_id is
  'The Yi chapter this student was sent by (yi.chapters.id). Set by organisers on the event''s Chapters screen; null until assigned. Distinct from events.chapter_name, which is the HOST chapter of the round.';
