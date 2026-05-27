# YIP Demo-Readiness Spec — Mizoram 4–5 June 2026

**Status:** DRAFT (pending user approval)
**Created:** 2026-05-27
**Target demo date:** **2026-06-04 (Mizoram Chapter Round, Day 1)**
**Time to demo:** ~8 days
**Stakeholders:** Pradeep Chenthilkumar (National Chair), Swapnil Ansarwadekar (National Co-Chair), Om Ommsharravana (developer)

## Source of truth
- Transcript: `/Users/omm/Downloads/New Recording 122.md` (43-min meeting, 2026-05-26 ~)
- Audit: `gap audit produced 2026-05-27`
- Production URL: https://yi-connect-app.vercel.app/yip

---

## 1. Goal

Close the **demo-critical gaps** the YIP National team explicitly requested in the recorded meeting, so the **Mizoram chapter round on 4–5 June** can run on Om's platform end-to-end without manual fallback. Anything Swapnil himself called "long shot" stays out of scope.

## 2. Scope (P0 + P1 only)

| # | Feature | Source of demand | Severity |
|---|---|---|---|
| F1 | Mock seeder runs cleanly end-to-end against renamed schema | Transcript §IV, §X | 🚨 SHOWSTOPPER |
| F2 | Chapter UI enforces "pick **exactly 5** committee topics" from 10–15 indicative pool | Transcript §VIII | 🚨 BLOCKER |
| F3 | Live position assignment + position-based bonus points (PM/Speaker/Minister) | Transcript §XVII §99 | 🟠 HIGH |
| F4 | Per-score special-remarks flags (no_confidence_brought, walkout, ruckus, suspension) | Transcript §XVII §98 | 🟠 HIGH |
| F5 | Breaking-news banner on projector view (admin-controlled, live) | Transcript §XIX §105 | 🟠 HIGH |
| F6 | `.xlsx` import accepted directly (Excel, not just CSV) | Transcript §V §25, §X §51 | 🟠 HIGH |
| F7 | Batch "push central topics to all chapter events" admin action | Transcript §VII §35 | 🟡 MEDIUM |
| F8 | Admin tool: super-admin provisions chapter-named admin logins (e.g. `Mizoram 1`, `Mizoram 2`) | Transcript §XII §65 | 🟡 MEDIUM |

## 3. Out of Scope (explicitly deferred)

| Feature | Reason |
|---|---|
| OTP-based login | Swapnil's preference, not blocker; needs SMS provider setup. Defer to post-Mizoram. |
| Student profiling (research/speaking/policy/process-oriented) | Swapnil himself called this "a long shot" (§115) |
| CricInfo-style cross-round stats | Swapnil himself called this "a long shot" (§125) |
| Custom award rules engine | Existing certificates work; not transcript blocker |
| SSO unification between /yip and /yi-future | Om made an over-claim; not in transcript as hard ask |
| Migration history consolidation (001-032 into yi-connect) | Reproducibility hygiene, not demo blocker |
| Audit log unification | Score audit + created_by sufficient for demo |

## 4. Functional Requirements

### F1 — Working mock seed
- Click "Seed Mock Data" on `/yip/dashboard/admin/mock-data` → seeder runs end-to-end without error.
- Result: 1 mock chapter event + 30 contestants + 4 jurors + scores + motions + bills + questions + fees + volunteers + media + a promoted regional event + a promoted national event.
- Tables that must populate: `yip.events`, `yip.contestants`, `yip.participants`, `yip.parties`, `yip.scores`, `yip.motions`, `yip.bills`, `yip.questions`, `yip.fees`, `yip.volunteers`, `yip.media`, `yip.brand_checks`, `yip.invitations`, `yip.promotions`, `yip.registrations`, `yip.organizers`, `yip.feedback`, `yip.jury_assignments`, `yi.years` (mock row with year=9999).
- Schools must resolve from `yi.institutions` (the cross-app canonical registry), not from a nonexistent `yip.schools`.
- "Wipe All Mock Data" button removes everything seeded with `is_mock=true` in FK-safe order.

### F2 — Exactly-5 committee topics enforcement
- New page `/yip/dashboard/events/[id]/topics` (or extension of existing event page).
- Shows the indicative central pool (10 topics already loaded) + zone-relevant regional pool.
- Multi-select widget enforces **min 5, max 5** before "Save" is enabled.
- Saved selection writes to `yip.event_topics` with `sequence=0…4`.
- Validation: on event create or update, if `event.is_chapter_level === true` and `event.status` is past `draft`, require exactly 5 topics linked.

