-- ═══════════════════════════════════════════════════════════════════
-- Speaking Floor — per-event "phone hand-raise" toggle (default OFF)
-- ───────────────────────────────────────────────────────────────────
-- Erode 2026 feedback cut two ways: "didn't get an equal chance to speak"
-- AND students buried in their phones. So the equity fix ships phone-FREE by
-- default — the Chair's fairness board + the projector meter derive "who has
-- spoken" from the Now-Speaking / agenda_speakers data already captured for
-- jury scoring, needing zero student phone use.
--
-- The optional digital placard (a student taps "I wish to speak" on /yip/me)
-- is gated behind THIS per-event flag, off unless a chapter deliberately turns
-- it on from the Control panel. Off ⇒ the phone card never renders and the
-- Chair panel shows the read-only fairness board only.
-- ═══════════════════════════════════════════════════════════════════

alter table yip.events
  add column if not exists speaking_placard_enabled boolean not null default false;
