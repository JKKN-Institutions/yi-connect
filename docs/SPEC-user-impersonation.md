# User Impersonation System - Technical Specification

> **Status**: Draft
> **Created**: 2026-01-04
> **Last Updated**: 2026-01-04
> **Author**: Claude Code
> **Stakeholder**: National Admin

---

## 1. Executive Summary

This document specifies a User Impersonation System for Yi Connect that allows National Admins and Super Admins to temporarily assume the identity of any user in the system. This enables debugging, QA testing, real-time support, and permission verification without requiring access to user credentials.

---

## 2. Business Requirements

### 2.1 Primary Use Cases

| Use Case | Description | Priority |
|----------|-------------|----------|
| **Debugging User Issues** | User reports a problem; admin needs to see their exact view to diagnose | P0 |
| **QA/Release Testing** | Before deploying, verify each role type sees correct data/UI | P0 |
| **Real-time Support** | Help users navigate while seeing what they see | P1 |
| **Permission Verification** | Audit that RLS and role-based access is working correctly | P1 |

### 2.2 Key Decisions (from Interview)

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Action Scope** | Full action capability | Admin can perform any action the user could |
| **Audit Trail** | User attribution with hidden admin log | Actions appear as user, separate audit tracks admin |
| **Session Timeout** | Configurable (15min/30min/1hr/4hr) | Different use cases need different durations |
| **Visual Indicator** | Persistent top banner | Clear but not intrusive |
| **Blocked Actions** | None | Full trust model for National/Super Admin |
| **Who Can Impersonate** | National Admin + Super Admin only | Restricted to highest trust levels |
| **Audit Visibility** | All National Admins can view | Transparency within admin team |
| **Quick-Switch** | Recent list + role cycling | Power user efficiency |

---

## 3. Functional Requirements

### 3.1 User Selection

**FR-001: Role-Based Quick Access**
- Admin selects a role type first (e.g., "Chapter Chair")
- Then selects which specific user of that role to impersonate
- Supports filtering by: Chapter, Region, Vertical

**FR-002: User Search**
- Searchable dropdown within role selection
- Search by: Name, Email, Membership Number
- Shows: User name, chapter, role(s), last active

**FR-003: Recent Users List**
- Quick access to last 10 impersonated users
- Persisted per admin (stored in browser + synced to DB)
- Shows timestamp of last impersonation

**FR-004: Role Cycling**
- When impersonating a user of Role X, can cycle to "next" user of same role
- Example: Viewing as "Chapter Chair of Madurai" → click "Next" → "Chapter Chair of Coimbatore"
- Useful for comparing experience across similar roles

### 3.2 Impersonation Session

**FR-005: Start Impersonation**
- Available from:
  - User detail page (`/admin/users/[id]`) - "Impersonate" button
  - Role-based selector (admin toolbar)
  - Recent users dropdown
- Creates impersonation session record
- Logs audit entry with: admin_id, target_user_id, started_at, reason (optional)

**FR-006: Visual Indicator**
- Persistent banner at top of screen when impersonating
- Shows: "Viewing as [Name] ([Role]) - [Remaining Time] - [End Impersonation]"
- Cannot be dismissed (safety measure)
- Color: Warning yellow/orange for visibility

**FR-007: Navigation While Impersonating**
- All pages render as if the impersonated user is logged in
- RLS policies apply for the impersonated user
- Permission checks use impersonated user's roles
- Exception: Admin-only pages remain accessible (for session management)

**FR-008: Actions While Impersonating**
- All actions execute as the impersonated user
- Database records show impersonated user as actor
- Separate audit log records true actor (admin)

**FR-009: Session Timeout**
- Configurable at session start: 15min, 30min, 1hr, 4hr
- Warning shown at 5 minutes remaining
- Auto-ends when timeout reached
- Admin can extend timeout before expiry

**FR-010: End Impersonation**
- "End Impersonation" button always visible in banner
- Returns to admin's normal session
- Logs: ended_at, duration, pages_visited, actions_taken_count

### 3.3 Audit System

**FR-011: Impersonation Session Log**
- Table: `impersonation_sessions`
- Tracks: who, whom, when, duration, reason
- Accessible to all National Admins

**FR-012: Action Audit Log**
- Table: `impersonation_action_log`
- Every mutation during impersonation logged
- Fields: session_id, action_type, table_affected, record_id, payload_summary
- Not visible in normal activity feeds

