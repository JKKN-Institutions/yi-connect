# BUG-002 Verification Test Protocol

## Bug Summary

**BUG-002: EC Member Can Access Member Requests Page**

| Field | Value |
|-------|-------|
| Bug ID | BUG-002 |
| Severity | High (Authorization Bypass) |
| Component | `/member-requests` page |
| Affected Role | EC Member |
| Test Account | `demo-ec@yi-demo.com` |
| Production URL | https://yi-connect-app.vercel.app/ |

## Current Behavior (BUG)

The `member-requests/page.tsx` has this role check at line 32:

```typescript
await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);
```

**Problem:** `'EC Member'` is included in allowedRoles, but according to the sidebar configuration, EC Members should NOT have access to Member Requests.

### Evidence from Sidebar Config

In `dashboard-sidebar.tsx` line 561-565:

```typescript
{
  name: 'Member Requests',
  href: '/member-requests',
  icon: UserCheck,
  requiredRoles: ['Executive Member', 'Chair', 'Co-Chair', 'EC Member']  // <-- BUG: EC Member included
}
```

**Wait** - the sidebar ALSO has `EC Member` in requiredRoles. This means:
1. EC Member sees "Member Requests" in sidebar (should they?)
2. EC Member can access `/member-requests` page (should they?)

## Role Hierarchy Reference

From `/lib/constants.ts`:

| Role | Hierarchy Level |
|------|----------------|
| Super Admin | 10 |
| National Admin | 7 |
| Executive Member | 5 |
| Chair | 4 |
| Co-Chair | 4 |
| EC Member | 2 |
| Member | 1 |

## Expected Behavior After Fix

There are two possible intents:

### Option A: EC Member Should NOT Access Member Requests
- Remove `'EC Member'` from both:
  - `member-requests/page.tsx` requireRole
  - `dashboard-sidebar.tsx` adminNavigation
- EC Member should see "Access Denied" or redirect to `/unauthorized`
- "Member Requests" should NOT appear in EC Member's sidebar

### Option B: EC Member SHOULD Access Member Requests (Read-Only)
- Current behavior is correct
- Bug should be closed as "Not a Bug"

**Decision Required:** Which is the intended behavior?

---

## Test Verification Steps

### Pre-Test Setup

```bash
# 1. Verify browser-use is available
~/.local/bin/browser-use --version

# 2. Open browser session for EC Member testing
~/.local/bin/browser-use -s ec-verify open https://yi-connect-app.vercel.app/login --headed
```

### Test 1: Login as EC Member

```bash
# Step 1: Check current state
~/.local/bin/browser-use -s ec-verify state

# Step 2: Find and click EC Member demo login button
# Look for element containing "EC Member" or "demo-ec@yi-demo.com"
~/.local/bin/browser-use -s ec-verify click [INDEX]

# Step 3: Wait for redirect to dashboard
~/.local/bin/browser-use -s ec-verify screenshot
```

**Expected:** User lands on `/dashboard` after login

### Test 2: Check Sidebar Visibility

```bash
# Step 1: Get page state to see sidebar
~/.local/bin/browser-use -s ec-verify state

# Step 2: Screenshot the sidebar
~/.local/bin/browser-use -s ec-verify screenshot
```

**Verify:**
- [ ] "Member Requests" link is/is not visible in Administration section
- [ ] Note which menu items EC Member can see

### Test 3: Direct URL Access Test (CRITICAL)

```bash
# Step 1: Navigate directly to member-requests
~/.local/bin/browser-use -s ec-verify navigate https://yi-connect-app.vercel.app/member-requests

# Step 2: Wait 2 seconds for auth check
sleep 2

# Step 3: Screenshot result
~/.local/bin/browser-use -s ec-verify screenshot

# Step 4: Check current URL
~/.local/bin/browser-use -s ec-verify state
```

**Current Behavior (BUG):**
- Page loads successfully
- Shows "Membership Applications" content
- URL remains `/member-requests`

**Expected Behavior After Fix (if Option A):**
- Redirected to `/unauthorized` OR
- Shows "Access Denied" message
- URL changes to `/unauthorized`

### Test 4: Check Console for Errors

```bash
# After navigating to member-requests
~/.local/bin/browser-use -s ec-verify console
```

**Expected:** No auth-related errors if fixed properly

### Test 5: Cleanup

```bash
~/.local/bin/browser-use -s ec-verify close
```

---

## Verification Checklist (Post-Fix)

### If Fix is "Remove EC Member Access":

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Login as EC Member | Success, lands on dashboard | |
| Check sidebar | "Member Requests" NOT visible | |
| Direct URL `/member-requests` | Redirect to `/unauthorized` | |
| Console check | No errors | |

### If Fix is "EC Member Has Read-Only Access":

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Login as EC Member | Success, lands on dashboard | |
| Check sidebar | "Member Requests" visible | |
| Direct URL `/member-requests` | Page loads normally | |
| Try to approve/reject request | Action denied | |

---

## Files to Verify After Fix

```bash
# Check page.tsx has correct roles
grep -n "requireRole" /Users/omm/PROJECTS/yi-connect/app/\(dashboard\)/member-requests/page.tsx

# Check sidebar has matching roles
grep -n "Member Requests" -A 5 /Users/omm/PROJECTS/yi-connect/components/layouts/dashboard-sidebar.tsx
```

## Related Files

| File | Purpose |
|------|---------|
| `/app/(dashboard)/member-requests/page.tsx:32` | Page-level requireRole check |
| `/components/layouts/dashboard-sidebar.tsx:561-565` | Sidebar visibility roles |
| `/lib/auth.ts:132` | `requireRole()` function definition |
| `/lib/constants.ts:15,27` | EC_MEMBER role constant |

---

## Quick Browser Commands Reference

```bash
# Open session
~/.local/bin/browser-use -s ec-verify open https://yi-connect-app.vercel.app/login --headed

# Get element indices
~/.local/bin/browser-use -s ec-verify state

# Click element by index
~/.local/bin/browser-use -s ec-verify click [INDEX]

# Navigate to URL
~/.local/bin/browser-use -s ec-verify navigate [URL]

# Take screenshot
~/.local/bin/browser-use -s ec-verify screenshot

# View console
~/.local/bin/browser-use -s ec-verify console

# Close session
~/.local/bin/browser-use -s ec-verify close
```

---

## Test Execution Log

_To be filled during actual testing_

| Step | Timestamp | Action | Result | Screenshot |
|------|-----------|--------|--------|------------|
| 1 | | Login as EC | | |
| 2 | | Check sidebar | | |
| 3 | | Direct URL access | | |
| 4 | | Console check | | |
| 5 | | Cleanup | | |

---

*Created: 2026-01-25*
*Test Prepper: Claude Agent*
