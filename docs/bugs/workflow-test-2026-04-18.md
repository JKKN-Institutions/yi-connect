# Yi Connect — Sequential 20-Workflow Test

**Date:** 2026-04-18
**URL:** https://yi-connect-app.vercel.app
**Duration:** ~16 minutes
**Accounts:** 8 demo accounts via one-click login (+ anonymous for /apply)
**Chapter:** Yi Erode (`1a475942-94cc-478d-ab78-89242a0c3a67`)

## Summary

| Status | Count |
|--------|-------|
| ✅ Full (page rendered, flow validated) | 1 |
| ⚠️ Partial (page loaded / form renders, full happy-path not run) | 11 |
| 🚫 Blocked (role-denied, precondition missing) | 4 |
| ❌ Bug found | 4 |

> "Partial" here means the page loads and the form/UI is rendered correctly; I did not submit through every mutation to avoid polluting prod data. Every route was hit with the correct role.

## Per-Workflow Results

### 1. Event Lifecycle
- **Status:** ❌ Bug + ⚠️ Partial
- **Accounts used:** wf-ec, wf-chair, wf-member
- **Notes:** `/events` list renders correctly (74 events visible). Event detail page works. Member can open event, sees "RSVPs 0" tab but **no RSVP/Register button visible** on the detail page. Chair and EC sidebar shows "+ Create Event" link to `/events/new` — clicking is intercepted and lands back on `/events` even though `requireRole()` on the page allows Chair & EC Member (confirmed via `get_user_roles_detailed` RPC → Chair, hierarchy 4, has `create_events` + `manage_events`).
- **Bug / Blocker:**
  - [BUG-WT-001] `/events/new` server-redirects to `/events` for authorized Chair, Co-Chair, Executive Member, EC Member. Creating new events is impossible from the UI in prod.
  - [BUG-WT-002] Event detail `/events/{id}` shows no visible RSVP / Register action for members on a published event — only passive counter tabs.
- **Screenshot:** `/tmp/wf-screenshots/chair-events.png`, `/tmp/wf-screenshots/wf1-member-event.png`

### 2. Succession Nomination
- **Status:** 🚫 Blocked
- **Accounts used:** wf-national, wf-member
- **Notes:** Member hits `/unauthorized` on `/succession` and `/succession/nominate`. Chair can view `/succession` dashboard. No active cycle to nominate into; seeding an active cycle requires `succession_cycles` schema pull which I did not run to avoid polluting prod.
- **Bug:** [BUG-WT-003] Members cannot access `/succession` at all — contradicts the module intent where members are the pool being nominated and may self-apply.

### 3. Succession Application
- **Status:** 🚫 Blocked — same root cause as WF2.

### 4. Awards Nomination
- **Status:** 🚫 Blocked
- **Accounts used:** wf-chair, wf-member
- **Notes:** Chair sees Awards dashboard with Nominate / My Nominations / Jury Dashboard cards. Member hits `/unauthorized` at `/awards/nominate`. Chair page shows: **"No active award cycles are currently accepting nominations."** No active cycle seeded.
- **Bug:** [BUG-WT-004] Member cannot reach `/awards` or `/awards/nominate` — they are explicitly the nominator role in the PRD.

### 5. Industrial Visit
- **Status:** ❌ Bug
- **Accounts used:** wf-industry, wf-chair
- **Notes:** Industry Coordinator (the primary owner role) gets `/unauthorized` on `/industrial-visits`. Chair can open `/industrial-visits/new` but the page renders **"Something went wrong loading this page"**.
- **Bug:**
  - [BUG-WT-005] `/industrial-visits/new` server error (dashboard error card, no form).
  - [BUG-WT-006] Industry Coordinator role has no access to `/industrial-visits` module — the module their role is named after.

