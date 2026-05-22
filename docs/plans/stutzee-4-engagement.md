# Plan: Engagement Features (Stutzee-Inspired)

**Planner:** Agent 4
**Date:** 2026-04-18
**Scope:** Attendee networking (scan-to-connect), Gamification (points + badges + leaderboard)
**Total effort:** ~34 hours (4A: 13h + 4B: 21h)

---

## Audit Summary

**No existing member-to-member connections.** `member_networks` table exists but is stakeholder CRM only (schools/industries).

**No `qr_token` on members.** Only `events.rsvp_token` (event-scoped) exists.

**No gamification anywhere.** Zero points/badges/leaderboard tables across 50+ migrations.

**`engagement_score` is live** — computed from event RSVPs / volunteer / feedback / skills with 50/30/15/5 weights in `chapter_settings`. Gamification must **extend, not replace**.

**`chapter_settings` already extensible.** Best path: add single `gamification_config JSONB` column rather than 8+ flat columns.

**AAA + Awards infrastructure complete.** `aaa_plans`, `health_card_entries`, `nominations`, `award_winners` all present — perfect feeders for gamification points.

---

## Feature 4A — Attendee Networking (13h)

### User story

At a chapter event, Member A wants to remember Member B after a brief conversation. A scans B's profile QR, B appears in A's connections with event+date+note. Post-event, A has a searchable address book.

### Schema

```sql
-- Migration: 20260417000001_member_connections.sql

-- Permanent profile QR token (separate from event-scoped rsvp_token)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS profile_qr_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE public.members
SET profile_qr_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE profile_qr_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_profile_qr_token ON public.members(profile_qr_token);

-- Privacy opt-out
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS allow_networking_qr BOOLEAN NOT NULL DEFAULT true;

-- One-way (LinkedIn follow model)
CREATE TABLE IF NOT EXISTS public.member_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_member_id  UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  to_member_id    UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_member_id, to_member_id, event_id)
);

CREATE INDEX idx_member_connections_from  ON public.member_connections(from_member_id);
CREATE INDEX idx_member_connections_to    ON public.member_connections(to_member_id);
CREATE INDEX idx_member_connections_event ON public.member_connections(event_id);

-- RLS
ALTER TABLE public.member_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own connections" ON public.member_connections
  FOR SELECT USING (from_member_id = auth.uid() OR to_member_id = auth.uid());

CREATE POLICY "Members create own connections" ON public.member_connections
  FOR INSERT WITH CHECK (from_member_id = auth.uid());
```

### One-way vs bidirectional

**Recommend one-way** (follow model, LinkedIn-style). If A scans B and B scans A at same event, two rows exist and UI shows "mutual connection". Avoids friction of accept flows at live events. Can upgrade to mutual-required later with `accepted_at` column.

### QR token URL

```
https://yi-connect-app.vercel.app/connect?token=<profile_qr_token>&event=<event_id>
```

Same static QR works at any event; event context is added by the scanner UI.

### UI

- `/connect?token=&event=` — public scan-landing. Shows member profile + "Add to My Connections" + optional note.
- `/connections` — address book, filterable by event, CSV export
- `/members/[id]` — "Connect" button + mutual indicator
- Event detail — "Show My QR" button
- Member settings — own QR + "Reset QR Token"

### Privacy

`allow_networking_qr` opt-out on member profile. Default on. When off, `/connect` page returns "Member not accepting connections."

### Independence from Agent 2

4A's `profile_qr_token` ≠ Agent 2's event-scoped `ticket_token`. Different tokens, different flows. 4A ships independently.

### Effort: 13h
2 schema + 1 getByToken + 2 CRUD actions + 2 scan landing + 3 address book + 2 QR display + 1 integration test

---

## Feature 4B — Gamification (21h)

### Decision: Extend, not rebuild

`engagement_score` is the strategic health signal (used for succession, leadership readiness). Do not replace.

Gamification adds **motivational raw points currency**:
- Time-windowed (monthly leaderboards; engagement is rolling 12mo)
- Visible, competitive, badge-driven
- Feeds Take Pride nominations

They coexist. High engagement_score and high points correlate but aren't identical.

### Schema

