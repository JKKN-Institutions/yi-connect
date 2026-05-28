# Schema Drift Audit — yi-connect — 2026-05-28

**Audited by:** Code review agent (Claude Sonnet 4.6)  
**Branch:** `audit/schema-drift`  
**Scope:** All `.from(table).select(columns)` queries across `app/`, `lib/`, `components/`, `contexts/`, `supabase/`  
**Excluded:** `app/yip/`, `app/coordinator/`, `app/chapter-lead/` (in-flight refactor)  
**Live schema ref:** Supabase project `bkmpbcoxbjyafieabxao` (queried via Management API)

---

## Summary Table

| Severity | Count | Auto-Fixed | Needs Human Review |
|----------|-------|------------|-------------------|
| CRITICAL  | 23    | 0          | 23                |
| HIGH      | 97    | 6          | 91                |
| MEDIUM    | 39    | 0          | 39                |
| **Total** | **159** | **6**   | **153**           |

**Total queries audited:** 1,143  
**Total distinct drift hits:** 159  
**Tables not found in live DB:** 28 tables (60 query hits)  
**Column mismatch on existing tables:** 99 query hits

---

## Top 5 Highest-Severity Drifts

### 1. `app/actions/chapter-lead-auth.ts:35` — CRITICAL
**Table:** `yi_connect.sub_chapter_leads`  
**Missing columns:** `password_hash`, `status`, `requires_password_change`  
**Why critical:** This is the sub-chapter lead login auth path. The table was refactored to use member-linked auth (`member_id`, `is_active`) but the auth action still queries the old credential columns. Every sub-chapter lead login attempt fails with a PostgREST 400. Three queries in this file are affected (lines 35, 125, 193). This is the known bug surfaced tonight.

### 2. `app/actions/coordinator-auth.ts:34` — CRITICAL
**Table:** `yi_connect.stakeholder_coordinators`  
**Missing columns:** `requires_password_change`, `role`, `assigned_at`, `assigned_by`  
**Why critical:** Coordinator portal login reads auth credential columns that no longer exist on the table (the table was restructured for chapter-linked coordinators with permission flags). Login is broken for all coordinators.

### 3. `lib/auth.ts:174` — CRITICAL (false positive confirmed safe)
**Table:** `yi_connect.user_roles`  
**"Missing" column:** `role`  
**Actual situation:** Query is `select('role:roles!inner(id, name, hierarchy_level, permissions)')` — a join alias. PostgREST handles this correctly. **Not a real drift.** Parser false positive.

### 4. `lib/push-notification.ts:54,77` + `app/actions/push.ts:62,155,344` — CRITICAL
**Table:** `yi_connect.push_subscriptions`  
**Missing columns:** `id`, `endpoint`, `p256dh`, `auth`, `user_id`, `device_info`  
**Why critical:** The `yi_connect.push_subscriptions` table does not exist in live DB. Push subscriptions in this schema are never stored. The `yi.push_subscriptions` and `future.push_subscriptions` tables exist but use different schemas. Push notifications are silently broken for all yi-connect users.

### 5. `app/api/admin/whoami/route.ts:30,47` + 12 other files — CRITICAL/HIGH
**Tables:** `public.people`, `public.role_assignments`  
**Why critical:** These tables exist in `yi_directory` schema, not `public`. All queries using `public.people` and `public.role_assignments` return empty/null results silently. Affects: `/api/admin/whoami`, admin directory mutations (create/edit/delete people + role assignments), yi-future national admin pages, push notification routing. **12 queries across 7 files** reference these tables with wrong schema prefix.

---

## Auto-Fixes Applied (6 changes across 4 files)

All fixes: `industries.name` → `industries.company_name` (column was renamed in DB, code not updated)

