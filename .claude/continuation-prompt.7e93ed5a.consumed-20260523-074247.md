# Yi Connect — Continuation Brief from 2026-05-22 PM session

## ONE-LINE GOAL
Next P0 is to work all 4 P0 items in order: fix YiFuture bare-path redirects (small autonomous win), migrate real chapter data from old Supabase project jxvbjpkypzedtrqewesc into the new yi_connect schema (large autonomous), then await Director on GitHub Secrets + Sentry DSN and the fate of the old Supabase project.

## WHERE WE ARE
Production is live at yi-connect-app.vercel.app. Phase E hotfix sweep finished this session. 124 RLS policies were rewritten across the yi_connect schema to remove infinite-recursion class (members policy now subqueries profiles; downstream tables collapse hops). The dangerous GRANT SELECT on auth.users was revoked. Google OAuth was recreated under a director@-owned project (yi-connect-auth-2026) after the prior project's permission walls blocked edits. All 13 admin routes were CFT-verified clean on production. The yi_connect schema is healthy but only Erode chapter is seeded — 64 other chapters of real data still sit in old Supabase project jxvbjpkypzedtrqewesc and have not been migrated.

## VERIFY CURRENT STATE (run these read-only commands first)

```
cd /Users/omm/PROJECTS/yi-connect
git log --oneline -3                                                                  # confirm latest = 6d93ec6 docs(session) on master
git status --short | grep -v worktrees | head -5                                      # should be clean (worktree dirs OK)
curl -sk -o /dev/null -w "%{http_code}\n" https://yi-connect-app.vercel.app/dashboard # 307 (auth-gated) — expected
curl -sk -o /dev/null -w "%{http_code}\n" https://yi-connect-app.vercel.app/yip       # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://yi-connect-app.vercel.app/yi-future # 200 (Phase D port live)
```

If git log doesn't show 6d93ec6 on master, or production routes return 5xx, STOP — something diverged between session-end and now. Surface to user before proceeding.

## NEXT TASKS (priority order)

1. **[P0 — autonomous] Fix YiFuture bare-path redirects in `app/yi-future/actions/auth.ts`**
   - Lines ~90, 108, 125, 145 return `/me`, `/mentor`, `/jury`, `/partner`, `/join?just_joined=1` as redirect strings.
   - After Phase D port, these 404 because the YiFuture app is mounted at `/yi-future`, not root.
   - Fix: prepend `/yi-future` to each redirect. Verify via CFT: anonymous user hits `/yi-future/join` → submits form → redirects to `/yi-future/me/...` not bare `/me`.
   - Size: small (15-30 min). Won't touch any file outside that one auth actions module.
   - Touch only this one file — rule #22 STAY IN SCOPE applies.

2. **[P0 — large autonomous] Migrate real chapter data from old Supabase → `yi_connect`**
   - Source: `jxvbjpkypzedtrqewesc.public.{members,events,approved_emails}` — 65 chapters with real data.
   - Target: `bkmpbcoxbjyafieabxao.yi_connect.{members,events,approved_emails}` — currently only Erode seeded.
   - **BEFORE bulk-inserting**, enumerate row counts on both sides and evaluate three strategies:
     - (a) pg_dump from old → sed-rewrite schema name → restore into new project
     - (b) batched REST INSERT via service-role keys + admin client
     - (c) temporary Foreign Data Wrapper + INSERT...SELECT inside the new project
   - **Critical constraint**: `auth.users` rows must already exist in new project for FK on members.user_id. Verify cross-project auth.users mapping BEFORE bulk insert — auth is shared via cross-app SSO so this should be true but must be confirmed.
   - RLS: use service role + admin Supabase client + manual chapter scoping (the bypass pattern Agent B/C established this session — read `feedback_phase_d_column_drift.md` and the session body sections on Agent B/C for the exact admin-client pattern).
   - Column drift: old project schema has slightly different column names (fiscal_year vs calendar_year, missing skill_will_category, events.organizer_id FK shape differs). Map columns explicitly in the migration script — do NOT trust SELECT *.
   - Verify: count(*) parity per chapter per table; spot-check a non-Erode chapter (e.g. Coimbatore or Chennai) renders in production `/members` and `/events` with correct data.
   - Size: large (3-5 hours). DO NOT START until row counts enumerated and a strategy chosen via AskUserQuestion (see OPEN QUESTIONS).

