# Yi Connect — What Makes Stutzee Unnecessary

**Not a feature comparison. A category shift.**

---

## The Core Insight

Stutzee sees Yi members as **conference attendees**. Yi Connect sees them as **nation builders with ongoing missions**.

A Stutzee member opens the app 3 days a year (at events). A Yi Connect member opens it weekly because their chapter's Best Chapter score depends on it, their vow witness is watching, and their next routing match is waiting.

---

## What Yi Actually Is (That Stutzee Doesn't Know)

| Yi Reality | Stutzee's Model | Yi Connect's Model |
|---|---|---|
| 5 nation-building projects (MASOOM, Climate, Health, Road Safety, Accessibility) | Not represented | Verticals with 3A tracking (Awareness → Action → Advocacy) |
| 4 stakeholder groups (Members, Yuva, Thalir, Rural) | All attendees are equal | MYTRI framework — who we engage determines how we measure |
| Health Card = how National sees chapters | No concept | Auto-logged from events via auto-pilot |
| Best Chapter = coverage × documentation × impact × visibility | No concept | Dashboard showing real-time chapter score |
| 30x model: train 30 Yuvas → they deliver to 30,000 | Events are endpoints | Events are training-of-trainers with multiplied impact tracking |
| EC structure: vertical chairs own WHAT, stakeholder chairs own WHO | All organisers are equal | Role-based dashboards per EC responsibility |
| Vows with witnesses and 90-day follow-up | No concept | Built into every event closing |
| Personalised dossiers from session content | Generic recordings | AI-filtered per member's sector + challenges |
| Routing: match members by shared problems | Random networking | Census-driven curated 1-on-1s |

---

## The 7 Things Yi Connect Has That Stutzee Never Will

### 1. Health Card Auto-Pilot
When a chapter event completes → auto-creates health card entries with EC/non-EC counts, vertical tagging, 3A classification. The data that determines Best Chapter is captured without manual entry.

**Stutzee equivalent:** None. Stutzee doesn't know what a health card is.

### 2. Personalised Routing at Events
YiFi proves the concept: census your challenges → get matched to the 5 people in the room who share your problem → pre-scheduled 12-minute meetings. Generalise to every national event (RCM, Take Pride, NMT, BEW).

**Stutzee equivalent:** Random "delegate" meetings with accept/decline. No matching logic.

### 3. Personalised Dossiers
11 hours of stage content → filtered to YOUR sector, YOUR problems. 500 attendees get 500 different transcripts from the same event. Delivered to WhatsApp same night.

**Stutzee equivalent:** None. Generic recordings for everyone.

### 4. Vow Wall + 365-Day Follow-Up
3 commitments per member (business / family-health / Yi). Named witness from your matches. 30/60/90/180/365-day nudges to both member and witness. Public scorecard at next year's event.

**Stutzee equivalent:** None. Events end when you walk out.

### 5. Yi Journey (Personal Impact Timeline)
Not "My Registrations" (a ticket list). A growing record of:
- Every event attended (chapter, regional, national)
- Every connection made (tagged to which event, auto-tracked by co-attendance)
- Every vow taken and its status
- Every health card entry they contributed to
- Their chapter's Best Chapter rank trajectory
- Their vertical's 3A progress

This is the reason to keep opening the app.

**Stutzee equivalent:** A static list of past event tickets.

### 6. Chapter Operating System
EC chairs don't need Stutzee. They need:
- Thalir EC: which schools are confirmed for MASOOM this month?
- Yuva EC: how many college volunteers are trained for Road Safety?
- ENT Chair: which members want to attend YiFi? Census completion rate?
- Chair: are all 10 verticals active? What's our Health Card submission rate?

This is daily/weekly usage. Not event-day usage.

**Stutzee equivalent:** None. Stutzee doesn't know what a vertical is.

### 7. Multi-Level Event Scope
Events are chapter (monthly meets), regional (RCM), or national (YiFi, Take Pride, NMT, BEW). Members see their chapter events + regional events in their region + national flagships. National admins see everything.

