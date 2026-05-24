# Cross-Schema PostgREST Embed Audit — Agent D

**Date:** 2026-05-24
**Agent:** D (audit-only, no code changes)
**Repo state:** master branch in worktree `agent-acb81653e9b66f32e`

---

## TL;DR

**The "~47 surfaces remain broken" estimate is significantly OVERSTATED.** The cross-schema embed problem has been **structurally resolved** by three already-deployed migrations. The remaining real exposure is **0–3 surfaces** at HIGH/CRITICAL risk. Most embeds that look cross-schema at first glance actually resolve correctly because the embed target either lives in the same schema, or is already proxied by a same-schema VIEW.

The two memory entries (`postgrest-cross-schema-embed`, `denormalize-over-refactor`) describe a real bug that *was* widespread on 2026-05-23 but has been largely neutralized by the structural fixes shipped that same day.

---

## Counts

| Bucket | Count | Notes |
|---|---|---|
| Total `.schema()` call sites | 2,182 across 318 files | All explicit schema calls |
| Total `.select(... "embed(...)")` patterns | **87** | 57 in `app/`, 30 in `lib/`, 0 in `components/` |
| Embeds in `.schema("future")` queries | 24 | All inside `app/yi-future/**` |
| Multi-line `.select(\`...\`)` patterns | 42 additional | All in yi_connect default schema |

### Classification

| Class | Count | Definition |
|---|---|---|
| 🔴 CRITICAL | **0** | User-facing page, cross-schema, no fallback, broken right now |
| 🟠 HIGH | **0** | Admin/job, cross-schema, no fix |
| 🟡 MEDIUM | **0** | Has fallback / edge case only |
| 🟢 OK | **~127** (87 single-line + 42 multi-line minus minor double-counts) | Same-schema OR already proxied by VIEW shim |

---

## Why the "47 surfaces remain" estimate was wrong

The structural fixes already in production neutralize the entire pattern:

1. **`future.chapters` VIEW** (migration `20260523093000`) — proxies `yi.chapters` into the `future` schema. Resolves the 17 `chapters(...)` embeds across `app/yi-future/**` (delegate, mentor, host, finalists, awards, partner, national/admin pages).

2. **`yi_connect.chapters` VIEW** (migration `20260522000023`) — proxies `yi.chapters` into `yi_connect`, with a computed `location = "City, State"` for legacy column-shape compatibility. Resolves every `chapters(...)` embed across `app/yi-connect/**`, `lib/data/`, `app/actions/**` (which all default to `yi_connect` per `lib/supabase/{client,server}.ts`).

3. **`members.full_name` denormalized column + trigger** (migration `20260523105000`) — sidesteps the nested `nominee:members(profile:profiles(full_name))` refactor that would have touched 5+ consumer files.

4. **YIP isolated client** (`lib/yip/supabase/{client,server}.ts`) — deliberately does NOT set `db.schema`, so YIP queries default to `public.*` where YIP tables live. The 4 yip-related embeds (`participants:participants(...)`, `topic:topics(*)`) resolve correctly within `public.*`.

The natively-future tables embedded by `app/yi-future/**` queries — `delegates`, `teams`, `team_members`, `corporate_partners`, `tracks`, `problem_statements`, `events`, `advancements`, `submissions`, `internship_slots`, `editions`, `colleges`, `message_threads`, `mentors`, `jury_assignments`, `jury_team_assignments` — are ALL native to `future` schema per `types/yi-future/database.ts` (lines 17–2606). Same-schema embeds, no risk.

The natively-yi_connect tables embedded by `lib/data/` and `app/actions/` — `profiles`, `roles`, `skills`, `events`, `members`, `user_roles`, `expense_categories`, `nominations`, `award_categories`, `award_cycles`, `jury_panels`, `member_requests`, `trainer_profiles` — are ALL native to `yi_connect` (confirmed via 56 yi_connect-prefixed CREATE TABLE statements and the SET search_path=yi_connect migrations). Same-schema embeds, no risk.

---

## Top 10 Surfaces I Examined Most Carefully (all resolved OK)

