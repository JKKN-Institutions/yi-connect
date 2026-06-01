# Siloed visibility — design note (Decision 3)

**Decision (2026-05-31 interview):** *Siloed — each app's admin sees only their own app's relationship with a person.* The same human can exist across YIP, Yuva, Thalir, etc.; sharing one **identity** must NOT mean sharing **visibility**. A YIP admin must not see a person's Thalir/child-safety data just because the `yi_directory.people` row is shared. This protects minors by default.

## The primitive
`yi_directory.current_user_can_see(p_app, p_chapter, p_zone) → boolean`
(migration `20260601060000_siloed_scope_helper.sql`)

Returns true if the **current auth user** holds an active role whose scope covers the given `(app, chapter, zone)`:
- `super_admin` → always (cross-app root)
- `national` / `platform_admin` of `p_app` → all of that app
- a `chapter` role matching `p_chapter`, or a `zone` role matching `p_zone`

It mirrors `can()`'s read-scope logic in SQL so it can run inside RLS `USING` clauses. `SECURITY DEFINER` so the policy can read `yi_directory` regardless of the caller's own RLS.

## How to silo a relationship table (per-table follow-up)
1. Ensure the table carries its **owning scope** — add `yi_chapter text` and/or `yi_zone text` columns (and backfill). Relationship rows must know which chapter/zone they belong to, since `yi_directory.people` is app-agnostic.
2. Enable RLS and add a SELECT policy:
   ```sql
   CREATE POLICY siloed_read ON yip.participations
     FOR SELECT TO authenticated
     USING ( yi_directory.current_user_can_see('yip', yi_chapter, yi_zone) );
   ```
3. Keep the existing service-role policy (the server actions use the service client and intentionally bypass RLS — enforcement for them happens in the action via `can()`).

## Status / open items
- ✅ Primitive created.
- ⏳ `yip.participations` is not yet siloed — it lacks `yi_chapter`/`yi_zone` columns and has no user-context read path yet (only service-client actions). Add the columns + policy when a user-facing read path is built.
- ⏳ When Thalir/Yuva land, every relationship table gets this policy from day one (never a per-vertical reinvention).
- The **write** side is already siloed at the action layer via `can()` (e.g. `participant.manage` is chapter/zone-scoped).
