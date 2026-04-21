# Plan: Event Structure Features (Stutzee-inspired)

**Planner:** Agent 1
**Date:** 2026-04-18
**Scope:** Multi-session agenda, speaker profiles, custom form builder
**Total effort:** ~21.25 hours (wall-clock ~14h with 2 engineers in parallel)

---

## Feature 1A — Multi-session Agenda

### User Story

Event organiser running a full-day conference. Today the full schedule lives in `description` as plain text. They need:
- A structured schedule attendees can read before the event
- Speaker assignment per session (Feature 1B)
- Independent session control (capacity, room, type)
- Vertical timeline view for attendees

### Database Schema

```sql
-- Migration: supabase/migrations/20260418000001_event_sessions.sql

CREATE TYPE session_type AS ENUM (
  'keynote', 'workshop', 'panel', 'networking',
  'break', 'presentation', 'qa', 'other'
);

CREATE TABLE IF NOT EXISTS public.event_sessions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title             TEXT          NOT NULL,
  description       TEXT,
  session_type      session_type  NOT NULL DEFAULT 'presentation',
  start_time        TIMESTAMPTZ   NOT NULL,
  end_time          TIMESTAMPTZ   NOT NULL,
  room_or_track     TEXT,
  capacity          INTEGER,
  current_interest  INTEGER       NOT NULL DEFAULT 0,
  sort_order        INTEGER       NOT NULL DEFAULT 0,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT valid_session_times CHECK (end_time > start_time)
);

CREATE INDEX idx_event_sessions_event_id ON public.event_sessions(event_id);
CREATE INDEX idx_event_sessions_start    ON public.event_sessions(start_time);
CREATE INDEX idx_event_sessions_sort     ON public.event_sessions(event_id, sort_order);

CREATE TABLE IF NOT EXISTS public.session_speakers (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID  NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  speaker_id   UUID  NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  role         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, speaker_id)
);

CREATE TABLE IF NOT EXISTS public.session_interests (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID  NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  member_id   UUID  NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);

-- Trigger to maintain current_interest count
CREATE OR REPLACE FUNCTION public.update_session_interest_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.event_sessions
  SET current_interest = (
    SELECT COUNT(*) FROM public.session_interests
    WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
  )
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_session_interest
AFTER INSERT OR DELETE ON public.session_interests
FOR EACH ROW EXECUTE FUNCTION public.update_session_interest_count();

-- RLS (Co-Chair+ to manage; members read published events)
ALTER TABLE public.event_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_speakers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_interests ENABLE ROW LEVEL SECURITY;
```

### RSVP integration decision: **Option C — Event RSVP + per-session "I'm interested"**

Attendee RSVPs once to the event (existing flow unchanged). Per-session interest is a lightweight signal — no capacity enforcement. Preserves the entire existing RSVP/QuickRSVP flow with zero changes.

### Effort: 8.0h

| Task | Hours |
|------|-------|
| SQL migration (tables, trigger, RLS) | 0.75 |
| TypeScript types in `types/event.ts` | 0.5 |
| Zod validations | 0.5 |
| Server actions (5: createSession, updateSession, deleteSession, reorderSessions, toggleSessionInterest) | 1.0 |
| Data layer (4 functions) | 0.75 |
| SessionCard, SessionForm, SessionList components | 2.0 |
| AgendaTimeline + SessionInterestButton | 1.0 |
| `/events/[id]/sessions` manage page | 1.0 |
| Integration into `/events/[id]` Tabs | 0.5 |

---

## Feature 1B — Speaker Profiles

### Audit: Existing speakers module

Yi **already has** `speakers` table in stakeholders CRM. Full profile fields: name, bio, photo, expertise, certifications, languages, fee_structure, past topics, rating, testimonials, video_links.

Existing routes: `/stakeholders/speakers`, `/stakeholders/speakers/[id]`, `/stakeholders/speakers/new`, `/stakeholders/speakers/[id]/edit`

**Gap analysis:**

| Stutzee Feature | Existing? | Gap |
|---|---|---|
| Speaker profile + bio + photo | ✅ | None |
| Expertise areas | ✅ | None |
| Session assignment | ⚠️ Partial — `past_yi_topics[]` only | No `session_speakers` junction |
| FAQ per speaker | ❌ | New: `speaker_faqs` table |
| Attendee session likes | ❌ | Covered by 1A's `session_interests` |
| Public speaker profile | ❌ | Future: public `/speakers/[id]` route |

**Recommendation: Extend existing `speakers` table — do NOT create parallel.**

Creating parallel would cause:
- Duplicate speaker records
- Diverging CRM vs event-specific rating
- Broken health score calculations (built on `stakeholder_interactions`)

### Schema delta

