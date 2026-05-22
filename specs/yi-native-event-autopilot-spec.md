# Spec: Yi-Native Event Auto-Pilot + Chapter Reporting

**Date:** 2026-04-18
**Author:** Claude (interview-driven)
**Status:** Ready for build
**Priority:** P0 (the #1 thing that would make a Chair smile)
**Effort:** ~29h total (auto-pilot 15h + reporting 12h + feature-flag integration 2h)

---

## Problem Statement

Yi Chapter Chairs lose hours after every event to:
1. **Manual reporting to Yi National** — compiling attendance, AAA progress, member engagement into quarterly submissions. Chair's biggest post-event pain (confirmed in interview).
2. **Manual re-entry of event data into AAA health cards, Take Pride nominations, engagement scores** — one event = three manual updates.
3. **Post-event attendee chase** — WhatsApp-hunting for feedback, absentees, photos.

**Why Stutzee doesn't solve this:** Stutzee is a generic event platform. It doesn't know about AAA plans, Take Pride cycles, engagement scoring, succession pipelines, or Yi National's reporting template. Yi Connect's value is being **Yi-native**: event data automatically flows into the Yi operating system.

**Why now:** We have 8 demo accounts seeded (this session) and the chapter-feature-toggle infrastructure from Dec 2025. The foundation is ready — we just need to connect events to the rest of Yi Connect's context.

---

## Interview Decisions (locked in)

| Decision | Answer |
|----------|--------|
| Real pain driving this | Yi-native context Stutzee can't provide — NOT feature-parity with Stutzee |
| Usage frequency | Varies wildly by chapter → feature flags per chapter |
| Build capacity | Us in Claude sessions (~10-15h/week) |
| Success metric (Oct 2026) | Chair chairs say "this made my life easier" |
| #1 post-event Chair pain | Quarterly reporting to National |
| Ship-one-thing priority | Event auto-pilot (RSVP → reminder → QR → auto report) |
| Feature rollout | Default OFF, Chair opts in per chapter (self-service) |

**Explicitly DESCOPED from the original 115h Stutzee roadmap:**
- ❌ Razorpay payment gateway (3C) — Yi doesn't run paid events for now (12h saved)
- ❌ Ticket pricing tiers (3B) — depends on 3C (8h saved)
- ❌ Sponsor lead capture (3D) — not Yi-native (7h saved)
- ❌ Public event landing page (2B) — Stutzee does this; not Yi-native priority (9h saved)
- ❌ Live event big-screen dashboard (2C) — Stutzee parity; not Yi-native (10h saved)
- ❌ Custom form builder (1C) — nice-to-have; defer (7.75h saved)
- ❌ Gamification badges + leaderboard (4B) — defer to Phase 2 (21h saved — but keep the points log as hook for reporting)
- ❌ Scan-to-connect networking (4A) — defer to Phase 2 (13h saved)

**Total savings: ~87h deferred.** Remaining Yi-native scope: ~29h.

---

## User Stories

### Story 1: Chair runs a monthly meet
```
As a Chapter Chair, 
when I finish running an event,
I don't want to touch anything else that day.

The system should automatically:
- Send feedback reminders to attendees (24h after)
- Compile attendance + feedback summary
- Update the AAA health card for that vertical (if tagged)
- Update each attending member's engagement score
- Email me a one-page event summary
- Queue the event's stats for the next quarterly national report
```

### Story 2: Chair preps quarterly report to National
```
As a Chapter Chair,
when Yi National asks for quarterly metrics,
I want to click one button and get a finished PDF — not scramble for 4 hours.

The PDF should contain:
- Events run this quarter (with attendance %)
- AAA verticals status (on-track vs behind)
- Top 10 members by engagement
- Financial snapshot
- Take Pride nominees auto-suggested from engagement leaders
```

### Story 3: Chair of smaller chapter turns it off
```
As a Chapter Chair of a small chapter that runs 3 events/year,
I don't want all this automation noise.

I should be able to turn off auto-pilot features per chapter,
while keeping core event management.
```

---

## Requirements

### Must-have (P0, in this scope)

**Auto-Pilot Feature Flag** (per chapter)
- [ ] `chapter_feature_toggles` entry `event_autopilot` default OFF
- [ ] Chair-accessible settings page at `/settings/event-autopilot` with toggle + config (how soon after event to send feedback reminder, which verticals auto-log health cards)

**Event Auto-Pilot Pipeline**
- [ ] Trigger: `event.status` transitions to `completed` (manually by Chair OR auto-scheduled at `event_date + 2 hours`)
- [ ] Step 1: Send WhatsApp + email feedback reminder to all RSVP'd members (uses existing Resend + whatsapp-web.js)
- [ ] Step 2: Compute event stats (attendance, check-in rate, feedback rating avg, photos count)
- [ ] Step 3: If event has `vertical_id`, auto-create draft `health_card_entries` with EC/Non-EC counts pre-filled from event check-ins
- [ ] Step 4: For each attending member, insert `member_points_log` row (+10 points via gamification hook — schema from cluster 4 plan, minimal badge/leaderboard UI deferred)
- [ ] Step 5: Email Chair one-page event summary via Resend
- [ ] Step 6: Flag event as eligible for quarterly report

**Quarterly Report Generator**
- [ ] New page `/reports/quarterly` (Chair access)
- [ ] Pick quarter (default: last completed quarter)
- [ ] Generate PDF with:
  - Chapter header + quarter + fiscal year
  - Events summary table (name, date, type, attendance, rating)
  - AAA verticals status grid (planned vs completed activities per vertical)
  - Top 10 members by engagement score delta this quarter
  - Financial snapshot (total expenses, approved, pending)
  - Auto-suggested Take Pride nominees (top 5 by engagement score)
- [ ] Download + email-to-national button
- [ ] Store generated report in `chapter_reports` table for audit

### Nice-to-have (P1, defer)

- Monthly mini-report (same format, auto-generated on 1st of month)
- Side-by-side previous-quarter comparison
- Graph of engagement score trends per vertical
- Multi-chapter compare (for National Admin viewing)

### Out of scope (explicitly)

- ❌ Paid ticketing (Razorpay) — not needed per interview
- ❌ Public event landing page — generic feature
- ❌ Live big-screen dashboard — generic feature
- ❌ Custom form builder — nice-to-have
- ❌ Full gamification badges UI — minimal points log only
- ❌ Scan-to-connect networking — Phase 2
- ❌ Automatic Take Pride nomination creation — we SUGGEST, Chair confirms

---

## Technical Constraints

- Must use existing `chapter_feature_toggles` for opt-in (no new flag system)
- Must use existing Resend + whatsapp-web.js (no new comms channels)
- Must use existing `health_card_entries` table (don't create parallel)
- Must use existing `engagement_score` calculation (don't replace)
- PDF generation: use `@react-pdf/renderer` or `html2canvas-pro` (already in package.json) or Puppeteer
- Feature-flag check must be fast — cache at request level
- Report generation: async job (can take 5-10 seconds for heavy chapters); show progress state
- All mutations must be idempotent — report can be regenerated safely

---

## Schema Changes

```sql
-- Migration: YYYYMMDD_event_autopilot.sql

-- 1. Auto-pilot runs table (audit log of what happened)
CREATE TABLE IF NOT EXISTS event_autopilot_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  chapter_id        UUID NOT NULL REFERENCES chapters(id),
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by      UUID REFERENCES auth.users(id), -- null = scheduled
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  steps_completed   JSONB DEFAULT '{}'::jsonb,
  -- { "feedback_reminder_sent": true, "stats_computed": true, 
  --   "health_card_created": true, "points_awarded": true, 
  --   "summary_emailed": true, "report_flagged": true }
  error_log         TEXT,
  completed_at      TIMESTAMPTZ
);

-- 2. Chapter reports archive
CREATE TABLE IF NOT EXISTS chapter_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id        UUID NOT NULL REFERENCES chapters(id),
  report_type       TEXT NOT NULL CHECK (report_type IN ('quarterly', 'monthly', 'annual')),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  fiscal_year       INTEGER NOT NULL,
  generated_by      UUID NOT NULL REFERENCES auth.users(id),
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url           TEXT,  -- Supabase Storage URL
  data_snapshot     JSONB NOT NULL,  -- frozen data at generation time
  sent_to_national  BOOLEAN DEFAULT false,
  sent_at           TIMESTAMPTZ,
  UNIQUE (chapter_id, report_type, period_start, period_end)
);

-- 3. Minimal points log (subset of cluster 4 plan — only the table, not full gamification UI)
CREATE TABLE IF NOT EXISTS member_points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chapter_id  UUID NOT NULL REFERENCES chapters(id),
  points      INTEGER NOT NULL CHECK (points != 0),
  reason      TEXT NOT NULL,
  action_type TEXT NOT NULL,
  source_id   UUID,
  source_type TEXT,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, action_type, source_id)
);

CREATE INDEX idx_points_log_member ON member_points_log(member_id);
CREATE INDEX idx_points_log_awarded ON member_points_log(awarded_at DESC);

-- 4. Feature toggle (via existing chapter_feature_toggles table — no schema change)
-- Just insert 'event_autopilot' as a new feature key
```

---

## Edge Cases & Error Handling

### Auto-pilot failures
- **Step fails** → mark run as `partial`, log error, continue other steps, notify Chair via in-app notification
- **WhatsApp not connected** → skip Step 1, email reminder only, log warning
- **Event has no vertical_id** → skip Step 3 (health card), continue
- **Event has 0 attendees** → skip Steps 3 & 4, still generate summary saying "low attendance"
- **Member missing engagement data** → skip that member's points award, continue others
- **Duplicate run of same event** → idempotent (UNIQUE constraints + `ON CONFLICT DO NOTHING`)

### Report generation failures
- **Supabase query times out** → retry once, then fail gracefully with partial report marked `incomplete`
- **PDF rendering fails** → show HTML preview, let Chair screenshot/print
- **Storage upload fails** → keep PDF in-memory, offer direct download
- **Quarter has 0 events** → still generate report with "No events this quarter" state

### Feature flag edge cases
- **Chair turns OFF auto-pilot mid-event-lifecycle** → in-flight runs complete; no new triggers
- **Chapter without `event_autopilot` toggle row** → defaults to OFF (safe default)
- **National Admin override** → future enhancement; not in scope

### Concurrency
- **Two Chairs trigger auto-pilot simultaneously** → DB UNIQUE constraint on `event_autopilot_runs(event_id, triggered_at)` prevents duplicate
- **Report generated twice for same quarter** → UNIQUE constraint on `chapter_reports` — second attempt overwrites with new data (acceptable)

---

## UI / Routes

| Route | Purpose | Access |
|-------|---------|--------|
| `/settings/event-autopilot` | Toggle + config per chapter | Chair, Co-Chair |
| `/events/[id]` | Add "Run Auto-Pilot Now" button when event is `completed`; show last run status | Chair, Co-Chair, EC Member |
| `/reports/quarterly` | Quarterly report generator | Chair, Co-Chair |
| `/reports/history` | List of past reports | Chair, Co-Chair, National Admin |

No new sidebar item for v1 — link from existing Events + Settings sidebar sections.

---

## Integration Points (existing code this touches)

| File | Change |
|------|--------|
| `app/actions/events.ts` | Add `triggerEventAutoPilot(eventId)` action; hook into `completeEvent()` |
| `app/actions/health-card.ts` | Add `createDraftHealthCardFromEvent(eventId)` — auto-called by auto-pilot |
| `lib/data/engagement.ts` (new or extend `lib/data/members.ts`) | `awardPointsForEvent(eventId, attendedMemberIds)` |
| `lib/features.ts` | Add `event_autopilot` to feature list |
| `lib/email/templates.ts` | New: `eventSummaryEmail`, `quarterlyReportEmail` |
| `lib/whatsapp/format-message.ts` | New: feedback reminder message template |
| `app/(dashboard)/events/[id]/page.tsx` | Show auto-pilot status card + manual trigger button |
| `components/events/event-autopilot-panel.tsx` (new) | Toggle + last-run display |
| `app/(dashboard)/settings/event-autopilot/page.tsx` (new) | Chair config page |
| `app/(dashboard)/reports/quarterly/page.tsx` (new) | Report generator |
| `app/(dashboard)/reports/history/page.tsx` (new) | Archive list |
| `lib/reports/quarterly-generator.ts` (new) | Report data aggregator + PDF renderer |

---

## Effort Breakdown

| Task | Hours |
|------|-------|
| Schema migration + feature flag seed | 1.0 |
| `triggerEventAutoPilot()` server action with all 6 steps | 4.0 |
| `event_autopilot_runs` audit tracking | 1.0 |
| WhatsApp + email feedback reminder templates | 1.5 |
| Auto-create health card draft from event | 1.5 |
| Points log inserts (minimal gamification hook) | 1.0 |
| Event summary email template + send | 1.0 |
| `/settings/event-autopilot` config page | 1.5 |
| `/events/[id]` auto-pilot panel + manual trigger | 1.5 |
| Quarterly report data aggregator | 3.0 |
| PDF renderer (react-pdf or puppeteer) | 3.0 |
| `/reports/quarterly` UI + generate button | 2.0 |
| `/reports/history` archive page | 1.5 |
| Chair review + iteration (inevitable) | 3.0 |
| Tests + edge cases | 2.5 |
| **TOTAL** | **~29h** |

---

## Success Criteria (verification when built)

1. [ ] Chair at Yi Erode turns on auto-pilot, runs a test event, completes it, verifies:
   - Feedback reminder arrived via WhatsApp+email to at least 1 attendee
   - Health card draft appears in Pathfinder for that vertical
   - Engagement scores updated for 3+ attending members
   - One-page summary email arrived in Chair's inbox within 5 min
2. [ ] Chair generates quarterly report for Q1 2026 → PDF downloads cleanly with all 5 sections populated
3. [ ] Chair at a smaller chapter turns auto-pilot OFF → no side-effects, events work normally
4. [ ] Second Chair at same chapter triggers same event's auto-pilot → idempotent, no double emails
5. [ ] Report for a quarter with 0 events generates a non-empty "no events" report (graceful degradation)

---

## Open Questions (flag for user before build)

1. **Yi National's actual report template** — I've assumed 5 sections. Does Yi National have a specific format they expect? If yes, mimic it.
2. **WhatsApp sender** — whose number sends the reminder? Personal Chair phone, chapter-shared number, or Yi Connect system number?
3. **Feedback reminder timing** — I chose "24h after event." Is this right, or should it be 2h, 48h, or configurable per event?
4. **Auto-pilot trigger** — I chose "event.status = completed" which requires manual mark-complete. Should we also auto-schedule at `event_date + 2h`?
5. **Who receives the summary email** — just Chair, or also Co-Chair + EC Member + vertical chair?
6. **Points default value** — I kept 10 points per attendance. Should chapters be able to configure this? (Already allowed by cluster 4 plan's `gamification_config`.)

---

## Rollout Plan

1. **Build in main branch with feature flag OFF for all chapters** (default)
2. **Enable for Yi Erode only** via service-role update to `chapter_feature_toggles`
3. **Chair runs 2-3 test events** over 2 weeks with feedback captured
4. **Iterate based on actual usage** — not theoretical
5. **Document learnings + open to other chapters** by Chair opt-in

---

## Next immediate actions (not part of spec — operational)

- [ ] **Update home page** to position Yi Connect as Yi-native operating system (user requested "full home page rewrite") — ~3-4h, separate from this spec
- [ ] **Close out current Chair-day mutation test** (background agent from earlier) and merge its findings into this spec's verification section
- [ ] **Archive the 87h of deferred plans** (cluster 2B, 2C, 3A-D, 4A, 1C) in `docs/plans/deferred/` — not deleted, just moved so we know where to find them later
