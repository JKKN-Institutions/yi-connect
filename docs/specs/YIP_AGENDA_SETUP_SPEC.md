# YIP — Agenda Setup Screen (spec)

**Status:** Ready to build · **Author:** Director session 2026-06-20 · **Target repo:** `yi-connect` (`app/yip/*`)

## 1. Problem

The agenda is seeded from a fixed template when an event is created. Today there is **no per-event way to choose which agenda items actually run on the day.** Chapters that complete steps before the event (e.g. party formation, party-leader selection) — or that don't run a given step at all — are stuck with those items still sitting on the Control panel and the projector as "upcoming." The organiser's only recourse is to **Skip** each one live, on the day, which is error-prone and makes the live agenda read wrong.

## 2. Goal

A **per-event Agenda Setup screen**, used **before** the event, that lets an organiser decide which template items will run live, in what order, with what timing — so the Control panel, projector, and student "what's next" views show the **correct day-of agenda**.

Narrow scope: this screen controls **which agenda STEPS appear in the live run**. It does **not** capture the underlying data of those steps. Party rosters, leaders, allocation, etc. are still captured on their existing screens (Parties / Allocation / Voting), whether done before or during the event. Marking "Party Formation" as done-beforehand here only removes the *step* from the live flow.

## 3. Scope

**In scope**
- Toggle each agenda item: **Runs live** ↔ **Won't run live** (done beforehand / not applicable).
- Reorder items within a day.
- Edit duration (minutes), title, description of an item.
- Add a custom item (e.g. "Inauguration", "Cultural Programme").
- Remove a custom item.
- Surface (and optionally toggle) `is_scoreable` per item, or deep-link to the existing **Jury → Sessions** "Scored sessions" panel which already owns that.

**Out of scope**
- Capturing party/leader/allocation data (existing screens own this).
- Embedding polls/votes/activities into the agenda or chat (separate subsystem).
- Cross-event agenda templates / master template editing (future).

## 4. Data model decision — **no schema change for MVP**

`yip.agenda.status` is an enum `agenda_status` = `{ upcoming, in_progress, completed, skipped }`. `advanceAgenda()` **already** picks the next item by skipping any item whose status is `skipped` or `completed` (see `app/yip/actions/agenda.ts`). We ride that existing behaviour:

| Setup state | Stored as | Effect on the day |
|---|---|---|
| **Runs live** (default) | `status = 'upcoming'` | Becomes `in_progress` when the house reaches it. |
| **Won't run live** | `status = 'skipped'` | `advanceAgenda` jumps over it; never becomes `current`. Shown struck-through. |

Re-including a `skipped` item before the event = set it back to `upcoming`.

**Why reuse `skipped` instead of a new `excluded` value:** zero migration, and `advanceAgenda` + the Control panel STATUS_CONFIG already render/skip it correctly. Lowest risk for the next live event.

> **Optional later upgrade (not MVP):** add an `excluded` value to `agenda_status` to distinguish "deliberately not part of this chapter's run" (set pre-event) from "skipped on the day" (a live exception) for cleaner results/reporting. If taken, every `status` switch must handle it: `advanceAgenda`, `goToPreviousAgendaItem`, control-panel `STATUS_CONFIG`, projector, results. Treat `excluded` exactly like `skipped` in advance logic.

**Add/remove custom items** require new `insert`/`delete` on `yip.agenda` (none exist today). `sequence_order` (int) drives ordering; reorder = reassign `sequence_order`.

## 5. Server actions (new, in `app/yip/actions/agenda.ts`)

All gated by `getYipEventAccess(eventId)`; reads/writes on the service client (yip.* is RLS read-only for `authenticated`, so the capability check IS the gate — same pattern as the rest of the file). Return the existing `ActionResult<T>` shape.

```ts
// Include / exclude an item from the live run (pre-event).
// includeInRun=false → status 'skipped'; true → status 'upcoming'.
setAgendaItemInRun(eventId, agendaItemId, includeInRun: boolean): ActionResult
// Guard: refuse if the item is currently `in_progress` (it's live) — tell the
// organiser to use the Control panel instead. Refuse flipping a `completed`
// item here (use Re-open on Control).

// Reorder within a day: persist the full ordered id list for that day.
reorderAgenda(eventId, day: 1|2, orderedItemIds: string[]): ActionResult
// Validate every id belongs to (event, day); reassign sequence_order 1..N.

// Edit metadata.
updateAgendaItem(eventId, agendaItemId, patch: {
  title?: string; description?: string|null;
  duration_minutes?: number; agenda_type?: string;
}): ActionResult

// Add a custom item to a day (appended; organiser can then reorder).
addAgendaItem(eventId, input: {
  day: 1|2; title: string; description?: string;
  duration_minutes?: number; agenda_type?: string;  // default 'general'
  is_scoreable?: boolean;                            // default false
}): ActionResult<{ id: string }>
// New row: status 'upcoming', mode default 'party', sequence_order = max+1 for the day.

// Remove an item. Block if it has dependent data (scores / vote_sessions /
// jury_session_assignments) — return a clear error naming the dependency.
deleteAgendaItem(eventId, agendaItemId): ActionResult
```

Every action ends with `revalidatePath` for `/agenda`, `/control`, and the projector route so the change propagates.

**Permissions**
- Include/exclude, reorder, metadata edit, add: `access.canManage` (chapter organiser, chair, national).
- Delete: `access.canDelete` (chair / national) — destructive.
- **Live-state guard:** if `event.status` is `day1_live`/`day2_live`, structural edits (reorder, add, delete) require chair/national and the UI shows a warning that the house is live; include/exclude of a non-current item is allowed but warns. On-the-day changes should normally use the Control panel's Skip/Jump.

