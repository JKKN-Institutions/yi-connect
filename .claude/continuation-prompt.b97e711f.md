# Continuation Brief — Yi Connect — 2026-05-29

## VERIFY CURRENT STATE
```bash
# 1. Confirm we're on master and synced
cd /Users/omm/PROJECTS/yi-connect && git log --oneline -5 && git status

# 2. Confirm latest Vercel deploy is live
curl -s -o /dev/null -w "%{http_code}\n" https://yi-connect-app.vercel.app/admin/directory

# 3. Hit the diagnostic endpoint (browser-only — needs director@ session cookie)
echo "Open in browser logged-in as director@jkkn.ac.in:  https://yi-connect-app.vercel.app/api/admin/whoami"

# 4. Confirm key files still exist
ls -la /Users/omm/PROJECTS/yi-connect/app/api/admin/whoami/route.ts /Users/omm/PROJECTS/yi-connect/lib/yip/auth/require-super-admin.ts /Users/omm/PROJECTS/yi-connect/lib/yi/auth/yi-directory-roles.ts

# 5. Confirm director@'s role_assignments rows in yi_directory are still active
echo "Run via Supabase Management API SQL on bkmpbcoxbjyafieabxao:  SELECT app, role, is_active FROM yi_directory.role_assignments ra JOIN yi_directory.people p ON p.id=ra.person_id WHERE p.email='director@jkkn.ac.in';"
```

## SESSION SUMMARY
This session wired Yi Future's P1 polish: quiz results now carry the chosen track into registration via `?track=` URL param plus `yifuture_quiz_track` localStorage, with the registration server action accepting an optional `preferred_track_slug` for pre-selection. Built a full Supabase-PKCE forgot-password / reset-password flow under `/yi-future/access/forgot-password` and `/yi-future/access/reset-password`, including middleware updates to whitelist the new public prefixes (`/yi-future/access`, `/yi-future/quiz`) that were 404ing on the CDN edge. Zeroed out Sandbox + Erode chapters (delegates + teams) so real registrations start clean, while preserving director@'s super-admin record on `yi.national_admins`. Shipped diagnostic endpoint `/api/admin/whoami` to surface what `getCurrentPersonRoles()` actually returns for the logged-in user — needed because director@ is hitting a 403 on `/admin/directory` despite having three active role_assignments (`yip/national`, `future/super_admin`, `future/platform_admin`) that should each independently pass the gate. New memory `feedback_postgrest_delete_schema_header.md` saved.

## P0 — Next Session Tasks
1. **[P0] Debug /admin/directory 403 for director@**. The diagnostic endpoint `/api/admin/whoami` is live in production — visit it in browser while logged in as director@ to see what `getCurrentPersonRoles()` actually returns. Then fix the gate or the data, then STRIP the diagnostic endpoint.
2. **[P0] Strip `/api/admin/whoami`** once bug is fixed (delete `app/api/admin/whoami/route.ts` + commit).
3. **[P1] Send password-reset** to 5 admins who never signed in (akshar@groupnish.com, koushikmodi26@gmail.com, manav@boxpushindia.com, mayank.jain@cii.in, varanmittal@gmail.com).
4. **[P1] Wire audit log** to `getCurrentPersonRoles` so every admin-route gate check is recorded with person_id + outcome.
5. **[P2] Real-time Supabase subscription** on jury live dashboard (replace polling).
6. **[P2] PWA push notifications** for team invites.

## KEY DECISIONS
- **Quiz → registration carry-channel**: uses `?track=` URL param + `yifuture_quiz_track` localStorage. Pre-selection happens via the registration server action's optional `preferred_track_slug` input, NOT a UI-side track field — delegates don't pick track during the 4-section registration; the quiz result IS their track choice.
- **Forgot-password flow uses Supabase PKCE**: `/yi-future/access/forgot-password` calls `resetPasswordForEmail` with `redirectTo=/yi-future/access/reset-password`. Reset page exchanges the auth code from the URL, then calls `updateUser({ password })`. Email sent via Supabase's default templates.
- **Middleware public prefixes** extended to include `/yi-future/access` and `/yi-future/quiz` — without that, the new nested forgot-password/reset-password routes 404'd on the CDN edge.
- **Sandbox + Erode chapters fully zeroed** (delegates + teams). Real registrations will start clean.
- **director@ super-admin status preserved**: `yi.national_admins.is_super_admin=true` left untouched after delegate cleanup.

## FILES TO READ FIRST (Q3 = all)
| File | Why |
|---|---|
| /Users/omm/PROJECTS/yi-connect/lib/yip/auth/require-super-admin.ts | The gate that's failing for director@ |
| /Users/omm/PROJECTS/yi-connect/lib/yi/auth/yi-directory-roles.ts | Where `getCurrentPersonRoles` + `isPlatformSuperAdmin` live |
| /Users/omm/PROJECTS/yi-connect/app/admin/directory/page.tsx | The 403 surface |
| /Users/omm/PROJECTS/yi-connect/app/api/admin/whoami/route.ts | Diagnostic endpoint (strip after fix) |
| /Users/omm/PROJECTS/yi-connect/.claude/sessions/b97e711f.md | Full session details |
| /Users/omm/.claude/projects/-Users-omm-PROJECTS-yi-connect/memory/feedback_postgrest_delete_schema_header.md | New memory from this session |

## OPEN BUG (must fix first)
**director@jkkn.ac.in gets 403 on `/admin/directory`** despite having all THREE of these active role_assignments in `yi_directory`:
- `app='yip', role='national', is_active=true` (should pass Path 1 of `requireSuperAdmin`)
- `app='future', role='super_admin', is_active=true` (should pass Path 2 via `isPlatformSuperAdmin`)
- `app='future', role='platform_admin', is_active=true`

Both gate paths should trip true. **Visit `/api/admin/whoami` in browser while logged in** to see what `getCurrentPersonRoles` actually returns — that's the cheapest diagnostic.

Likely candidates:
1. `auth.getUser()` returning null because the yip supabase client cookie scope doesn't extend to `/admin/*` paths
2. `svc.schema("yi_directory")` override silently failing when service client was created with `db:{schema:"yip"}`
3. `person_id` lookup returning null for some unforeseen reason (email casing, trimmed whitespace, soft-delete flag)

## DEPLOYMENT
- **Vercel project**: yi-connect-app (jkkn-institutions team)
- **Production URL**: https://yi-connect-app.vercel.app
- **Auto-deploys** on push to `master`
- **Supabase**: `bkmpbcoxbjyafieabxao` (shared Yi platform DB, `yi_connect` + `yi_directory` + `yi` + `yip` + `future` schemas)
