# Layer 1 — UI Action Inventory Sweep

**User tested as:** director@jkkn.ac.in (Super Admin, also National Admin badge — Erode chapter scope)
**Production URL:** https://yi-connect-app.vercel.app
**Tool:** Claude-in-Chrome (CFT)
**Sweep window:** 2026-05-24 22:14 → 22:20 IST
**Surface tested:** 6 pages (dashboard + 5 admin pages)

## Important methodology note

Synthetic JS `.click()` does NOT trigger Radix UI tab buttons (confirmed by memory entry `feedback_synthetic_click_misses_modern_ui_libs.md`). All tab/dropdown clicks below used CDP real mouse events via `find` + element ref, NOT JS `.click()`. Where CDP coordinate clicks were used, target rect was off by ~30px (viewport top offset issue); switched to element-ref clicks mid-sweep.

---

## Findings summary

| Page | Total interactive elements | Tested | PASS | FAIL |
|------|---------------------------|--------|------|------|
| /dashboard | 15 (main content row) | 1 sample | 0 | 0 (unverified) |
| /member-requests | 4 tabs | 4 | 4 | 0 |
| /admin/chapters | 22 | 5 actions | 1 | 4 |
| /admin/users | 80 | 3 actions | 0 | 3 |
| /admin/docs | 27 | inventory only | n/a | n/a |
| /admin/impersonation-audit | 11 | inventory only | n/a | n/a |

---

## /dashboard (Quick Actions row — 15 interactives)

Most elements are NAV links to chapter-scoped pages. Only one real button: "Message Yi Group" (dropdown trigger).

| Element | Type | Result |
|---|---|---|
| New Event | a → /events/new | nav (untested) |
| Add Member | a → /members/new | nav (untested) |
| Send Announcement | a → (sanitized URL) | nav (untested) |
| Nominate for Award | a → /awards/nominate | nav (untested) |
| Browse Knowledge Base | a → (sanitized URL) | nav (untested) |
| Message Yi Group | button (dropdown) | Click fired; dropdown state not captured |
| 4 stat cards (Members/Events/Budget/Engagement) | a → scoped pages | nav (untested) |
| 3 feature cards (Stakeholders/Knowledge/Verticals) | a → /stakeholders, /knowledge, /verticals | nav (untested) |
| View all events / Create your first event | a → /events / /events/new | nav (untested) |

---

## /member-requests — PASS

All 4 status tabs (Pending, Approved, Rejected, Withdrawn) switch correctly via CDP click-by-ref:

| Tab | data-state after click | Panel content | Verdict |
|---|---|---|---|
| Pending | active | "No pending applications" | PASS |
| Approved | active | "No approved applications" | PASS |
| Rejected | active | (panel switched, empty state) | PASS |
| Withdrawn | active | (panel switched, empty state) | PASS |

URL does NOT update with ?status=X — tab is purely client state. Minor: deep-linking to a tab via URL won't work.

---

## /admin/chapters — 4 of 5 tested actions FAIL

70 chapters total ("Page 1 of 7"). 22 interactives on first page.

| Action | Expected | Actual | Verdict |
|---|---|---|---|
| Row "Open menu" (chapter 1 Ahmedabad) | Dropdown opens with row actions | Menu opened with `Edit` / `Delete` options | **PASS** |
| Sort header click "Chapter Name" | Rows reorder DESC | Rows unchanged: Ahmedabad → Bengaluru both before and after | **FAIL** — sort header silently does nothing |
| Sort header click "Chapter Name" (2nd click) | Rows reorder ASC | Same — unchanged | **FAIL** — same bug |
| Search input `Erode` | At least 1 row (Erode is a real chapter) | 0 rows | **FAIL** — search filter not matching existing record |
| Pagination "Next page" | Rows for page 2 + status "Page 2 of 7" | Status text updated to "Page 2 of 7" BUT rows still show page-1 data (Ahmedabad → Bengaluru) | **FAIL** — pagination metadata updates, data does not |

Network: no 4xx/5xx errors caught during these actions. The clicks fire but state mutations don't trigger server refetch or display update.

---

## /admin/users — 3 of 3 tested actions FAIL

85 total users, 27 new this month, 8 different roles.

| Action | Expected | Actual | Verdict |
|---|---|---|---|
| Layout render | Full-width main pane (~1080px) like /admin/chapters | Content squeezed into left ~540px of viewport, rest blank white | **FAIL** — CSS/layout regression specific to /admin/users |
| Row "Open menu" (first row Sandbox Test Chair) | Dropdown opens | No menu in DOM after click (`[role=menu][data-state=open]` absent) | **FAIL** — row actions don't open |
| "All Roles" filter button | Dropdown listbox opens with role options | No listbox/menu in DOM after click | **FAIL** — filter dropdown doesn't open |

Same Radix pattern as /admin/chapters which works — so this is page-specific, not library-wide. Possibly a portal/z-index issue inside the half-width layout container.

---

## /admin/docs — inventory only (27 links)

Looks clean. Sidebar of module-doc links (Member Intelligence, Stakeholder CRM, Event Lifecycle, Finance, Succession, Awards, Communication, Knowledge, Vertical, National, Industrial Visits, Opportunities) + main-pane duplicate of same. No interactive bugs surfaced at the inventory level. Deep navigation untested.

---

## /admin/impersonation-audit — inventory only (11 actions)

Stats: 0 total sessions / 0 active / 0 last-7-days / 0 actions logged — empty database. Interactives: search input, 2 date pickers, Apply Filters, Refresh, View, page-size 10, full pagination. Surface looks complete; behaviour untested because no data exists to act on.

---

## Defensive-UI patterns observed

- **Silent client-state-only updates (CRITICAL pattern):** /admin/chapters pagination + sort fall into the "silent failure" bucket from `silent-failure-auditor`. The pagination indicator updates ("Page 2 of 7") but the data does not refetch — user can't tell there's a problem unless they read the rows. This is exactly the rule-25 pattern Server Claude warned about.
- **Layout regression on /admin/users** would only be caught by an eyeball check; HTTP 200 + page-loads probes would PASS.
- **Member-requests tabs WORK** (good) but the tab choice doesn't survive page reload (no URL state) — minor UX.
- Console + network: NO 4xx/5xx fetch errors observed during any of the failing actions. The bugs are silent, not loud.
