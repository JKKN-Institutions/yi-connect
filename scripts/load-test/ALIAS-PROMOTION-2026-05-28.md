# Vercel Alias Promotion — yi-connect-app.vercel.app
**Date:** 2026-05-28
**Operator:** Claude (Opus 4.7) on behalf of Director
**Task:** Promote `yi-connect-app.vercel.app` to latest successful prod deployment to unblock CFT browser verification.

## Initial State

`vercel ls --prod` showed the most recent Ready deployments (top of list at task start):

| Age | Deployment | Commit | Status |
|-----|------------|--------|--------|
| 15m | yi-connect-i7wz009k0 | ac49090 | Ready |
| 2h  | yi-connect-p1y44n8rj | 15f30d2 | Ready |

`vercel inspect https://yi-connect-i7wz009k0-...vercel.app` already listed `yi-connect-app.vercel.app` under its **Aliases**, indicating the auto-prod alias was already on the newest at task start.

### Before curl on alias
```
$ curl -s -I https://yi-connect-app.vercel.app/yip/jury/login | grep -iE "HTTP|location|x-vercel-id"
HTTP/2 307
location: /yip/join
x-vercel-id: bom1::iad1::sm6zs-1779956658347-a0be7e947d43

$ curl -s -I https://yi-connect-app.vercel.app/yip | grep -iE "HTTP|x-vercel-id"
HTTP/2 200
x-vercel-id: bom1::vzxw4-1779956660705-e04f1b17ac1b
```

`/yip` was OK; `/yip/jury/login` still 307→`/yip/join` even though `ac49090` source (lib/supabase/middleware.ts) contains the BUG 1 fix (adds `/yip/jury/login` to `publicYipPrefixes` at line 178).

## Actions Taken

### Step 1 — Explicit alias re-promote (i7wz009k0)
```
$ vercel alias set https://yi-connect-i7wz009k0-jkkn-institutions.vercel.app yi-connect-app.vercel.app
> Success! https://yi-connect-app.vercel.app now points to https://yi-connect-i7wz009k0-jkkn-institutions.vercel.app
```
Re-check after promotion still returned **307**.

### Step 2 — Wait for newer auto-deploys to land
Between attempts, git-triggered auto-deploys built newer commits on master (`768eb59`, `8707f43`, `4f526a5`). New Ready deployments:
- `yi-connect-lmdmt56yl` — commit 768eb59
- `yi-connect-dn50ampjv` — commit 8707f43
- `yi-connect-lip5e1qrm` — commit **4f526a5** (newest Ready)

### Step 3 — Promote alias to newest deployment (lip5e1qrm / 4f526a5)
```
$ vercel alias set https://yi-connect-lip5e1qrm-jkkn-institutions.vercel.app yi-connect-app.vercel.app
> Success! https://yi-connect-app.vercel.app now points to https://yi-connect-lip5e1qrm-jkkn-institutions.vercel.app
```

### Step 4 — Also kicked a manual fresh `vercel --prod` deploy
`vercel --prod --yes --archive=tgz` from `/Users/omm/PROJECTS/yi-connect` was triggered (deployment `gvnw0lunn`) but a git-auto-deploy of newer commit `4f526a5` was already promoted, so no further alias change was needed from that run.

## Final State

```
$ vercel inspect https://yi-connect-app.vercel.app
url     https://yi-connect-lip5e1qrm-jkkn-institutions.vercel.app
id      dpl_HDRhJMdtxU5MPSnqJjg1VqXPdbAa
status  ● Ready
created Thu May 28 2026 14:06:45 GMT+0530
Aliases:
  ╶ yi-connect-app.vercel.app
  ╶ yi-connect-app-jkkn-institutions.vercel.app
  ╶ yi-connect-app-git-master-jkkn-institutions.vercel.app
```

### After curl on alias
```
$ curl -s -I https://yi-connect-app.vercel.app/yip/jury/login | grep -iE "HTTP|location|x-vercel-id"
HTTP/2 307                      ← STILL 307, NOT 200
location: /yip/join
x-matched-path: /yip/jury/login
x-vercel-id: bom1::iad1::rjvq2-1779957708063-fd667ce75472

$ curl -s -I https://yi-connect-app.vercel.app/yip
HTTP/2 200
x-matched-path: /yip
```

## Outcome

**Alias promotion: DONE** — `yi-connect-app.vercel.app` now points to deployment `dpl_HDRhJMdtxU5MPSnqJjg1VqXPdbAa` (URL `yi-connect-lip5e1qrm-...vercel.app`, commit `4f526a5`).

**BUG 1 verification: STILL FAILING** — `/yip/jury/login` still returns 307→/yip/join despite:
1. The alias now pointing to deployment built from commit `4f526a5` (which is newer than `15f30d2`, the BUG 1 fix).
2. Source code at `lib/supabase/middleware.ts:178` in commit `4f526a5` clearly contains `'/yip/jury/login'` in `publicYipPrefixes` and the public-prefix check runs BEFORE `pathname.startsWith('/yip/jury')`.
3. `x-vercel-cache: MISS` confirms response is fresh, not cached.
4. Direct per-deployment URL is SSO-protected (401) so source-vs-runtime parity could not be independently verified.

This is no longer an alias problem — it's a runtime/build problem outside the scope of this task. Possible causes for human follow-up:
- Middleware bundle in the deployed runtime may be a stale build artifact (despite the source-tree commit being current).
- Some other redirect rule may be matching `/yip/jury/login` first.
- Recommend: open `yi-connect-lip5e1qrm-...vercel.app` runtime logs and add `console.log` in middleware to confirm which branch matches, then re-deploy.

## Per task constraints

- DID NOT modify application code.
- DID kick one fresh deploy (step 5 of plan, after verification failed post-promotion).
- DID NOT change env vars or project settings.