```sql
-- Migration: 20260417000002_gamification.sql

CREATE TABLE IF NOT EXISTS public.member_points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  chapter_id  UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  points      INTEGER NOT NULL CHECK (points != 0),
  reason      TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'event_attended', 'event_on_time', 'event_feedback',
    'aaa_activity_completed', 'health_card_submitted',
    'best_practice_submitted', 'take_pride_nominated',
    'take_pride_won', 'event_volunteered',
    'connection_made', 'correction'
  )),
  source_id   UUID,
  source_type TEXT,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_by  UUID REFERENCES public.members(id),
  UNIQUE (member_id, action_type, source_id)  -- idempotency
);

CREATE TABLE IF NOT EXISTS public.badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'blue',
  criteria    JSONB NOT NULL,
  -- e.g. { "type": "event_count", "threshold": 5 }
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_badges (
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  badge_id    UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, badge_id)
);

-- Materialized view for fast leaderboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS public.member_points_summary AS
SELECT
  member_id, chapter_id,
  SUM(points) FILTER (WHERE awarded_at >= date_trunc('month', now())) AS points_this_month,
  SUM(points) FILTER (WHERE awarded_at >= date_trunc('year',  now())) AS points_this_year,
  SUM(points) AS points_all_time,
  COUNT(*) AS actions_count,
  MAX(awarded_at) AS last_action_at
FROM public.member_points_log
GROUP BY member_id, chapter_id
WITH NO DATA;

CREATE UNIQUE INDEX ON public.member_points_summary(member_id);

ALTER TABLE public.chapter_settings
  ADD COLUMN IF NOT EXISTS gamification_config JSONB DEFAULT '{
    "enabled": true,
    "daily_cap": 50,
    "points": {
      "event_attended": 10, "event_on_time": 5, "event_feedback": 5,
      "aaa_activity_completed": 15, "health_card_submitted": 10,
      "best_practice_submitted": 20, "take_pride_nominated": 10,
      "take_pride_won": 100, "event_volunteered": 15, "connection_made": 2
    }
  }'::jsonb;
```

### Point-earning actions (chapter-configurable)

| Action | Default |
|--------|---------|
| Attend event | 10 |
| On time | +5 |
| Submit feedback | 5 |
| Complete AAA activity | 15 |
| Submit health card | 10 |
| Submit best practice | 20 |
| Nominate for Take Pride | 10 |
| Win Take Pride | 100 |
| Volunteer for event | 15 |
| Make connection | 2 (low: prevents farming) |

**Daily cap: 50 points/day/member** (configurable).

### Seed badges

12 badges: First Step (1 event), Regular (5 events), Committed (10), Early Bird (on time x3), Feedback Champion, AAA Warrior, Knowledge Sharer, Nominator, Take Pride Winner, Connector (10 connections), Top of Chapter (monthly #1), Century Club (100pts/month).

### Integration points

Each server action calls shared `awardPoints(memberId, actionType, sourceId, sourceType)` utility. Idempotent via UNIQUE constraint + `ON CONFLICT DO NOTHING`.

| File | Trigger | Action |
|------|---------|--------|
| `app/actions/events.ts` check-in | rsvp.checked_in_at set | `event_attended` + `event_on_time` |
| `app/actions/events.ts` feedback | feedback insert | `event_feedback` |
| `app/actions/events.ts` volunteer | volunteer completed | `event_volunteered` |
| `app/actions/aaa.ts` | activity completed | `aaa_activity_completed` |
| `app/actions/health-cards.ts` | entry insert | `health_card_submitted` |
| `app/actions/knowledge.ts` | best practice insert | `best_practice_submitted` |
| `app/actions/awards.ts` nominate | nomination insert | `take_pride_nominated` |
| `app/actions/awards.ts` declareWinner | winner insert (rank=1) | `take_pride_won` |
| `app/actions/connections.ts` (new) | connection insert | `connection_made` |

### UI additions

- `components/members/engagement-metrics-tab.tsx` → add "Points & Badges" section
- `/leaderboard` — chapter monthly/yearly/all-time leaderboard (uses materialized view)
- Chair dashboard "Top 5 This Month" widget
- `/awards/nominate` — "Leaderboard Leaders" suggested nominees callout

### Anti-gaming

- Daily cap 50pts
- Feedback only counts if `overall_rating IS NOT NULL` + min text length
- Health card: once per vertical per month
- `member_points_log` immutable — changing config affects future only

### Take Pride integration

1-line addition to `declareWinner()`: award 100pts for rank 1, 50pts for rank 2-3. Reverse path: leaderboard leaders surfaced as suggested nominees (soft suggestion, not auto-nomination).

### Effort: 21h
3 schema + 1 config + 2 awardPoints util + 2 badge eval + 3 hook 8 actions + 4 leaderboard page + 2 engagement tab + 1 dashboard widget + 1 Take Pride callout + 1 badge seed + 1 cron refresh

---

## Cross-Feature Dependencies

| Feature | Depends on |
|---------|-----------|
| 4A | Nothing — fully independent, different token than Agent 2 |
| 4B | 8 existing server action files (all exist, additive only) |

## Build order

1. **Week 1: 4B schema + events hooks + leaderboard** — highest-frequency triggers first
2. **Week 2: 4B remaining hooks + badges + dashboards** — full coverage
3. **Week 3: 4A networking** — more valuable after members are engaged

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Points inflation | Medium | Daily cap, quality gates on feedback, low weight for passive |
| Gamification shifts motivation | Medium | Weight high-effort actions higher; Chair can disable |
| Materialized view stale | Low | Refresh on Chair visit + 6h cron |
| awardPoints in rolled-back transaction | Medium | Call after commit, not nested in mutation transaction |
| QR spoofing | Low | `/connect` requires auth; spoofer only adds self to own contacts |
| Duplicate point awards | Low | UNIQUE constraint + `ON CONFLICT DO NOTHING` |

## Migrations to create

- `20260417000001_member_connections.sql`
- `20260417000002_gamification.sql`
- `20260417000003_gamification_badges_seed.sql`
- `20260417000004_chapter_settings_gamification.sql`