```sql
CREATE TABLE IF NOT EXISTS public.speaker_faqs (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_id  UUID  NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  question    TEXT  NOT NULL,
  answer      TEXT  NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_public   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Close type-vs-schema drift (Type has these, DB doesn't)
ALTER TABLE public.speakers
  ADD COLUMN IF NOT EXISTS social_media_links       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suitable_topics          TEXT[],
  ADD COLUMN IF NOT EXISTS target_audience          TEXT[],
  ADD COLUMN IF NOT EXISTS session_formats          TEXT[],
  ADD COLUMN IF NOT EXISTS years_of_experience      INTEGER,
  ADD COLUMN IF NOT EXISTS organizations_associated TEXT[],
  ADD COLUMN IF NOT EXISTS notable_achievements     TEXT[],
  ADD COLUMN IF NOT EXISTS typical_session_duration TEXT,
  ADD COLUMN IF NOT EXISTS max_audience_size        INTEGER,
  ADD COLUMN IF NOT EXISTS requires_av_equipment    TEXT[],
  ADD COLUMN IF NOT EXISTS language_proficiency     TEXT[],
  ADD COLUMN IF NOT EXISTS charges_fee              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_range                TEXT,
  ADD COLUMN IF NOT EXISTS availability_status      TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS blackout_dates           TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_days           TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_time_slots     TEXT[];
```

### Effort: 5.5h

| Task | Hours |
|------|-------|
| SQL: `speaker_faqs` table + column additions + RLS | 0.5 |
| TypeScript + Zod additions | 0.5 |
| Server actions (4 FAQ CRUD) | 0.75 |
| Data layer | 0.5 |
| FAQ List + Form components | 1.5 |
| ProfileCard + SessionHistory components | 1.0 |
| Extend `/stakeholders/speakers/[id]` tabs | 0.75 |

---

## Feature 1C — Custom Form Builder

### Decision: Option B — Predefined field types with label/required toggles

Stored as JSONB on events table. Rendered dynamically in RSVP form. Not full drag-drop (too much for Yi scale); not reuse of existing `custom_fields` metadata (collision risk).

### Schema delta

```sql
-- Migration: supabase/migrations/20260418000002_event_custom_forms.sql

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_form_fields JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.guest_rsvps
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_custom_responses
  ON public.event_rsvps USING gin(custom_field_responses);
```

### Supported field types

`text`, `textarea`, `select`, `multiselect`, `checkbox`, `date`, `number`, `phone`

### Key risk: QuickRSVP fallback

If event has required custom fields, the 1-click QuickRSVP must fall back to full RSVPForm dialog. Apply same logic to anonymous guest flow (`guest_rsvps`).

### Effort: 7.75h

| Task | Hours |
|------|-------|
| SQL migration | 0.25 |
| Types + Zod | 0.75 |
| `updateEventFormFields` action + modify `createOrUpdateRSVP` | 1.0 |
| `CustomFieldsEditor` component (add/edit/delete/preview) | 2.5 |
| `CustomFormFieldPreview` | 0.5 |
| Modify RSVPForm dynamic rendering | 1.5 |
| QuickRSVP fallback logic | 0.5 |
| EventForm integration | 0.75 |

---

## Cross-Feature Dependencies

```
1B (Speaker FAQs + DB columns)
  └─ unblocks 1A (session_speakers FKs → speakers.id)
1C — fully independent
```

## Recommended build order

1. **1B** Speaker extensions (5.5h)
2. **1A** Multi-session agenda (8.0h) — needs 1B's DB done
3. **1C** Custom form builder (7.75h) — can run parallel with 1A

**Wall-clock with 2 engineers:** ~14h. **Sequential:** ~21.25h.

## Risks / Open Questions

1. **Timezone** — all Yi chapters are in India. Hardcode `Asia/Kolkata` for now, add `chapters.timezone` later if needed.
2. **Per-session RSVP** — Option C (interest only) is enough for now. Can upgrade to `session_rsvps` later without breaking existing flow.
3. **Type/schema drift on `speakers`** — ~15 columns exist in TypeScript type but not in DB. 1B's migration closes the gap.
4. **Export of custom form responses** — CSV export won't know dynamic columns. Follow-up task.

## Files Touched

### Feature 1A (new + modified)
- NEW: `supabase/migrations/20260418000001_event_sessions.sql`, `components/events/sessions/*.tsx` (6 files), `app/(dashboard)/events/[id]/sessions/page.tsx`
- MOD: `types/event.ts`, `lib/validations/event.ts`, `app/actions/events.ts`, `lib/data/events.ts`, `app/(dashboard)/events/[id]/page.tsx`

### Feature 1B
- NEW: `app/actions/speakers.ts`, `components/stakeholders/speakers/speaker-faq-{list,form}.tsx`, `speaker-{profile-card,session-history}.tsx`
- MOD: `app/(dashboard)/stakeholders/speakers/[id]/page.tsx`, `types/stakeholder.ts`, `lib/validations/stakeholder.ts`, `lib/data/stakeholder.ts`
- Migration shares same file as 1A

### Feature 1C
- NEW: `supabase/migrations/20260418000002_event_custom_forms.sql`, `components/events/custom-fields-editor.tsx`, `components/events/custom-form-field-preview.tsx`
- MOD: `types/event.ts`, `lib/validations/event.ts`, `app/actions/events.ts`, `components/events/rsvp-form.tsx`, `components/events/event-form.tsx`, `components/events/guest-rsvp-form.tsx`, `app/(dashboard)/events/[id]/page.tsx`, public RSVP route
