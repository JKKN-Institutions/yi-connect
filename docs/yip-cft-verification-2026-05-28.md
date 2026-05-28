# YIP Admin CFT Verification — Mizoram Demo Readiness

**Date:** 2026-05-28
**Target:** https://yi-connect-app.vercel.app/yip
**Event:** Mizoram Chapter Round 2026 (`27219472-5d6d-4b77-b6e0-22b77a6eb38b`)
**Tester:** CFT-routed Claude (Default profile, signed in via Chrome → demo-super@yi-demo.com)
**Verdict:** **RED** — three blocking bugs on the Mizoram event detail route. Demo unusable as-is.

---

## A — Anonymous routes

| Route | HTTP | Result | Notes |
|---|---|---|---|
| `/yip` | 200 | PASS | YIP branding intact: saffron→white→green tricolor gradient, Yi/Thalir/CII/Bharat Rising present, "Where Young Voices Shape Tomorrow's India" hero, Organize Event + Join with Access Code CTAs |
| `/yip/join` | 200 | PASS | Access-code entry visible, helpful sub-links "Jury member? Sign in with email" → `/yip/jury/login` and "Organizing an event? Sign in here" → `/yip/login`, plus "One-click demo accounts" link |
| `/yip/login` | 200 | PASS | Organizer Portal with email/password, "Join with access code" fallback, demo-accounts link |
| `/yip/jury/login` | 307 → `/yip/join` | **FAIL — see Bug 1** | Middleware `/yip/jury/*` access-code gate intercepts the public login subroute |
| `/yip/test-login` (anon) | 307 → `/yip/join` | PASS (expected) | Super-admin gated; correct behavior for unauth user |
| `/yip/dashboard` (anon) | 307 → `/yip/login?redirectTo=...` | PASS | OAuth-gated as intended |

## B — Admin routes (Mizoram, authed as demo-super@yi-demo.com)

| Tab / Page | Result | Notes |
|---|---|---|
| `/yip/dashboard` (event list) | **EMPTY** — "No events yet" | Even super-admin sees no events on personal `/yip/dashboard`. Sidebar shows: My Events, Topics, Schools, Zones, Admin |
| `/yip/dashboard/admin` (Pipeline View) | PASS structure | Mizoram Chapter Round 2026 IS visible: Chapter level, Draft status, 0 participants, 4 Jun 2026 |
| **Click "Mizoram Chapter Round 2026" link** | **FAIL — Bug 2** | Link href = `/dashboard/events/<uuid>` (missing `/yip` prefix) → 404 "Page Not Found" |
| `/yip/dashboard/events/27219472-5d6d-4b77-b6e0-22b77a6eb38b` (direct nav) | **FAIL — Bug 3** | Silently redirects to `/yip/dashboard` (My Events empty list). React error #418 (hydration) thrown in console |
| `/yip/dashboard/admin/topics` | PASS | 91 topics total (81 active, 30 central). 11 visible incl. Education, Electronics & IT, Finance, Skill Dev, Road Transport, Health, Environment, Agriculture, Housing, Women & Child, MSME. **F7 PASS:** "Push topics to all chapter events" button visible (top-right, next to "New Topic") |
| Admin tab nav row | PASS | Pipeline, People, Rubrics, Topics, Checklist Template, National Team, Chapter Admins, Seasons, Branding Rules, Moderation all clickable |
| Event-detail tabs (Overview, Checklist, Registrations, Participants, Fees, Parties, Allocation, Jury, Volunteers, Branding, Topics, Questions, Motions, Bills, Control, Media, Scoring, Results, Feedback) | **BLOCKED** | Cannot reach event detail page — all 19 tabs untestable |
| **K verification** (20 central topics auto-attached to Mizoram) | **BLOCKED** | Can't access event Topics tab. Admin Topics Library shows 30 central topics total — auto-attach unverifiable from this layer |
| **F3 verification** (Positions card on /control) | **BLOCKED** | Can't reach control panel |
| **F4 verification** (Special Remarks in jury UI) | **BLOCKED** | Can't reach scoring UI |
| **E verification** (delete gate on /admin/mock-data) | **NOT TESTED** | Avoided per instructions (super-admin would have active buttons, no signal on gate working) |
| **P2 verification** (Participants Import modal) | **BLOCKED** | Can't reach Participants tab |

## C — Mobile / viewport

