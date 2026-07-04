-- ═══════════════════════════════════════════════════════════════════
-- YIP Speaking Floor — raise-to-speak queue (speaking equity)
-- ───────────────────────────────────────────────────────────────────
-- Erode 2026 chapter round's #1 feedback theme (16 mentions, all 5
-- detractors) was "I didn't get an equal chance to speak." There was no
-- digital placard and no per-student turn counter — the Chair called on
-- whoever they happened to notice.
--
-- This table is the live "raise your hand" queue. A student taps
-- "I wish to speak" on their phone (/yip/me) → a 'waiting' row. The Chair's
-- control panel shows the queue AUTO-SORTED so people who have spoken least
-- float to the top, and Call → Mark spoken drives it. The projector shows a
-- public fairness meter ("N of M have spoken").
--
-- It is DISTINCT from yip.agenda_speakers (the organiser-authored, ordered
-- formal debate roster). speaking_requests is student-initiated and ad-hoc.
-- The event-wide fairness signal ("turns spoken") is DERIVED at read time as
-- spoken speaking_requests + completed agenda_speakers (see
-- app/yip/actions/speaking-floor.ts getSpeakingTurnCounts) — never
-- denormalised, so it can't drift.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists yip.speaking_requests (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references yip.events(id)       on delete cascade,
  -- The agenda item that was live when the hand went up (context only). Nulled
  -- if that item is later deleted; a request's lifecycle is event-scoped.
  agenda_item_id   uuid references yip.agenda(id)                on delete set null,
  participant_id   uuid not null references yip.participants(id) on delete cascade,
  -- waiting  → hand raised, in the queue
  -- called   → the Chair has called them to the mic (their turn now)
  -- spoken   → they finished speaking (counts toward their turn total)
  -- withdrawn→ the student lowered their own hand
  -- skipped  → the Chair dismissed the request without giving a turn
  -- expired  → auto-cleared when the House moved to a new agenda item
  status           text not null default 'waiting',
  requested_at     timestamptz not null default now(),
  called_at        timestamptz,
  resolved_at      timestamptz,
  constraint yip_speaking_requests_status_check
    check (status in ('waiting', 'called', 'spoken', 'withdrawn', 'skipped', 'expired'))
);

-- One ACTIVE placard per participant per event: a student can't spam the queue
-- with multiple pending hands. Historical (spoken/withdrawn/expired) rows are
-- unconstrained so they can raise their hand again next debate.
create unique index if not exists yip_speaking_one_active_per_participant
  on yip.speaking_requests (event_id, participant_id)
  where status in ('waiting', 'called');

-- Live-queue read (Chair panel + projector + phone) and per-participant turn
-- history both key on (event_id, status) / (event_id, participant_id).
create index if not exists yip_speaking_event_status
  on yip.speaking_requests (event_id, status);
create index if not exists yip_speaking_event_participant
  on yip.speaking_requests (event_id, participant_id);

-- Realtime: replica identity full + publication membership so INSERT/UPDATE/
-- DELETE propagate to the browser subscribers (phone/projector/control panel).
-- Without BOTH, realtime never fires for the new table (learned the hard way —
-- see 20260601080000_yip_realtime_publication_and_schema.sql).
alter table yip.speaking_requests replica identity full;
alter publication supabase_realtime add table yip.speaking_requests;

-- RLS: enable + PUBLIC read (mirrors yip.agenda_speakers — the queue is not a
-- secret ballot; who has raised their hand is shown on the projector). Realtime
-- postgres_changes only delivers rows the subscriber can SELECT, so anon read
-- is required for the phone/projector to receive updates. All WRITES go through
-- the service-role client in server actions (which bypasses RLS), so there is
-- intentionally NO insert/update/delete policy — the server action is the sole
-- authorization layer (participant cookie for students, getYipEventAccess for
-- the Chair), exactly like yip.votes.
alter table yip.speaking_requests enable row level security;

create policy yip_speaking_requests_read_all
  on yip.speaking_requests
  for select
  using (true);
