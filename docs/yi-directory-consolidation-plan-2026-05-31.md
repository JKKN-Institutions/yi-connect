# Yi Platform — Identity, Relationship & Permission Architecture

**Date:** 2026-05-31 · **Status:** PROPOSAL (Phase 0 applied; everything else pending review)
**Supersedes:** the earlier Tier-1/2/3 draft of this file (kept in git history).
**Decision:** Make `yi_directory` the single identity spine for every human across every app in the monorepo; let each app own its *relationship* with those humans; govern access through one scoped permission gate.

---

## 1. The paradigm — "Sign in with Google" for all of Yi

When you use *Sign in with Google*, **Google owns who you are** (your identity). **Each app owns what you are to them** (Zomato has your orders, Uber your rides). Nobody re-stores "you."

That is the entire architecture:

- **`yi_directory` = identity.** One row per human, forever. *Who they are.*
- **Each app's own tables = that app's relationship** with the human. *What they are to that app.*
- **One permission gate** decides what each person can *do* and *see*, scoped to their chapter/zone/year.

A YIP admin managing delegates, a Yuva admin managing students, and a Thalir admin managing schoolchildren are all managing **their own app's relationship rows**, every one pointing at a **shared identity**. The same delegate who is also a member's child who is also a Yuva student = **one identity, three app-relationships.** That is unification, not fragmentation.

---

## 2. The three layers

```
  LAYER 1 — IDENTITY                      yi_directory.people
  "who is this human"          one row per human (principal OR subject)
        │                      name, contact, photo, is_minor, dob?
        │  person_id (FK)      ← deduped at the source; never copied per-app
        ├───────────────────────────────┬───────────────────────────────┐
        ▼                                ▼                               ▼
  LAYER 2a — ROLES                 LAYER 2b — RELATIONSHIPS        (impact = NOT here)
  yi_directory.role_assignments    per-app domain tables          aggregate counts only
  only role-HOLDERS (principals)   yip.participations             thalir.reach(school,date,count)
  app, role, year, chapter, zone   yuva.enrollments               — no per-child PII for
  ~thousands of rows               thalir.enrollments               one-touch reach
  (the ONLY table auth scans)      ~thousands–lakhs, app-owned

  LAYER 3 — SCOPED PERMISSIONS     yi_directory.role_permissions  +  can(user, capability, scope)
  "what can they do / see"         (app, role, capability, scope_type)
                                   one gate every page & action calls
```

**Why layered, not one big table:** identity must be unified (one human = one row). Authorization must be fast and principal-only (auth never wants to scan millions of student rows). The two are different concerns, so they are different *tables* — but the **person is never split**.

---

## 3. The three volumes of people (what goes where)

| Bucket | Examples | Count (your vault figures) | Lives in |
|---|---|---|---|
| **Principals** | members, organizers, chairs, RMs | ~7,400 | `people` + `role_assignments` |
| **Managed individuals** | named delegates, enrolled students tracked over time | thousands–low lakhs | `people` + per-app relationship row |
| **Impact reach** | "19L students sensitised across 75 schools" | ~35L | **aggregate counts, NOT identities** |

The scary "35 lakh" is almost entirely **reach you report**, not individuals you administer. The identity table is sized to buckets 1+2 and point-looks-up fine. **Modeling one-touch minors as identity rows is pure liability — don't.**

---

## 4. Target schema (concrete)

### Layer 1 — identity (exists; minor extensions)
`yi_directory.people` — add nullable `is_minor boolean default false`, optional `dob date`, and ensure a dedupe key (unique on `lower(email)`; soft-match on `phone`). Minors carry **no `user_id`** (no login).

### Layer 2a — roles (exists)
`yi_directory.role_assignments` unchanged. This stays the principal-only, auth-critical table.

