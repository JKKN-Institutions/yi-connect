# Layer 2 — API Route Matrix (yi-connect prod)

**Scope:** 15 route.ts files in `/Users/omm/PROJECTS/yi-connect/app/api/`. GET-only probes against `https://yi-connect-app.vercel.app` with no auth header.
**Server actions:** ~90 files in `app/actions/*.ts` inventoried only (Server Actions are not HTTP-callable; they sit behind the React form/action layer with Next.js's built-in CSRF guard and require a valid action ID).
**Run date:** 2026-05-24
**Convention:** "Expected" for an admin/auth-only route hit with no auth = 401, 403, or 302/307 to /login. 200 = leak. No code-level auth check (relies on RLS only) = flagged.

## Result Matrix

| # | Route | Methods exported | Auth check in code | curl no-auth status | Expected | Verdict |
|---|-------|------------------|---------------------|---------------------|----------|---------|
| 1 | `/api/activity-templates` | GET | **NONE** — relies on RLS on `yi_connect.activity_templates` | **200** (returns `{templates: []}`) | 401/empty | **FAIL — no code-level auth.** Currently safe only because RLS denies the anon role and the route swallows missing-table errors. If RLS is ever loosened or the table grows public rows, leaks instantly. |
| 2 | `/api/admin/debug-roles` | GET | **NONE** — anon `email=` query param, runs SERVICE-ROLE queries | **200** (returns user UUID, email, every role assignment, internal RPC outputs for any email passed) | 401 | **CRITICAL LEAK.** No auth check. Accepts arbitrary `?email=` and uses the **service-role key** to enumerate any user's profile id, role table, and RPC behaviour. PII + role-graph enumeration oracle. Default test email `demo-ec@yi-demo.com` works without credentials. Recommend: delete the route OR gate behind Super Admin + IP allow-list + remove from prod build. |
| 3 | `/api/admin/diagnose-auth` | GET | Soft: reads cookies, calls `getCurrentUser()`, but **returns 200 with diagnosis** in all cases instead of redirecting/401-ing | **200** (returns "No authenticated user - would redirect to /login") | 401 | **FAIL (info disclosure, low sev).** Safe-ish: no PII for anon (`user: null`), but discloses the allowed-role list `[Super Admin, National Admin, Chair, Co-Chair, Executive Member, EC Member]` and confirms route structure. Recommend: gate behind `getCurrentUser()` then Super-Admin role; return 401 when no user. |
| 4 | `/api/admin/fix-demo-roles` | GET, POST | **NONE** (both methods) | **200** on GET (lists demo users, role-fetch errors), POST not tested (mutating) | 401 | **CRITICAL LEAK on GET.** Enumerates demo user accounts and their role state. POST is unauthenticated and triggers `fixDemoUserRoles()` server action — high-risk mutation primitive if it runs without owner check. SAFETY NOTE: POST not probed per ground rules. Treat as compromised until proven otherwise. |
| 5 | `/api/admin/impersonation-audit/export` | GET | `getCurrentUser()` + `getUserHierarchyLevel() >= 6` | **401** (`{"error":"Unauthorized: Please log in"}`) | 401 | **PASS.** |
| 6 | `/api/admin/impersonation/actions/[sessionId]` | GET | `requireRole(['Super Admin', 'National Admin'])` | **500** when probed with placeholder UUID (`{"error":"Failed to fetch action log"}`) | 302→/login or 401 | **FAIL (silent).** Comment in route admits: "If requireRole throws (redirect), it won't be caught here in Next.js 16". In practice the 500 means either (a) requireRole's redirect isn't firing for API routes and the data layer leaks, OR (b) the data layer is failing for an unrelated reason. Either way the route does not return a clean 401/403/302 to an unauthenticated caller. **Dynamic-param route — needs manual test with real sessionId + no cookies to confirm exact behaviour.** |
| 7 | `/api/bug-reporter/[...path]` | GET, POST, PUT, DELETE, OPTIONS | **NONE** — open CORS proxy to `jkkn-centralized-bug-reporter.vercel.app` (or `BUG_REPORTER_API_URL`) | 404 on placeholder path (404 from upstream) | n/a (intentional proxy) | **MEDIUM RISK.** Intentional auth-free CORS proxy. Forwards arbitrary methods+headers+body to an external host. Acceptable IF the upstream enforces auth, but this app becomes a free egress / amplification primitive (SSRF-shaped). At minimum: lock `BUG_REPORTER_API_URL` to a fixed value, strip dangerous headers, rate-limit. |
| 8 | `/api/events/[id]/volunteer-matches` | GET | **NONE** — calls `getVolunteerMatches()` directly | **500** with placeholder UUID | 401 | **CRITICAL — likely leak when called with a real event UUID.** No auth check at all in route. The 500 is from data-layer failure on a non-existent UUID, not from auth. Any unauthenticated caller with a real event ID gets the full volunteer-match list (skills, availability, scores). **Dynamic-param route — needs manual test with a real event UUID + no cookies to confirm.** |
| 9 | `/api/events/export` | GET | `getCurrentUser()` | **401** (`{"success":false,"error":"Unauthorized"}`) | 401 | **PASS.** |
| 10 | `/api/expand-url` | POST | **NONE** — but allowlisted to `goo.gl` and `maps.app.goo.gl` only | 405 on GET (correct) | n/a | **LOW RISK.** Limited SSRF primitive (only Google short-URLs). Acceptable. |
| 11 | `/api/verticals` | GET | `getCurrentUser()` | **401** (`{"error":"Unauthorized"}`) | 401 | **PASS.** |
| 12 | `/api/whatsapp/send` | POST | **NONE** | 405 on GET (POST-only, not probed) | 401 | **CRITICAL LEAK (likely).** No auth check in route. Anyone who can hit the URL can send WhatsApp messages via the Railway service or local client. SAFETY NOTE: POST not probed per ground rules. Treat as compromised. |
| 13 | `/api/whatsapp/status` | GET, POST | **NONE** (both methods) | **200** on GET (`{state:"disconnected", isLoggedIn:false, qrCode:null}`) | 401 | **FAIL.** Discloses WhatsApp service state (and would disclose QR code if one is active, enabling session-hijack). POST triggers re-initialization of the WhatsApp client without auth — DoS / session-replacement primitive. |
| 14 | `/api/yi-creative/callback` | GET | OAuth state validation in `handleYiCreativeOAuthCallback` (server action) | **307** redirect to `/settings/integrations?yi_creative_error=Missing+authorization+code+or+state` | 307 redirect | **PASS.** Correct OAuth callback behaviour (no static auth check needed; auth is via state+code validation downstream). |
| 15 | `/api/yi-creative/connection` | GET | `supabase.auth.getUser()` + hierarchy >= 4 OR National Admin + chapter match | **401** with valid chapterId, **400** without | 401 | **PASS.** |

## Findings Summary

### Critical leaks (immediate action)
- `/api/admin/debug-roles` — anonymous PII + role enumeration with service-role key
- `/api/admin/fix-demo-roles` — anonymous GET enumerates demo users; POST is an unauthenticated mutation
- `/api/whatsapp/send` — anonymous POST sends WhatsApp messages
- `/api/whatsapp/status` — anonymous GET leaks service state (and QR code when active); POST re-inits client
- `/api/events/[id]/volunteer-matches` — no code-level auth; relies on data layer

### Auth-via-RLS only (silent-fail risk)
- `/api/activity-templates` — no code-level auth; safe only as long as RLS holds

### Soft fails (lower sev)
- `/api/admin/diagnose-auth` — returns 200 with diagnostic info instead of 401
- `/api/admin/impersonation/actions/[sessionId]` — `requireRole` redirect comment suggests it does not work in API-route context in Next.js 16; manual cookie-less test with a real sessionId required

### Pass
- `/api/admin/impersonation-audit/export`, `/api/events/export`, `/api/verticals`, `/api/yi-creative/connection`, `/api/yi-creative/callback`, `/api/expand-url` (low-risk allowlist)

### Intentional but should be hardened
- `/api/bug-reporter/[...path]` — open CORS proxy; lock upstream URL, strip headers, rate-limit

## Server Actions Inventory (informational only — not HTTP-callable)
~90 files under `app/actions/*.ts`. Server Actions are protected by Next.js's built-in action-ID + CSRF guard; no live HTTP probe possible. Recommend a separate Layer-2b sweep that greps each action file for an explicit `getCurrentUser()` / `requireRole()` / role check at the top of every exported `async function`. Files without such a guard at the entry point should be flagged.

## Method note (per safety rules)
POST/PUT/PATCH/DELETE were NOT exercised against production. Routes with POST-only or POST+GET (`/api/admin/fix-demo-roles`, `/api/whatsapp/send`, `/api/whatsapp/status`, `/api/expand-url`, `/api/bug-reporter/[...path]`) had their **code-level auth checks** read from source. Verdict is based on code inspection + GET probe where applicable.
