# Varnam Vizha — Festival Platform Spec 🎨🪔

**Status:** Draft for approval · **Author:** Claude (for director@jkkn.ac.in) · **Date:** 2026-06-20
**Lives at:** `app/varnam-vizha/*` inside `yi-connect` (NOT a standalone repo)
**Source of truth for festival data:** Obsidian vault `/Users/omm/Vaults/Young Indians/Varnam VIzha/` + 2026 WhatsApp intel

---

## 0. TL;DR

Varnam Vizha is Yi Erode's flagship 11-day September cultural festival (timed to culminate on **Erode Day, 16 Sept**). This spec defines a **festival platform** built as a new branded vertical inside the `yi-connect` monorepo — its own URL, but sharing yi-connect's login, members, and the `yi_directory`.

**The whole build is ~one new database table + a branded vertical that composes existing yi-connect modules.** Sub-events, registration, sponsors, government contacts, speakers, budget, and P&L are **already built** in yi-connect and are reused, not rebuilt.

It is **evergreen** (any year/edition plugs in; 2026 is the current cycle) and answers the exact need the 2026 co-chairs flagged on WhatsApp ("website ready ah? Google sheet ready ah?") and never executed.

---

## 1. Purpose

Replace the 2025 patchwork (Google Forms + handwritten paper forms + BookMyShow + WhatsApp + scattered Google Sheets) with **one platform** that:

1. Gives the public a single branded home for the festival (events, schedule, sponsors, gallery, register).
2. Captures registrations and attendance digitally (no more 100 handwritten forms).
3. Lets the committee run the edition: events, team/roles, sponsor pipeline, budget/P&L, timeline.
4. Preserves institutional memory so each year's chair can replicate the festival (the "Playbook").

---

## 2. Strategic context (grounded in real history)

### 2.1 The proven 2025 operating model (the requirements baseline)
- **Dates:** 5–16 Sept 2025, ~11 days, two weekends, **Collector-approved**.
- **~15 executed sub-events** across many venues: Inauguration at Collectorate, 5K Awareness Run, Bike Rally, Kolam Contest, Women's Carnival, Turf Cricket, Rhythm & Roots, Job Fair, **Jolly Jam concert** (BookMyShow-ticketed), Heritage Walk (Collector-hosted), Valedictory at Kongu Engineering College, Midnight Walkathon.
- **Coalition model:** Yi + 15–20 partner forums (CII, OEF, IWN, Rotary, JCI, BNI, Round Table, Siragugal, IMA, EAA, CREDAI, Erode Runners Club…), each owning specific events and submitting their own logo + permission letters.
- **Funding constraint (foundational):** Government provides **permissions only, NO money**. The festival is **entirely self-funded** via sponsors + ticketed events. Any budget/sponsorship feature must assume this.
- **Distribution:** Instagram/YouTube/Facebook `@erodevarnamvizha`, Voice of Erode (social partner), BookMyShow for concert tickets.
- **4-week thematic arc (2025):** Heritage → Innovation → Nature & Sport → Unite.

### 2.2 The 2026 reality (why this app, now)
- **Two co-chairs appointed:** Deepak + Senthil (17 Feb 2026). Yadhavi mentoring.
- 2026 kickoff named three infra priorities: **Google Sheets, Website, Social media** — then momentum stalled. The chairs' "is the website ready?" went unanswered.
- **Continuity gaps:** both 2025 design vendors left the group (Nov/Dec 2025); several forum leads left in 2026. The platform must reduce dependence on individual vendors and capture knowledge centrally.
- **2026 dates not yet fixed** (inference: again early-to-mid September to land on 16 Sept).

> Design implication: treat the 2025 catalogue as the **requirements baseline**, and design explicitly for the gaps the 2026 thread exposed — role/committee continuity, sponsorship tracking, multi-forum event+permission management, and the "Google Sheets → real website + registration" jump.

---

## 3. Architecture

