# Bug Tracking - Yi Connect Demo Accounts

**Testing Date:** 2026-01-23
**Tester:** Claude (Browser-Use Multi-Session)
**URL:** https://yi-connect-app.vercel.app
**Roles Being Tested:** Chair, Co-Chair, EC Member

## Bugs Found

| ID | Description | Role | Severity | Status | Verified |
|----|-------------|------|----------|--------|----------|
| BUG-001 | Chair denied access to User Management | Chair | HIGH | FIXED | ✅ |

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
