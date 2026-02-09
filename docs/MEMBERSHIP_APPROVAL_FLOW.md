# Membership Approval Flow - Complete Implementation Guide

## Overview

The Yi Connect membership approval system is now fully implemented with automatic profile and member record creation. This document explains the complete flow from application to first login.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Public Application                                      │
│  Route: /apply                                                   │
│  Action: submitMemberRequest()                                   │
│  Result: Record created in member_requests table (status='pending')│
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Admin Review                                           │
│  Route: /member-requests                                         │
│  UI: MemberRequestsTable component                              │
│  Actions: View Details | Approve | Reject                       │
└───────────────────┬─────────────────────────────────────────────┘
                    │
      ┌─────────────┴─────────────┐
      │                           │
      ▼ APPROVE                   ▼ REJECT
┌─────────────────────┐   ┌─────────────────────┐
│ approveMemberRequest│   │ rejectMemberRequest │
│ - Add to whitelist  │   │ - Update status     │
│ - Update status     │   │ - Add rejection note│
│ - Send email (TODO) │   │ - Send email (TODO) │
└──────────┬──────────┘   └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Email Whitelisted                                      │
│  Table: approved_emails                                          │
│  Fields:                                                         │
│    - email (for OAuth check)                                    │
│    - member_request_id (links to application)                   │
│    - assigned_chapter_id (chapter assignment)                   │
│    - approved_by (admin who approved)                           │
│    - is_active = TRUE                                           │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: User Logs In with Google OAuth                         │
│  Route: /api/auth/callback/google                               │
│  Trigger: on_auth_user_created                                  │
│  Function: handle_new_user()                                    │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Automatic Account Creation                             │
│  (All happens in handle_new_user() trigger)                     │
│                                                                  │
│  ✅ Check email in approved_emails whitelist                     │
│  ✅ Create profile record                                        │
│  ✅ Assign "Member" role                                         │
│  ✅ Fetch data from member_requests table                        │
│  ✅ Create member record with application data                   │
│  ✅ Update approved_emails (mark member_created=TRUE)            │
│  ✅ Update member_requests (link created_member_id)              │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: User Redirected to Dashboard                           │
│  Route: /dashboard                                              │
│  Status: Full access with profile + member record               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. member_requests Table
```sql
-- Stores membership applications
CREATE TABLE member_requests (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  -- Professional info
  company TEXT,
  designation TEXT,
  industry TEXT,
  years_of_experience INTEGER,
  linkedin_url TEXT,
  -- Personal info
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  -- Application info
  motivation TEXT NOT NULL,
  how_did_you_hear TEXT,
  preferred_chapter_id UUID REFERENCES chapters(id),
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_member_id UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. approved_emails Table
```sql
-- Email whitelist for OAuth
CREATE TABLE approved_emails (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  approved_by UUID NOT NULL REFERENCES auth.users(id),
  member_request_id UUID REFERENCES member_requests(id),
  assigned_chapter_id UUID REFERENCES chapters(id),
  is_active BOOLEAN DEFAULT TRUE,
  -- First login tracking
  first_login_at TIMESTAMPTZ,
  member_created BOOLEAN DEFAULT FALSE,
  created_member_id UUID REFERENCES members(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. profiles Table
```sql
-- User profiles (created on first login)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  chapter_id UUID REFERENCES chapters(id),
  approved_email_id UUID REFERENCES approved_emails(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. members Table
```sql
-- Member records (created on first login)
CREATE TABLE members (
  id UUID PRIMARY KEY REFERENCES profiles(id),
  chapter_id UUID REFERENCES chapters(id),
  membership_number TEXT UNIQUE,
  member_since DATE DEFAULT CURRENT_DATE,
  membership_status TEXT DEFAULT 'active',
  -- Professional info
  company TEXT,
  designation TEXT,
  industry TEXT,
  years_of_experience INTEGER,
  linkedin_url TEXT,
  -- Personal info
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  -- Additional fields
  avatar_url TEXT,
  renewal_date DATE,
  membership_type TEXT DEFAULT 'individual',
  family_count INTEGER DEFAULT 0,
  languages TEXT[],
  willingness_level INTEGER,
  vertical_interests TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Components

### 1. Public Application Form
**File:** `app/(public)/apply/page.tsx`
**Component:** `components/members/member-form.tsx` (mode='apply')

Features:
- Multi-step form (4 steps)
- Fields: Basic Info, Professional, Personal, Motivation
- Client-side validation
- Submits to `submitMemberRequest()` server action

### 2. Admin Review Dashboard
**File:** `app/(dashboard)/member-requests/page.tsx`
**Component:** `components/member-requests/member-requests-table.tsx`

Features:
- Tabbed interface (Pending, Approved, Rejected, Withdrawn)
- View application details
- Approve with optional notes
- Reject with required notes
- Pagination support

Server Actions:
- `getMemberRequests()` - Fetch applications with filters
- `getMemberRequestById()` - Fetch single application
- `approveMemberRequest()` - Approve and whitelist
- `rejectMemberRequest()` - Reject with notes

### 3. Database Trigger
**Function:** `handle_new_user()`
**Trigger:** `on_auth_user_created`

Executes automatically when user logs in with Google OAuth:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

The trigger:
1. Checks if email is in `approved_emails` whitelist
2. Blocks unauthorized users
3. Creates profile with chapter assignment
4. Assigns default "Member" role
5. Fetches application data from `member_requests`
6. Creates member record with all application data
7. Updates tracking fields

---

## Server Actions Reference

### submitMemberRequest(formData: FormData)
**Access:** Public (anonymous users)
**File:** `app/actions/member-requests.ts`

```typescript
// Validates and stores membership application
export async function submitMemberRequest(formData: FormData): Promise<FormState> {
  // Validate with Zod schema
  // Check for duplicate applications
  // Insert into member_requests table
  // Return success/error
}
```

### approveMemberRequest(requestId: string, notes?: string)
**Access:** Executive Member and above
**File:** `app/actions/member-requests.ts`

```typescript
// Approves application and adds to whitelist
export async function approveMemberRequest(requestId: string, notes?: string): Promise<FormState> {
  // Verify request exists and is pending
  // Check for duplicate approval
  // Add email to approved_emails whitelist
  // Update member_requests status
  // Send approval email (TODO)
  // Invalidate caches
}
```

### rejectMemberRequest(requestId: string, notes: string)
**Access:** Executive Member and above
**File:** `app/actions/member-requests.ts`

```typescript
// Rejects application with notes
export async function rejectMemberRequest(requestId: string, notes: string): Promise<FormState> {
  // Verify request exists and is pending
  // Update status to 'rejected'
  // Save rejection notes
  // Send rejection email (TODO)
  // Invalidate caches
}
```

---

## Security & Permissions

### Row Level Security (RLS) Policies

#### member_requests table:
- ✅ **INSERT:** Anyone (anon + authenticated)
- ✅ **SELECT:** Own requests (by email) OR Executive Members+
- ✅ **UPDATE:** Executive Members and above
- ❌ **DELETE:** Not allowed

#### approved_emails table:
- ✅ **SELECT:** Own email OR Executive Members+
- ✅ **INSERT/UPDATE:** Executive Members and above
- ❌ **DELETE:** Not allowed

#### members table:
- ✅ **SELECT:** Own record OR same chapter members
- ✅ **INSERT:** Self OR Co-Chair and above
- ✅ **UPDATE:** Own record OR Co-Chair and above (same chapter)
- ✅ **DELETE:** Co-Chair and above (same chapter)

### User Roles Hierarchy
1. **Member** (level 1) - Basic access
2. **EC Member** (level 2) - View chapter data
3. **Co-Chair** (level 3) - Manage chapter members
4. **Chair** (level 4) - Full chapter control
5. **Executive Member** (level 5) - Review applications, cross-chapter access
6. **National Admin** (level 6) - System-wide access

---

## Testing Checklist

### ✅ Application Submission
- [ ] Public can access /apply page
- [ ] Form validates required fields
- [ ] Application saves to database
- [ ] Success message displayed
- [ ] Duplicate email rejected

### ✅ Admin Review
- [ ] /member-requests accessible to Executive Members+
- [ ] Pending applications visible
- [ ] View details shows complete application
- [ ] Approve adds to whitelist
- [ ] Reject requires notes
- [ ] Status updates correctly

### ✅ First Login
- [ ] Approved user can login with Google
- [ ] Unauthorized user blocked
- [ ] Profile created with chapter assignment
- [ ] Member record created with application data
- [ ] User redirected to dashboard
- [ ] Dashboard shows member data

---

## Future Enhancements

### 📧 Email Notifications (TODO)
- [ ] Send welcome email on application submission
- [ ] Send approval email with login link
- [ ] Send rejection email (optional)

### 🔔 Admin Alerts
- [ ] Notify admins of new applications
- [ ] Dashboard widget for pending count
- [ ] Weekly digest of pending applications

### 📊 Analytics
- [ ] Application conversion rate
- [ ] Average approval time
- [ ] Applications by chapter
- [ ] Rejection reasons analysis

### ✨ Additional Features
- [ ] Bulk approve/reject
- [ ] Export applications to CSV
- [ ] Application comments/discussion
- [ ] Applicant interview scheduling

---

## Error Handling

### Common Errors & Solutions

#### "Email is not authorized"
**Cause:** User trying to login before admin approval
**Solution:** Apply at /apply first, wait for admin approval

#### "This email is already approved"
**Cause:** Admin trying to re-approve an email
**Solution:** Check approved_emails table

#### "Request is already approved"
**Cause:** Admin trying to approve already processed request
**Solution:** Refresh page to see current status

#### "new row violates row-level security policy"
**Cause:** RLS blocking insert/update
**Solution:** Check user permissions and RLS policies

---

## Maintenance

### Database Cleanup

```sql
-- Remove old rejected applications (older than 6 months)
DELETE FROM member_requests
WHERE status = 'rejected'
  AND reviewed_at < NOW() - INTERVAL '6 months';

-- Remove old withdrawn applications
DELETE FROM member_requests
WHERE status = 'withdrawn'
  AND updated_at < NOW() - INTERVAL '6 months';
```

### Monitoring Queries

```sql
-- Pending applications count
SELECT COUNT(*) FROM member_requests WHERE status = 'pending';

-- Approval rate
SELECT
  COUNT(CASE WHEN status = 'approved' THEN 1 END) * 100.0 / COUNT(*) as approval_rate
FROM member_requests
WHERE status IN ('approved', 'rejected');

-- Average approval time
SELECT AVG(reviewed_at - created_at) as avg_approval_time
FROM member_requests
WHERE status = 'approved';
```

---

## Conclusion

The membership approval system is now fully implemented with automatic profile and member record creation. The system provides a seamless flow from application to first login, with proper admin controls and security policies in place.

For questions or issues, please check the codebase documentation or contact the development team.
