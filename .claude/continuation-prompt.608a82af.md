## VERIFY CURRENT STATE
```bash
cd /Users/omm/PROJECTS/yi-connect && git log --oneline -5
cd /Users/omm/PROJECTS/yi-connect && git status --short | head -30
cd /Users/omm/PROJECTS/yi-connect && npx supabase db ping --linked 2>&1 | head -5
cd /Users/omm/PROJECTS/yi-connect && cat .env.local | grep -E 'SUPABASE_URL|VERCEL' | sed 's/=.*/=***/'
cd /Users/omm/PROJECTS/yi-connect && npm run build 2>&1 | tail -5
```

## CONTEXT
Yi Connect is the unified Yi member platform (PWA) replacing Stutzee — it hosts YiFi (routing/vows/dossiers for the July 17 Madurai national summit), Yi Future (problem-solving event), YIP, chapter health, and Yi Journey. Last session built the entire YiFi module (14 files), extended events with scope/capabilities, unified PWA + Google-first auth, built mobile nav + Yi Journey + chapter health dashboard, and authored the vision doc defining 7 differentiators over Stutzee. There are 32 uncommitted files from the session that need to be committed and deployed.

## KEY DECISIONS
- **YiFi is an event, not a competition** — organiser roles replace jury/scoring. No competition semantics.
- **event_capabilities JSONB on events table** — any event can enable routing/vows/dossiers; YiFi just maxes all capabilities. National events default all-on, chapter events default all-off.
- **Google-first auth eliminates access codes** — OAuth callback auto-sets module session cookies by email match. Access codes are fallback only.
- **PostgREST workaround** — yifi schema tables accessed via SECURITY DEFINER plpgsql functions in public schema (adding yifi to db_schema causes PGRST002 cache hang).
- **Don't replicate Stutzee** — build what makes it unnecessary via 7 Yi-specific differentiators (health card auto-pilot, personalised routing, dossiers, vow wall, Yi Journey, chapter OS, multi-level event scope).
- **Shared Supabase project** — project ID bkmpbcoxbjyafieabxao hosts all modules (yi-future, yifi, yip, events).

## P0 TASK
**Deploy yi-connect to Vercel and CFT-verify Google OAuth flow end-to-end.** Success criteria: (1) `vercel --prod` succeeds with no build errors, (2) visiting the production URL shows the Yi Connect landing page, (3) Google OAuth login redirects correctly and sets session cookies, (4) authenticated user lands on correct module based on their registrations, (5) `/yifi/admin` is accessible with organiser role.

## TASK QUEUE (ordered)
1. Commit the 32 uncommitted files from last session (group logically: yifi module, auth changes, PWA unification, UI components)
2. Import real 170 YiFi registrants from registration CSV into yifi.registrants table
3. Build admin sub-pages: registrant management, census monitor, match curation interface
4. Yi Journey + Chapter Health with real Supabase queries replacing mock data
5. Generalise routing capabilities to all events

## MUST-READ FILES
- `/Users/omm/PROJECTS/yi-connect/docs/yi-connect-vision.md`
- `/Users/omm/Vaults/Young Indians/Erode-Yi/National-Events/YiFi-Madurai-2026/spec.md`
- `/Users/omm/PROJECTS/yi-connect/progress.txt`

## LANDMINES
- **32 uncommitted files** — must commit BEFORE deploying or risk deploying stale code.
- **Supabase CLI was relinked** last session — verify `supabase db ping --linked` hits bkmpbcoxbjyafieabxao before any migrations.
- **PostgREST PGRST002** — do NOT add `yifi` to `db_schema` in Supabase dashboard. Use public-schema RPC functions with SECURITY DEFINER.
- **PWA manifest** — verify `/manifest.webmanifest` returns 200 on production (was blocked by middleware, fixed last session).
- **Worktree debris** — 13 agent worktrees in `.claude/worktrees/` from parallel-agent runs. Don't commit these.
- **YiFi deadline July 17** — 7 weeks remaining. Import of 170 registrants blocks admin tooling and match generation.
