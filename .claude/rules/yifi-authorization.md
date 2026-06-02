---
paths:
  - "app/yifi/**"
  - "lib/yifi/**"
---

# 🔴 YiFi Authorization Model

Auto-loads on `app/yifi/**` / `lib/yifi/**`. YiFi is **edition-scoped** and, today, **self-contained** — it does NOT yet read from `yi_directory` (it folds in later per the locked tier model). Service client: `@/lib/yifi/supabase/server`. Everything is scoped to the current edition via the `yifi_current_edition` RPC.

## Two principal types
1. **Organisers** — email + password (Supabase auth). The gate for every `/yifi/admin/*` page is `getAdminContext()` in `app/yifi/admin/_guard.ts`: it loads the current edition, then flattens permission keys from `yifi_check_organiser(email, edition)`. Pages call `hasPermission(ctx.permissions, "<key>")`; `"*"` = super (sees everything). No session → `redirect("/yifi/login")`; no active edition → `redirect("/yifi/admin")`.
2. **Registrants / members** — **access-code** based (no password). `validateAccessCode()` in `app/yifi/actions/auth.ts` resolves the code via `yifi_lookup_registrant` and sets an httpOnly `yifi_session` cookie `{ type:"member", id, name, editionId }`.

## Invariants
- **Deny EXPLICITLY:** every admin sub-page checks `hasPermission(...)` and renders `<AccessDenied>` — NOT a silent redirect (rule #27; already followed in `_guard.ts`).
- **Gate EVERY admin sub-page** with `getAdminContext()` + its own `hasPermission` key. Do not rely on the layout alone.
- **Service-client RPCs:** `yifi_current_edition`, `yifi_check_organiser`, `yifi_find_by_email`, `yifi_lookup_registrant`.
- **Future:** when YiFi migrates into `yi_directory`, the organiser permission lookup becomes a `role_assignments` read (`app='yifi'`). Until then, this self-contained organiser/permission model is the source of truth — do not assume yi_directory governs YiFi yet.
