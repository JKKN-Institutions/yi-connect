-- YIP Chapter Round Report — Section 6 (Zero Hour).
-- Adds a free-text Zero Hour summary to events. The report auto-drafts this from
-- the event's questions + motions; the organiser edits and saves it inline
-- (app/yip/actions/report-awards-zero-hour.ts -> saveZeroHourSummary). Additive,
-- nullable, idempotent. Null = not yet recorded.
alter table yip.events
  add column if not exists zero_hour_summary text;

comment on column yip.events.zero_hour_summary is
  'Free-text Zero Hour summary for the Chapter Round Report (Section 6). Auto-drafted from questions + motions, edited and saved by the organiser. Nullable; null = not yet recorded.';