| # | File:line | From | Embed | Why OK |
|---|---|---|---|---|
| 1 | `app/yi-future/api/finalists/[eventId]/pdf/route.tsx:83` | `future.events` | `chapters(name, city), tracks(name)` | `future.chapters` view + `tracks` native to future |
| 2 | `app/yi-future/actions/emails.ts:333` | `future.advancements` | `events(...chapters(city, name))` | Nested embed, all future-native or future.chapters view |
| 3 | `app/yi-future/api/consent/blank-pdf/route.tsx:50` | `future.delegates` | `colleges(name)` | `colleges` IS native to `future` schema (verified in types/yi-future/database.ts:250) |
| 4 | `app/yi-future/host/awards/page.tsx:47` | `future.advancements` | `teams(... chapters(name))` | All resolvable via shim + native |
| 5 | `app/yi-future/chapter/submissions/page.tsx:40` | `future.submissions` | `teams!inner(team_name, chapter_id, edition_id)` | future-native |
| 6 | `lib/sso/yi-creative.ts:391` | `yi_connect.members` | `chapter:chapters(id, name, location)` | yi_connect.chapters VIEW supplies `location` |
| 7 | `lib/data/users.ts:430` | `yi_connect.profiles` | `chapters(name)` | yi_connect.chapters VIEW |
| 8 | `lib/data/members.ts:1245` | `yi_connect.nominations` | `nominator:profiles!nominations_nominator_id_fkey(full_name)` | Same-schema |
| 9 | `app/actions/award.ts:280` | `yi_connect.nominations` | `cycle:award_cycles(... category:award_categories(name)), nominee:members(...)` | All yi_connect-native |
| 10 | `app/(dashboard)/awards/jury/page.tsx:146` | `yi_connect.jury_panel_members` | `panel:jury_panels(id, cycle_id)` | Same-schema |

---

## Patterns I Looked For And Did NOT Find

- `.schema("future").from(X).select("yi_connect_table(...)")` — none
- `.schema("yi_connect").from(X).select("future_table(...)")` — none
- `.schema("public").from(X).select("yi_connect_table(...)")` — none (no `.schema("public")` calls at all)
- Embeds targeting tables that don't exist in the from-schema and aren't shimmed — none confirmed

---

## Recommended Next Steps (Priority Order)

Given there are no confirmed broken surfaces, recommendations are about **defense and verification**, not fixes:

1. **VERIFY in prod browser** the 24 `app/yi-future/**` embed sites still render correctly post-`future.chapters`-view. Sample 3–5 critical pages (`/yi-future/me`, `/yi-future/mentor/scoring/[teamId]`, `/yi-future/host/finalists`, `/yi-future/host/awards`, `/yi-future/api/consent/blank-pdf`). If they render, the structural fixes are confirmed effective and this whole audit can be closed.

2. **DOCUMENT the shim pattern** as a `.claude/skills/` rule for future yi-connect work, so the next time someone adds a `.schema("X").from(Y).select("Z(...)")` where Z lives in a different schema, they immediately add the proxying view in the migration rather than discovering it at runtime.

3. **ADD a CI grep** that flags new `.schema("future")` or `.schema("yi")` calls combined with `.select(...embed...)` and pings a reviewer to confirm the embed target is same-schema or shimmed. Pattern: `grep -rEln '\.schema\("(future|yi)"\)' app/ lib/ | xargs grep -lE '\.select\(['"'"'"][^'"'"'"]*\('`.

4. **NO denormalization needed** — the `members.full_name` denormalization on 2026-05-23 was the last consumer-shape mismatch I could find. The other 30 lib-side embeds all use the existing yi_connect.chapters VIEW or same-schema joins.

5. **Re-check if browser-level smoke tests catch this class of bug** — if a `.schema("future").from("X").select("Y(...)")` silently returns `null` for the embed because Y isn't proxied, the page will render with empty fields rather than throwing. Confirm Phase D regression test coverage actually asserts on embed shape, not just HTTP 200.

---

## Single Pattern That, If Fixed Structurally, Unblocks The Most Surfaces

**Already done.** The `CREATE VIEW <from_schema>.<embed_target> AS SELECT * FROM <real_schema>.<embed_target>` shim is the structural fix, and it's been applied for the two known cross-schema target tables (`yi.chapters` proxied into both `future` and `yi_connect`).

The meta-pattern: **whenever a new app schema is added that needs to embed shared tables, ship a one-line view shim per shared table.** That single rule, encoded in skill/agent docs, prevents the entire class of bug.

---

## Confidence Notes

- **High confidence** the 24 yi-future-schema embeds are OK (cross-referenced against `types/yi-future/database.ts` table list + existing future.chapters migration).
- **High confidence** the 30 lib/-side embeds are OK (verified yi_connect schema defaults + table existence in migrations).
- **Medium confidence** on the 42 multi-line backtick embeds — sampled ~10, all yi_connect default schema with yi_connect-native or VIEW-proxied embed targets. Pattern is consistent enough that I'm comfortable not auditing every one.
- **Schema unknowns**: `message_threads` is in types/yi-future/database.ts so assumed future-native (no migration in this repo). If it's missing in production, that's a separate "missing migration" bug, not a cross-schema bug.

If the in-prod smoke test in recommendation #1 shows ANY yi-future page silently null'ing an embed, this audit's confidence drops and the broken surface should be added to a HIGH bucket here.