| Viewport | Result | Notes |
|---|---|---|
| 375x812 (iPhone) `/yip/jury/login` | Resize call returned OK, but screenshot tool captured at 1348x896 regardless. Page itself (desktop view) — single-column access-code card, sub-links readable | Anonymous flow looks mobile-friendly visually |
| 375x812 `/yip/dashboard` | Same desktop-sized capture | Sidebar visible — needs hamburger collapse on real mobile to verify |

**Caveat:** CFT screenshot tool ignores viewport for capture dimensions on this build. Real mobile verification requires DevTools device emulation or a physical phone.

## D — Console errors

| Page | Errors |
|---|---|
| `/yip` | None |
| `/yip/jury/login` | None (before redirect fires) |
| `/yip/login` | None |
| `/yip/dashboard` | None |
| `/yip/dashboard/admin` | None |
| `/yip/dashboard/admin/topics` | None |
| `/yip/dashboard/events/<mizoram-uuid>` (direct) | **React Minified Error #418** (Hydration mismatch — server HTML differs from client). Stack in `ef27bef5d73dccff.js`. See: https://react.dev/errors/418?args[]=HTML |

---

## Bugs found

### BUG 1 — `/yip/jury/login` (D's frictionless jury login) is unreachable in production [HIGH]
- **Route:** `https://yi-connect-app.vercel.app/yip/jury/login`
- **Symptom:** HTTP 307 → `/yip/join`. The new jury-by-email login page never renders.
- **Repro:** `curl -sI https://yi-connect-app.vercel.app/yip/jury/login` → `location: /yip/join`
- **Root cause:** `lib/supabase/middleware.ts` line ~209: `if (pathname.startsWith('/yip/jury'))` enforces yip_session access-code cookie BEFORE checking for the public `/yip/jury/login` subroute. The public exemption list `publicYipPrefixes` (lines 174-179) covers `/yip/join`, `/yip/login`, `/yip/event`, `/yip/test-login` but NOT `/yip/jury/login`.
- **Fix:** Add `'/yip/jury/login'` to `publicYipPrefixes`, OR add an `if (pathname === '/yip/jury/login' || pathname.startsWith('/yip/jury/login/')) return supabaseResponse` exemption before the `/yip/jury` gate.
- **Files:** `lib/supabase/middleware.ts:174-179` and `:201-204`
- **Workaround for demo:** Jury can use the "Sign in with email" link inside `/yip/join` page — that link points to `/yip/jury/login` and gets the same 307. So the workaround does not work either. **No anon access path to frictionless jury login exists today.**

### BUG 2 — Admin Pipeline "Mizoram Chapter Round 2026" link routes to `/dashboard/events/<uuid>` (missing `/yip` prefix) [BLOCKER]
- **Route:** `/yip/dashboard/admin` → click event title in Events table
- **Symptom:** Link href = `https://yi-connect-app.vercel.app/dashboard/events/27219472-5d6d-4b77-b6e0-22b77a6eb38b` → 404 "Page Not Found"
- **Expected:** `https://yi-connect-app.vercel.app/yip/dashboard/events/27219472-5d6d-4b77-b6e0-22b77a6eb38b`
- **Repro:** Login `/yip/dashboard/admin`, click any event title link.
- **Root cause:** The event row link in the Admin Pipeline table is constructed without the `/yip` prefix. Likely `app/yip/dashboard/admin/page.tsx` or a shared `EventRow` component using `<Link href={`/dashboard/events/${id}`}>` instead of `/yip/dashboard/events/...`.
- **Fix:** Grep for `dashboard/events/${` in `app/yip/dashboard/admin/` and prepend `/yip`.

### BUG 3 — `/yip/dashboard/events/<mizoram-uuid>` silently redirects to `/yip/dashboard` and throws React error #418 [BLOCKER]
- **Route:** Direct navigation to the Mizoram event detail URL.
- **Symptom:**
  1. URL silently rewrites to `/yip/dashboard` (My Events empty list).
  2. React Minified Error #418 (hydration mismatch — server HTML ≠ client) in console.
  3. demo-super@yi-demo.com cannot reach the event detail page even though the event exists and shows in the admin pipeline.
- **Repro:** Authed session → navigate to `/yip/dashboard/events/27219472-5d6d-4b77-b6e0-22b77a6eb38b`.
- **Possible causes:**
  (a) RLS or access-check on the event detail page that fails for demo-super's chapter scope → uses `redirect()` instead of returning 404/403 + a user-facing error.
  (b) The event-detail page's server component returns a redirect for non-Mizoram-chapter users; demo-super is presumably scoped to Erode.
  (c) Hydration mismatch suggests server/client divergence on the redirect path itself.
