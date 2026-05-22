# Continuation Brief — yi-connect / Yi Platform Unification

Resuming a long-running session. Previous Claude shipped Phase A (DB unification), Phase B (code rewire), Phase C (cross-app auth), and Phase D ports (472 files of YIP + YiFuture as nested route segments). Phase D is **not yet smoke-tested** — known blockers must be fixed first.

## VERIFY CURRENT STATE (run these BEFORE picking work)

```bash
cd /Users/omm/PROJECTS/yi-connect

# 1. Confirm the Phase D port files exist and were committed
git log --oneline -3
ls app/yip app/yi-future components/yip components/yi-future lib/yip lib/yi-future | head -20

# 2. Confirm the unified Supabase DB is live (expect 127 tables)
cat > /tmp/q.json <<'EOF'
{"query": "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'yi_connect';"}
EOF
TOKEN=$(cat ~/.supabase/access-token)
curl -sS -X POST "https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @/tmp/q.json

# 3. Confirm .env.local points at SHARED Supabase (not the old standalone)
grep "NEXT_PUBLIC_SUPABASE_URL" .env.local | head -1
# Expected: https://bkmpbcoxbjyafieabxao.supabase.co

# 4. TS error baseline (expect 6, all in lib/yi-future/supabase/server.ts)
npx tsc --noEmit 2>&1 | grep -v "^\.next/" | grep "error TS" | wc -l
```

If counts/paths don't match: read `.claude/sessions/686673a5.md` for full context.

## KEY DECISIONS (from previous session — must respect these)

1. **Monorepo merge, NOT 3 apps + SSO.** User locked this via AskUserQuestion. Previous Claude drifted to "3 apps + SSO" during reconnaissance and downgraded the plan unilaterally; user caught it 6h later. Phase D ports are the correction. Do not re-suggest the SSO alternative.

2. **Default schema routing.** All 4 Supabase client creators in `lib/supabase/{client,server}.ts` + `app/actions/demo-seed.ts` have `db: { schema: 'yi_connect' }`. This is why 8,777 `.from()` calls work without rewrites. Don't remove.

3. **`yi_connect.chapters` is a VIEW, not a table.** Wraps `yi.chapters` and adds computed `location = "City, State"`. Writes to chapters MUST use `.schema('yi').from('chapters')` — see `app/actions/chapters.ts` for the pattern + `splitLocation()` helper.

4. **handle_new_user trigger is non-blocking.** When a YIP student or YiFuture delegate signs up via shared `auth.users`, the trigger silently returns NEW if their email isn't in `yi_connect.approved_emails`. Don't reintroduce a blocking RAISE EXCEPTION.

