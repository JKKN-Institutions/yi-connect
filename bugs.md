# Bug Tracking - Yi Connect Demo Accounts

**Testing Date:** 2026-01-23
**Tester:** Claude (Browser-Use Multi-Session)
**URL:** https://yi-connect-app.vercel.app
**Roles Being Tested:** Chair, Co-Chair, EC Member

## Bugs Found

| ID | Description | Role | Severity | Status | Verified |
|----|-------------|------|----------|--------|----------|
| BUG-001 | Chair denied access to User Management | Chair | HIGH | FIXED | ✅ |
| BUG-002 | EC Member denied access to Communication Hub | EC Member | MEDIUM | NEW | ❌ |
| BUG-003 | EC Member denied access to Pathfinder | EC Member | MEDIUM | NEW | ❌ |
| BUG-004 | ALL roles denied access to Member Requests | ALL | HIGH | NEW | ❌ |

## Bug Details

### BUG-001: Chair role denied access to User Management
- **Session/Role:** Chair (demo-chair@yi-demo.com)
- **Found at:** https://yi-connect-app.vercel.app/settings/users
- **Steps to reproduce:**
  1. Login as Chair using demo account
  2. Click "User Management" in sidebar under Administration
  3. Page shows "Access Denied" error
- **Expected:** Chair should have full access to User Management
- **Actual:** "Access Denied - You don't have permission to access this page"
- **Other roles affected:** No (Co-Chair and EC Member correctly don't have access)
- **Severity:** HIGH - Core admin functionality broken
- **Status:** FIXED ✅ VERIFIED IN PRODUCTION
- **Fix:** Added 'Chair' role to requireRole() in all 4 admin/users pages
- **Commit:** 723d374 - fix(admin): grant Chair role access to User Management
- **Verified:** 2026-01-23 - Chair can now access /admin/users with full functionality

### BUG-002: EC Member denied access to Communication Hub
- **Session/Role:** EC Member (demo-ec@yi-demo.com)
- **Found at:** https://yi-connect-app.vercel.app/communication
- **Steps to reproduce:**
  1. Login as EC Member using demo account
  2. Click "Communication Hub" > "Overview" in sidebar
  3. Page shows "Access Denied" error
- **Expected:** EC Member should have access (sidebar shows Communication Hub)
- **Actual:** "Access Denied - You don't have permission to access this page"
- **Other roles affected:** No - Co-Chair and Chair can access Communication Hub
- **Severity:** MEDIUM - Inconsistent permission (shown in sidebar but can't access)
- **Status:** NEW
- **Notes:** Either hide Communication Hub from EC Member sidebar OR grant access

### BUG-003: EC Member denied access to Pathfinder
- **Session/Role:** EC Member (demo-ec@yi-demo.com)
- **Found at:** https://yi-connect-app.vercel.app/pathfinder
- **Steps to reproduce:**
  1. Login as EC Member using demo account
  2. Click "Pathfinder" > "Overview" in sidebar
  3. Page shows "Access Denied" error
- **Expected:** EC Member should have access (sidebar shows Pathfinder)
- **Actual:** "Access Denied - You don't have permission to access this page"
- **Other roles affected:** No - Co-Chair and Chair can access Pathfinder
- **Severity:** MEDIUM - Inconsistent permission (shown in sidebar but can't access)
- **Status:** NEW
- **Notes:** Either hide Pathfinder from EC Member sidebar OR grant access

### BUG-004: ALL roles denied access to Member Requests
- **Session/Role:** ALL (Chair, Co-Chair, EC Member)
- **Found at:** https://yi-connect-app.vercel.app/admin/member-requests
- **Steps to reproduce:**
  1. Login as any demo account
  2. Click "Administration" > "Member Requests" in sidebar
  3. Page shows "Access Denied" error for ALL roles
- **Expected:** At least Chair should have access; others based on permissions
- **Actual:** "Access Denied - You don't have permission to access this page" for ALL
- **Other roles affected:** ALL roles are affected
- **Severity:** HIGH - Core admin functionality broken for all users
- **Status:** NEW
- **Notes:** Need to add appropriate roles to requireRole() in member-requests page

---

## Action Inventory (Step 5.5)

### Chair Role - Sidebar Modules
1. □ Dashboard
2. □ Members (expand submenu)
3. □ Events (expand submenu)
4. □ Finance (expand submenu)
5. □ Stakeholders (expand - 7 types: Schools, Colleges, Industries, NGOs, Government, Vendors, Speakers)
6. □ Industrial Visits (expand submenu)
7. □ Opportunities (expand submenu)
8. □ Communication Hub (expand submenu)
9. □ Awards (expand submenu)
10. □ Knowledge (expand submenu)
11. □ Verticals (expand submenu)
12. □ Pathfinder (expand submenu)
13. □ Succession (expand submenu)
14. □ Settings (expand submenu)
15. □ Administration > Member Requests
16. □ Administration > User Management ← CHAIR ONLY
17. □ Administration > User Guide

### Co-Chair Role - Sidebar Modules (NO User Management)
1. □ Dashboard
2. □ Members
3. □ Events
4. □ Finance
5. □ Stakeholders (7 types)
6. □ Industrial Visits
7. □ Opportunities
8. □ Communication Hub
9. □ Awards
10. □ Knowledge
11. □ Verticals
12. □ Pathfinder
13. □ Succession
14. □ Settings
15. □ Administration > Member Requests
16. □ Administration > User Guide

### EC Member Role - Sidebar Modules (NO User Management, NO Opportunities)
1. □ Dashboard
2. □ Members
3. □ Events
4. □ Finance
5. □ Stakeholders (7 types)
6. □ Industrial Visits
7. □ Communication Hub
8. □ Awards
9. □ Knowledge
10. □ Verticals
11. □ Pathfinder
12. □ Succession
13. □ Settings
14. □ Administration > Member Requests
15. □ Administration > User Guide

---

## Testing Progress
