# Yi-Connect Layer 3 — RLS / Access Matrix Audit

**Date:** 2026-05-24
**Project:** bkmpbcoxbjyafieabxao (shared yi-platform DB, schema = `yi_connect`)
**Method:** Management API SQL (pg_policies + pg_tables) + anon PostgREST GET (read-only)
**Time taken:** ~6 min

---

## Headline numbers

| Metric | Value |
|---|---|
| Tables in `yi_connect` schema | **147 base tables + 16 views = 163 relations** |
| Base tables with RLS enabled | **147 / 147 (100%)** |
| Base tables with RLS disabled | **0** |
| Total RLS policies | **416** |
| Policies granted to `anon` role | **13** |
| Policies with `USING true` for `anon` | **1** (profiles.anon_view_profiles_for_rsvp) |
| Policies with `USING true` for `public` role | **7** (see section A) |
| **Confirmed anon-read leaks (real data returned to unauthenticated request)** | **5 surfaces** |

> Original tables file said 160 — actual is 147 base tables + 16 views. The 16 views matter: they are NOT covered by RLS at the view level. Same VIEW-shim pattern as `future.chapters` from memory.

---

## A. Policy audit — suspicious policies (USING true + public role)

7 base tables have an SELECT/ALL policy that is `USING true` granted to the `public` role. `public` in Postgres includes both `anon` and `authenticated`. For SELECT this means: anyone with the anon key sees the data.

| Table | Suspicious policies |
|---|---|
| `stakeholder_contacts` | "Users can manage stakeholder contacts" (ALL, USING true) + "Users can view all stakeholder contacts" (SELECT, USING true) |
| `stakeholder_documents` | "Users can manage documents" (ALL) + "Users can view all documents" (SELECT) |
| `booking_restrictions` | "Anyone can view restrictions" (SELECT, USING true) — explicitly intentional name |
| `event_templates` | "Anyone can view active event templates" (SELECT, USING true) |
| `notifications` | "Service can insert notifications" (INSERT, WITH CHECK true) — INSERT-only, less severe |
| `relationship_health_scores` | "System can manage health scores" (ALL, USING true) |
| `session_booking_history` | `booking_history_insert` (INSERT, WITH CHECK true) — INSERT-only |