- **Impact:** Even if Bug 2 is fixed, organizers from other chapters (or super-admins viewing the platform-wide pipeline) cannot drill into a chapter's event.
- **Fix:** Audit `app/yip/dashboard/events/[id]/page.tsx` (and its layout) for any `redirect()` calls that fire when the user's chapter doesn't match the event's chapter. Super-admin (role='national' + 'super') should bypass chapter scoping. Surface a "You don't have access to this event" page instead of silent redirect.

---

## Blocked-on items

| Verification | Reason | Required action |
|---|---|---|
| K (20 ministry topics on Mizoram) | Can't open event detail | Fix Bug 2 + Bug 3 first |
| F3 (Positions card) | Can't open /control | Fix Bug 2 + Bug 3 |
| F4 (Special Remarks checkboxes) | Can't open scoring UI | Fix Bug 2 + Bug 3, then need at least 1 jury + 1 participant |
| E (delete gate on /admin/mock-data) | Not tested per instructions (super has active state by design) | Test with non-super account |
| P2 (Participants Import modal) | Can't open Participants tab | Fix Bug 2 + Bug 3 |
| All 19 event-detail tabs (Overview through Feedback) | Can't open event detail | Fix Bug 2 + Bug 3 |
| Real mobile viewport rendering | CFT screenshot tool ignored resize_window | Use physical device or DevTools emulation |

---

## Notes for the June 4-5 demo

**Single biggest blocker:** The Mizoram event detail page is unreachable. The link in the only place the event surfaces in the UI (Admin Pipeline) routes to a non-existent yi-connect URL, and even the correct YIP URL silently bounces super-admin back to an empty My Events list. **0 of the 19 event-detail tabs (Overview, Participants, Topics, Allocation, Jury, Control, Scoring, Results, etc.) can be opened by anyone today.**

**Recommended pre-demo sequence (in order):**
1. **Fix Bug 2** (one-line link prefix in admin pipeline event row) — 5 min, unblocks the click path.
2. **Fix Bug 3** (chapter-scope redirect on event detail for super-admin) — likely 30-60 min, unblocks viewing.
3. **Fix Bug 1** (add `/yip/jury/login` to middleware public list) — 5 min, unblocks frictionless jury login that D shipped.
4. Re-run this verification in full with all 19 tabs.

**What works well:**
- Anonymous routes (landing, join, login) — branding correct, mobile-friendly visually, no console errors.
- Admin Topics Library — F7 push button visible, 91 topics seeded (30 central confirms K's seeding ran for the library at minimum).
- Admin Pipeline view — finds Mizoram event row correctly.
- Sidebar / Admin tab nav structure — all expected tabs present.
- Console clean on all reachable pages except the broken event-detail navigation.

---

## Screenshots

CFT screenshot tool saved screenshots inline by ID (`ss_*`); these IDs are session-scoped and do not persist to disk. Re-running this verification will produce fresh IDs. Key screenshots captured this session:
- `ss_1526ym4b5` — /yip landing
- `ss_57233ozup` — /yip/jury/login redirected (shows /yip/join page)
- `ss_9908s6d5f` — /yip/login organizer portal
- `ss_8006i5mh8` — /yip/dashboard (My Events empty, signed in as demo-super)
- `ss_1545d85r2` — /yip/dashboard/admin/topics (Topics Library Admin, 91 topics, F7 push button visible)
- `ss_7222mwbgi` — /yip/dashboard/admin (Pipeline View, Mizoram event row visible)
- `ss_33685p44n` — 404 Page Not Found (broken admin pipeline link routing to /dashboard/events/<uuid>)
- `ss_06889c4p8` — /yip/dashboard/events/<mizoram-uuid> silent redirect back to /yip/dashboard

For persistent screenshot capture in future runs, save_to_disk behavior needs investigation — the flag returned OK but no files were found on disk in standard locations.

---

**Local commit context:** yi-connect HEAD at verification time: `8107b41d` (master branch).
**Production deployment served:** `dpl_5jN2W4rj7sKYHZqmafiBGZXodEtJ` (Vercel ID `bom1::psh7w-1779947252108-2962cfa51eb6`).