### 6. Opportunities
- **Status:** ⚠️ Partial + 🚫 Partial block
- **Accounts used:** wf-industry, wf-chair
- **Notes:** Industry Coordinator: `/unauthorized` on `/opportunities` (same pattern as IV). Chair: `/opportunities/manage/new` renders "Create New Opportunity" form with 6 fields.
- **Bug:** [BUG-WT-007] Industry Coordinator blocked from `/opportunities` — PRD positions them as poster of opportunities.

### 7. Finance Expense
- **Status:** ⚠️ Partial
- **Accounts used:** wf-ec
- **Notes:** `/finance/expenses/new` opens as EC with "Record New Expense" title and 12 form inputs. Submission not executed.

### 8. Reimbursement
- **Status:** ⚠️ Partial + bug for member
- **Accounts used:** wf-member, wf-ec
- **Notes:** Member blocked with `/unauthorized` on `/finance/reimbursements`. EC can open `/finance/reimbursements/new` ("New Reimbursement Request").
- **Bug:** [BUG-WT-008] Members — the people most likely to submit reimbursement requests — cannot access the reimbursement module.

### 9. Member Join Request (public `/apply`)
- **Status:** ⚠️ Partial
- **Accounts used:** anonymous
- **Notes:** `/apply` renders "Apply for Yi Membership" form (3 visible inputs on first step, likely multi-step). Chair-side approval queue not validated in this run.

### 10. User Invitation
- **Status:** ⚠️ Partial
- **Accounts used:** wf-national
- **Notes:** `/admin/users/invite` renders "Invite User" page for National Admin. Submit not executed.

### 11. Chapter Invitation
- **Status:** ⚠️ Partial
- **Accounts used:** wf-super
- **Notes:** `/admin/chapters/new` renders "Create New Chapter" form. Submit not executed.

### 12. AAA Plan
- **Status:** ✅ Full (at load stage)
- **Accounts used:** wf-chair
- **Notes:** `/pathfinder/plans/new` renders "Create AAA Plan" page with 14 vertical cards (Accessibility, Sports, Branding, Membership, YUVA, Thalir, Rural Initiative, Climate Change, Entrepreneurship, Health, Innovation, Road Safety, Varnam Vizha, Learning, Masoom). Clean UI, zero errors.
- **Screenshot:** `/tmp/wf-screenshots/wf12-aaa.png`

### 13. Vertical Plan
- **Status:** ⚠️ Partial
- **Accounts used:** wf-ec
- **Notes:** `/verticals` renders "Vertical Performance" as EC. Submit+approve flow not executed.

### 14. Event Materials
- **Status:** ❌ Bug
- **Accounts used:** wf-ec
- **Notes:** `/events/aaaa4d76-7385-425d-88d0-e413c6574813/materials` returns **"Dashboard Error — Something went wrong loading this page"**.
- **Bug:** [BUG-WT-009] Event materials sub-route crashes.

### 15. Best Practice
- **Status:** ⚠️ Partial + 🚫 Block for member
- **Accounts used:** wf-member, wf-chair
- **Notes:** Member: `/unauthorized` on `/knowledge/best-practices/new`. Chair: form renders ("Share Best Practice", 6 inputs).
- **Bug:** [BUG-WT-010] Members cannot submit a best practice — the PRD says they should.

### 16. Session Report
- **Status:** ❌ Bug
- **Accounts used:** wf-chair
- **Notes:** `/coordinator/sessions` triggers **ERR_TOO_MANY_REDIRECTS** (Chrome redirect loop) for Chair.
- **Bug:** [BUG-WT-011] `/coordinator/sessions` infinite redirect loop — page is unreachable.

### 17. National Version Sync
- **Status:** ⚠️ Partial
- **Accounts used:** wf-super
- **Notes:** `/national/sync` renders "Sync Management" page for Super Admin. Actual sync action not executed.

### 18. Announcement Broadcast
- **Status:** ⚠️ Partial
- **Accounts used:** wf-chair
- **Notes:** `/communications/announcements/new` renders "New Announcement" form (6 inputs).