## 6. UI — `/yip/dashboard/events/[id]/agenda`

New tab **"Agenda"** in the **"Before the event"** tab group in `event-tab-nav.tsx`, placed just before the "During the event" group (icon: `ListOrdered` or `CalendarClock`). Plug into the existing **Before-the-Event setup checklist** (`setupProgress[href]`): mark done once the organiser has reviewed the agenda (e.g. opened + saved once, or any item toggled).

Server page mirrors the Jury Sessions page pattern: auth via `getEvent(id)` → `Forbidden403` on null; load all agenda rows for the event ordered by `(day, sequence_order)`.

**Layout**
- Day 1 / Day 2 segmented control (matches Control panel's day filter).
- Per day, an ordered list of agenda rows. Each row shows:
  - Drag handle (reorder) · sequence number
  - Title (inline-editable) · agenda_type chip · duration (inline-editable minutes)
  - **"Runs live" toggle** (the core control). Off = greyed/struck-through row labelled *"Won't run live — done beforehand or not applicable."*
  - Scoreable indicator (★ if `is_scoreable`); link "Manage scored sessions" → `/jury/sessions`.
  - Row menu: Edit details · Remove (custom items / chair only).
- **"+ Add item"** per day.
- Header summary: *"N of M items will run live on Day X."*
- Optimistic updates with revert-on-error + toast (match `scored-sessions-panel.tsx` / `control-panel.tsx` conventions).

**Copy guidance (12th-grade, no jargon):** the toggle label is **"Run this live on the day?"**. Helper under an Off item: *"This step won't show on the Control panel or projector. Use this when your chapter does it before the event (e.g. party formation) or skips it."*

## 7. System behaviour after a change

- **Control panel:** excluded (`skipped`) items render struck-through (existing `STATUS_CONFIG.skipped`); `advanceAgenda`/`goToPreviousAgendaItem` already jump over them — verify Previous also skips `skipped` (advance does; confirm the backward path does too, else patch it to match).
- **Projector / student "what's next":** must not display `skipped` items as upcoming/current. Audit those views; hide or de-emphasise `skipped`.
- **Jury:** unaffected — jury visibility keys off `is_scoreable` + `jury_session_assignments`, not `status`. A pre-done-but-scoreable session (e.g. Cabinet Introductions held earlier) can still be scored via the "allow earlier sessions" toggle; it just won't anchor as "current." Note this in the jury/sessions help.
- **Results:** excluded scoreable sessions with no scores contribute nothing (existing aggregation tolerates empty sessions — confirm).

## 8. Edge cases

1. Excluding the **current** (`in_progress`) item → refuse; direct to Control panel.
2. Excluding a `completed` item → refuse here (use Re-open on Control).
3. Reorder must not move a `completed`/`in_progress` item behind the live cursor mid-event → block structural reorder while live (chair-only + warning).
4. Delete an item with scores/votes/jury assignments → refuse with a named-dependency error; offer "exclude from run" instead.
5. Excluding **every** scoreable item → allow, but warn ("no sessions will be scored").
6. Realtime: agenda changes must reach `useRealtimeEvent` subscribers (yip.* publication already includes agenda — verify after build, two-tab test).

## 9. Phasing

- **MVP (ship first):** include/exclude toggle (reuse `skipped`) + reorder + duration/title edit. Solves "show the correct agenda" directly, no migration.
- **Phase 2:** add/remove custom items.
- **Phase 3 (optional):** `excluded` enum value for reporting clarity; chapter-saved agenda presets.

## 10. Acceptance criteria

- [ ] Organiser can mark any non-live item "Won't run live"; it shows struck-through and **does not appear as upcoming/current** on Control panel or projector.
- [ ] On the day, advancing the agenda **skips** every excluded item with no manual Skip needed.
- [ ] Re-including before the event restores the item to the live flow.
- [ ] Reorder persists and is reflected on the Control panel.
- [ ] Duration/title edits persist and show on Control + projector.
- [ ] (Phase 2) Add/remove custom item works; delete blocked when dependencies exist.
- [ ] Non-manage roles get `Forbidden403`; backward/structural edits blocked for ordinary organiser while live.
- [ ] `npx tsc --noEmit` clean on the main tree; two-tab realtime check (setup change → Control panel reflects without refresh).
- [ ] Adversarial-verify pass vs live schema (status enum, RLS, grants) before merge — per the scoring/auth verification rule.

## 11. Files to touch

- `app/yip/actions/agenda.ts` — new actions (§5).
- `app/yip/dashboard/events/[id]/agenda/page.tsx` — server page (auth + load).
- `app/yip/dashboard/events/[id]/agenda/agenda-setup-client.tsx` — client UI (§6).
- `app/yip/dashboard/events/[id]/event-tab-nav.tsx` — add "Agenda" tab to the "Before the event" group + setup-checklist entry.
- Projector + student "what's next" views — ensure `skipped` items are hidden/de-emphasised.
- (Phase 3 only) migration adding `excluded` to `agenda_status` + handle it everywhere `status` is switched.

## 12. Key facts (verified 2026-06-20, live DB `bkmpbcoxbjyafieabxao`)

- `agenda_status` enum = `upcoming, in_progress, completed, skipped`. `agenda_mode` = `party, committee, mixed`.
- `advanceAgenda()` already skips `completed` + `skipped` when choosing the next item.
- `yip.agenda` has no insert/delete server action today; ordering via `sequence_order`.
- Event tab groups: **Before the event** (Team, Checklist, Participants, Committees, Parties, Allocation, Jury, Volunteers) → **During the event** (Control, Proceedings, Chat, Scoring, Media) → **After**. "Agenda" belongs at the end of *Before the event*.