**Stutzee equivalent:** Flat event list — no chapter/regional/national distinction.

---

## What Yi Connect Deliberately Does NOT Build

| Stutzee Feature | Why We Skip It |
|---|---|
| In-app messaging | Yi members live on WhatsApp. We deeplink to `wa.me/{phone}` instead. |
| Connection temperature slider | Manual busywork. We track relationship signal from platform behavior (co-attendance, vow witnessing, routing matches). |
| Notes | Stutzee's own screenshot shows "No notes found." Nobody uses it. |
| Rate Us / Share App | App Store mechanics. Yi Connect is a PWA — share the URL. |

---

## The Member Experience (What Replaces Stutzee)

### Opening Yi Connect as a YiFi Registrant:
1. `/home` detects yifi_session → lands on `/yifi/me`
2. See routing card: 5 matches with scheduled slots
3. At event: tap "I met them" after each meeting
4. Closing: write 3 vows, assign witnesses
5. Same night: personalised dossier arrives on WhatsApp + `/yifi/me/dossier`
6. 30 days later: "How's your vow going?" nudge
7. Between events: `/me/journey` shows growing timeline
8. Next chapter event: routing suggests "meet X, they share your labour shortage problem"

### Opening Yi Connect as a Chapter Chair:
1. `/home` detects OAuth → lands on `/dashboard`
2. See chapter score: 15/20 verticals active, 82% health card submission rate
3. Upcoming: YiFi 2026 (18 Erode members registered, 12 census complete)
4. This week: MASOOM session in 3 schools (Thalir EC confirmed)
5. Alerts: Climate vertical has 0 activities this quarter

### Opening Yi Connect as a National Admin:
1. `/dashboard` with national view
2. YiFi 2026: 170 registered across 30 chapters, Madurai hosting
3. Chapter rankings by health card score
4. BEW 2026 planning: 40 chapters confirmed

---

## The Yi-Specific Events Calendar

These are the events yi-connect knows about that Stutzee treats as generic conferences:

| Event | Scope | Frequency | What Yi Connect Adds |
|---|---|---|---|
| **YiFi** | National | Annual (Jul) | Routing + Dossiers + Vow Wall |
| **RCM** | Regional | 2x/year | Regional chapter benchmarking + The Knit |
| **Take Pride** | National | Annual (Dec) | Awards tracking + nomination pipeline |
| **NMT** | National | Annual | National strategy → chapter action plans |
| **BEW** | National | Annual (Mar) | Entrepreneurship week activities across all chapters |
| **Chapter Monthly** | Chapter | Monthly | Local events with health card auto-logging |
| **MASOOM Sessions** | Chapter | Ongoing | School program tracking (Thalir stakeholder) |
| **Yuva Programs** | Chapter | Ongoing | College volunteer training (Yuva stakeholder) |
| **Rural Outreach** | Chapter | Ongoing | Village/SHG partnership tracking |

---

## Build Priority (What to Ship Before YiFi on 17 July)

### Already Built (this session):
- [x] YiFi module with routing, vows, dossier, reveal screen
- [x] Events module extended with chapter/regional/national scope
- [x] Madurai chapter activated as YiFi host
- [x] Multi-level organiser roles
- [x] Unified PWA with smart home routing

### Build Next:
1. **Yi Journey page** (`/me/journey`) — personal impact timeline
2. **Mobile bottom nav** — Home, Events, Connections, Profile (match Stutzee's navigation muscle memory)
3. **Generalise routing to events module** — any event can enable census + matching
4. **WhatsApp deeplinks on connections** — tap to chat, not in-app messaging
5. **Chapter health dashboard** — Best Chapter score components visible to all members

---

*Authored: 2026-05-26*
*This document replaces all Stutzee gap analysis. Yi Connect is not catching up to Stutzee — it's making Stutzee a category error.*
