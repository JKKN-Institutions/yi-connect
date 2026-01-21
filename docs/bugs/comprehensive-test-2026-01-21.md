# Bug Tracking - Comprehensive Feature Test

**Testing Date:** 2026-01-21
**Tester:** Claude
**Application:** Yi Connect
**Base URL:** http://localhost:3000

## Features Under Test

1. Bulk User Deactivation (`/admin/users`)
2. Industry Portal Settings (`/industry-portal/settings`)
3. Member Engagement Metrics (`/members/[id]`)
4. IV Industry Analytics (`/industrial-visits/analytics`)
5. Communication Analytics (`/communications/analytics`)
6. Impersonation System (`/admin/users` → Impersonate)
7. Pathfinder Dashboard (`/pathfinder`)

## Bugs Found

| ID | Description | Severity | Status | Fix Agent | Verified |
|----|-------------|----------|--------|-----------|----------|
| BUG-001 | ALL "Add Member" buttons/links navigate to member profile instead of Add Member form (SYSTEMIC) | **HIGH** | Open | - | - |
| BUG-002 | `/opportunities/new` page crashes with Server Component render error | **HIGH** | Open | - | - |
| BUG-003 | Awards Admin - All `/new` routes return 404 (SYSTEMIC) | **HIGH** | Open | - | - |
| BUG-004 | `/awards/my-nominations` returns 404 - Cannot view own nominations | **MEDIUM** | Open | - | - |
| BUG-005 | Pathfinder Health Card - Log Activity fails with "Chapter Not Found" | **HIGH** | Open | - | - |
| BUG-006 | Succession - Nominate a Member page crashes (Zod schema error) | **HIGH** | Open | - | - |
| BUG-007 | Succession - Multiple routes return 404 (SYSTEMIC) | **HIGH** | Open | - | - |

## Bug Details

### BUG-001: ALL "Add Member" Buttons/Links Misdirect (SYSTEMIC)
- **Severity:** HIGH (blocks core functionality)
- **Affected Locations:**
  1. Dashboard (`/dashboard`) - "Add Member" quick action button
  2. Members page (`/members/table`) - "Add Member" header button
  3. Members sidebar - "Add Member" navigation link
- **Action:** Click any "Add Member" button/link
- **Expected:** Navigate to Add Member form (`/members/new`)
- **Actual:** Navigates to an existing member's profile page (`/members/a2cebaf8-42cd-450d-925e-5ba178fa1cca`)
- **Screenshots:** ss_8126x28wz (dashboard), ss_417525xbs (members page)
- **Console:** Clean (no errors)
- **Root Cause:** Likely hardcoded member ID or incorrect href in component

### BUG-002: Post New Opportunity Page Crashes (Zod Schema Error)
- **Severity:** HIGH (blocks core functionality)
- **Affected URLs:**
  - `/opportunities/new` (sidebar link)
  - `/opportunities/manage/new` (button from Manage page)
- **Action:** Navigate to any "Create Opportunity" page
- **Expected:** Form to create new opportunity
- **Actual:** "Dashboard Error - Something went wrong loading this page"
- **Console Errors:**
  ```
  Error: .partial() cannot be used on object schemas containing refinements
  at Module.ea (...ba08d327b3dfc206.js:1:39086)
  at e.partial (...ba08d327b3dfc206.js:37:36045)
  ```
- **Root Cause:** Zod v4 schema validation error - `.partial()` is being called on an object schema that contains `.refine()` or `.superRefine()`. This is a known Zod incompatibility.
- **Fix:** Remove refinements before calling `.partial()`, create separate schema, or restructure the opportunity form schema

### BUG-003: Awards Admin - All Creation Pages Missing (SYSTEMIC 404)
- **Severity:** HIGH (blocks ALL award management)
- **Affected URLs:**
  - `/awards/admin/cycles/new` - Cannot create award cycles
  - `/awards/admin/categories/new` - Cannot create award categories
- **Action:** Click any "New" or "Create" button in Awards Admin section
- **Expected:** Form to create new item
- **Actual:** 404 Page Not Found
- **Screenshots:** ss_1547wmbvm (cycles/new), ss_3338ww45w (categories/new)
- **Console:** Clean (no errors)
- **Root Cause:** The `/new` routes don't exist in Awards admin section. Either:
  1. Pages not created yet
  2. Should use modal-based creation (design issue)
  3. Missing page.tsx files for both routes

### BUG-004: My Nominations Page Missing (404)
- **Severity:** MEDIUM (blocks user functionality)
- **Affected URL:** `/awards/my-nominations`
- **Action:** Click "My Nominations" in Awards sidebar
- **Expected:** List of user's submitted nominations
- **Actual:** 404 Page Not Found
- **Screenshot:** ss_4827kdoyh

### BUG-005: Pathfinder Health Card - Log Activity Fails (Chapter Not Found)
- **Severity:** HIGH (blocks core Pathfinder functionality)
- **Affected URLs:**
  - `/pathfinder/health-card/new` (Log Activity)
  - `/pathfinder/plans/new` (Create AAA Plan - shows similar chapter association error)
