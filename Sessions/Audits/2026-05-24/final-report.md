# Yi Connect — Three-Layer Sweep Final Report

**Date:** 2026-05-24
**Production URL:** https://yi-connect-app.vercel.app
**Tested as:** director@jkkn.ac.in (Super Admin / National Admin; Erode chapter scope)
**Scope chosen:** Real admin surface (not Chapter Chair impersonation)
**Tools:** Claude-in-Chrome (Layer 1), curl + Read (Layer 2), Supabase Management API + PostgREST as anon (Layer 3)

---

## Top-line verdict: 🔴 SHIP-BLOCKER findings across all three layers

| Layer | Total tested | Pass | Fail | Critical |
|------|------|------|------|----------|
| 1 — UI Action Inventory | 6 pages | 1 (member-requests) | 2 broken (chapters, users) | 7 silent UI failures |
| 2 — API Route Matrix | 15 routes | 6 | 9 | **5 unauthenticated leaks** |
| 3 — RLS / Access Matrix | 147 base tables + 16 views | 142 | 5 | **5 anon-read PII leaks** |

**The single most urgent fix:** `/api/admin/debug-roles?email=anyone@example.com` — returns user UUID + roles + RPC outputs from PRODUCTION using the service-role key, with NO authentication. Anyone with the URL has god-mode reconnaissance.

---

## 🔴 Critical findings (fix this week)

### A. API auth bypasses (Layer 2)

