# Continuation Brief — Yi Future 6.0

## VERIFY CURRENT STATE
Run these commands FIRST before doing anything:
- `curl -s -o /dev/null -w "%{http_code}" https://yi-connect-app.vercel.app/yi-future/join` — should be 200
- `git log --oneline -3` — expect `207daa1 session(yi-future): test run...`, `b2cb026 fix(yi-future): use hex #F5A623...`, `b25c3b3 fix(yi-future): button selected state...`
- `curl -s -o /dev/null -w "%{http_code}" https://yi-connect-app.vercel.app/yi-future/me` — should be 200 (with access code session)
- Verify Vercel deployment is current (last commit 207daa1 should be live)

## P0 — URGENT: Delegate Post-Registration Flow (client waiting)

The registration form (`app/yi-future/join/steps/register.tsx`) works and creates delegates in `future.delegates` with a 6-digit access_code. The current `celebration.tsx` step shows after registration but does NOT display the access code prominently.

**What needs to be built (sequential flow):**

1. **Thank-you page with access code display** — After `registerDelegate()` succeeds, show the 6-digit code in big text + "save this code" messaging + chapter chair contact info (email + phone). The action already returns the code in the response.

2. **Team formation flow** (`app/yi-future/me/team/`):
   - Captain creates team → invites members via dropdown of registered delegates in same chapter
   - Invited member logs in with their code → sees pending invite → accepts/rejects
   - Captain clicks "Team is Complete" button (min 1, max 5 members — constants already in `lib/yi-future/constants.ts` as `TEAM_SIZE_MIN`, `TEAM_SIZE_MAX`)
   - The `freezeTeam` action already exists in `app/yi-future/actions/team-invites.ts`

3. **Problem statement unlock** — After team is frozen (`is_frozen = true`), show PS picker. The team page (`app/yi-future/me/team/page.tsx`) already has `pickProblemStatement` and `clearProblem` actions wired. Currently visible regardless of frozen state — gate it behind `is_frozen` check.

4. **Post-PS selection: Journey view** — After PS is picked, show 90/60/30-day plan + mentor info + submission forms. Pages already exist at `app/yi-future/me/journey/`, `app/yi-future/me/submissions/`.

**Key files for P0:**
- `app/yi-future/join/steps/celebration.tsx` — modify to show access code
- `app/yi-future/join/steps/register.tsx` — registration form (working)
- `app/yi-future/actions/delegate-register.ts` — returns access_code on success
- `app/yi-future/actions/team-invites.ts` — has `freezeTeam`, `setLeader`, invite actions
- `app/yi-future/actions/teams.ts` — has `pickProblemStatement`, `clearProblem`
- `app/yi-future/me/team/page.tsx` — captain's team view (exists, needs PS gating)
- `app/yi-future/me/team/invites/page.tsx` — invite management
- `lib/yi-future/constants.ts` — TEAM_SIZE_MIN, TEAM_SIZE_MAX

**What's MISSING and needs creation:**
- Invite-via-dropdown UI (select registered delegates from same chapter)
- Accept/reject invite UI for non-captain members
- "Team Complete" confirmation button gated on member count
- PS picker visibility gated on `is_frozen`
- Access code prominent display on celebration step

## P1 — Client Demo Fixes

1. **Add 30-day programme duration** — Setup page currently has 60/90 day options only. Add 30-day to edition setup form.
2. **Fix "Clear pick" button** — Chapter admin team detail PS clear button not working (action exists at `clearProblem` in teams.ts)
3. **National admin delegate list** — Add individual delegate list view (not just grouped by team). National admin pages at `app/yi-future/(national)/national/`
4. **Finale dates editable in admin UI** — Columns exist (`finale_start_date`, `finale_end_date` on chapters table via migration 20260525090000). Need UI in chapter/host admin.
5. **Raipur host dual capability** — Host needs both "chapter prelim" tab AND "regional finale" tab in their admin view.