5. **Per-module Supabase clients in Phase D ports.** `lib/yip/supabase/*` defaults to public schema (YIP's tables); `lib/yi-future/supabase/*` defaults to future schema. SEPARATE from yi-connect's `lib/supabase/*` which defaults to yi_connect.

6. **Branch name is legacy.** Still on `feat/auto-mount-mybugspanel`. Rename to `feat/platform-unification` before opening any PR.

7. **Production Vercel is on OLD Supabase.** `.env.local` change was local-only. Vercel env vars NOT touched. Live `https://yi-connect-app.vercel.app` still queries `jxvbjpkypzedtrqewesc.supabase.co`. P2 task covers the production deploy.

## NEXT TASKS (interview-anchored)

User answered Q1 = "All the above" → execute all three areas. P0 below is the blocker-fix; P1 is middleware + smoke test; P2 is production deploy.

### P0 — Phase D blocker fixes (BEFORE any smoke test)

1. **Patch nested `<html>` in `app/yip/layout.tsx`** — currently has its own `<html>` and `<body>`. Nested under yi-connect's root layout, this breaks every `/yip/*` route. Change to return just `<>{children}<PWARegister/></>`; move font CSS variables to a wrapping div; remove manifest reference if no `app/yip/manifest.ts`.

2. **Patch nested `<html>` in `app/yi-future/layout.tsx`** — same pattern. References `/splash/*.png` and `/icons/*.png` (see task 5).

3. **Fix 6 TS errors in `lib/yi-future/supabase/server.ts`** — `db: { schema: 'future' }` literal doesn't match Supabase's `"public"` generic + cookie type errors. Quick fix: type-cast options with `as any`, OR add explicit `<Database>` generic with a Database type that includes `future` schema.

4. **Merge YIP + YiFuture deps into yi-connect `package.json`** — new deps from YiFuture: `web-push`, `@react-pdf/renderer`, `canvas-confetti`, `@boobalan_jkkn/bug-reporter-sdk`, `sharp` (dev). Then `npm install`. Review `npm audit` — GitHub flagged 69 vulnerabilities (34 high) post-port-commit; likely in new deps.

5. **Copy YiFuture's PWA assets** — `cp -r /Users/omm/PROJECTS/YiFuture/public/splash public/`, same for `icons/`, `manifest.json`, `sw.ts`.

### P1 — Middleware + smoke test

6. **Reconcile root `middleware.ts`** for 3 auth postures:
   - `/dashboard/*`, `/members/*`, `/finance/*`, `/stakeholders/*`, `/m/*` — keep current OAuth gating
   - `/yip/jury/*`, `/yip/event/*/display`, `/yip/join`, `/yip/test-login` — public (access codes)
   - `/yi-future/jury/*`, `/yi-future/event/*/display`, `/yi-future/me/*`, `/yi-future/mentor/*`, `/yi-future/partner/*`, `/yi-future/join` — public (access codes)
   - `/yi-future/national/admin/*` — gated by `yi.national_admins` allow-list
   - Audit `lib/yip/supabase/middleware.ts` and `lib/yi-future/supabase/middleware.ts` for logic worth merging

7. **Smoke test:**
   - `npm install` (post deps merge)
   - `npx tsc --noEmit 2>&1 | grep -v "^\.next/" | grep "error TS"` — expect 0 after task 3
   - `npm run dev`
   - Hit: `/` `/login` `/apply` `/yip` `/yi-future` — all 200
   - Check dev console for runtime errors

8. **Audit `/yi-future/api/*` routes** — webhooks/cron/push subscriptions pointing at old bare `/api/...` will break. Check `vercel.json`, push subscription endpoints.

9. **Cookie collision check** — YiFuture uses `yifuture_session`; yi-connect uses Supabase SSR defaults (`sb-*`). Verify no clash.

### P2 — Production deploy + E2E

10. **Update Vercel env vars** on `yi-connect-app` project (3 keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Values in YIP's `.env.local`. Use Vercel dashboard or `vercel env add` CLI.

11. **Trigger Vercel redeploy** — push commit OR manual from dashboard.

12. **Run `docs/AUTH_E2E_TEST_PLAN.md`** against production — 7 manual tests covering cross-app auth, dashboard load, chapter dropdown, /apply write path, chapter writes.

13. **Rename branch** `feat/auto-mount-mybugspanel` → `feat/platform-unification` before opening any PR.

### P3 — Cleanup + Director actions (non-blocking)

14. Delete dead `components/yip/ui/` orphan directory (14 files — all shadcn primitives shared via `components/ui/`).
15. **Director:** insurance quotes per `docs/INSURANCE_QUOTE_BRIEF.md` (ICICI Lombard, HDFC ERGO, Tata AIG).
16. **Director:** review `docs/BETA_AGREEMENT.md`, `BETA_CHAPTERS_OUTREACH.md`, `PRICING.md`, `PRIVACY_POLICY.md`, `MINOR_CONSENT_FLOW.md` before sending to chairs.
17. **DevOps:** configure GitHub Secrets for `.github/workflows/daily-backup.yml` (`SUPABASE_DB_URL`, `AWS_*`, `S3_BUCKET_NAME`).

## CRITICAL FILES TO READ (Q3 answer = "all the above")

1. `.claude/sessions/686673a5.md` — full session body
2. `app/yip/layout.tsx` — see nested `<html>` (P0 #1)
3. `app/yi-future/layout.tsx` — see nested `<html>` (P0 #2)
4. `lib/yi-future/supabase/server.ts` — see TS errors (P0 #3)
5. `docs/PHASE_B_FOLLOWUP.md` — Phase B limitations + open TODOs
6. `docs/AUTH_E2E_TEST_PLAN.md` — 7-test manual smoke for P2
7. `docs/PROGRAMS_UNIFICATION_FEASIBILITY.md` — original architecture rationale (note: SOME content superseded by user's monorepo correction)
8. `supabase/migrations/20260522*.sql` — 24 migrations from this session for reference

## Memory loaded this session (relevant to next)

- `feedback_dont_downgrade_locked_decisions` — don't unilaterally reframe locked AskUserQuestion answers during execution
- `project_yi_connect_unified_db` — yi-connect lives in shared Supabase under yi_connect schema; full Phase D context
- `feedback_silent_200_pattern` — Server Actions silent-success failure mode
- `feedback_schema_drift_check` — verify TS types vs live DB via Management API before debugging

## SESSION ENDED

- `progress.txt` updated (pointer prepended for pane 686673a5)
- `.claude/sessions/686673a5.md` written (full session body)
- 2 new memory entries written
- Atomic commit + push (`25c9cd6`, 477 files, REMOTE_SHA matches LOCAL_SHA)
- Phase D port files committed
- This brief written + verified
