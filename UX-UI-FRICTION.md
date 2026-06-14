# UX / UI friction log — Yi Connect main dashboard

Found while authoring the role-aware smart guide (`/user-guide`). Authoring a
guide is a free UX + UI audit: flow problems surface from the steps, visual
problems from opening each screen. Logged here instead of papered over.

> **Authoring caveat:** the guide content was authored from the app's real
> routes (verified to exist), not by opening every screen. The in-browser
> click-through pass (verification step) is what closes the UI half of this audit.

| # | Screen / element | UX or UI | Problem | Suggested fix | Severity | Status |
|---|---|---|---|---|---|---|
| 1 | Sidebar "Members" parent (`href: '/members'`) | UX / routing | There is **no** `app/(dashboard)/members/page.tsx` — the module index doesn't exist. Clicking the parent "Members" item likely 404s; the real listing is `/members/table` and `/members/grid`. | Point the parent to `/members/table`, or make it a non-navigating group header. Guide deep-links already use `/members/table`. | Medium | Open (out of scope for this change — flagged) |
| 2 | `/user-guide` discoverability | UX | The real user-guide page had **no sidebar link at all** — the sidebar "User Guide" item pointed to `/admin/docs`, so the user guide was reachable only by typing the URL. | Added a "Guide" sidebar item → `/user-guide` (visible to all) + a "? Help" FAB on every page. | Medium | **Resolved by this change** |
| 3 | Sidebar "User Guide" label | UI / IA | Labeled "User Guide" but linked to `/admin/docs` (admin module documentation) — a mislabel that sends users to the wrong place. | Relabeled that item to "Admin Docs" (kept its admin-only role gate); the new "Guide" item is the actual user guide. | Low | **Resolved by this change** |
| 4 | Floating action buttons | UI | The dashboard now has three FABs: Activity Planner (bottom-left, z-50), Bug Reporter (bottom-right, z-[60]), and the new Help FAB (bottom-left, raised above Activity Planner, z-40). | Help FAB placed at `bottom-20 left-4` to stack above Activity Planner and clear the mobile bottom navbar. **Confirm no overlap on a ~390px phone viewport.** | Low | Needs browser check |
| 5 | Vertical Head / Coordinator help access | UX | The old "User Guide" nav gate excluded Vertical Head and Coordinator roles entirely — those personas had no path to help. | The new "Guide" item has no role gate (visible to everyone); the guide opens on each role's own lane. | Medium | **Resolved by this change** |
