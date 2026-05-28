# YIP Admin CFT Re-Verification — Post-Bug-Fix
**Date:** 2026-05-28
**Target:** https://yi-connect-app.vercel.app/yip
**Commit verified:** 15f30d2 (pushed to origin/master)
**Verdict:** RED — deploy did not reach the production alias; runtime verification not possible

## Deploy gate
**FAILED after 6 retries (3+ min wait) + extended monitor loop (~4 min more).**

Polling result on `https://yi-connect-app.vercel.app/yip/jury/login`:
- All retries: `HTTP/2 307 → location: /yip/join`, `x-vercel-cache: MISS`
- `x-vercel-id` resolves through `bom1::iad1` (production edge), proving the alias is live but pointing at an OLD deployment.

Ground truth via GitHub deployments API on `JKKN-Institutions/yi-connect`:
- Commit `15f30d23` finished with **state=success** at 2026-05-28T06:14:25Z (~50 min before this CFT run started).
- Deployment URL: `https://yi-connect-p1y44n8rj-jkkn-institutions.vercel.app`
- That URL returns **HTTP 401 + `_vercel_sso_nonce`** — i.e. it is gated as a Vercel SSO-protected preview, never promoted to the `yi-connect-app` production alias.
- The 7 most recent successful deploys (commits `15f30d23`, `8107b41d`, `d8dec9ff`, `259c225c`, `20317c57`, `9da054b8`, `39511790`) all sit at unique `yi-connect-*-jkkn-institutions.vercel.app` URLs. None are aliased to `yi-connect-app.vercel.app`.
- Conclusion: the production alias has been frozen for ~14+ hours. The last alias rotation predates the CFT-surfaced bug fixes. Likely cause: Vercel project's production branch/alias setting changed, or a deploy hook is misrouting commits to a per-commit preview lane instead of promoting the alias.

**This is a deploy-infrastructure problem, not a code problem.** All three source-code fixes are confirmed present on `origin/master` at `15f30d2` (see per-bug sections). Without alias promotion or a different CFT URL, runtime verification of the live behaviour is impossible from this session.

## BUG 1 fix — Jury login

**Source verified (PASS in code):**
`lib/supabase/middleware.ts:173-184`:
```
const publicYipPrefixes = [
  ...
  '/yip/jury/login',
  ...
];
if (publicYipPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))) {
```

**Runtime verified: NOT POSSIBLE.**
- `curl -sI https://yi-connect-app.vercel.app/yip/jury/login` → still 307→/yip/join (OLD code).
- Browser test skipped because alias is stale; would test the wrong build.

## BUG 2 fix — Admin Pipeline event link prefix

**Source verified (PASS in code):**
- `grep -rn "href={\`/dashboard/events" app/yip/` → **0 occurrences** (no missing-prefix links remain).
- `grep -rn "href={\`/yip/dashboard/events" app/yip/` → **9 occurrences** across the expected pages:
  - `app/yip/dashboard/page.tsx:134`
  - `app/yip/dashboard/zones/[zone]/page.tsx:165`
  - `app/yip/dashboard/admin/admin-client.tsx:515`
  - `app/yip/dashboard/admin/pipeline/pipeline-client.tsx:93`
  - `app/yip/dashboard/admin/people/[id]/page.tsx:169`
  - `app/yip/dashboard/events/[id]/page.tsx:157`
  - `app/yip/dashboard/events/[id]/edit/page.tsx:158, 298`
  - `app/yip/dashboard/events/[id]/parties/parties-client.tsx:243`

**Runtime verified: NOT POSSIBLE.** Pipeline page would still serve the OLD link shape from the stale alias.

## BUG 3 fix — Super-admin event access

**Source verified (PASS in code):**
- `app/yip/actions/events.ts` imports `isCurrentUserSuperAdmin` (line 6).
- Six write functions (`getEvent`, `getEventWithDetails`, `updateEvent`, `setEventLock`, `pushLiveBanner`, `clearLiveBanner`) now check `existing.created_by !== user.id && !(await isCurrentUserSuperAdmin())` — i.e. super-admin bypass is wired in (lines 209, 291, 422, 484, plus list-query gates at 239, 348 that conditionally apply `.eq("created_by", user.id)` only when `!isSuper`).
- `app/yip/dashboard/page.tsx` event list now imports `isCurrentUserSuperAdmin` (new import added in the diff).
- New helper file `lib/yip/auth/require-super-admin.ts` (65 lines) is present in the commit.

**Runtime verified: NOT POSSIBLE.** Cannot log in as super-admin against the stale alias build, which still has the `created_by`-only filter.

## Previously-blocked verifications now possible
All BLOCKED again — same root cause (stale alias). No runtime probe was attempted because every check would target old code and produce false negatives:
- **K (auto-attach central topics):** BLOCKED — needs runtime event detail page.
- **F3 (Positions card on /control):** BLOCKED — needs runtime event detail page.
- **F4 (Special Remarks in jury scoring):** BLOCKED — needs jury login (BUG 1 dep).
- **P2 (Import allocation cols):** BLOCKED — needs runtime Participants tab.
- **B (audit log page):** BLOCKED — needs `/yip/dashboard/admin/audit-log` reachable through super-admin gate (BUG 3 dep).

## Remaining bugs (if any)
1. **NEW BLOCKER — Vercel production alias not promoting.** `yi-connect-app.vercel.app` has been frozen for 14+ hours; all 7 most recent successful deploys (including `15f30d2`) are stuck at per-commit preview URLs with SSO-protected 401s. Until the alias is promoted (or a different canonical CFT URL is provided), no live verification of the YIP module is possible. Suggested fixes (out of CFT scope):
   - In Vercel dashboard → Project settings → Domains → confirm `yi-connect-app.vercel.app` is set as production alias for the right project and production branch is `master`.
   - Or run `vercel alias set yi-connect-p1y44n8rj-jkkn-institutions.vercel.app yi-connect-app.vercel.app` from a machine with Vercel CLI auth.
   - Or trigger a fresh deploy with `vercel deploy --prod` from the project root.

No new application-layer bugs found (all checks blocked by deploy gap).

## Verdict justification

**RED.** All three CFT-surfaced bug fixes are correctly authored and present on `origin/master` at commit `15f30d2` (verified by source diff and grep). The Vercel build of `15f30d2` succeeded ~50 minutes before this CFT run began. However, the public production alias `yi-connect-app.vercel.app` did not get promoted to that build — it still serves a deployment from before the fixes landed. Since the prompt's verification target is the alias URL, the actual end-user observable behavior is **unchanged from the prior RED CFT report**, and the Mizoram demo remains unreachable for super-admin and jury users at the canonical URL. This is a deploy-infrastructure block, not a code-quality block. Promote the alias to the `15f30d2` deployment (or any subsequent deploy of master HEAD) and rerun this CFT — the source-level verification strongly suggests the three bug fixes will pass runtime verification once the alias points at them.