### Layer 2b — relationships (new pattern, one per app domain)
```sql
-- example: YIP delegates
CREATE TABLE yip.participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES yi_directory.people(id),
  edition_id uuid, event_id uuid, team text, status text, score int,
  created_at timestamptz DEFAULT now()
);
-- yuva.enrollments / thalir.enrollments follow the same shape (school_id, cohort, attendance…)
```
Each app admin has full CRUD over **their** relationship table. Identity is shared and never duplicated.

### Layer 3 — scoped permissions (new)
```sql
CREATE TABLE yi_directory.role_permissions (
  app text NOT NULL,           -- yip | future | yuva | thalir | '*'
  role text NOT NULL,          -- chapter_chair | rm | national | super_admin | …
  capability text NOT NULL,    -- 'event.delete', 'delegate.manage', 'directory.read'
  scope_type text NOT NULL,    -- global | zone | chapter | edition | self
  PRIMARY KEY (app, role, capability, scope_type)
);
```
```ts
// lib/yi/auth/can.ts  — the ONE gate every page/action calls
export async function can(
  capability: string,
  target: { app: string; chapter?: string; zone?: string; year?: number }
): Promise<boolean>
// resolves: does the user hold a role granting `capability`, AND is `target` inside that role's scope?
```
The **scope** is the hard 80% (a chapter chair edits *their* chapter's events, not everyone's). It is explicit here, not assumed.

### The one shared primitive — find-or-create
```ts
// lib/yi/directory/resolve-person.ts
export async function resolvePerson(
  input: { full_name: string; email?: string; phone?: string }
): Promise<string /* person_id */>
// 1. match existing by email, then phone  → dedupe at the source
// 2. else INSERT one people row
```
Every app's "add a delegate/student/member" flow calls this, then writes its own relationship row. **`chapter-roles.ts` already implements this pattern** — Phase 6 extracts it to a shared lib.

---

## 5. Current state (verified 2026-05-31)

- ✅ **Phase 0 applied & proven** — `sync_from_organizer_profile()` now matches by `source_yip_profile_id`; firing the sync twice on an emailless organizer added **zero** rows. Duplicate generation is stopped.
- `people` 92 rows (still 6 duplicate humans pending Phase 1 dedup); `role_assignments` 99.
- Already on yi_directory: `require-super-admin.ts` (only a dead `organizerId` field still hits organizers), `chapter-roles.ts` (reference impl).
- Still on `yip.organizers`: write-path (`admin-team`, `admin-chapter-admins`, `hierarchy`, `log-action`) + drift tooling.
- Single structural blocker: FK `yip.events.chapter_em_id → yip.organizers.id`.
- Evidence of live drift: organizers knows `{chapter_em, national, rm}`; yi_directory also has `regional_admin` (6) that organizers never got.

---

## 6. Migration phases (executable, ordered)

| Ph | What | Risk | Owner | Verify |
|----|------|------|-------|--------|
| **0** | ✅ Idempotent sync (1-line source match) | low | agent | double-sync adds 0 rows *(done)* |
| **1** | Dedup the 6 humans → people 92→86, roles→92 | med | agent | counts + each cluster = 1 person, `{regional_admin,rm}` |
| **2** | Repoint organizers **write-path** to yi_directory (`admin-team`, `admin-chapter-admins`, `hierarchy`, `log-action`) | med | agent | no app code writes `yip.organizers` (grep gate) |
| **3** | Resolve `events.chapter_em_id` FK → add `chapter_em_person_id → people.id`, backfill, drop old col | **high** | agent + human review | row-count assert; event screens render |
| **4** | `yip.organizers` → **view** over yi_directory; drop both sync triggers + function | **high** | agent + human review | every YIP admin screen works; no 403 regressions |
| **5** | Delete drift tooling (`admin/directory/sync-status/*`) | low | agent | n/a (dead code) |
| **6** | **Subjects layer** — extract `resolvePerson()` lib; add `yip.participations` (+ yuva/thalir when built); migrate delegate flows to find-or-create | med | agent | adding the same delegate twice → 1 person, 2 participations only if intended |
| **7** | **Scoped permissions** — `role_permissions` table + `can()` gate; convert gates file-by-file (no big-bang) | med, long | agent + human (capability map) | each converted gate matches old behaviour in tests |
| **8** | Generalize to `future.*`; new verticals read Layers 1+3, never make their own `organizers` | low | agent + review | CLAUDE.md rule enforced in review |

