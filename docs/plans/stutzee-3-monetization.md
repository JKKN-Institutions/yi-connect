# Plan: Monetization & Sponsorship Features

**Planner:** Agent 3
**Date:** 2026-04-18
**Scope:** Sponsorship tier UI, ticket pricing, Razorpay gateway, lead capture
**Total effort:** ~33 hours

---

## Audit Summary

**Sponsorship data model — mostly built:**
- `sponsors`, `sponsorship_tiers`, `sponsorship_deals`, `sponsorship_payments` all exist with full RLS
- `sponsorship_deals.event_id` already FKs events — **no junction table needed**
- Tier levels defined: platinum/gold/silver/bronze/supporter

**Gaps in sponsorship schema:**
- `sponsors.logo_url` missing
- `sponsorship_tiers.benefits` is flat `TEXT[]` — needs to become structured JSONB for "included vs not-included" checklist
- No tier management UI in app
- No per-event sponsor display

**Events are entirely free today.** No ticket tier, price, or payment columns anywhere. Everything must be additive (default false) to keep existing events working.

**No payment gateway.** No Razorpay or Stripe package, no webhook route, no payment table.

**QR scanning infra ready to reuse** for 3D (lead capture) — `html5-qrcode` + `qr-scanner.tsx` + `event_checkins` table.

---

## Feature 3A — Sponsorship Tier UI (6h)

### Schema delta

```sql
-- Migration: 20260418000001_sponsorship_tier_ui_enhancements.sql

ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE sponsorship_tiers
  ADD COLUMN IF NOT EXISTS benefits_structured JSONB DEFAULT '[]'::jsonb;

UPDATE sponsorship_tiers
SET benefits_structured = (
  SELECT jsonb_agg(jsonb_build_object('label', b, 'included', true))
  FROM unnest(benefits) AS b
)
WHERE benefits IS NOT NULL AND array_length(benefits, 1) > 0;

ALTER TABLE sponsorship_tiers DROP COLUMN IF EXISTS benefits;
ALTER TABLE sponsorship_tiers RENAME COLUMN benefits_structured TO benefits;
```

### New UI

- `/finance/sponsorships/tiers` — tier CRUD (Sheet-based)
- `components/finance/tier-form.tsx`
- `components/events/event-sponsors.tsx` — embeds on event detail, groups by tier
- Sponsor form → add `react-dropzone` logo upload to Supabase Storage `sponsor-logos` bucket
- Revenue per tier card on `/finance/sponsorships` (recharts)

### Effort: 6h
0.5 migration + 2 tier mgmt + 1 logo upload + 1.5 event sponsor section + 1 revenue card

---

## Feature 3B — Ticket Pricing Tiers (8h)

### Schema delta

```sql
-- Migration: 20260418000002_event_ticket_tiers.sql

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_paid_event BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS event_ticket_tiers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  price_paise          INTEGER NOT NULL CHECK (price_paise >= 0),
  member_price_paise   INTEGER CHECK (member_price_paise >= 0),
  sale_starts_at       TIMESTAMPTZ,
  sale_ends_at         TIMESTAMPTZ,
  quantity             INTEGER,
  quantity_sold        INTEGER NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  sort_order           INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_sale_window CHECK (sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_ends_at > sale_starts_at),
  CONSTRAINT valid_quantity CHECK (quantity IS NULL OR quantity_sold <= quantity)
);

ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS ticket_tier_id UUID REFERENCES event_ticket_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_paid_paise INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_paise >= 0),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded', 'failed')),
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- Atomic ticket reservation to prevent overselling
CREATE OR REPLACE FUNCTION reserve_ticket(p_tier_id UUID, p_rsvp_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_tier event_ticket_tiers;
BEGIN
  SELECT * INTO v_tier FROM event_ticket_tiers WHERE id = p_tier_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'tier_not_found'); END IF;
  IF v_tier.quantity IS NOT NULL AND v_tier.quantity_sold >= v_tier.quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'sold_out');
  END IF;
  UPDATE event_ticket_tiers SET quantity_sold = quantity_sold + 1, updated_at = now() WHERE id = p_tier_id;
  RETURN jsonb_build_object('success', true, 'price_paise', v_tier.price_paise);
END;
$$;
```

**Key design choices:**
- Prices in **paise** (integer) — no floats
- `reserve_ticket()` uses `FOR UPDATE` row lock — prevents overselling
- `is_paid_event` default false — all existing events unaffected

### UI
- Event form: "Paid Event" toggle → reveals ticket tier editor
- Public RSVP: if `is_paid_event`, show tier picker with sold-out states
- Organizer: new "Ticket Sales" tab on event detail

### Effort: 8h
1 migration + 2 tier editor + 2 public picker + 1.5 sales stats + 1.5 types/data

---

## Feature 3C — Razorpay Payment Gateway (12h — highest risk)

### Why Razorpay

- Native INR + UPI + all domestic payment methods
- Test mode with sandbox keys — no business verification for dev
- Standard checkout widget loads from Razorpay CDN — no PCI scope