3. **[P0 — Director-gated] GitHub Secrets + Sentry DSN setup**
   - Director must set these (do NOT action on Director's behalf per CLAUDE.md "no auto-actions"):
     - GitHub Secrets in `JKKN-Institutions/yi-connect`: `SUPABASE_DB_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
     - Vercel env var `NEXT_PUBLIC_SENTRY_DSN` in yi-connect-app project (production + preview + development scopes)
   - Once Director confirms each is set, autonomous verify:
     - Manually trigger the daily-backup workflow run → confirm S3 dump object landed in the bucket
     - Trigger a test error from production → confirm it appears in the Sentry project dashboard
   - Surface the checklist to Director and stand by — don't push, don't ask repeatedly.

4. **[P0 — Director decision] Fate of old Supabase project `jxvbjpkypzedtrqewesc`**
   - Still ACTIVE and billing. Three options for Director to pick via AskUserQuestion:
     - (a) Keep ~30 days as warm fallback, then decommission
     - (b) Decommission now (only AFTER task 2 data migration completes and parity is verified)
     - (c) Downgrade to free tier as cold archive
   - Once Director picks, execute via Supabase Management API. Block (b) until task 2 verification is green.

## KEY DECISIONS

**Why these 4 tasks and this order:**
- User said "all the above" — all 4 are P0, must be worked.
- Sequencing: task 1 (small, autonomous, fast win to build momentum) → task 2 (large, autonomous, contains the actual unlock that turns Yi Connect from a pilot into a multi-chapter platform) → tasks 3 and 4 (Director-gated, can run in parallel with the user once flagged).
- Task 2 is the critical-path item — without real chapter data migrated, Yi Connect remains Erode-only and can't be opened to other chapters.

**Patterns from this session worth carrying forward:**
- **CFT can unblock "gated" GCP/Google admin actions via owned resources.** When permission walls block edits on resource X owned by another user, check if the user owns a fresh resource X' where the dependency can be recreated from scratch. Google OAuth recreate took ~15 minutes via a director@-owned project, vs unknown days waiting for permission escalation. See `feedback_cft_owned_resources_unblock_gated.md`.
- **JS `.click()` is unreliable on Radix / Material UI / Google Cloud Console commit buttons.** Synthetic clicks dispatch the event but the React/MUI handler doesn't fire. Use CDP `Input.dispatchMouseEvent` for a real OS-level click, or fall back to asking the user to click. Cost ~15 min of debugging this session. See `feedback_synthetic_click_misses_modern_ui_libs.md`.
- **Phase A schema port copied RLS predicates verbatim and created a recursion class.** Fix members policy FIRST to subquery profiles (the parent identity table), then collapse hops in downstream tables that referenced members in their USING clause. Migration `20260522160000_yi_connect_rls_cleanup.sql` shows the pattern across 124 policies.
- **Column drift after a schema migration is its own distinct bug class.** fiscal_year vs calendar_year, missing skill_will_category, vanished events.organizer_id FK — all surfaced as generic "Failed to fetch X" errors with the real Postgres error buried in the action's catch block. When debugging Phase-D-shaped errors, `console.log` the raw error object BEFORE trying any fix.
- **Parallel worktree agents (3-4 per batch on non-overlapping file sets) scale well.** 11 agents across 3 batches completed cleanly this session. Use this pattern for any "fix N independent things" task — assign each agent a disjoint file set and merge worktrees at the end.

**Probe verdict from session end:** healthy. No prior probe-facts to compare against (session started fresh), but symptom check was clean — no redundant reads, no repeated greps, sharp recall of file paths and Phase A/B/C/D/E context throughout.

## MUST READ FIRST

User said "all" on the surface-paths question. Read in this order before starting task 1:

1. `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/MEMORY.md` — full memory index for this project
2. `/Users/omm/PROJECTS/yi-connect/.claude/sessions/7e93ed5a.md` — full body of the session that just ended
3. The 5 newest memory files (all relevant to the next session):
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_rls_recursion_pattern.md`
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_auth_users_grant_leak.md`
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_phase_d_column_drift.md`
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_cft_owned_resources_unblock_gated.md`
   - `/Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_synthetic_click_misses_modern_ui_libs.md`
4. `/Users/omm/PROJECTS/yi-connect/CLAUDE.md` — project rules (the nextjs16-web-development skill is mandatory for any module work; advanced-tables-components is mandatory for any new data table)
5. `/Users/omm/PROJECTS/yi-connect/progress.txt` — top 20 lines for cross-pane awareness

After those reads, run the VERIFY CURRENT STATE block, then start task 1.

## OPEN QUESTIONS FOR USER

Surface via AskUserQuestion BEFORE starting task 2 (do not block tasks 1, 3, or 4 on these):
- Task 2 strategy: (a) pg_dump+restore with schema rewrite, (b) REST batch INSERT via service role, (c) temporary Foreign Data Wrapper + INSERT...SELECT — which path?
- Task 2 scope: migrate ALL 65 chapters' historical data, or only Erode + chapters with active 2026 events (smaller blast radius, faster verification)?
