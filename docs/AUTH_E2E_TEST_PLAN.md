# Auth End-to-End Test Plan

Manual test plan a non-coder Director can run after Phase B code rewire (2026-05-22).

## Prerequisites

- Dev server running locally: `npm run dev` from `/Users/omm/PROJECTS/yi-connect`
- Browser open at `http://localhost:3000`
- Google account for `director@jkkn.ac.in` available
- Director's email already seeded in `yi_connect.approved_emails` (done in migration `20260522000022`)

## Test 1 — Cross-app signup does NOT break

**Why:** The `yi_connect.handle_new_user()` trigger on `auth.users` was patched to be non-blocking. Need to confirm YIP and YiFuture signups still work.

**Steps:**
1. Open YIP app (`/Users/omm/PROJECTS/YIP`) and run its dev server on a different port (`PORT=3001 npm run dev`).
2. Sign in as a YIP student (or test account whose email is NOT in `yi_connect.approved_emails`).
3. Expected: YIP creates its own profile row in `public.*`. No exception. No "Email not authorized" error.

**Pass criteria:** YIP user signs in successfully. Check `yi_connect.profiles` — no row created for the YIP user.

If this fails: the trigger is still blocking. Re-verify migration `20260522000022` was applied.

## Test 2 — Director can sign into yi-connect

**Steps:**
1. Go to `http://localhost:3000/login`
2. Click "Sign in with Google"
3. Authenticate as `director@jkkn.ac.in`

**Expected after sign-in:**
- Redirected to `/dashboard` (or `/onboarding` if profile is fresh)
- A row appears in `yi_connect.profiles` with director's auth.users.id
- A row appears in `yi_connect.user_roles` IF a `Member` role exists in `yi_connect.roles` (currently empty — see TODO in PHASE_B_FOLLOWUP.md)

**Verify via Supabase SQL editor:**
```sql
SELECT id, email, chapter_id FROM yi_connect.profiles WHERE email = 'director@jkkn.ac.in';
SELECT first_login_at, member_created FROM yi_connect.approved_emails WHERE email = 'director@jkkn.ac.in';
```

`first_login_at` should be set to ~now; `member_created` should be true.

## Test 3 — Unauthorized email is silently no-op'd

**Steps:**
1. Sign in with a Gmail account that is NOT in `yi_connect.approved_emails` (e.g. a personal Gmail).
2. Expected behavior:
   - User signs into the Supabase auth pool successfully
   - No row created in `yi_connect.profiles`
   - User sees an error or onboarding page (per existing yi-connect flow)
   - YIP and YiFuture are still able to handle this user if they wish

Note: the new yi-connect trigger does NOT raise an exception — it silently skips. Application-layer code in yi-connect's middleware handles unauthorized users via the redirect to `/login`.

## Test 4 — Dashboard pages load with yi_connect data

After signing in as director, visit each page and check the browser console + dev server log for errors:

- `/dashboard` — should show stats + chapter dropdown
- `/members` — should show members list (empty if no demo seed run)
- `/events` — should show events module
- `/finance` — should show budget dashboard
- `/stakeholders` — should show schools/colleges/industries lists
- `/knowledge` — should show document repo
- `/awards` — should show Take Pride dashboard
- `/pathfinder` — should show AAA plans

**Pass criteria:** Every page returns HTTP 200, no "column does not exist" errors in dev server log, no React error boundaries triggered.

## Test 5 — Chapter dropdown shows real chapters

**Steps:**
1. From the dashboard, look at the chapter switcher (top right or sidebar).

**Expected:** All ~60 chapters from `yi.chapters` listed (Ahmedabad, Bengaluru, ..., Erode, ..., Vellore, Visakhapatnam). Erode should be selected by default for director.

**Verify via SQL:**
```sql
SELECT id, name, location FROM yi_connect.chapters ORDER BY name;
```

`location` should be `"City, State"` format for all rows.

## Test 6 — Create a member request (write path)

**Steps:**
1. Sign out.
2. Go to `/apply`.
3. Submit a member application with a fake test email.

**Expected:**
- HTTP 200 on form submit
- A row appears in `yi_connect.member_requests`
- No "column chapters.location does not exist" error

## Test 7 — Chapter management (admin write path)

**Only if you're a national admin (via `yi.national_admins`).**

**Steps:**
1. Sign in as director.
2. Go to `/admin/chapters` (or wherever chapter create is).
3. Try to create a test chapter named "Test Chapter, Test City, Test State".

**Expected:**
- Insert succeeds (via `.schema('yi').from('chapters').insert(...)`)
- New row appears in `yi.chapters` with `city = "Test City"`, `state = "Test State"`
- View `yi_connect.chapters` reflects it with `location = "Test City, Test State"`

**Cleanup:** Delete the test chapter to keep the chapter list clean.

## Rollback plan if anything fails

The old standalone yi-connect Supabase project (`jxvbjpkypzedtrqewesc`) is paused but not deleted. Backup of old `.env.local` is at `.env.local.backup-jxvbjpkypzedtrqewesc-pre-phaseB`.

To roll back:
1. Restore old `.env.local` from the backup
2. Restart dev server
3. Investigate the failure on the new shared DB without time pressure

After 2 weeks of clean operation, decommission the old project.
