# Plan: Event Experience Features (Stutzee-inspired)

**Planner:** Agent 2
**Date:** 2026-04-18
**Scope:** QR per-attendee tickets, public event landing page, live event dashboard
**Total effort:** ~27 hours

---

## Audit Summary — What Already Exists

**QR infrastructure (55% built):**
- `components/events/event-qr-code.tsx` — event-wide QR (encodes `/events/[id]/checkin?qr=true`)
- `components/mobile/qr-scanner.tsx` — html5-qrcode scanner for self check-in
- `app/(dashboard)/events/[id]/checkin/page.tsx` + `/app/(mobile)/m/checkin/page.tsx`
- `app/actions/events.ts`: `checkInAttendee()`, `selfCheckIn()` — idempotent, tracked method
- `supabase/migrations/20251115000001_event_lifecycle_manager.sql` — `event_checkins` table
- `lib/crypto/hmac.ts` — HMAC signing (already used for RSVP tokens)
- `jose` + `qrcode` + `html5-qrcode` all already in package.json

**Public RSVP (complete):**
- `app/(public)/rsvp/[token]/page.tsx` — anonymous RSVP page
- `supabase/migrations/20260129000001_quick_rsvp.sql` — `rsvp_token` + anon RLS
- `lib/data/public-events.ts` — anon Supabase queries
- `app/actions/quick-rsvp.ts` — `toggleMemberRSVP()`, `addGuestRSVP()` with HMAC

**Realtime (proven pattern):**
- `components/communication/notification-bell.tsx` — Supabase `postgres_changes` subscription, working

**Missing:**
- Per-attendee QR ticket (unique token per RSVP row)
- Public event detail page (`/e/[slug]`)
- `public_slug` column on events
- `/events/[id]/live` route
- Chair-scans-member endpoint

---

## Feature 2A — QR Per-Attendee Tickets

### Schema delta

```sql
-- Migration: supabase/migrations/YYYYMMDD000001_attendee_ticket_tokens.sql

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS ticket_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

ALTER TABLE public.guest_rsvps
  ADD COLUMN IF NOT EXISTS ticket_token TEXT UNIQUE
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE public.event_rsvps   SET ticket_token = encode(extensions.gen_random_bytes(16), 'hex') WHERE ticket_token IS NULL;
UPDATE public.guest_rsvps   SET ticket_token = encode(extensions.gen_random_bytes(16), 'hex') WHERE ticket_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_ticket_token ON public.event_rsvps(ticket_token);
CREATE INDEX IF NOT EXISTS idx_guest_rsvps_ticket_token ON public.guest_rsvps(ticket_token);

-- Prevent double check-in at DB level
ALTER TABLE public.event_checkins
  ADD CONSTRAINT uq_event_checkins_attendee
  UNIQUE (event_id, attendee_type, attendee_id);
```

### Security

- 128-bit random tokens (not JWTs — expiry enforced via `event.status`)
- Idempotency already in `checkInAttendee()` — second scan is no-op success
- Token only returned to RSVP owner via existing RLS
- Chair's scanner calls server action with opaque token — no client-side member_id

### New server action

```typescript
// app/actions/events.ts
checkInByTicketToken(ticketToken: string): Promise<ActionResponse<AttendeeProfile>>
// 1. Lookup event_rsvps OR guest_rsvps by ticket_token
// 2. Verify event.status IN ('published', 'ongoing')
// 3. Idempotency check on event_checkins
// 4. Insert event_checkins (check_in_method: 'qr_code', checked_in_by: current_user)
// 5. Update rsvp.status → 'attended'
// 6. Return attendee profile for display
```

### New components

- `components/events/attendee-ticket.tsx` — member-facing QR display, QR encodes `/events/[id]/checkin/scan?t=[token]`, download button
- `app/(dashboard)/events/[id]/checkin/scan/page.tsx` — Chair scanner with camera + live attendee card

### Email/WhatsApp integration

- Embed QR image (base64 from `qrcode.toDataURL()`) in RSVP confirmation email (Resend)
- Send QR as media attachment via whatsapp-web.js

### Effort: 8h

| Task | Hours |
|------|-------|
| Schema migration | 0.5 |
| `checkInByTicketToken` action | 1.5 |
| `AttendeeTicket` component | 1.5 |
| Chair scanner page | 2.0 |
| Email + WhatsApp integration | 1.5 |
| Event detail page integration | 1.0 |

---

## Feature 2B — Public Event Landing Page

### Route: `/e/[slug]`

Short URL for posters/WhatsApp (vs internal `/events/[id]`).

### Schema delta

```sql
-- Migration: supabase/migrations/YYYYMMDD000002_event_public_slug.sql

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_events_public_slug
  ON public.events(public_slug)
  WHERE public_slug IS NOT NULL;

CREATE POLICY "anon_view_events_by_slug"
ON public.events FOR SELECT
TO anon
USING (
  public_slug IS NOT NULL
  AND status IN ('published', 'ongoing', 'completed')
);
```

### Slug generation

```ts
// lib/utils/slug.ts
generateEventSlug(title: string): string
// Format: "networking-dinner-april-2026-k3x9"
// = slugify(title) + '-' + randomAlphanumeric(4)
// Set in publishEvent() server action; retry loop on UNIQUE conflict
```

### Components