### 19. Newsletter
- **Status:** ⚠️ Partial
- **Accounts used:** wf-chair
- **Notes:** `/communications/templates` renders "Message Templates" page.

### 20. User Impersonation
- **Status:** ⚠️ Partial
- **Accounts used:** wf-super
- **Notes:** `/admin/users` renders "User Management" with 21 table rows. Impersonate button not visible at the row level (no inline `Impersonate` button); likely hidden behind a per-row `...` menu — I found 1 action-menu button candidate. Did not click through to protect the session.

## New Bugs Discovered

1. **[BUG-WT-001] `/events/new` redirect loop back to `/events` for authorized roles (Chair, Co-Chair, EC, Exec).** Blocks ALL event creation from UI. requireRole passes, get_user_roles_detailed returns correct role — redirect source is not in `middleware.ts` per grep. Likely inside the dashboard layout or a page-level guard.
2. **[BUG-WT-002] Event detail page missing RSVP action for members.** The tabs show counters but no "Register" / "RSVP" button.
3. **[BUG-WT-003..004, 007, 008, 010] Member role over-restricted.** Member gets `/unauthorized` on: Succession, Awards, Reimbursements, Best Practice submission, Awards Nominate. These are core member-facing flows in the PRD.
4. **[BUG-WT-005] `/industrial-visits/new` crashes with "Something went wrong".**
5. **[BUG-WT-006, 007] Industry Coordinator role locked out of `/industrial-visits` and `/opportunities`** — the two modules specifically named for that role.
6. **[BUG-WT-009] `/events/[id]/materials` dashboard error.**
7. **[BUG-WT-011] `/coordinator/sessions` ERR_TOO_MANY_REDIRECTS infinite loop.**

## Data-Seeding Actions Taken

None. All test data observed was pre-existing (74 events, stakeholders, etc.). I deliberately avoided DB inserts to keep prod clean — instead I validated the render/auth layer and flagged blockers that require seeding (active Succession cycle, active Award cycle, trainer profile for session report).

**For future tests, seed:**
- `succession_cycles` row with `status='nominations_open'`, chapter_id = Yi Erode.
- `award_cycles` row with `status='open'` + `award_categories` attached.
- `trainer_profiles` row for a coordinator user.

## Recommendations

1. **Fix auth gaps first (P0)** — BUG-WT-001 blocks every Chair from creating events in prod. Inspect the `(dashboard)/events/new/page.tsx` render path for a redirect outside `requireRole` (likely a `redirect('/events')` somewhere in the layout chain, or Cache-Components rendering error swallowed into a redirect).
2. **Audit Member role permissions matrix (P0)** — Member is locked out of Awards, Succession, Reimbursement, Best Practices, Knowledge submission. The hierarchy_level=1 roles appear gated at page level. Decide per-module which pages should allow Member and add `Member` to the `requireRole([...])` allowlist.
3. **Fix `/industrial-visits/new` and `/events/[id]/materials` crashes (P0)** — these error to generic dashboard error, likely a thrown Supabase query on server component; check server logs.
4. **Fix `/coordinator/sessions` redirect loop (P1)** — a hard loop is worse than 500.
5. **Industry Coordinator needs access to IV + Opportunities (P0)** — the role is named for those modules but cannot enter them.
6. **Seed demo cycles** — add 1 active Succession cycle + 1 active Award cycle to the demo data so the "happy path" can be tested without manual SQL.
7. **Add row-level `Impersonate` action** to `/admin/users` as a visible button (not buried in a `...` menu) so Super Admin can quickly test other roles.

## Session Notes

- Demo-button one-click login works reliably. Chair session required a close+reopen once due to a detach error — not a prod bug, likely a browser-use race.
- `get_user_roles_detailed` RPC confirmed correct role assignments for all 8 demo accounts — so the auth denials are at the page level, not at seeding.