**FR-013: Audit Log Viewer**
- Admin page: `/admin/impersonation-audit`
- Filterable by: Admin, Target User, Date Range, Action Type
- Shows session details with expandable action list

**FR-014: Analytics Dashboard**
- Most impersonated users (who needs the most support?)
- Impersonation frequency by admin
- Common actions taken during impersonation
- Session duration distribution

### 3.4 Security

**FR-015: Role Restriction**
- Only users with hierarchy_level ≥ 6 (National Admin) can impersonate
- Super Admin (level 7) can impersonate anyone
- National Admin (level 6) can impersonate users up to level 5

**FR-016: Self-Impersonation Prevention**
- Admin cannot impersonate themselves

**FR-017: Concurrent Session Handling**
- Admin can only have one active impersonation session
- Starting new impersonation ends previous session

---

## 4. Technical Architecture

### 4.1 Implementation Approach

**"Virtual Impersonation" Pattern:**
- Keep admin's Supabase auth session intact
- Store impersonation context in:
  - Cookie: `yi-impersonation-session` (encrypted, httpOnly)
  - Database: `impersonation_sessions` table
- Modify data layer to check impersonation context before fetching

```
[Request Flow]
1. User visits any page
2. Middleware checks for impersonation cookie
3. If present:
   a. Verify session is valid (not expired, matches admin)
   b. Inject impersonated user context
   c. Pass through to page
4. Data fetching uses impersonated user ID for RLS context
5. Actions log to both normal tables AND audit log
```

### 4.2 Database Schema

```sql
-- Impersonation sessions table
CREATE TABLE impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  timeout_minutes INTEGER NOT NULL DEFAULT 30,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT, -- 'manual', 'timeout', 'new_session', 'logout'
  pages_visited INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Action audit log
CREATE TABLE impersonation_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES impersonation_sessions(id),
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL,
  record_id UUID,
  payload_summary JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recent impersonations (for quick access)
CREATE TABLE admin_recent_impersonations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  last_impersonated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  impersonation_count INTEGER DEFAULT 1,
  UNIQUE(admin_id, target_user_id)
);

-- Indexes
CREATE INDEX idx_impersonation_sessions_admin ON impersonation_sessions(admin_id);
CREATE INDEX idx_impersonation_sessions_target ON impersonation_sessions(target_user_id);
CREATE INDEX idx_impersonation_sessions_active ON impersonation_sessions(ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_impersonation_action_log_session ON impersonation_action_log(session_id);
```

### 4.3 RLS Policies

```sql
-- Impersonation sessions: Only National Admin+ can view
CREATE POLICY "National Admin can view impersonation sessions"
ON impersonation_sessions FOR SELECT
USING (get_user_hierarchy_level(auth.uid()) >= 6);

-- Only the impersonating admin can update their session
CREATE POLICY "Admin can update own impersonation session"
ON impersonation_sessions FOR UPDATE
USING (admin_id = auth.uid());

-- Only National Admin+ can start impersonation
CREATE POLICY "National Admin can start impersonation"
ON impersonation_sessions FOR INSERT
WITH CHECK (
  get_user_hierarchy_level(auth.uid()) >= 6
  AND admin_id = auth.uid()
  AND get_user_hierarchy_level(target_user_id) < get_user_hierarchy_level(auth.uid())
);

-- Action log: Only National Admin+ can view
CREATE POLICY "National Admin can view action log"
ON impersonation_action_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM impersonation_sessions s
    WHERE s.id = session_id
    AND get_user_hierarchy_level(auth.uid()) >= 6
  )
);
```

### 4.4 Key Functions