Phases 0–1 are data hygiene. 2–5 are the Tier-1 inversion (one branch). 6–7 are the new layers (separate tracks). 8 is ongoing discipline.

---

## 7. How an app admin manages their people (day-to-day walkthrough)

**Scenario: a YIP chapter admin adds 30 delegates to their event.**
1. Admin clicks *Add Delegate*, enters name + phone.
2. System calls `resolvePerson()` → finds an existing identity (delegate attended last year) or creates one. *Admin never sees this; it just dedupes.*
3. System creates a `yip.participations` row (this event, this team). **The admin owns and edits this.**
4. Admin assigns teams, records scores, marks attendance — all on `participations`. Full control, entirely within YIP.

**What the admin can and cannot see (Layer 3):**
- ✅ Sees and edits **their chapter's** delegates' YIP participation.
- ❌ Does **not** see that a delegate is also a Thalir minor in a child-safety program — even though it's the same identity. Shared identity ≠ shared visibility.

**When a delegate later becomes staff:** an admin grants them a role → one `role_assignments` row added. No new identity, no migration. They were always one person.

---

## 8. The honest hard parts (NOT solved by the model — flagged, not papered over)

1. **Shared-person, app-scoped *visibility*.** One identity may relate to many apps; a YIP admin must not see Thalir/child data. This needs the Layer-3 gate to govern **reads of subject data**, not just staff actions. Real work, the expensive 80%. (Phase 7.)
2. **The count-vs-individual threshold is a human policy call, per vertical.** "When does a Thalir child stop being a count and become a kept record?" involves **minor consent / guardian** law. An agent can build either; only the org can decide the line.
3. **Scope-model granularity.** `scope_type ∈ {global, zone, chapter, edition, self}` covers known cases; a genuinely new scope (e.g. school-level for Thalir) means extending the enum + the gate. Expect one or two iterations.
4. **Phase 3/4 are the only irreversible structural steps.** Snapshot the DB first; keep `yip.organizers` as a base table for ≥1 week behind the view before dropping it. Don't drop-and-pray.
5. **MCP/Management-API can't run multi-statement transactions reliably** (proven today). Apply structural migrations via real `psql`/`supabase db push`, or step-wise autocommit with per-step asserts.

---

## 9. Who does what (agents + humans)

**AI agents (Claude Code) can fully execute:** all migrations & DDL; repointing the ~5 code sites; extracting `resolvePerson()`; building the `can()` gate + `role_permissions`; generating before/after tests; the grep-gates and row-count asserts.

**Humans must decide (agents cannot):** the capability→role→scope map (what each role may actually do); the minor count-vs-individual threshold + consent policy; approval of Phases 3/4 (irreversible); whether to do Layers 6–7 now or after Yuva/Thalir launch.

---

## 10. Sequencing recommendation

1. **Phase 1 dedup** next (data is clean to merge now that Phase 0 stopped the bleed).
2. **Phases 2→5** as one reviewed Tier-1 branch.
3. **Decide now, build with Yuva:** Layers 6–7 should land *before* Yuva/Thalir, because that's where 35-lakh-scale and minor-data either hold or collapse. Retrofitting after launch is far costlier.
4. Tier-3 discipline ongoing.

**One open decision for you:** do we treat Layers 6–7 (subjects + scoped permissions) as a hard prerequisite for the first student-facing vertical, or ship Tier-1-for-principals first and fast-follow? My recommendation is the former — the next vertical is exactly the stress test.
