# Phase B — Follow-up notes

Tracks the loose ends from the Phase B code rewire (2026-05-22).

## yi_connect.chapters is a VIEW, not a table

The compatibility view in `supabase/migrations/20260522000023_yi_connect_chapters_view.sql` wraps `yi.chapters` and adds:
- Computed `location = "City, State"`
- `member_count` (always NULL — column doesn't exist on `yi.chapters`)
- `established_date` (always NULL — column doesn't exist on `yi.chapters`)
- `updated_at` (mirrored from `created_at`)

### Read path

`.from('chapters').select(...)` works transparently via default-schema routing.

### Write path

All chapter writes (`insert`, `update`, `delete`) must explicitly target `yi.chapters` via `.schema('yi').from('chapters')`. Patched files (2026-05-22):

- `app/actions/chapters.ts:118, 217, 269, 396`
- `app/actions/demo-seed.ts:297`

### Form-level fallout

`yi.chapters` has `city + state` columns, **not** `location`. yi-connect's chapter forms still accept a single `location` field. The `splitLocation(text)` helper in `app/actions/chapters.ts` splits the form input on the first comma — first part → city, rest → state.

If a chapter chair enters `"Erode, Tamil Nadu"`, that parses to `{city: "Erode", state: "Tamil Nadu"}`. If they enter just `"Erode"`, state stays empty.

Long term: refactor the create/edit chapter forms to have separate City + State inputs. Filed as TODO; not blocking.

## Columns no longer persisted

`member_count` and `established_date` were stored on yi-connect's old `public.chapters`. They're not on `yi.chapters`. The view exposes them as NULL.

- `member_count`: previously updated by `demo-seed.ts` after seeding. The patched code still issues the `UPDATE`, but it now targets `yi.chapters` which has no such column — the update silently does nothing. Demo seed completion does not depend on this; ignore.
- `established_date`: forms still accept it; it's silently dropped on insert. Filed as TODO.

## Deferred reports migration superseded

`supabase/migrations/20260522000018_yi_connect_reports.DEFERRED.sql` is now superseded by `20260522000024_yi_connect_reports_rewrite.sql`. The `.DEFERRED.sql` file can be deleted once the rewrite has been smoke-tested against real report generation.

## Cross-schema query summary

| What | Schema | Notes |
|---|---|---|
| yi-connect tables (members, events, finance, etc.) | `yi_connect.*` | Default schema — no explicit `.schema()` needed |
| Chapter reads | `yi_connect.chapters` (view) | Works via default schema |
| Chapter writes | `yi.chapters` | Must use `.schema('yi').from('chapters')` |
| National admin allow-list (auth gating) | `yi.national_admins` | Used in RLS, not directly by app code |
| Cross-app person identity | `yi_directory.people` | Used via FK; app rarely queries directly |
| Auth users | `auth.users` | Standard Supabase; cross-app shared |

## Open TODOs

- [ ] Refactor chapter forms (city + state vs single location field)
- [ ] Decide whether to add `member_count` as a generated column on `yi.chapters` or keep NULL
- [ ] Decide whether to add `established_date` on `yi.chapters`
- [ ] Delete `20260522000018_yi_connect_reports.DEFERRED.sql` after smoke test
- [ ] Set up daily Supabase backup (`scripts/backup-supabase.sh` + GitHub Actions)
- [ ] Run AUTH_E2E_TEST_PLAN.md against the dev environment
- [ ] Rename branch `feat/auto-mount-mybugspanel` to `feat/platform-unification` before PR