Anon read currently returns empty arrays for `stakeholder_contacts`, `stakeholder_documents`, `event_templates`, `relationship_health_scores` (likely no data yet, OR something behavioral I didn't see). The policies are still WRONG — they'll leak the moment a row exists. **stakeholder_contacts and stakeholder_documents are the worst** because they hold relationship/document PII when populated.

Full policy table (all 147 base tables) saved separately — see `/tmp/yi-sweep-2026-05-24/policy-audit.md`.

---

## B. Anon-read behavioral test — REAL LEAKS confirmed

Called PostgREST as anon (NEXT_PUBLIC_SUPABASE_ANON_KEY only) with `Accept-Profile: yi_connect`. 5 surfaces returned actual production data to an unauthenticated request.

| Surface | HTTP | Rows | Kind | Leak severity | Notes |
|---|---|---|---|---|---|
| `chapters` | 200 | 1 | **VIEW** over `yi.chapters` | **MEDIUM** | View bypasses yi_connect RLS. Anon got chapter id/name/region/chair_name/chair_email/chair_mobile/is_active. Chair PII (email+mobile) exposed. |
| `profiles` | 200 | 1 | base table | **HIGH** | Policy `anon_view_profiles_for_rsvp` uses `USING true` — leaks **every column of every profile** (email, full_name, phone, chapter_id, avatar_url). Intended for RSVP flow but scope is wrong. |
| `members` | 200 | 1 | base table | **HIGH** | Policy `anon_view_members_for_rsvp` uses `USING (is_active = true)` — leaks all active members (company, designation, membership_status, membership_number, chapter_id). |
| `events` | 200 | 1 | base table | **LOW (likely intentional)** | Two anon policies: `anon_view_events_by_slug` (public_slug IS NOT NULL + status published/ongoing/completed) and `anon_view_events_by_token` (rsvp_token IS NOT NULL + same). Properly scoped — anon only sees published events. **Acceptable IF the leaked row had a public_slug or rsvp_token; verify.** |
| `booking_restrictions` | 200 | 1 | base table | **LOW** | Explicit `Anyone can view restrictions` policy — likely intentional UX. Confirm with product whether booking rules should be public. |

### Tables tested and OK (RLS filtered to 0 rows for anon)

`member_requests`, `chapter_invitations`, `budgets`, `expenses`, `best_practices`, `stakeholder_contacts`, `notifications`, `event_templates`, `relationship_health_scores`, `session_booking_history`, `stakeholder_documents`, `approved_emails`, `certifications`, `chapter_settings`, `chapter_reports`, `cmp_progress`, `impersonation_sessions`, `financial_audit_logs`, `award_cycles`, `award_categories`, `admin_recent_impersonations`.

> **CAUTION:** "0 rows returned" can mean either (a) RLS correctly filtered, or (b) the table is empty. For empty tables, this audit cannot prove the policy is safe — only that no leak is currently happening. Re-run after seeding data, OR audit the policy text directly.

### Surfaces returning 404 (not exposed via PostgREST schema cache)

`awards`, `communications`, `impersonation_audit`, `audit_logs`, `award_winners`, `sponsorships`, `expense_reimbursements`, `stakeholders`, `relationships`, `announcement_templates`, `announcement_drafts`. These are either renamed (PGRST205 hints suggested `award_cycles`, `notifications`, `impersonation_sessions`, `financial_audit_logs`) or genuinely missing. The corrected names were tested above and all returned 0 rows.

---

## C. Exact leaking policy text (for fix targeting)

### `profiles.anon_view_profiles_for_rsvp` — **fix priority 1**
```
roles: {anon}
USING: true        ← wide open
```
**Recommended fix:** scope to profiles whose member is on an event with an active rsvp_token, e.g.
```sql
USING (
  EXISTS (
    SELECT 1 FROM yi_connect.event_rsvps r
    JOIN yi_connect.events e ON e.id = r.event_id
    WHERE r.member_id = profiles.id
      AND e.rsvp_token IS NOT NULL
      AND e.status IN ('published','ongoing')
  )
)
```
Or column-restrict using a separate `profiles_public` view that exposes only `id, full_name, avatar_url`.

### `members.anon_view_members_for_rsvp` — **fix priority 1**
```
roles: {anon}
USING: (is_active = true)
```
Same problem — too wide. Scope to members linked to an event with active token, OR restrict columns via a public view.

### `chapters` (VIEW over `yi.chapters`) — **fix priority 2**
VIEW bypasses RLS. Either:
- Add an explicit RLS-aware INSTEAD OF rule on the view, OR
- Recreate as `SECURITY INVOKER` view (in PG 15+ via `security_invoker = on`) so the calling role's RLS on `yi.chapters` is enforced, OR
- Restrict the view to public columns (drop `chair_email`, `chair_mobile`).

### `booking_restrictions` + `event_templates` + `stakeholder_*` + `relationship_health_scores` — **fix priority 3**
Confirm with product whether each is intentionally public. If not, replace `USING true` with `USING (auth.role() = 'authenticated')` minimum, ideally tighter.

---

## D. Auth blockers / gaps in this audit

None. Management API personal access token (`/Users/omm/.supabase/access-token`) worked for SQL reads. Anon key from `.env.local` worked for behavioral tests. No blocked queries.

**Caveats:**
1. "0 rows" doesn't prove RLS works on empty tables — need to re-test after data exists.
2. Only tested ~30 of 147 base tables behaviorally; the remaining ~117 were policy-audited only. None had `USING true + public` except the 7 already listed.
3. Did not test `service_role` access (assumed full) or `authenticated` cross-chapter leakage (different test class — Layer 4).
4. The 16 VIEWs were NOT individually probed except `chapters`. They should ALL be checked for the same security-invoker gap.

---

## E. Recommended next actions (in priority order)

1. **Fix `profiles.anon_view_profiles_for_rsvp` — scope tighter.** Currently leaks every profile's email + phone.
2. **Fix `members.anon_view_members_for_rsvp` — scope tighter.** Currently leaks every active member's company/designation/chapter.
3. **Audit all 16 VIEWs in `yi_connect`** for SECURITY INVOKER vs DEFINER and column exposure. Start with `chapters`, `award_nominations`, `member_activity_data`, `pending_bookings_for_chair`.
4. **Decide on the 7 `USING true` policies** — keep + document, OR tighten. Flag `stakeholder_contacts/_documents` and `relationship_health_scores` as urgent because they'll leak the moment they're populated.
5. **Re-run this audit on a populated DB.** Empty tables hide RLS bugs.
6. (Layer 4 — next sweep) **Test cross-chapter leakage** — log in as Chapter A chair, GET Chapter B's data. The `members` chapter-scoping policy looks correct but should be behaviorally verified.

---

**Raw artifacts:**
- `/tmp/yi-sweep-2026-05-24/rls-raw.json` — full policy audit (147 tables)
- `/tmp/yi-sweep-2026-05-24/policy-audit.md` — markdown table of all policies
- `/tmp/yi-sweep-2026-05-24/anon-read.md` — anon GET test results
- `/tmp/yi-sweep-2026-05-24/anon-read-raw.txt` — raw response bodies (for verification)
- `/tmp/yi-sweep-2026-05-24/leak-policies.json` — full text of policies on the 5 leaking surfaces