| Route | Method | What it leaks / does | Severity |
|---|---|---|---|
| `/api/admin/debug-roles` | GET `?email=` | Service-role-backed dump of any user's UUID, email, roles, RPC outputs | **CRITICAL** |
| `/api/admin/fix-demo-roles` | GET / POST | GET enumerates demo accounts; POST is unauthenticated mutation | **CRITICAL** |
| `/api/whatsapp/send` | POST | Unauthenticated WhatsApp send primitive (spam / impersonation risk) | **CRITICAL** |
| `/api/whatsapp/status` | GET / POST | Leaks WhatsApp service state; exposes QR code if any active session | **HIGH** |
| `/api/events/[id]/volunteer-matches` | GET | No auth check in code (probe 500'd on placeholder UUID; real UUID would leak skill + availability data) | **HIGH** |
| `/api/activity-templates` | GET | No code-level auth; currently held back only by RLS. One policy loosening = leak | **MEDIUM** (silent fail) |
| `/api/admin/diagnose-auth` | GET | Returns 200 + allowed-role list to anon instead of 401 | **MEDIUM** |
| `/api/admin/impersonation/actions/[sessionId]` | various | Source code admits `requireRole` redirect doesn't work in Next.js 16 API context | **MEDIUM** |
| `/api/bug-reporter/[...path]` | * | Open CORS proxy forwards arbitrary methods/headers/bodies to external host (SSRF + amplification) | **MEDIUM** (intentional, needs hardening) |

### B. Anon-read PII leaks via PostgREST (Layer 3)

| Surface | Policy | Data leaked when probed | Severity |
|---|---|---|---|
| `yi_connect.profiles` | `anon_view_profiles_for_rsvp` USING **true** | email + full_name + phone of every profile | **HIGH** |
| `yi_connect.members` | `anon_view_members_for_rsvp` USING `is_active = true` | company + designation + chapter of every active member | **HIGH** |
| `yi_connect.chapters` (VIEW over `yi.chapters`) | no security_invoker — bypasses caller RLS | chair_email + chair_mobile | **MEDIUM** |
| `yi_connect.events` | 2 anon policies (public_slug / rsvp_token flows) | Possibly intentional. Confirm leaked row had a public slug. | **LOW** (verify) |
| `yi_connect.booking_restrictions` | `Anyone can view` | Likely intentional | **LOW** |

### C. Pre-leak risk — tables with USING true + public

These returned 0 rows today only because the tables are empty. They will leak the moment data exists:

- `stakeholder_contacts` (relationship PII — **urgent**)
- `stakeholder_documents` (relationship PII — **urgent**)
- `event_templates`
- `relationship_health_scores`
- `booking_restrictions` (probably intentional)

### D. UI silent failures (Layer 1)

| Page | Action | What "works" but actually fails |
|---|---|---|
| `/admin/chapters` | Click sort header "Chapter Name" | Click fires, no error, no reorder |
| `/admin/chapters` | Type `Erode` in search | Click fires, no error, 0 results (Erode is a real chapter) |
| `/admin/chapters` | Click "Next page" | Status updates to "Page 2 of 7" while rows stay on page 1 |
| `/admin/users` | Full layout | Renders at half viewport width — eyeball-only catch |
| `/admin/users` | Row "Open menu" | Click fires, no dropdown appears |
| `/admin/users` | "All Roles" filter button | Click fires, no listbox appears |
| `/admin/chapters` & `/admin/users` | Pagination + sort + filter generally | No 4xx/5xx fetch errors — these are silent state-update bugs |

---

## ✅ What works

- `/member-requests` — all 4 status tabs switch correctly (using CDP click-by-ref; synthetic JS clicks are ignored by Radix)
- `/admin/chapters` row action menu opens correctly with Edit / Delete options
- 147/147 base tables have RLS enabled (no totally unprotected table)
- 6 of 15 API routes have correct auth checks (`impersonation-audit/export`, `events/export`, `verticals`, `yi-creative/connection`, `yi-creative/callback`, `expand-url`)
- Management API token + service-role key + anon key are properly compartmentalized in `.env.local` (not committed)

---

## Recommended fix order (top → bottom = stop the bleeding first)

1. **Disable or auth-gate `/api/admin/debug-roles`** in the next deploy. Today. (5-minute fix)
2. **Disable or auth-gate `/api/admin/fix-demo-roles`, `/api/whatsapp/send`, `/api/whatsapp/status`, `/api/events/[id]/volunteer-matches`.** Same deploy.
3. **Rewrite `profiles.anon_view_profiles_for_rsvp`** to scope by event_rsvps + active rsvp_token, OR create a `profiles_public` view with only id/full_name/avatar_url.
4. **Same treatment for `members.anon_view_members_for_rsvp`** — replace `is_active=true` with an event-scoped predicate.
5. **Recreate `yi_connect.chapters` view with `security_invoker = on`** so caller-RLS on `yi.chapters` is enforced. OR drop chair_email/chair_mobile from the view. (This is the same VIEW-shim pattern noted in memory `feedback_postgrest_cross_schema_embed.md`, but with a security gap.)
6. **Tighten USING-true policies** on `stakeholder_contacts`, `stakeholder_documents`, `event_templates`, `relationship_health_scores` before any data lands in them.
7. **Layer-2b sweep** of `app/actions/*.ts` (~90 server actions): grep for missing `getCurrentUser()` / `requireRole()` at every exported entry point. Server Actions can't be curl'd but are still HTTP-callable from the browser.
8. **/admin/chapters and /admin/users client-side state bugs** — investigate the table component. Likely a stale TanStack-Table state vs server-driven data mismatch (URL searchParams not wired to actions).
9. **`/admin/users` layout regression** — eyeball check after CSS investigation.
10. **`/api/bug-reporter/[...path]`** — restrict allowed upstream host(s), restrict methods, drop forwarded auth headers.

---

## Artifacts

All raw outputs in `/tmp/yi-sweep-2026-05-24/`:

- `layer1-ui.md` — UI Action Inventory detail
- `layer2-api.md` — API route matrix detail
- `layer3-rls.md` — RLS + anon-read detail
- `policy-audit.md` — full pg_policies dump
- `anon-read.md`, `anon-read-raw.txt` — behavioral anon GET evidence
- `leak-policies.json`, `rls-raw.json` — raw queries

## Caveats

- Chapter-Chair perspective was NOT actually tested. Sweep ran as Super Admin per user's explicit choice ("sweep as director@jkkn.ac.in's actual surface"). A real Chair will have a much narrower visible surface — the leaks above are independent of role, so this doesn't change the urgency, but the UI sweep would look different.
- Layer 1 covered 6/19 sidebar surfaces. The 14 expandable menus (Members/Events/Finance/Stakeholders/Industrial Visits/Opportunities/Communication Hub/Awards/Knowledge/Verticals/Pathfinder/Succession/National/Settings) were NOT clicked open — separate sweep needed.
- Layer 2 did NOT send POST/PUT/PATCH/DELETE per safety rules. The unauth POSTs (`/api/whatsapp/send`, `/api/admin/fix-demo-roles`) were verdicted from source-code reading + GET probe returning 405 — not a live mutation test.
- Layer 3 behaviorally tested only ~30 of 147 tables. Remaining 117 were policy-audited only; the 5 confirmed leaks + 7 pre-leak USING-true patterns are accurate.
- Authenticated-cross-chapter leak (Chair X reading Chair Y's data) is a Layer 4 test and was NOT done.