- **Action:** Click "Log Activity" button from Health Card page
- **Expected:** Form to log new activity for the chapter
- **Actual:** Shows "Chapter Not Found - Unable to load chapter information"
- **Screenshot:** ss_73977zi31
- **Console:** Clean (no errors)
- **Context:** User is logged in as "Chair" at Yi DemoChapter. Health Card listing page (`/pathfinder/health-card`) works and shows "0 entries for your chapter", meaning chapter IS found on listing page but NOT on /new page.
- **Root Cause:** Data fetching inconsistency - listing page finds chapter but form page doesn't. Likely different data fetching logic or missing chapter context.

### BUG-006: Succession - Nominate a Member Page Crashes (Zod Schema Error)
- **Severity:** HIGH (blocks core succession functionality)
- **Affected URL:** `/succession/nominate`
- **Action:** Click "Nominate a Member" quick action from Succession overview
- **Expected:** Form to nominate a member for leadership
- **Actual:** "Dashboard Error - Something went wrong loading this page"
- **Screenshot:** ss_7415wbbi6
- **Console Errors:**
  ```
  Error: .omit() cannot be used on object schemas containing refinements
  at Module.et (...1d9217ab594a6e8a.js:1:37907)
  at e.omit (...1d9217ab594a6e8a.js:37:37789)
  ```
- **Root Cause:** Zod v4 schema validation error - `.omit()` is being called on an object schema that contains `.refine()` or `.superRefine()`. Same root cause as BUG-002 (.partial() issue).
- **Fix:** Remove refinements before calling `.omit()`, or restructure the nomination form schema

### BUG-007: Succession - Multiple Routes Return 404 (SYSTEMIC)
- **Severity:** HIGH (blocks multiple succession features)
- **Affected URLs:**
  - `/succession/my-nominations` - Cannot view nominations I've submitted
  - `/succession/nominations-for-me` - Cannot view nominations I've received
  - `/succession/cycles` - Cannot manage succession cycles
  - `/succession/positions` - Cannot view/manage positions
- **Action:** Click "View All" links from Succession overview or navigate directly
- **Expected:** Respective listing/management pages
- **Actual:** 404 Page Not Found for all above routes
- **Screenshots:** ss_12119j53e (my-nominations), ss_30409wf2p (nominations-for-me), ss_675425lcm (cycles), ss_3527k1zwi (positions)
- **Console:** Clean (no errors)
- **Working Pages:**
  - `/succession` - Overview works
  - `/succession/eligibility` - Works (shows eligibility status)
  - `/succession/apply` - Works (correctly shows "Applications Not Yet Open")
- **Root Cause:** Missing page.tsx files for these routes. The module skeleton exists but many sub-pages haven't been implemented.

## Test Results Summary

### Modules Tested

| Module | Status | Key Issues |
|--------|--------|------------|
| Dashboard | ✅ PASS | Quick actions work (except Add Member - BUG-001) |
| Members | ⚠️ PARTIAL | List/detail work, Add Member broken (BUG-001) |
| Events | ✅ PASS | List, details, materials work |
| Finance | ✅ PASS | Budgets, expenses, reimbursements work |
| Stakeholders | ✅ PASS | All entity types work |
| Industrial Visits | ✅ PASS | List, analytics work |
| Opportunities | ⚠️ PARTIAL | List works, /new crashes (BUG-002) |
| Communication Hub | ✅ PASS | Announcements, analytics work |
| Awards | ⚠️ PARTIAL | Scoring works, admin /new 404s (BUG-003, BUG-004) |
| Knowledge Base | ✅ PASS | Documents, wiki work |
| Verticals | ✅ PASS | Performance tracking works |
| Pathfinder | ⚠️ PARTIAL | Dashboards work, forms fail (BUG-005) |
| Succession | ⚠️ PARTIAL | Overview works, most pages 404/crash (BUG-006, BUG-007) |
| Settings | ✅ PASS | Profile settings works |

### Bug Summary by Category

| Category | Count | Bugs |
|----------|-------|------|
| Zod v4 Schema Errors | 2 | BUG-002, BUG-006 |
| Missing Routes (404) | 3 | BUG-003, BUG-004, BUG-007 |
| Misdirected Links | 1 | BUG-001 |
| Data Fetching Issues | 1 | BUG-005 |

### Priority Fix Order

1. **BUG-001** (Add Member misdirection) - Blocks member creation
2. **BUG-002 + BUG-006** (Zod schema errors) - Same root cause, fix together
3. **BUG-005** (Chapter Not Found) - Blocks Pathfinder data entry
4. **BUG-003 + BUG-004 + BUG-007** (Missing 404 routes) - Create page files

---
*Testing started: 2026-01-21 07:26 AM*
*Testing completed: 2026-01-21 08:45 AM*
*Total bugs found: 7*