### 3.1 Where it lives — and where it must NOT
- **Build location:** `app/varnam-vizha/*` inside `/Users/omm/PROJECTS/yi-connect` (GitHub `JKKN-Institutions/yi-connect`).
- **DO NOT build in** `/Users/omm/PROJECTS/Varnam Vizha app` (the empty folder created 2026-06-20). Per yi-connect's own rule, editing standalone vertical folders "ships NOTHING" — this is the exact trap the 2026-05-26 YIP absorption fixed. That folder will get a README pointer only.
- yi-connect is a **single Next.js 16 app** (App Router), not a workspace monorepo. Verticals are top-level path sections: `/yip`, `/yi-future`, `/yifi` → and now `/varnam-vizha`.

### 3.2 How it connects to yi-connect
- **Shared Supabase backend** (`bkmpbcoxbjyafieabxao`) — same DB as yi-connect/YIP/YiFuture.
- **Shared login + identity:** `yi_directory.people` (one row per human) + `yi_directory.role_assignments`. Varnam adds a new `app = 'varnam'` value. The `app` column is **free-text `TEXT NOT NULL` with no CHECK constraint → no migration needed to introduce `'varnam'`.**
- **Shared directory growth:** partners, industry, government, vendors, speakers are added to the existing CRM tables, enriching the one Yi directory (per your requirement).

