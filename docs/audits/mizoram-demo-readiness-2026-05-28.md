# Mizoram Chapter Round 2026 — Demo Readiness Audit

**Event ID:** `27219472-5d6d-4b77-b6e0-22b77a6eb38b`
**Demo:** June 4-5, 2026 (7 days out)
**Auditor:** Claude (read-only DB + code audit)
**Date:** 2026-05-28

---

## Verdict

**YELLOW** — Demo can run, but 4 hard blockers must be closed by the user before June 4. No code or data gaps that would block demo-day cold; all gaps are operational (participant upload, jury, venue, payment, oath text).

**Counts:** 16 PASS / 5 WARN / 6 FAIL

---

## Per-item findings

### Event row sanity

| # | Item | Status | Detail |
|---|------|--------|--------|
| 1 | Event row exists, correct name/dates/level/status | **PASS** | name=`Mizoram Chapter Round 2026`, day1=`2026-06-04`, day2=`2026-06-05`, level=`chapter`, status=`draft` |
| 2 | `yi_zone_code = 'NER'` and `zone = 'NER'` | **PASS** | Both backfilled tonight, confirmed `NER` in DB |
| 3 | `yi_chapter_id` points to real chapter with `region='NER'` | **PASS** | Links to `yi.chapters` Mizoram, region=`NER`, chair=Alan Lalhriatpuia |
| 4 | `max_participants` sensibly set | **PASS** | 170 (≥94, headroom for walk-ins) |
| 5 | `fee_per_participant_inr` set | **PASS** | ₹399 |
| 6 | `venue_name` + `venue_address` set | **FAIL** | Both NULL. Front-end will render empty venue panels. |
| 7 | `day1_date` + `day2_date` set | **PASS** | 2026-06-04 / 2026-06-05 |

### Participants + parties

| # | Item | Status | Detail |
|---|------|--------|--------|
| 8 | Participants count | **FAIL** | 0 participants. XLSX at `/Users/omm/Downloads/Mizoram_participant_list_v2_full.xlsx` still pending import. |
| 9 | Parties count | **FAIL** | 0 parties. Expected 5 from XLSX. |
| 10 | Allocation status | **PASS-pending** | `allocation_locked=false` (correct — must stay unlocked until participants + parties uploaded and allocation engine run) |

### Topics

| # | Item | Status | Detail |
|---|------|--------|--------|
| 11 | event_topics count ≥ 20 | **PASS** | Exactly 20 rows attached |
| 12 | `is_central=true` on all | **PASS** | All 20 rows confirmed `is_central=true` |
| 13 | Selection model / picked 5 | **PASS-with-note** | No separate "selected" flag exists — all 20 are active. Organizers narrow down via the Topics tab (delete unwanted rows). If only 5 should be live for the demo, organizer must prune to 5 via the UI. |

### Jury

| # | Item | Status | Detail |
|---|------|--------|--------|
| 14 | jury_assignments count where `is_active=true` | **WARN** | 1 row: "Demo Jury (Mizoram)", email=`demo-jury@yip-platform.test`, access_code=`2B4207`. No real jury yet. |
| 15 | Real jury pending | **FAIL** | User must add real jury emails before June 4. |

### Rubric

| # | Item | Status | Detail |
|---|------|--------|--------|
| 16 | Rubric attached / available for chapter level | **PASS** | 3 default+active rubrics exist: `speaker` (5 criteria, /100), `deputy_speaker` (5/100), `mp` (5/110). `RUBRIC_ROLE_MAP` in `app/yip/actions/scoring.ts` maps all 11 parliament_role enum values (PM/LoP/Cabinet Min/Shadow Min/Bill Committee/MP) to one of those 3 rubrics. Coverage is complete. |

### Live config

| # | Item | Status | Detail |
|---|------|--------|--------|
| 17 | `live_banner_text` + `live_banner_active` | **PASS** | text=NULL, active=false (correct pre-event) |
| 18 | `current_agenda_item_id` | **PASS** | NULL (correct pre-event) |
| 19 | `live_timer_running` | **PASS** | false |
| 20 | `scores_locked` + `registrations_frozen` | **PASS** | Both false (correct in draft) |

### Central agenda template

| # | Item | Status | Detail |
|---|------|--------|--------|
| 21 | Central agenda attached / agenda state machine seeded | **WARN** | `central_agenda` is NULL; `yip.agenda` has 0 rows for this event. Only one of 4 existing events (Erode MOCK chapter) has central_agenda set. May not be blocker if agenda is built live via the Control panel. Recommend confirming with team whether agenda needs pre-seeding. |
| 22 | `oath_text` set | **FAIL** | NULL. All 3 other events (mock Erode, mock South, mock Delhi) have oath_text populated. Likely needed for opening ceremony — will display blank on the projector view if not set. |