### Env vars needed

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```

### npm package: `razorpay@^2.9.4`

### Schema

```sql
-- Migration: 20260418000003_event_payments.sql

CREATE TABLE IF NOT EXISTS event_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id                 UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
  ticket_tier_id          UUID NOT NULL REFERENCES event_ticket_tiers(id),
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  amount_paise            INTEGER NOT NULL CHECK (amount_paise > 0),
  amount_refunded_paise   INTEGER NOT NULL DEFAULT 0,
  razorpay_order_id       TEXT NOT NULL UNIQUE,
  razorpay_payment_id     TEXT UNIQUE,
  razorpay_signature      TEXT,
  status                  TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'attempted', 'captured', 'failed', 'refunded')),
  payer_name              TEXT,
  payer_email             TEXT,
  payer_phone             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at             TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Webhook route: `app/api/webhooks/razorpay/route.ts`

**Critical security rules:**
1. Read raw body (`req.text()`, not `req.json()`) for signature verification
2. HMAC-SHA256 verify `x-razorpay-signature` header against body + RAZORPAY_WEBHOOK_SECRET
3. Reject 400 on signature mismatch
4. Use service role client (not user session) for DB writes
5. Return 200 immediately after DB update — Razorpay retries non-200

### Reconciliation job (nightly)

Find `event_payments` where `status='created'` AND `created_at < now() - interval '1 hour'` → call Razorpay Orders API → update DB. Handles webhook failures.

### Effort: 12h
1 schema + 1 razorpay lib + 1.5 createPaymentOrder + 2 checkout component + 2 webhook + 2 edge cases + 1 reconciliation + 1.5 email confirmation

---

## Feature 3D — Lead Capture for Sponsors (7h)

### Auth model

**Decision:** No sponsor rep logins. EC members operate portal on behalf of sponsors. Avoids onboarding external accounts.

### Schema

```sql
-- Migration: 20260418000004_sponsor_leads.sql

CREATE TABLE IF NOT EXISTS sponsor_leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id            UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  captured_by_user_id   UUID NOT NULL REFERENCES auth.users(id),
  rsvp_id               UUID REFERENCES event_rsvps(id) ON DELETE SET NULL,
  guest_rsvp_id         UUID REFERENCES guest_rsvps(id) ON DELETE SET NULL,
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  company               TEXT,
  designation           TEXT,
  interest_level        TEXT NOT NULL DEFAULT 'medium'
    CHECK (interest_level IN ('hot', 'warm', 'medium', 'cold')),
  interest_areas        TEXT[],
  notes                 TEXT,
  follow_up_requested   BOOLEAN NOT NULL DEFAULT false,
  follow_up_by          DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### UI

- `/events/[id]/sponsor-portal` — EC member picks sponsor → scans attendee QR (reuse `qr-scanner.tsx`) → fills quick form
- Prefill name/email/company from `event_rsvps JOIN members` when QR resolves
- Leads table at `/events/[id]/sponsor-portal/leads` with CSV export (xlsx already in pkg)
- "Leads" tab on `/finance/sponsorships/[id]` deal detail
- Email sponsor contact on capture (Resend)

### Effort: 7h
0.5 migration + 1 portal page + 1 QR integration + 1.5 lead form + 1.5 leads table + 1 email + 0.5 deal tab

---

## Cross-Feature Dependencies

| Feature | Depends on |
|---------|-----------|
| 3A | Nothing new — fully independent |
| 3B | 3C (payment gateway) |
| 3C | 3B (tier id to charge against) — build together |
| 3D | Existing QR infra — fully independent |

## Build order

1. **3A** Sponsorship Tier UI (6h, standalone)
2. **3D** Lead Capture (7h, standalone)
3. **3C** Razorpay Gateway (12h, build BEFORE 3B)
4. **3B** Ticket Tiers (8h, uses 3C)

Build 3C before 3B. Trying to build ticket UI without tested payment gateway leads to half-finished flows.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Webhook arrives after browser close | High | Server status check on page load + polling fallback |
| Duplicate webhook | Medium | Idempotency: check `razorpay_payment_id` exists before processing |
| Two buyers at last seat | High | `FOR UPDATE` row lock in `reserve_ticket()` |
| GST on ticket sales | Medium | Yi is Section 8 non-profit; confirm with CA before live. Don't code GST yet. |
| Member vs non-member price fraud | Medium | Member price derived server-side from `auth.uid()`, never client parameter |
| `benefits TEXT[]→JSONB` migration corrupts | Medium | Use `jsonb_agg(unnest)` — test on staging first |
| Refunds | Out of scope | Record `status='refunded'` only. Manual Razorpay dashboard refund. |

## Migrations to create

- `20260418000001_sponsorship_tier_ui_enhancements.sql`
- `20260418000002_event_ticket_tiers.sql`
- `20260418000003_event_payments.sql`
- `20260418000004_sponsor_leads.sql`