## P2 — Jury & Scoring Enhancements

1. Auto-assign teams to jury by track (4 jury categories = 4 tracks)
2. Journey gamification scoring (20% of total: ~5pts each for Phase A/B/C attendance)
3. Jury category management UI

## P3 — Communication

1. Mentor-team in-app chat (dedicated messaging between mentor and assigned team)
2. Chapter chair contact info on registration completion page

## KEY DECISIONS (from client demo 2026-05-25 — ALL LOCKED)

### Team Formation (LOCKED)
- Student registers individually → gets 6-digit code on screen
- Logs in with code → captain invites team members (dropdown of registered names from same chapter)
- Invited member logs in → accepts/rejects invite
- Captain clicks "team is complete" (min 1, max 5)
- Problem statements become visible ONLY after team confirmed (frozen)
- Quiz is optional helper alongside PS selection
- Anyone in team can pick PS (not just captain)
- No admin confirmation for PS — student picks, admin overrides via backend if needed

### Scoring Model (LOCKED)
- Jury evaluation: 80% of total score
- Journey gamification: 20% of total score (Phase A ~5pts, Phase B ~5pts, Phase C ~5pts, details TBD)

### Jury Structure (LOCKED)
- 4 jury categories (one per track: Climate Action, Healthcare, Smart Cities, Rural Development)
- Add jury members to a category
- Auto-assign teams to matching jury based on track
- All jury in a category evaluate all teams in that track

### Other Locked Decisions
- Code-based auth stays (not email/password for delegates)
- Mentor in-app chat: enabled
- Expert page: skipped
- Programme duration: add 30-day option
- Contact info on registration: chapter chair email + phone (not Yi National ID)
- PWA push notifications for team invites
- National admin needs individual delegate list (not just team view)
- Regional finale host needs both chapter prelim tab AND regional finale tab

## CONTEXT

- 65 chapter chairs + 8 national admins all have working logins (Supabase Auth)
- Delegates use 6-digit access codes (not Supabase Auth)
- 12 real problem statements from PPTX are live in `future.problem_statements`
- yi_directory.people bridges Yi Future <-> Yi Connect <-> YIP (cross-app identity)
- All sidebar links fixed (90 total) + permanent redirects in next.config.ts
- Button styling fix deployed (hex #F5A623 instead of yi-gold CSS var)
- Database schema: `future` schema in shared Supabase (bkmpbcoxbjyafieabxao)
- 5 test delegates seeded for Erode chapter, 2 test teams with submissions
- Track renamed: Climate Change -> Climate Action
- NER chapters (3) merged under ER (Raipur), Bengaluru duplicate fixed
- 4 tracks: Climate Action, Healthcare, Smart Cities, Rural Development

## FILES TO READ

| File | Why |
|------|-----|
| `.claude/sessions/b97e711f.md` | Full session log with all decisions |
| `app/yi-future/join/steps/register.tsx` | Registration form (working) |
| `app/yi-future/join/steps/celebration.tsx` | Post-registration step (needs access code display) |
| `app/yi-future/actions/auth.ts` | Access code validation + session management |
| `app/yi-future/actions/delegate-register.ts` | Registration action (returns access_code) |
| `app/yi-future/actions/team-invites.ts` | Team invite/freeze actions |
| `app/yi-future/actions/teams.ts` | PS pick/clear actions |
| `app/yi-future/me/team/page.tsx` | Captain's team view |
| `app/yi-future/me/team/invites/page.tsx` | Invite management |
| `lib/yi-future/constants.ts` | TEAM_SIZE_MIN, TEAM_SIZE_MAX, SESSION_COOKIE_NAME |
| `lib/yi-future/host-context.ts` | Multi-track host context (just refactored) |

## DEPLOYMENT

- Vercel project: yi-connect-app
- Production URL: https://yi-connect-app.vercel.app
- Auto-deploys on push to master
- Supabase: shared project bkmpbcoxbjyafieabxao, schema `future`