All in `components/events/public/`:
- `PublicEventHero` — banner, title, date, register CTA
- `PublicEventDetails` — full description, tags, organizer chapter
- `PublicEventMap` — `<iframe>` Google Maps embed (no API key needed for embed)
- `PublicEventVirtual` — "Virtual Event" badge + join link post-registration
- `PublicEventAgenda` — conditional on Agent 1's 1A (event_sessions)
- `PublicEventSpeakers` — conditional on Agent 1's 1A
- `PublicRegisterCTA` — delegates to existing `/rsvp/[token]` flow OR inline `GuestRSVPForm`

### OG metadata

Dynamic `generateMetadata()` in `app/(public)/e/[slug]/page.tsx`. WhatsApp reads og:image/title/description — use `banner_image_url` or Yi gradient fallback via next/og.

### Risks

- **Public spam** — guest RSVP rate limit + `max_capacity` + `guest_limit` server-side checks
- **Slug collision** — 1/1.7M odds; retry loop on UNIQUE violation
- **DDoS** — middleware `Cache-Control: max-age=60` on GET

### Effort: 9h

| Task | Hours |
|------|-------|
| Schema + slug generator | 1.0 |
| Data layer `getPublicEventBySlug()` | 1.0 |
| `PublicEventHero` + `Details` | 2.5 |
| `PublicEventMap` + `Virtual` | 1.0 |
| `PublicRegisterCTA` (delegates to existing guest flow) | 1.5 |
| OG metadata | 0.5 |
| `publishEvent` slug generation + event detail link button | 1.5 |

---

## Feature 2C — Live Event Dashboard

### Route

`app/(dashboard)/events/[id]/live/page.tsx` + nested layout that drops sidebar for full-screen kiosk mode.

### Auth

`requireRole(['Chair', 'Co-Chair', 'Super Admin', 'National Admin'])`.

### Schema delta

```sql
-- Migration: supabase/migrations/YYYYMMDD000003_live_dashboard_rls.sql

CREATE POLICY "Chair+ can view all check-ins for their chapter events"
ON public.event_checkins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.hierarchy_level >= 3
  )
);
```

(Needed for Supabase Realtime `postgres_changes` subscriptions — Realtime respects RLS.)

### Components (all in `components/events/live/`)

- `LiveDashboard` — client component, Supabase channel subscription, full-screen CSS
- `BigAttendanceCounter` — animated `checkins/rsvps` fraction (framer-motion, already in pkg)
- `LatestArrivals` — last 5 check-ins with avatar+name+company+time; new arrivals animate in
- `EngagementMetrics` — 3-stat row
- `NextSessionCard` — conditional on 1A (polls `event_sessions WHERE start_time > now()`)
- `QRPosterCard` — reuse existing `EventQRCode` at large size for late-comer self-check-in
- `LiveClock` — `setInterval` 1s

### Realtime subscription (follows `notification-bell.tsx` pattern)

```typescript
supabase
  .channel(`live-checkins:${eventId}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'event_checkins',
    filter: `event_id=eq.${eventId}`
  }, handleNewCheckIn)
```

Polling fallback at 30s. Member profile cache (`Map<memberId, profile>`) to avoid redundant fetches for repeat check-ins.

### Kiosk mode session refresh

Supabase access tokens expire after 1h. WebSocket drops silently. Mitigation: `setInterval` heartbeat server action every 45 min to refresh cookie.

### Effort: 10h

| Task | Hours |
|------|-------|
| Route + full-screen layout | 1.0 |
| `LiveDashboard` with Realtime subscription | 2.5 |
| `BigAttendanceCounter` + framer-motion | 1.5 |
| `LatestArrivals` with profile fetch + animation | 2.0 |
| `EngagementMetrics` | 0.5 |
| `NextSessionCard` (conditional) | 1.0 |
| `QRPosterCard` + `LiveClock` | 1.0 |
| RLS + session heartbeat | 0.5 |

---

## Cross-Feature Dependencies

| Feature | Depends On |
|---------|-----------|
| 2A | Existing `checkInAttendee`, `QRScanner`, HMAC lib — all reusable |
| 2B | Existing `/rsvp/[token]` + `GuestRSVPForm` (Register CTA delegates) |
| 2B agenda/speakers | Agent 1 Feature 1A (conditional render) |
| 2C | 2A preferred (richer attendee data); Agent 1 1A for NextSessionCard |

## Build order

1. **2A** QR tickets — foundation (8h)
2. **2B** Public page — standalone, parallelisable (9h)
3. **2C** Live dashboard — after 2A (10h)

Wall-clock with 2 engineers in parallel: ~19h.

---

## Environment variables

No new vars. Uses existing `RSVP_HMAC_SECRET`, Supabase URL/keys.

## Migrations

- `YYYYMMDD000001_attendee_ticket_tokens.sql` (2A)
- `YYYYMMDD000002_event_public_slug.sql` (2B)
- `YYYYMMDD000003_live_dashboard_rls.sql` (2C)

---

## Files Touched

### 2A
- NEW: `components/events/attendee-ticket.tsx`, `app/(dashboard)/events/[id]/checkin/scan/page.tsx`, migration
- MOD: `app/actions/events.ts`, `app/(dashboard)/events/[id]/page.tsx`, `lib/email/templates/`, `lib/data/events.ts`

### 2B
- NEW: `lib/utils/slug.ts`, `app/(public)/e/[slug]/page.tsx`, 7 `components/events/public/*.tsx`, migration
- MOD: `lib/data/public-events.ts`, `app/actions/events.ts` (`publishEvent`), `app/(dashboard)/events/[id]/page.tsx`

### 2C
- NEW: layout + page at `app/(dashboard)/events/[id]/live/`, 7 components in `components/events/live/`, migration
- MOD: `app/(dashboard)/events/[id]/page.tsx` (Live Dashboard button)
