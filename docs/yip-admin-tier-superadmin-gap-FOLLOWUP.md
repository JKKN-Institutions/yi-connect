# YIP Admin-Tier Super-Admin Gap — Follow-up (separate PR)

**Found:** 2026-05-30 adversarial sweep, during the chapter-roles PR (`feat/yip-chapter-roles`).
**Scoped out** of that PR (which is the per-chapter *event* model). This is a distinct **platform super-admin boundary** fix.

## The hole
`app/yip/dashboard/admin/layout.tsx` gates only on `if (!user) redirect("/yip/login")` — **any authenticated Yi member reaches every `/admin/*` page**. The admin server actions are also ungated (service client, no role check). So any logged-in user can read/edit **platform-wide master data**: scoring rubrics, seasons/years, the central+regional topic catalogue, the admin team list, checklist templates, branding rules, and run pipeline promotions.

These are NOT event-scoped (no `event_id`), so `getYipEventAccess` does not apply — the correct gate is **super-admin** (`requireSuperAdmin()` from `lib/yip/auth/require-super-admin.ts`, which already resolves YIP national / platform super_admin).

## Files to fix (each: add `requireSuperAdmin()` at the top of every exported write action; return `{ ...success:false, error }` on deny)
- `app/yip/actions/admin-rubrics.ts` — 6 writes (rubric CRUD)
- `app/yip/actions/admin-seasons.ts` — 6 writes (yi_year / season CRUD)
- `app/yip/actions/admin-topics.ts` — 9 writes: `adminCreateTopic/adminUpdateTopic/adminDeactivateTopic/adminReactivateTopic/adminReorderTopics/adminBulkImport` (catalogue). NOTE: `attachCentralTopicsToEvent` and `pushCentralTopicsToAllChapterEvents` are event-touching — gate the per-event one via getYipEventAccess(canManage) or keep it internal-only (it's called by createEvent which is now gated); gate the bulk "push to all chapter events" as super-admin.
- `app/yip/actions/admin-team.ts` — 6 writes (organizer/team membership)
- `app/yip/actions/admin-checklist.ts` — 8 writes (checklist_template CRUD)
- `app/yip/actions/admin-branding-rules.ts` — 5 writes (brand_rules CRUD)
- `app/yip/actions/people.ts` — 7 writes (yi_directory people / contestants) — review intended audience; likely super-admin.
- `app/yip/actions/hierarchy.ts` — 2 writes incl. `setEventZone` (events.update) — event-scoped, should be getYipEventAccess(canManage) or super-admin.
- `app/yip/actions/pipeline.ts` — 6 writes: `markQualified`, `promoteToEvent`, `createRegionalEvent`, `createNationalEvent` (write participants/promotions/events) — super-admin (cross-event promotion is a national function).

Also: `app/yip/dashboard/admin/layout.tsx` should redirect/Forbidden non-super-admins (defense-in-depth so the pages don't even render), and `schools.ts` `createSchool`/`updateSchool`/`findOrCreateSchool` (yi.institutions master data) should be super-admin (only `deleteSchool` is gated today).

## Verification
- `npx tsc --noEmit` clean on main tree after.
- Re-run the adversarial sweep probe "ungated-mutations" restricted to admin-*/pipeline.
- Manual: a chapter organiser hitting `/admin/rubrics` etc. must get Forbidden; a national/super-admin must still work.

## Why separate
The chapter-roles PR is about who can run a *chapter event*. This is about who can edit *the platform itself*. Different gate (`requireSuperAdmin` vs `getYipEventAccess`), different reviewers, and folding it in would bloat an already-large security PR. Tracked here so it isn't lost.