### 3.3 Own URL
- **No host-based routing precedent exists** in yi-connect today (it's path-based: production `yi-connect-app.vercel.app/yip` etc.).
- **Approach:** add the domain (e.g. `varnamvizha.in` / `erodevarnamvizha.in` / a subdomain) in Vercel, then a host→path rewrite in `middleware.ts`:
  ```ts
  // host varnamvizha.* → serve /varnam-vizha/*
  if (host?.startsWith("varnamvizha")) {
    return NextResponse.rewrite(new URL("/varnam-vizha" + pathname, request.url));
  }
  ```
  PWA manifest scoped to `/varnam-vizha`. Path-based access (`/varnam-vizha`) works day one with zero config; the custom domain is a deploy-time add-on. *(Domain name = an open decision, §11.)*

### 3.4 Branding takeover
Root `app/layout.tsx` imposes no nav chrome, so the vertical fully controls its look via `app/varnam-vizha/layout.tsx` (fonts, `themeColor`, metadata, brand Header/Footer) + its own CSS. Visual direction: **vibrant/colorful** — "Varnam" means *color* — Tamil-cultural, festival energy. (Frontend-design skill to be invoked at build time.)

---

## 4. Data model

### 4.1 The ONE new table (evergreen grouping)
Events in yi-connect are **flat** (no edition/series linkage). To make the festival evergreen (any year plugs in, sub-events roll up), add:

```sql
-- migration: 20260620xxxxxx_varnam_festival_editions.sql  (SQL shown first per project rule)
CREATE TABLE yi_connect.festival_editions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_key  text NOT NULL DEFAULT 'varnam-vizha',   -- supports future festivals/chapters
  chapter_id    uuid REFERENCES yi.chapters(id),
  year          integer NOT NULL,
  name          text NOT NULL,                           -- "Varnam Vizha 2026"
  slug          text UNIQUE NOT NULL,                    -- "varnam-vizha-2026"
  theme         text,                                    -- optional annual theme
  start_date    date,
  end_date      date,
  status        text NOT NULL DEFAULT 'planning'         -- planning | live | completed | archived
                  CHECK (status IN ('planning','live','completed','archived')),
  chair_person_ids uuid[] DEFAULT '{}',                  -- → yi_directory.people.id
  budget_id     uuid REFERENCES yi_connect.budgets(id),  -- ties P&L to the edition
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (festival_key, year)
);

ALTER TABLE yi_connect.events
  ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES yi_connect.festival_editions(id);
```
A sub-event is just a normal `events` row with `festival_edition_id` set. This reuses **all** event machinery (sessions, speakers, custom forms, RSVP token, public slug, autopilot) for free.

### 4.2 Everything else is REUSED (no new tables)
| Festival need | Existing table(s) | Notes |
|---|---|---|
| Sub-events | `yi_connect.events` (+ new FK) | category `cultural`/`sports`/etc.; public_slug; rsvp_token |
| Agenda / line-up | `event_sessions`, `session_speakers` | performers/guests per session |
| Performers/guests | `speakers` | fees (JSONB), availability, media, ratings |
| Public registration (no login) | `quick_rsvp` (`rsvp_token`) + `event_custom_forms` (`registration_form_fields` JSONB) → `event_rsvps`/`guest_rsvps` | replaces Google Forms + paper forms |
| Sponsors + pipeline | `sponsors`, `sponsorship_tiers`, `sponsorship_deals`, `sponsorship_payments` | prospect→committed→paid funnel; tiers (platinum…supporter) |
| Industry partners | `industries`, `industry_opportunities` | CSR/sponsorship potential fields |
| Government contacts | `government_stakeholders` | dept, official, designation, decision authority — Collector/SP/ASP/PRO |
| Other partners/vendors | `ngos`, `vendors`, `stakeholder_contacts`, `stakeholder_interactions`, `stakeholder_mous` | forums, caterers, printers, AV |
| Budget + P&L | `budgets`, `budget_allocations`, `expenses`, `expense_categories`, `expense_receipts` | scope by `chapter_id` + `fiscal_year` + `event_id`; link `budget_id` on edition |
| Member roles/auth | `yi_directory.people`, `yi_directory.role_assignments` | `app='varnam'` |

### 4.3 Reconciliation note (build-time)
The 2025 Yi-Erode events import (`20251220000003/4`) inserted into `public.events`; the canonical events module is `yi_connect.events`. Build task: confirm which table production reads and migrate/re-tag the 1 existing `varnam-vizha`-tagged event (Thiran Ottam 2025) + backfill `festival_edition_id` for historical Varnam events. *(Verify against live schema before writing the migration — do not assume.)*

---

## 5. Identity, roles & authorization

### 5.1 Role taxonomy (`app='varnam'`)
Stored as free-text `role` on `yi_directory.role_assignments` (scoped by `yi_year`, optional `yi_chapter`):
- `varnam_super_admin` — platform master data for the festival vertical.
- `chair` / `co_chair` — edition leadership (2026: Deepak, Senthil).
- `organizer` — committee member, manage events/registrations (no delete).
- `forum_lead` — owns a partner-forum's events (e.g. CII, Rotary).
- `viewer` — read-only committee access.
Cross-app `platform_super_admin` always has full access.

### 5.2 Auth helpers to create (copy the YIP pattern)
- Reuse shared `getCurrentPersonRoles()` from `lib/yi/auth/yi-directory-roles.ts` (cached per request; returns `{ user_id, person_id, email, assignments[] }`).
- New `lib/varnam/auth/access.ts`:
  - `requireVarnamRole(roles: string[])` → gate dashboard/admin.
  - `getVarnamEventAccess(eventId)` → `{ canView, canManage, canDelete, role, reason }`, mirroring `lib/yip/auth/event-access.ts` with `app==='varnam'`.
- **Deny EXPLICITLY:** render `app/varnam-vizha/_components/Forbidden403.tsx` (copy from YIP) or return `{ success:false, error }`. **Never silent-`redirect()`** to a landing page (creates an undiagnosable bounce-loop — a documented yi-connect rule). Gate every sub-page + layout with the same helper.

---

## 6. The four zones

### 6.1 🎨 Public festival site  *(anonymous)*
Routes under `app/varnam-vizha/` (public) — branded reskin of the `(public)` patterns:
- `/` — hero, theme, dates, countdown to the edition; "what is Varnam Vizha".
- `/events` — the edition's sub-events (cards from `events WHERE festival_edition_id = current`), filter by week/theme/category.
- `/events/[slug]` — public event page (reuse `/e/[slug]` renderer: hero, agenda, speakers, venue/map, register CTA).
- `/schedule` — calendar/timeline across the 11 days.
- `/sponsors` — tiered sponsor wall (from `sponsorship_deals` joined to `sponsors`, status ≥ committed).
- `/gallery` — past-edition media (Playbook-fed).
- `/about` / `/partners` — coalition forums + organizers.
**Reusable components:** public event hero/agenda/speakers/map/CTA, `Header`/`Footer` (branded).
**Bilingual note:** festival content is heavily Tamil — see §12 (non-Latin review gate).

### 6.2 🎟️ Registration & ticketing  *(anonymous + member)*
- Per sub-event registration via `rsvp_token` page (no login) → `event_rsvps`/`guest_rsvps` with `custom_field_responses` (event-specific questions via `registration_form_fields`).
- Member registration uses existing logged-in RSVP.
- Digital pass / confirmation (email + on-screen) replacing handwritten forms.
- **Ticketing/payments boundary:** the platform can **track** registrations, tiers, and ticket counts, but **I will not wire real payment collection** (out of safety scope). Paid events (e.g. Jolly Jam) either keep BookMyShow with the link surfaced here, or you connect a payment gateway separately. *(Decision, §11.)*

### 6.3 📊 Committee dashboard  *(login-gated)*
Festival-lensed views over reused modules, under `app/varnam-vizha/dashboard/*`:
- **Events** — create/manage edition sub-events (lifecycle, sessions, custom forms, autopilot).
- **Registrations** — per-event lists, check-in, attendance, export.
- **Team & roles** — committee from `yi_directory` (`app='varnam'`), portfolio assignments, continuity view (who's active this year).
- **Sponsors** — pipeline board (`sponsorship_deals` stages), tiers, payments, target list seeded from intel.
- **Partners/Government/Industry** — CRM lists (`industries`/`government_stakeholders`/`ngos`/`vendors`) + interactions + MoUs.
- **Budget & P&L** — `budgets` + `budget_allocations` (planned) vs `expenses` (actual) for the edition; self-funded rollup; sponsor income vs cost.
- **Timeline** — milestones to the festival window.

### 6.4 📖 Digital Playbook  *(login-gated, evergreen)*
The institutional-memory zone, seeded from the vault's 13 files:
- **Past editions** (2021→) — chronicle, leadership, what ran, attendance.
- **Event templates** — reusable blueprints per signature event (Heritage Walk, Nila Soru, Thiran Ottam, Jolly Jam…), with requirements/checklists.
- **Contact directory** — government, sponsors, vendors, forums, media (from `Dedicated-Groups-Intel.md`).
- **Playbook docs** — timeline template, permission-letter templates, sponsorship matrix, branding kit, the FST strategic plan.
- **Lessons** — `Learnings-and-Feedback.md`.

---

## 7. Seed / migration plan
1. `festival_editions` rows for **2021–2026** (from `Chronicle-All-Years.md`); 2026 = `status='planning'`, chairs Deepak + Senthil.
2. Backfill `festival_edition_id` on the existing imported Yi-Erode Varnam events; create 2025 sub-events from `2025-Edition.md` + WhatsApp catalogue (~15 confirmed).
3. Seed sponsors/targets, government contacts, vendors, venues from `Dedicated-Groups-Intel.md` + WhatsApp intel (Milky Mist, Sakthi Masala, Agni Steels, Collector/SP/ASP, Texvalley, etc.).
4. Seed Playbook docs/templates from vault files.
5. Add `app='varnam'` role rows for the 2026 committee (after confirming names/emails).
> Tamil strings in seeds: prefer vault-verbatim text; flag any AI-generated Tamil for native review (§12).

---

## 8. Reuse-vs-new scorecard
- **New:** 1 table (`festival_editions`) + 1 column (`events.festival_edition_id`); `lib/varnam/auth/*`; `app/varnam-vizha/*` (layout, pages, components, branded CSS); seed migrations; optional middleware host-rewrite.
- **Reused as-is:** events + sessions + speakers + custom-forms + rsvp + autopilot; full Stakeholder CRM; Industry portal; Financial Command; `yi_directory` identity/auth; public event renderer.

---

## 9. Phased build plan (each phase verified before the next)
- **P0 — Scaffold & data model:** branch off clean `master`; `app/varnam-vizha` skeleton + branded layout/login; `festival_editions` migration; auth helpers. *Verify:* `/varnam-vizha` loads branded; gated route 403s correctly.
- **P1 — Public site:** home, events list, public event page, schedule, sponsors wall (read-only, current edition). *Verify (browser):* every page renders with seeded 2026 edition + sample events; screenshots eyeballed.
- **P2 — Registration:** custom-form registration + confirmation/pass; member + guest paths. *Verify:* end-to-end register on a test event, row lands in `event_rsvps`, check-in works.
- **P3 — Committee dashboard:** events, registrations, team/roles, sponsors pipeline, budget/P&L. *Verify:* each as the relevant role; explicit 403 for others.
- **P4 — Playbook + seed history:** 2021–2026 editions, templates, contacts, lessons. *Verify:* past editions browsable.
- **P5 — Polish & domain:** bilingual pass (native Tamil review), gallery/media, custom domain wire-up, PWA.
- Scaffold `docs/varnam-features.json` (house style) at P0 to track features + test steps.

---

## 10. Risks & gotchas
- **Dirty repo:** yi-connect currently on `feat/yip-juror-blind-scoring` with uncommitted work — branch cleanly off `master`; don't entangle with juror-scoring changes.
- **Tamil/non-Latin corruption (rule #24/#25):** any AI-generated Tamil needs native review; prefer vault-verbatim; visual artifacts (PDF passes, posters) need eyeball verification, not just HTTP 200.
- **No-funding constraint:** budget UI must frame govt as permissions-only; income = sponsors + tickets.
- **Payments out of scope for me** — track only; real collection via BookMyShow/gateway you wire.
- **Schema reconciliation:** `public.events` vs `yi_connect.events` for the 2025 import — verify before the seed migration.
- **Multi-tenant care:** writes through real RLS paths (service client with correct `Content-Profile`), not the Management API (which bypasses RLS → false green).

---

## 11. Decisions — RESOLVED 2026-06-20 (✅) + open (⏳)
1. ✅ **Public language:** **Bilingual Tamil + English.** Build i18n from P1; prefer vault-verbatim Tamil; every AI-generated Tamil string gets a native-review flag before go-live (rule #24/#25). Keep new generated Tamil ≤5-word strings; use `[TAMIL_TBD]` placeholders for long copy.
2. ✅ **Evergreen scope:** **Erode-only to start.** Keep `festival_editions.festival_key` + `chapter_id` columns (cheap future-proofing) but don't generalize UI/flows beyond Erode now.
3. ✅ **Paid tickets:** **Plan in-app payments later.** Registration designed so a gateway (Razorpay/Stripe) drops in later; app tracks tiers/counts now; **Claude wires no payment collection.** Concerts can still surface a BookMyShow link in the interim.
4. ⏳ **Domain:** User **has/will get a domain** — exact name TBD. Ship path-based (`/varnam-vizha`) at P0; wire the host→`/varnam-vizha` middleware rewrite + Vercel domain at P5 once the name is given.
5. ⏳ **2026 committee seed:** confirm names/emails (Deepak, Senthil + portfolios) at P0, else seed placeholders and backfill.

---

## 12. Appendix — key intel (from vault + 2026 WhatsApp)
- **Official channels:** IG/YouTube/FB `@erodevarnamvizha`; email `erodevarnamvizha@gmail.com`; Voice of Erode (social partner).
- **Working docs (Google):** master sheet, sponsorship sheet, planning doc (links in WhatsApp intel / `Dedicated-Groups-Intel.md`).
- **2026 leadership:** Co-Chairs Deepak + Senthil; mentor Yadhavi Yogesh.
- **Sponsor targets:** Milky Mist (top poll), Sakthi Masala, Agni Steels, URC, SKM, Ramraj, hospitals (KMCH, Lotus, Arasan), etc.
- **Government:** Collector (chair/patron), SP, ASP Vivekanandan, DSP, PRO — permissions only.
- **Signature events to template:** Inauguration, Heritage Walk, Thiran Ottam, Nila Soru, Jolly Jam, Turf Cricket, Kolam Contest, Women's Carnival, Midnight Walkathon, Valedictory.
- **Vault source files:** `00-Varnam-Vizha-Overview`, `Chronicle-All-Years`, `2025-Edition`, `Teams-and-Leadership`, `Sponsors-Funding-Patrons`, `Sub-Events-Catalog`, `Dedicated-Groups-Intel`, `Learnings-and-Feedback`, `Media-and-Branding`, `FST-Analysis-2026`.

---

_End of Spec — Varnam Vizha Festival Platform · awaiting approval + §11 decisions before P0._