```sql
-- Check if admin can impersonate target user
CREATE OR REPLACE FUNCTION can_impersonate_user(
  impersonator_id UUID,
  target_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Can't impersonate self
  IF impersonator_id = target_id THEN
    RETURN FALSE;
  END IF;

  -- Must be National Admin (6) or Super Admin (7)
  IF get_user_hierarchy_level(impersonator_id) < 6 THEN
    RETURN FALSE;
  END IF;

  -- Can only impersonate users with lower hierarchy level
  IF get_user_hierarchy_level(target_id) >= get_user_hierarchy_level(impersonator_id) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active impersonation session for admin
CREATE OR REPLACE FUNCTION get_active_impersonation(admin_id UUID)
RETURNS TABLE (
  session_id UUID,
  target_user_id UUID,
  target_user_name TEXT,
  target_user_role TEXT,
  started_at TIMESTAMPTZ,
  timeout_minutes INTEGER,
  remaining_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.target_user_id,
    p.full_name,
    (SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = s.target_user_id ORDER BY r.hierarchy_level DESC LIMIT 1),
    s.started_at,
    s.timeout_minutes,
    GREATEST(0, s.timeout_minutes - EXTRACT(EPOCH FROM (now() - s.started_at)) / 60)::INTEGER
  FROM impersonation_sessions s
  JOIN profiles p ON s.target_user_id = p.id
  WHERE s.admin_id = get_active_impersonation.admin_id
  AND s.ended_at IS NULL
  AND s.started_at + (s.timeout_minutes || ' minutes')::INTERVAL > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.5 File Structure

```
yi-connect/
├── app/
│   ├── actions/
│   │   └── impersonation.ts          # Server actions for impersonation
│   ├── (dashboard)/
│   │   └── admin/
│   │       └── impersonation-audit/
│   │           └── page.tsx           # Audit log viewer
│   └── api/
│       └── impersonation/
│           ├── start/route.ts         # Start impersonation API
│           ├── end/route.ts           # End impersonation API
│           └── status/route.ts        # Check impersonation status
├── components/
│   ├── admin/
│   │   ├── impersonation-banner.tsx   # Top banner during impersonation
│   │   ├── impersonation-selector.tsx # Role-based user selector
│   │   ├── recent-impersonations.tsx  # Quick access dropdown
│   │   └── impersonation-analytics.tsx # Analytics dashboard
├── contexts/
│   └── impersonation-context.tsx      # React context for impersonation state
├── hooks/
│   └── use-impersonation.ts           # Hook for impersonation state/actions
├── lib/
│   ├── auth.ts                        # Modified to check impersonation
│   └── data/
│       └── impersonation.ts           # Data fetching for impersonation
├── middleware.ts                       # Modified for impersonation check
├── supabase/
│   └── migrations/
│       └── [timestamp]_impersonation_system.sql
└── types/
    └── impersonation.ts               # Type definitions
