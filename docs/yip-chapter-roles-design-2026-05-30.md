# YIP Two-Role Per-Chapter Model + RLS Write Fix — Design

**Date:** 2026-05-30 · **Branch:** `feat/yip-chapter-roles` (stacked on `fix/yip-idor-delete-gates` / PR #248)
**Decided via Director interview.** Deadline pressure: user chose "block June 4 demo on this fix," so it must merge + deploy to production before 2026-06-04.

## Why
Two problems surfaced while testing the real Excel-import path on production:
1. **Brittle single-owner model.** Every organiser action gated on `events.created_by === user.id`. Only the one account that created the event could import/allocate/run it. Super-admins could *see* but not *import* (the "pradeep — Event not found or not authorized" error).
2. **RLS write-block (bigger bug).** `yip.parties / participants / events / jury_assignments / agenda` have RLS **enabled** with **read-only policies + no write policy for `authenticated`**. Only `service_role` can write. The importer creates parties via the **session** client → DB rejects: *"new row violates row-level security policy for table parties."* This means **UI import / addJury / live-control / allocation have never worked for a logged-in user** — all existing data was service-role seeded. Invisible until a human clicked Import.

## The model
Two chapter-scoped roles in `yi_directory.role_assignments` (app=`yip`, `yi_chapter` = event.chapter_name):
- **chapter_admin** (chair) — `canView + canManage + canDelete`.
- **chapter_organizer** — `canView + canManage`, **NOT** `canDelete`. The ONLY thing an organiser cannot do is delete rows / delete the event.

Capabilities (final): `canView`, `canManage` (import, allocate, lock/**unlock**, parties/jury/topics/venue, assign roles, **go live**, **compute + publish results**, check-in), `canDelete` (row + event deletions — chair only).

Above chapters: YIP `national`/`super_admin` (full, any event) and `regional_admin` (full within their zone).

### Chair grant (decided)
Admin granted by EITHER (a) explicit `app='yip', role='chapter_admin'` for the chapter, OR (b) user email == `yi.chapters.chair_email` (normalized). **Precedence ("exactly one admin"):** explicit role is canonical; chair_email is the fallback when no explicit role exists. Both grant identical full capability — no conflict in *what* they can do. When national assigns an explicit admin, also update `chair_email` so the two converge.

### created_by
**No longer an authorization signal.** Pure role-based. A migration seeds nobody is required — national survivors (director, pradeep both hold yip/national) keep full access; chair_email covers chapter chairs (e.g. Mizoram = alan@lailen.com). Organisers are explicitly assigned.

### Other interview answers
- Organiser count: one organiser + chair per chapter (not DB-enforced; convention).
- Who assigns: chair OR national (both).
- Blocked-action UX: **hidden entirely** (no greyed buttons).
- No-chair fallback: national holds delete until a chair exists.

## Edge cases walked (2026-05-30)
- **E1** organiser = all-except-delete (corrected an early draft that wrongly blocked publish).
- **E2** defense-in-depth: hide delete buttons AND server rejects organiser deletes.
- **E3** email + chapter-name matching normalized `lower(trim())`. NER names match exactly (Mizoram/Guwahati/Nagaland verified).
- **E4** director + pradeep both `yip/national` → survive created_by removal. Mock events (no chapter link) → national-only, fine.
- **E5** Mizoram chair alan@lailen.com has login + people row but only a `future` chapter_chair role → **chair_email path is what makes him work** (no YIP role seeded). → grant = "both" (email OR explicit role).
- **E6** email-edit instantly transfers delete power → user accepted (chair_email is national-managed).
- **E7** exactly one *effective* admin via precedence (explicit role wins; else chair_email).

## Implementation plan

### New file (done)
- `lib/yip/auth/event-access.ts` — `getYipEventAccess(eventId) → { canView, canManage, canDelete, role, reason }`. The single gate. ✅ written.

### RLS write fix (part of this PR)
Route **all gated organiser writes through the service client** AFTER the `getYipEventAccess` check passes — mirrors how `createParty`/`topics.ts` already correctly use the service client. Do NOT loosen RLS policies (keep DB locked down; the app is the gate). Files where session-client writes currently fail under RLS: `participants.ts` (import/add/checkin/setRole), `jury.ts` (addJury/removeJury), `agenda.ts` (advance/timer/speaker), `allocation.ts` (run/lock/unlock/override). Convert their write paths to service client + capability check.

### Gate replacement (the ~16 `created_by === user.id` sites)
Replace each with `getYipEventAccess(eventId)`:
- **Manage actions** (import, addParticipant, checkIn, setParliamentRole, addJury, allocation run/lock/unlock, agenda, parties create/assign, topics, venue/update, lock toggles, computeResults, publish/unpublish) → require `access.canManage`.
- **Delete actions** (deleteParticipant, deleteParty, deleteMotion, deleteVolunteer, removeJury, deleteRegistration, deleteMedia, bulkDeleteMedia, deleteInvitation, delete event) → require `access.canDelete`.
- `getEvent()` view gate → require `access.canView` (keeps 3-tier + adds chapter roles).

### UI
- `getYipEventAccess` surfaced to the event layout; pass `canDelete`/`canManage`/`role` down so delete buttons + chair-only controls are **hidden** for organisers (participants-client, parties, motions, volunteers, registrations, media, branding, results danger-zone).

### Assignment tooling
- A server action + minimal admin UI for chair/national to assign/remove a chapter_organizer (and explicit chapter_admin), writing `yi_directory.role_assignments`.

### Verification
- `npx tsc --noEmit` clean on main tree after merge.
- Re-run the adversarial gate sweep (the completeness critic that caught the IDOR holes).
- Manual: as organiser → import works, delete hidden+rejected; as chair → delete works; as outsider → Forbidden.
- The RLS path: confirm a *session-authenticated* organiser import now succeeds (the test that just failed).

## Open risk
Production-auth change on a 5-day clock. Mitigation: ship behind the existing PR-review flow; keep master untouched until merged; Mizoram demo data is already service-seeded (94+5 restored) so the event is safe regardless of merge timing.