| File | Line | Change |
|------|------|--------|
| `lib/coordinator-auth.ts` | 102 | `.select('name')` → `.select('company_name')`, `industry?.name` → `industry?.company_name` |
| `lib/auth/industry-portal.ts` | 74 | `.select('id, name')` → `.select('id, company_name')`, `.name` → `.company_name` |
| `app/actions/industrial-visits.ts` | 815 | `.select('name')` → `.select('company_name')`, `industry?.name` → `industry?.company_name` |
| `app/actions/industrial-visits.ts` | 971 | `.select('name')` → `.select('company_name')`, `industry?.name` → `industry?.company_name` |
| `app/yi-future/actions/feedback.ts` | 75 | `future.mentors.name` → `full_name` (column renamed in mentors table) |
| `lib/data/health-card-tracking.ts` | 108 | `vertical_activities.title` → `activity_title` (column renamed) |

---

## Full Drift Inventory by Severity

### CRITICAL — Auth/Security/Missing Tables (23 hits)

| File:Line | Schema.Table | Missing Columns | Reason |
|-----------|-------------|-----------------|--------|
| `app/actions/chapter-lead-auth.ts:35` | `yi_connect.sub_chapter_leads` | `password_hash`, `status`, `requires_password_change` | Auth table restructured |
| `app/actions/chapter-lead-auth.ts:125` | `yi_connect.sub_chapter_leads` | `password_hash` | Same |
| `app/actions/chapter-lead-auth.ts:193` | `yi_connect.sub_chapter_leads` | `full_name`, `email` | Same |
| `app/actions/coordinator-auth.ts:34` | `yi_connect.stakeholder_coordinators` | `requires_password_change` | Auth table restructured |
| `lib/coordinator-auth.ts:76` | `yi_connect.stakeholder_coordinators` | `role`, `assigned_at`, `assigned_by` | Same |
| `lib/push-notification.ts:54` | `yi_connect.push_subscriptions` | `id`, `endpoint`, `p256dh`, `auth` | Table missing in yi_connect schema |
| `lib/push-notification.ts:77` | `yi_connect.push_subscriptions` | `id`, `user_id`, `endpoint`, `p256dh`, `auth` | Same |
| `app/actions/push.ts:62` | `yi_connect.push_subscriptions` | `id` | Same |
| `app/actions/push.ts:155` | `yi_connect.push_subscriptions` | `id`, `endpoint`, `device_info`, `created_at`, `last_used` | Same |
| `app/actions/push.ts:344` | `yi_connect.push_notification_logs` | `id` | Table missing |
| `app/api/admin/whoami/route.ts:30` | `public.people` | `id`, `email` | Wrong schema — table is `yi_directory.people` |
| `app/api/admin/whoami/route.ts:47` | `public.role_assignments` | all columns | Wrong schema — table is `yi_directory.role_assignments` |
| `app/admin/directory/actions/directory-reads.ts:333` | `public.role_assignments` | `yi_year` | Wrong schema |
| `app/admin/directory/actions/directory-mutations.ts:182,214,358,436,599,628,651,665` | `public.role_assignments` + `public.people` | multiple | Wrong schema (8 queries) |
| `lib/yi/auth/yi-directory-roles.ts:57,67` | `yi_directory.people/role_assignments` | `id`, `email`, all | Schema exists but table shapes mismatch |
| `app/auth/callback/route.ts:207,228` | `public.delegates`, `public.participants` | all columns | Tables not in public schema |
| `app/yi-future/national/admin/broadcast/page.tsx:43,69` | `yi_directory.people/role_assignments` | `id`, `role` | Schema mismatch |

### HIGH — Core Data Layer (selected key hits, 97 total)

