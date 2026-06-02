---
paths:
  - "app/yip/**"
  - "lib/yip/**"
---

# 🔴 YIP Authorization Model (two gates — never mix them)

This rule auto-loads whenever you work in `app/yip/**` or `lib/yip/**`. It was split out of the root `CLAUDE.md` so non-YIP sessions (Yi-Future, YiFi, dashboard) don't carry it in context.

1. **Event-scoped actions** (anything tied to one event: import / allocate / lock / go-live / score / compute / publish, and every `events/[id]/*` page + layout) → `getYipEventAccess(eventId)` from `lib/yip/auth/event-access.ts` → `{ canView, canManage, canDelete, role, reason }`. chair = `chapter_admin` (full incl. delete); organiser = `chapter_organizer` (everything but delete); above chapters: YIP `national`/`super_admin` (any event), `regional_admin` (within zone). **`events.created_by` is NOT an authz signal** — authz is purely role-based via `yi_directory.role_assignments`.
2. **Platform master data** (rubrics, seasons, topic catalogue, admin team, checklist templates, branding rules, cross-event pipeline promotions — everything under `/yip/dashboard/admin/*`, `app/yip/actions/admin-*`, `pipeline.ts`) → `requireSuperAdmin()` from `lib/yip/auth/require-super-admin.ts`. NOT event-scoped; `getYipEventAccess` does not apply.

**Two hard rules for every gate:**
- **Fail CLOSED.** Null/unknown scope must DENY. `&& scope && target !== scope` is a fail-OPEN bug (null scope skips the block). Correct form: `&& target && (scope === null || target !== scope)`.
- **Deny EXPLICITLY.** Render `<Forbidden403>` (`app/yip/_components/Forbidden403.tsx`) or return `{ success:false, error }` — NEVER a silent `redirect()` to a landing page (it creates an undiagnosable bounce-loop). Gate **every** sub-page + layout with the same helper; one stale `.eq("created_by")` silently 403s every child.