### F3 — Position assignment + bonus points
- New DDL: `yip.participants.parliament_role` already exists (enum). Confirm and surface.
- New DDL: `yip.scores.position_bonus` integer DEFAULT 0.
- Control panel `/yip/dashboard/events/[id]/control` gains a "Positions" panel:
  - For each parliamentary role (Speaker, Prime Minister, Deputy Speaker, Leader of Opposition, Cabinet Minister), assign one participant.
  - Persists as `participants.parliament_role`.
- Scoring action (`scoring.ts`): on score insert, look up `participants.parliament_role` and add bonus from config:
  - Prime Minister: +5
  - Speaker: +3
  - Deputy Speaker: +2
  - Leader of Opposition: +3
  - Cabinet Minister: +2
  - MP: 0
- Bonus added at compute-results time, not stored per-criterion (clean rollup).
- Configurable via `yip.position_bonus_config` table (single row, JSONB) so the national team can tune without code changes.

### F4 — Special-remarks per score
- New DDL: `yip.scores` gains four boolean columns:
  - `flag_no_confidence_brought` (this student brought a no-confidence motion)
  - `flag_walkout` (this student walked out of the house)
  - `flag_ruckus` (this student caused a ruckus)
  - `flag_suspension` (this student was suspended)
- Each flag has a **point impact** in `yip.scoring_flags_config` (JSONB):
  - `no_confidence_brought: +3` (rewards initiative)
  - `walkout: -5` (penalty)
  - `ruckus: -3` (penalty)
  - `suspension: -10` (severe penalty)
- Jury scoring UI gains a "Remarks" section below the rubric — 4 toggles.
- Compute-results sums: base_score + position_bonus + sum(flag_points).
- Special-remark events are logged to `yip.score_audit` (already exists).

### F5 — Breaking-news banner on projector
- New DDL: `yip.events.live_banner_text` (text, nullable) + `yip.events.live_banner_active` (boolean DEFAULT false).
- Control panel: new "Broadcast" section with text input + Push/Clear buttons.
- Push: sets `live_banner_text` + `live_banner_active=true` + broadcasts on the `yip:live-banner:${eventId}` realtime channel.
- Projector display: when `live_banner_active=true`, render a marquee/flashing banner across the top of the screen.
- Clear: sets `live_banner_active=false`, banner fades out.

### F6 — `.xlsx` import
- Existing `components/yip/csv-import.tsx` extends to accept `.xlsx` MIME types.
- Use the `xlsx` npm library (client-side, ~30KB gzipped) to parse `.xlsx` → row array → existing CSV pipeline.
- File picker accepts both `.csv` and `.xlsx`.
- Header row recognition stays the same: `name, school, class, phone, email, city, state`.
- Provide a download template button: "Download YIP roster template (.xlsx)" → generates and downloads.

### F7 — Batch push central topics
- New admin action in `app/yip/actions/admin-topics.ts`: `pushCentralTopicsToAllChapterEvents(yearId, topicIds)`.
- Selects all `yip.events` where `level='chapter'` AND `yi_year_id=yearId`.
- For each, upserts `event_topics` rows with `is_central=true`.
- Idempotent: re-running doesn't create duplicates.
- New button on `/yip/dashboard/admin/topics`: "Push selected central topics to all 2026 chapters" with confirmation dialog.

### F8 — Chapter-named admin login provisioning
- New page `/yip/dashboard/admin/chapter-admins` (super-admin only).
- Shows all 65 chapters as rows (sourced from `yi.chapters`).
- Per row: input field "Admin email" + "Admin name" + button "Create login".
- Action calls Supabase Auth Admin (`auth.admin.createUser`) → creates user → inserts into `yip.organizers` with `role='chapter_em'` + `chapter_name=<chapter.name>` + `is_active=true`.
- Login slug: stored in `yip.organizers.login_slug` (new column, e.g. `mizoram-1`) — user can sign in with email OR slug at `/yip/login`.
- Email enrolment: sends magic link to the provided email.

## 5. Non-Functional