### Permissions & access

| # | Item | Status | Detail |
|---|------|--------|--------|
| 23 | Pradeep + Swapnil can see the event | **PASS** | Both have `app='yip', role='national', is_active=true`. `isCurrentUserSuperAdmin()` matches `YIP_SUPER_ROLES = {national, super_admin}` → passes super-admin gate → reads ANY event. |
| 24 | Poornima (NER RM) can see the event | **PASS** | Has `app='yip', role='regional_admin', yi_zone='NER', is_active=true`. Event's `yi_zone_code='NER'` matches. `getRegionalAdminZones('yip')` returns `['NER']` for her → gate passes. |
| 25 | Other 5 RMs blocked | **PASS** | Shruti (ER), Sakshi (NR), Punit (WR), Shenher (SRTN), Shivani (SRTKKA) all have zones ≠ NER. No zone match → gate denies (`event = null`) → 403 Forbidden page renders. Confirmed via code path in `app/yip/actions/events.ts:278-298` + `lib/yip/auth/require-super-admin.ts`. |
| 26 | Demo jury login dropdown shows this event | **PASS** | Jury row `is_active=true`, event status=`draft` (not deleted). Demo access_code=`2B4207`. |

### Bugs / blockers (data gaps that break demo day)

| # | Item | Status | Detail |
|---|------|--------|--------|
| 27a | Missing participants → allocation, scoring, results all dead | **FAIL** | 0 participants — every downstream feature requires them. |
| 27b | Missing parties → can't run party-based allocation | **FAIL** | 0 parties. |
| 27c | Missing venue → projector view & comms blank | **FAIL** | venue_name + venue_address NULL. |
| 27d | Missing oath_text → opening ceremony screen blank | **WARN** | Other events all have it; likely templated copy exists somewhere. |
| 27e | Checklist not seeded | **WARN** | 0 rows; 33 templates available. Organizer can manually seed via UI button (`seedChecklistForEvent`). Demo will work without it, but operational ops checklist will be empty. |
| 27f | Fees / mycii_payment_link / mycii_event_registered | **WARN** | fee=₹399 set, but `mycii_payment_link=NULL` and `mycii_event_registered=false`. If real fee collection runs at demo, payment link must be added; if demo-only, ignore. |

---

## Action items before June 4

**HARD BLOCKERS (must close):**
- [ ] **Upload participants + parties** from `/Users/omm/Downloads/Mizoram_participant_list_v2_full.xlsx` (expected: 5 parties, ~94+ participants). Without this, allocation, scoring, results, and projector view are all empty.
- [ ] **Set venue_name + venue_address** on the event row via the Edit Event UI.
- [ ] **Add real jury** (replace or augment the single demo-jury row). Real jury emails go through the Jury tab → "Add Jury" form.
- [ ] **Set oath_text** on the event row (copy from one of the existing events as a starting template if no Mizoram-specific oath exists yet).

**NICE-TO-HAVES (won't block demo, but improve readiness):**
- [ ] **Prune topics to 5** if the demo should only show 5 of 20 — currently all 20 are flagged `is_central=true` and will appear in the participant view.
- [ ] **Seed checklist** via the Checklist tab button so organizer ops list is populated.
- [ ] **Decide on `central_agenda` text** if the projector view needs a static agenda block; otherwise the agenda state machine + Control tab handle it live.
- [ ] **Add `mycii_payment_link`** if real fee collection runs at the demo (₹399/head). If demo is fee-waived, ignore.
- [ ] **Run allocation engine + lock allocation** once participants + parties land, ideally 24-48h before demo so any errors surface in time.

---

## How visibility was verified

Code path traced in `app/yip/actions/events.ts:263-319` (`getEvent`):

1. `isCurrentUserSuperAdmin()` → returns `true` for users with `app='yip', role IN ('national','super_admin')` in `yi_directory.role_assignments`. Pradeep + Swapnil + Director (cross-app `super_admin`) all PASS.
2. For non-super users, fetches event unfiltered, then checks `created_by === user.id` OR `event.yi_zone_code IN getRegionalAdminZones('yip')`. Poornima's `NER` zone matches event's `NER` → PASS. Other 5 RMs' zones don't match → null event → 403.

DB confirmed via Supabase Management API queries against `yi_directory.role_assignments` joined with `yi_directory.people`.

---

*Audit completed 2026-05-28. Read-only — no data or code modified.*