```

---

## 5. User Interface Specifications

### 5.1 Impersonation Banner

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Viewing as Ravi Kumar (Chapter Chair - Madurai) │ 25 min remaining │ ← → │ End │
└─────────────────────────────────────────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| Warning icon | Yellow/orange indicator |
| User info | Name + Primary Role + Chapter |
| Time remaining | Countdown timer |
| ← → arrows | Cycle to prev/next user of same role |
| End button | Stop impersonation immediately |

### 5.2 Impersonation Selector

**Step 1: Role Selection**
```
┌─────────────────────────────────────┐
│ Impersonate User                    │
├─────────────────────────────────────┤
│ Select Role Type:                   │
│ ┌─────────────────────────────────┐ │
│ │ ○ Chapter Chair         (12)   │ │
│ │ ○ Co-Chair              (24)   │ │
│ │ ○ Vertical Chair        (48)   │ │
│ │ ○ EC Member             (156)  │ │
│ │ ○ Regular Member        (892)  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancel] [Next →]                   │
└─────────────────────────────────────┘
```

**Step 2: User Selection**
```
┌─────────────────────────────────────┐
│ Select Chapter Chair to Impersonate │
├─────────────────────────────────────┤
│ 🔍 Search users...                  │
├─────────────────────────────────────┤
│ Filter by Chapter:                  │
│ [All Chapters ▼]                    │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ○ Ravi Kumar                   │ │
│ │   Madurai Chapter • Active     │ │
│ │ ○ Priya Sharma                 │ │
│ │   Chennai Chapter • Active     │ │
│ │ ○ Arun Krishnan                │ │
│ │   Coimbatore Chapter • Active  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [← Back] [Start Impersonation]      │
└─────────────────────────────────────┘
```

**Step 3: Timeout Selection**
```
┌─────────────────────────────────────┐
│ Session Settings                    │
├─────────────────────────────────────┤
│ Impersonating: Ravi Kumar           │
│                                     │
│ Session Duration:                   │
│ ○ 15 minutes (Quick check)          │
│ ● 30 minutes (Default)              │
│ ○ 1 hour (Extended testing)         │
│ ○ 4 hours (Deep debugging)          │
│                                     │
│ Reason (optional):                  │
│ ┌─────────────────────────────────┐ │
│ │ Investigating reported issue...│ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancel] [Start Impersonation]      │
└─────────────────────────────────────┘
```

### 5.3 Audit Log Viewer

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Impersonation Audit Log                                          [Export]│
├─────────────────────────────────────────────────────────────────────────┤
│ Filters: [Admin ▼] [Target User ▼] [Date Range ▼] [Action Type ▼]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─ Session #1 ─────────────────────────────────────────────────────────┐│
│ │ Admin: Super Admin (you)                                             ││
│ │ Target: Ravi Kumar (Chapter Chair - Madurai)                         ││
│ │ Started: Today, 2:30 PM • Duration: 12 minutes                       ││
│ │ Reason: Investigating event creation issue                           ││
│ │ Actions: 3 [Expand ▼]                                                ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─ Session #2 ─────────────────────────────────────────────────────────┐│
│ │ Admin: National Admin (Amit)                                         ││
│ │ Target: Priya Sharma (EC Member - Chennai)                           ││
│ │ Started: Yesterday, 4:15 PM • Duration: 45 minutes                   ││
│ │ Reason: QA testing new member features                               ││
│ │ Actions: 8 [Expand ▼]                                                ││
│ └──────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Integration Points

### 6.1 Existing Auth System

| File | Modification |
|------|--------------|
| `lib/auth.ts` | Add `getEffectiveUser()` that checks impersonation context |
| `middleware.ts` | Inject impersonation context from cookie |
| `lib/supabase/server.ts` | Pass impersonated user ID for RLS context |

### 6.2 Server Actions

All existing server actions that check `getCurrentUser()` will automatically use the impersonated user through the modified auth layer. The audit logging is added via a wrapper function.

### 6.3 UI Components

| Component | Integration |
|-----------|-------------|
| `dashboard-header.tsx` | Add impersonation banner slot |
| `user-menu.tsx` | Show impersonated user info, not admin |
| `dashboard-sidebar.tsx` | Use impersonated user's permissions |

---

## 7. Testing Plan

### 7.1 Unit Tests

- `can_impersonate_user()` function with various role combinations
- Session timeout calculations
- Audit log entry creation

### 7.2 Integration Tests

- Start impersonation → verify data visibility changes
- Perform action → verify dual logging (user + audit)
- Session timeout → verify auto-end
- Concurrent session → verify previous session ends

### 7.3 E2E Tests

- Full flow: Login as admin → Impersonate → Navigate → Act → End
- Verify banner visibility across all pages
- Verify role cycling functionality
- Verify audit log accuracy

---

## 8. Security Considerations

### 8.1 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Admin abuse | Comprehensive audit logging, visible to all National Admins |
| Session hijacking | Encrypted httpOnly cookie, server-side session validation |
| Privilege escalation | Can only impersonate users with lower hierarchy level |
| Forgotten impersonation | Visible banner, configurable timeout, auto-end |

### 8.2 Audit Requirements

All impersonation activity is:
- Logged with admin identity (cannot be anonymous)
- Timestamped with server time (cannot be spoofed)
- Immutable (audit logs have no UPDATE/DELETE policies)
- Visible to all National Admins (peer accountability)

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (MVP)
- Database schema & migrations
- Basic start/end impersonation
- Visual banner
- Simple user selector

### Phase 2: Enhanced UX
- Role-based selection flow
- Recent users list
- Configurable timeout
- Session extension

### Phase 3: Audit & Analytics
- Audit log viewer
- Analytics dashboard
- Export functionality
- Action-level logging

---

## 10. Open Questions

None - all requirements clarified during interview.

---

## 11. Appendix

### A. Interview Summary

The following decisions were made during the requirements interview:

1. **All 4 use cases are in scope** - debugging, QA, support, permission verification
2. **Full action capability** - not view-only
3. **User attribution** - actions appear as user, with hidden audit
4. **Role-based selection** - pick role first, then user
5. **Configurable timeout** - 15min/30min/1hr/4hr options
6. **Banner indicator** - persistent top bar
7. **No blocked actions** - full trust model
8. **National/Super admin only** - highest trust levels
9. **Audit visible to all national admins** - peer transparency
10. **Quick-switch enabled** - recent list + role cycling
11. **Complete feature set** - including analytics

### B. Existing Infrastructure

The Yi Connect codebase already has:
- User/role hierarchy (levels 0-7)
- `get_user_hierarchy_level()` function
- RLS policies using hierarchy
- Admin user management at `/admin/users`
- Supabase Auth integration
- Server Actions pattern

---

*Document End*
