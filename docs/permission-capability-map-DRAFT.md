# Permission Capability Map — DRAFT

**Date:** 2026-05-31 · **Status:** DRAFT — review before relying on this
**Layer:** 3 (scoped permissions) of the yi_directory consolidation plan ([yi-directory-consolidation-plan-2026-05-31.md](./yi-directory-consolidation-plan-2026-05-31.md) §4, §6 Phase 7)
**Backs:** `yi_directory.role_permissions` (migration `20260531130000_role_permissions.sql`) and the `can()` gate (`lib/yi/auth/can.ts`)

> ⚠️ **This is a DRAFT for Director ratification, NOT a security-final map.**
> Per the plan §8/§9, the capability→role→scope map is a **human policy decision** — an
> agent can build the machinery (table + gate) but cannot decide what each role may
> actually do. The six rows below are a deliberately small, conservative seed so the
> gate can be exercised. **Do not rely on these allow/deny answers in production
> until they are reviewed and expanded.**

---

## Proposed map (as seeded)

App = `yip` for every row in this draft.

| Capability    | Role             | Scope     | Meaning (proposed)                                              |
|---------------|------------------|-----------|----------------------------------------------------------------|
| `*`           | `national`       | `global`  | National role may do anything, anywhere in YIP.                |
| `*`           | `super_admin`    | `global`  | Platform super-admin — unrestricted (matches existing convention). |
| `*.read`      | `regional_admin` | `zone`    | Regional admin may READ anything within their own zone.        |
| `*.read`      | `rm`             | `zone`    | RM (regional manager) may READ anything within their own zone. |
| `event.manage`| `chapter_chair`  | `chapter` | Chapter chair may manage events of their own chapter.          |
| `event.manage`| `chapter_em`     | `chapter` | Chapter EM may manage events of their own chapter.             |

### How the gate reads this (wildcard + scope semantics)

- `*` capability → grants ANY requested capability.
- `X.*` stored → grants any requested capability starting `X.` (e.g. `event.*` ⊇ `event.delete`).
- `*.Y` stored → grants any requested capability ending `.Y` (e.g. `*.read` ⊇ `event.read`).
- Otherwise exact match.
- Scope check: `global` always allows; `zone` allows iff the user's assignment zone equals
  `target.zone`; `chapter` allows iff the user's assignment chapter equals `target.chapter`.
- `edition` and `self` scopes are **stubbed (deny)** in the gate — see open questions.
- **Deny-by-default:** nothing matching in scope ⇒ `false`.

---

## Open questions for Director review

1. **`edition` and `self` scope semantics (unresolved).**
   `scope_type` allows `edition` and `self`, but the gate currently denies both:
   - `edition` — the assignment's `yi_edition_id` is not yet surfaced to the gate, and the
     rule ("does this edition belong to the assignment?") is undefined. What should an
     edition-scoped grant mean exactly?
   - `self` — meant for "the subject is the current user," but the subjects layer
     (plan §6) doesn't exist yet, so there is no subject identity to compare against.
   Both need a decision before they can be relied on.

2. **Per-vertical capability naming.**
   This draft only covers `yip`. The same capability vocabulary must be agreed for
   `future`, and later `yuva` / `thalir`. Should capabilities be shared across verticals
   (e.g. one `event.manage` everywhere) or namespaced per app? Naming locked now avoids
   churn when the next vertical lands.

3. **Deny-by-default confirmation.**
   The gate denies anything not explicitly granted. Please confirm this is the intended
   posture (it is the safe default, but it means every legitimate capability must be
   added to this map before the corresponding gate is switched over — no implicit access).

4. **Coverage of write/delete capabilities.**
   This seed grants read broadly (zone) and only `event.manage` for chapter roles. The
   full set of write/delete capabilities (`event.delete`, `delegate.manage`,
   `finance.approve`, `directory.read`, …) and which roles + scopes hold them is not yet
   mapped and must be filled in deliberately, capability by capability, as gates convert
   (plan §6 Phase 7: "convert gates file-by-file, no big-bang").