- **Build green:** `npm run build` must exit 0 throughout.
- **No new dependencies** other than `xlsx` (npm, client-only).
- **All DDL via Management API** (the live DB has hybrid migration history — direct PG via API is the trusted path this session).
- **Each DDL change** captured in `supabase/migrations/<timestamp>_<name>.sql` for posterity, even if applied via API.
- **Idempotent migrations** — `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, etc.
- **Schema cache reload** after every DDL: `NOTIFY pgrst, 'reload schema';`
- **Browser-tested** on production URL https://yi-connect-app.vercel.app/yip after each feature ships.

## 6. Tech Stack (already decided)

- yi-connect monorepo, master branch
- Next.js 15 App Router under `app/yip/`
- Supabase project `bkmpbcoxbjyafieabxao`
- Schema-pinned client: `createServerClient<Database, "yip">`
- Realtime channels prefixed `yip:*`
- Production deploy auto-fires on git push to master (Vercel)

## 7. Assumptions to flag

- [ASSUMPTION] Position bonus values (PM +5, Speaker +3, etc.) are illustrative. Final values to be set by Swapnil before Mizoram.
- [ASSUMPTION] Special-remark point impacts (walkout -5, suspension -10, etc.) are illustrative. Final values to be set by Swapnil.
- [ASSUMPTION] `xlsx` library client-side parsing is acceptable (no server-side parsing).
- [ASSUMPTION] Breaking-news banner is text-only marquee (no images/video).
- [ASSUMPTION] Chapter-admin login provisioning will email a magic link, not generate raw passwords.
- [ASSUMPTION] Exactly-5 topic constraint applies only to chapter-level events, not regional/national.
- [ASSUMPTION] All 8 features ship before 4 June. If time short, drop F7 and F8 first (admin convenience, not demo-critical).

## 8. Verification Plan

For each feature:
1. **Schema check** — query `information_schema.columns` via Management API; expected columns present.
2. **Build green** — `npm run build` exits 0.
3. **Type check** — `npx tsc --noEmit` clean.
4. **Browser walk** — login as `director@jkkn.ac.in` via magic link, exercise the feature, confirm DB state.
5. **Mock seed end-to-end** — after every change, re-run `Seed Mock Data` and confirm it still works (regression guard).

## 9. Dependency Order

```
F1 (mock seed)  ←─ unblocks everything (need real data to test against)
  ↓
F3 (positions + bonus) ─── F4 (special remarks)
  │                              │
  └──────┬───────────────────────┘
         ↓
F5 (breaking news banner)       F6 (xlsx import)         F2 (pick 5 topics)
                                                              ↓
                                                       F7 (batch push to chapters)
                                                              ↓
                                                       F8 (chapter admin logins)