| File:Line | Schema.Table | Missing Columns | Impact |
|-----------|-------------|-----------------|--------|
| `lib/coordinator-auth.ts:101,111` | `yi_connect.industries` | `name` (→ `company_name`) | **FIXED** |
| `lib/coordinator-auth.ts:491,499` | `yi_connect.session_bookings` | `student_count` | Booking session display broken |
| `lib/business-rules.ts:574` | `yi_connect.session_bookings` | `session_date` | Business rule evaluation incorrect |
| `lib/data/reports-quarterly.ts:86` | `yi_connect.event_feedback` | `rating` (→ `overall_rating`) | Quarterly reports show 0 ratings |
| `lib/data/reports-quarterly.ts:157` | `yi_connect.planned_activities` | `ec_members_count`, `non_ec_members_count` | Report numbers wrong |
| `lib/data/trainers.ts:258` | `yi_connect.trainer_profiles` | `session_type_id`, `attendance_count`, `feedback_score` | Trainer matching broken |
| `lib/data/trainer-scoring.ts:220` | `yi_connect.trainer_profiles` | `city`, `eligible_session_types` | Trainer scoring/matching broken |
| `lib/data/session-bookings.ts:653` | `yi_connect.session_bookings` | `attendance_count`, `expected_participants`, `feedback_score` | Booking stats broken |
| `app/actions/events.ts:1519` | `yi_connect.events` | `venue` (→ `venue_id`/`venue_address`) | Event venue display null |
| `app/actions/autopilot.ts:152` | `yi_connect.events` | `venue` | Same |
| `lib/data/users.ts:403` | `yi_connect.profiles` | `is_active` | User stat counts wrong |
| `lib/data/awards.ts:606` | `yi_connect.nominations` | `weighted_score` | Award scoring broken |
| `app/actions/session-bookings.ts:162,230,284,379,440,498` | `yi_connect.session_bookings` | `status_history` | Status history feature broken (6 queries) |

### MEDIUM — App Pages / Non-Core (39 hits, see full JSON)

Key examples:
- `components/national/multi-chapter-overview.tsx:83` — `yi_connect.chapters.status` missing (shows all chapters as active)
- `app/(dashboard)/succession/nominate/page.tsx:69` — `yi_connect.members` missing `first_name`, `last_name`, `email` (succession nomination form broken)
- `app/(dashboard)/admin/users/page.tsx:133` — `yi_connect.roles.location` missing (roles admin page minor display issue)
- `app/(dashboard)/dashboard/page.tsx:258` — `yi_connect.budgets.amount` missing (→ `allocated_amount`)
- `app/(mobile)/m/profile/page.tsx:81` — `yi_connect.members` missing `engagement_score`, `yi_activity_score` (mobile profile shows nulls)

---

## Notable Patterns (Codebase Health Observations)

1. **`public.*` schema confusion:** ~15 queries reference `public.people`, `public.role_assignments`, `public.delegates`, `public.participants`, `public.chapters`, `public.members`, `public.votes` — these live in `yi_directory`, `yip`, or `yi_connect` schemas respectively. This suggests copy-paste from an older schema design where everything was in `public`.

2. **Removed credential columns on auth tables:** Both `sub_chapter_leads` and `stakeholder_coordinators` had `password_hash`/`status`/`requires_password_change` removed (moved to member-linked auth model) but the auth action files still query the old shape. At minimum 2 login portals are broken.

3. **`yi_connect.push_subscriptions` never migrated:** The push notification library was written for `yi_connect` schema but the table was never created there. Push notifications for yi-connect users have never worked in production.

4. **Column renames not propagated:** Several clean renames (`industries.company_name`, `vertical_activities.activity_title`, `mentors.full_name`, `budgets.allocated_amount`) were done in the DB but not reflected in queries. 6 were auto-fixed; ~8 more require context-checking before fixing.

5. **`session_bookings` is heavily drifted:** 10+ queries reference columns that don't exist (`status_history`, `student_count`, `session_date`, `assigned_trainer_id`, `attendance_count`, `feedback_score`). The entire session booking flow likely returns incomplete data or silently drops fields.

---

## Recommended Fix Priority

1. **Immediate:** `chapter-lead-auth.ts` and `coordinator-auth.ts` auth column drift — both login portals broken
2. **Immediate:** `public.people` / `public.role_assignments` schema prefix — admin directory is non-functional  
3. **This sprint:** `push_subscriptions` table creation in `yi_connect` schema OR redirect to correct schema
4. **This sprint:** `session_bookings` column drift — booking workflow data quality severely degraded
5. **Next sprint:** Remaining HIGH hits in data layer libs (reports, trainers, awards)

---

*Auto-fix commit:* see branch `audit/schema-drift`  
*Full machine-readable data:* `/tmp/drift_final.json` (not committed — ephemeral)