```

F1 must complete first. F3+F4 share scoring schema migration, do together. F5/F6/F2 are independent — parallelizable. F7 needs F2 done. F8 stands alone.

## 10. Task Decomposition (bite-sized, 2–5 min each)

### Phase A — Mock seeder (F1) [SEQUENTIAL, blocks rest]
- A1. Walk seeder line-by-line, find every `.from()` that doesn't resolve to a renamed table. (5 min)
- A2. Fix each call-site one-by-one with type-check after each. (15-30 min)
- A3. Live-test seed → fail → fix → repeat until clean. (30-60 min)
- A4. Commit + push + verify on production. (5 min)

### Phase B — Schema migrations (F3, F4, F5, F8) [PARALLEL DDL]
- B1. DDL: add `yip.scores.position_bonus int default 0` + `yip.scores.flag_no_confidence_brought / flag_walkout / flag_ruckus / flag_suspension boolean default false`. (5 min)
- B2. DDL: add `yip.events.live_banner_text text` + `yip.events.live_banner_active boolean default false`. (3 min)
- B3. DDL: add `yip.organizers.login_slug text unique`. (3 min)
- B4. DDL: create `yip.position_bonus_config` + `yip.scoring_flags_config` (JSONB single-row tables) seeded with default values. (5 min)
- B5. Regen / hand-edit `types/yip/database.ts` for all 4 changes. (10 min)
- B6. Commit DDL migration files to `yi-connect/supabase/migrations/` + push. (5 min)

### Phase C — F3 + F4 (positions + special remarks) [SEQUENTIAL on scoring code]
- C1. Update `actions/scoring.ts` `submitScore()` to accept + persist position_bonus + 4 flags. (10 min)
- C2. Update `actions/results.ts` `computeResults()` to apply bonus + flag deltas to final score. (10 min)
- C3. Update `jury/jury-scoring-client.tsx` — add "Remarks" toggles below rubric. (15 min)
- C4. Add "Positions" panel to `events/[id]/control/control-panel.tsx` — assign PM/Speaker/Deputy/LoP/Cabinet/MP. (20 min)
- C5. Update `actions/participants.ts` `setParliamentRole(participantId, role)`. (5 min)
- C6. Browser walk: assign positions → score with flags → verify result computation. (15 min)

### Phase D — F5 (breaking news banner) [PARALLEL with C]
- D1. Add "Broadcast" section to `control-panel.tsx` — text input + Push/Clear. (10 min)
- D2. New action `actions/events.ts` `pushLiveBanner(eventId, text)` + `clearLiveBanner(eventId)` — write columns + broadcast realtime. (10 min)
- D3. Update `event/[id]/display/projector-display.tsx` — subscribe to banner channel, render marquee. (15 min)
- D4. Browser walk: push banner → see marquee → clear → marquee disappears. (5 min)

### Phase E — F2 + F7 (topics: pick 5 + batch push) [PARALLEL with C, D]
- E1. New page `events/[id]/topics/page.tsx` + client — show pool + multi-select with min=max=5 guard. (25 min)
- E2. Update `actions/topics.ts` `assignTopicsToEvent` to validate count for chapter events. (5 min)
- E3. Add navigation tab "Topics" to `events/[id]/event-tab-nav.tsx`. (3 min)
- E4. New action `admin-topics.ts` `pushCentralTopicsToAllChapterEvents(yearId, topicIds)`. (10 min)
- E5. Add "Push central to all 2026 chapters" button to `dashboard/admin/topics/topics-admin-client.tsx` with confirm dialog. (10 min)
- E6. Browser walk: pick 5 on Mizoram event → save → confirm. Push central to all → confirm 64 other chapter events also got the rows. (10 min)

### Phase F — F6 (xlsx import) [PARALLEL with C, D, E]
- F1. `npm install xlsx` in yi-connect. (1 min)
- F2. Extend `components/yip/csv-import.tsx` to accept `.xlsx` MIME + use SheetJS to parse. (15 min)
- F3. Add "Download YIP roster template (.xlsx)" button — generates a 1-row sample file. (10 min)
- F4. Browser walk: upload Swapnil's Mizoram .xlsx → see preview → import. (10 min)

### Phase G — F8 (chapter admin login provisioning) [SEQUENTIAL, low priority]
- G1. New page `dashboard/admin/chapter-admins/page.tsx` + client — list 65 chapters from `yi.chapters`. (15 min)
- G2. New action `admin-chapter-admins.ts` `createChapterAdmin(chapterId, email, name, loginSlug)` — calls Supabase Auth Admin + writes organizer row. (20 min)
- G3. Super-admin gate on the route via middleware extension. (5 min)
- G4. Browser walk: create 1 Mizoram admin → magic-link email arrives → can sign in → reaches /yip/dashboard. (15 min)

### Phase Z — Final verification + post-session
- Z1. End-to-end production walk: log in as super-admin → wipe + reseed mock → exercise all 8 features. (30 min)
- Z2. Update progress.txt + features.json with what landed and what's deferred.
- Z3. Send a 5-line summary to Swapnil + Pradeep with the live URL and "ready for Mizoram" status.

---

## 11. Estimated time

| Phase | Time | Can parallelize? |
|---|---|---|
| A — Mock seeder | 60-90 min | No (blocks all) |
| B — DDL migrations | 30 min | No (foundation) |
| C — Positions + remarks | 75 min | With D, E, F |
| D — Banner | 40 min | With C, E, F |
| E — Topics pick-5 + push | 65 min | With C, D, F |
| F — xlsx import | 40 min | With C, D, E |
| G — Chapter admins | 55 min | Sequential (low priority, do last) |
| Z — Verification | 30 min | No |

**Total serial:** ~6 hours
**Total with parallelism (C/D/E/F in parallel):** ~3.5 hours
**Buffer for live debugging + Vercel deploy waits:** +50% = **~5 hours wall clock**

## 12. Risk Register

| Risk | Mitigation |
|---|---|
| Mock seeder reveals more schema gaps as we fix the current one | Fix each one until clean; budget 90 min for this |
| `xlsx` library breaks Vercel build | Test build before pushing; library is well-maintained |
| Position bonus point values disputed by Swapnil | Use config table (JSONB), values changeable without code deploy |
| Vercel build queue takes >5 min per deploy | Batch commits where possible; use `--no-verify` only if a hook fails for unrelated reasons |
| Chapter admin provisioning trips Supabase Auth rate limits | Cap at 5 chapter admins per session for first run; do bulk in batch later |

---

## 13. Open Questions for User (before build starts)

1. **Approve scope** (8 features F1-F8) or trim (e.g. drop F7+F8)?
2. **Approve point values** (PM +5, walkout -5, etc.) as illustrative defaults, with Swapnil to tune later?
3. **Build all in this session** or split (do F1-F6 now, F7-F8 next session)?
4. **Run in parallel via subagents** (faster, ~3.5h) or sequential in main session (safer, ~6h)?
5. **Magic-link vs password** for chapter admin provisioning — confirm magic-link?
