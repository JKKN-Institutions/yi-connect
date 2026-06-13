# YUVA Volunteer Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Replace the vote-only YUVA volunteer kiosk (`app/yip/volunteer/page.tsx`) with a 6-part dashboard — Your Desk, Your Responsibilities, What's Happening Now, the Vote Kiosk (kept), desk-scoped Attendance check-in, and a desk-scoped "90-second speech finished" marker (also exposed to organisers).

**Architecture:** All volunteer surfaces authenticate with the existing `yip_session` cookie (`type: "volunteer"`) via `requireVolunteerSession(eventId) → { volunteerId, name }`. New volunteer reads/writes live in a new server-action file `app/yip/actions/volunteer-desk.ts`, all gated by `requireVolunteerSession` and **desk-scoped**: a volunteer may only see/act on students in a party or committee they are assigned to in `yip.yuva_assignments`. Desk-scoping is a single pure function (`lib/yip/yuva-desk.ts`) that is unit-tested. Organisers reach the speech marker through a `canManage`-gated action mirroring `checkInParticipant`. One additive migration adds `participants.speech_finished` (service-role-only by default — column grants are column-scoped, so the new column is not anon-readable). The dashboard is a tabbed client shell that keeps the existing `KioskClient` untouched as the "Vote" tab.

**Tech Stack:** Next.js 15 App Router + React 19 server actions, Supabase (Postgres schema `yip`, service-role writes behind capability gates), Tailwind v4. Verification: `npx tsc --noEmit` (compile gate), `npx tsx` harness (pure logic), adversarial-verify against the LIVE DB with the real anon key, and live browser QA on a throwaway clone.

---

## Current State (surveyed 2026-06-13 against origin/master `9ba3ec15`)

- **Only volunteer surface today:** `app/yip/volunteer/page.tsx` → renders `KioskClient` (`app/yip/volunteer/kiosk-client.tsx`) and nothing else. Page gate: `getYipSession()`, redirect to `/yip/join` unless `session.type === "volunteer"`.
- **Volunteer auth:** `lib/yip/auth/yip-session.ts` → `requireVolunteerSession(eventId)` returns `{ ok, volunteerId, name }`. The volunteer session carries `id` (= `yip.volunteers.id`), `name`, `eventId`. Login is set in `app/yip/actions/auth.ts`.
- **Vote kiosk actions:** `app/yip/actions/vote-capture.ts` — `getKioskState(eventId)` (poll model: 4s WAITING / 5s LIST) and `castKioskVote(...)`. Both gated by `requireVolunteerSession`. **Keep as-is.**
- **YUVA desks data:** `yip.yuva_assignments` (migration `supabase/migrations/20260611130000_yip_yuva_assignments.sql`). Columns: `id, event_id, volunteer_id, party_id, committee_name, created_at`. Exactly one of `party_id`/`committee_name` set per row; a volunteer can have several rows. **RLS enabled, `REVOKE ALL FROM anon, authenticated`** → service-role only. Admin CRUD in `app/yip/actions/yuva-assignments.ts`; UI at `app/yip/dashboard/events/[id]/yuva/`. Live rows: Erode `170c8e79` (2), ZZZ QA clone `6ecd54d8` (1). **Erode has 10 `[MOCK]` volunteers with NULL access codes — test on a clone or seeded volunteer, not those.**
- **Student-side mirror pattern:** `app/yip/actions/me-dashboard.ts` already reads `yuva_assignments` from the *student* side (`getMeContacts` = "who is my YUVA", `getMyPartyRoster` = non-PII party roster). This is the exact pattern to mirror for the *volunteer* side — `createServiceClient` + scope by session id + **deliberately omit PII columns** (no phone/email/school).
- **Check-in model:** `app/yip/actions/participants.ts` → `checkInParticipant` / `checkOutParticipant` / `bulkCheckIn`, all `canManage`-gated, flipping a single `participants.checked_in` (+ `checked_in_at`). No day1/day2 split. The volunteer version flips the **same** columns (one source of truth) but gates on `requireVolunteerSession` + desk-scope.
- **Agenda / "now":** `events.current_agenda_item_id` points at the live item; `yip.agenda` rows carry `status` (`upcoming`/`in_progress`/`completed`/`skipped`), `title`, `description`, `agenda_type`, `day`, `sequence_order`, `session_key`. `events.status` is `day1_live`/`day2_live`/etc. "What's happening now" = read those two and poll.
- **`participants` columns (live):** includes `party_id (uuid)`, `committee_name (text)`, `serial_no`, `full_name`, `constituency_name`, `checked_in`, `checked_in_at`. **No `speech_finished` column yet.**
- **Grant model (live):** `participants` SELECT grants are **column-scoped** to `anon`+`authenticated`; `access_code`/`email`/`phone`/`parent_phone` have NO SELECT (REVOKE is live). Therefore a new column added by `ALTER TABLE` gets **no** grant → service-role only. Migration must NOT grant `speech_finished`.
- **Types:** `yuva_assignments` and (after migration) `speech_finished` are NOT in `types/yip/database.ts`. The codebase's established choice (see `me-dashboard.ts`, `yuva-assignments.ts`, `vote-capture.ts`) is a **narrow file-local untyped accessor**, NOT a full `supabase gen types` regen. Follow that to keep the PR diff minimal (rule: stay in scope).
- **Test runner:** No vitest/jest. Pure-logic tests are tsx harnesses run with `npx tsx lib/yip/__tests__/<name>.test.ts` (see `lib/yip/__tests__/election-outcome.test.ts`).

## Key Decisions (locked with product owner 2026-06-13)

1. **Volunteer scope = DESK-SCOPED.** A volunteer may only view/check-in/mark students whose `party_id` matches one of their assigned parties OR whose `committee_name` matches one of their assigned committees. A volunteer with **no** assignment sees an empty desk + a "No desk assigned — see an organiser" message (fail-closed, never crash). A student belongs to both a party and a committee, so they may legitimately appear on more than one volunteer's desk — that is intended.
2. **Every participant gives a 90-second speech** → `speech_finished` toggle applies to every student in scope (no eligibility designation surface needed).
3. **Speech marker is reversible** (toggle on/off) — craft decision; mistakes happen during a live event.
4. **Attendance writes the same `checked_in`/`checked_in_at`** columns as the organiser check-in (single source of truth), so the projector / participants dashboard reflect volunteer check-ins automatically.
5. **"What's happening now" polls** (~5s, reusing the kiosk poll pattern) — read-only live-follow, no realtime subscription.
6. **Organisers** reach the speech marker via a `canManage`-gated action (`markSpeechFinished`) on the participants admin page — same gate as `checkInParticipant`.

## Risks & Gotchas (read before starting)

- **Migration before code deploy.** Apply the column to prod (Management API) BEFORE merging code that reads/writes it, or the live read crashes. The migration is additive (`ADD COLUMN ... DEFAULT false NOT NULL`) and safe.
- **Do not grant `speech_finished`.** Leaving it ungranted is the secure default. Adversarially verify post-migration that the real anon key cannot read it.
- **`select("*")` + new column:** organiser reads go through `getEventParticipants` which does `.select("*")` on the **service-role** client — service role reads all columns, so it picks up `speech_finished` with no change. Do not switch any **anon/authenticated** read to `select("*")` for participants (column-scoped grants would error on the ungranted column).
- **Untyped columns:** reading/writing `speech_finished` and `yuva_assignments` through the typed client fails tsc (column/table not in generated types). Use the narrow untyped accessor pattern already in the codebase — shown in full in Task 3/5/6. Do NOT run a full `supabase gen types` regen for this PR.
- **Desk-scope must be enforced server-side on every write**, not just hidden in the UI. The roster read filters by desk AND each write re-verifies the target is in-desk before mutating (defense in depth — `yip.participants` write policies are permissive; the server action is the only gate).
- **No PII in the volunteer roster.** Mirror `getMyPartyRoster`: SELECT only `id, serial_no, full_name, constituency_name, party_id, committee_name, checked_in, speech_finished`. Never add phone/email/school. (Volunteers are not chair/organiser; minimal data.)
- **Keep the vote kiosk working.** Restructuring `page.tsx` into tabs must not change `KioskClient`'s props (`eventId`, `volunteerName`) or its mount conditions. Regression-check the kiosk after the UI change.
- **Audit logging:** `logAuditAction` is keyed to authenticated users; volunteers are not auth users. Volunteer writes therefore do **not** call `logAuditAction` (matches `castKioskVote`, which audits provenance via the `recorded_by_volunteer_id` column on the row, not the audit log). For attendance/speech we keep it simple (YAGNI): no extra provenance column in v1. The organiser action MAY audit since it runs as an auth user — but to stay in scope, match `checkInParticipant`, which does NOT audit either. So: neither path audits in v1.
- **Worktree tsc caveat:** if `npx tsc --noEmit` in the worktree reports missing-module noise, the authoritative gate is tsc on the MAIN tree after merge + Vercel green (per project memory). The worktree shares the main `node_modules` via symlink, so this should be clean here.
- **Commit per file** (agents have socket-died mid-run): each task ends with a commit so partial progress survives.

---

## Execution Order & Batching

```
Batch A (schema — must land first):           Task 1
Batch B (pure logic, parallel-safe):          Task 2
Batch C (server actions, depend on A+B):      Task 3, Task 4, Task 5, Task 6   ← can be built in parallel (distinct files / functions)
Batch D (UI, depends on C):                   Task 7 (organiser) ‖ Tasks 8–12 (volunteer dashboard)
Batch E (verification gate):                  Task 13 → 14 → 15 → 16
```

Within Batch C, Tasks 3/4/5 are all in the new `volunteer-desk.ts` (build sequentially in that one file) and Task 6 is in `participants.ts` (independent). Batch D organiser (Task 7) and volunteer (8–12) touch disjoint files and can go in parallel.

---

### Task 1: Migration — add `participants.speech_finished`

**Files:**
- Create: `supabase/migrations/20260613120000_yip_participant_speech_finished.sql`

**Step 1: Write the migration**

```sql
-- YIP: per-participant "90-second speech finished" marker.
-- Every participant gives a 90-second speech; organisers and desk-scoped YUVA
-- volunteers tick each student off as they finish. Reversible (plain boolean).
--
-- Additive only. NOT NULL DEFAULT false is safe on a populated table.
--
-- ACL: participants SELECT grants are COLUMN-scoped (each column granted
-- individually to anon/authenticated; access_code/email/phone are NOT granted).
-- A newly-added column therefore inherits NO grant -> readable only by
-- service_role, which is exactly what we want (this marker is read/written via
-- the event-gated / volunteer-gated server actions only). Do NOT grant it.
-- RLS is already enabled on yip.participants.

ALTER TABLE yip.participants
  ADD COLUMN IF NOT EXISTS speech_finished boolean NOT NULL DEFAULT false;

-- Intentionally NO grant statement: leaving the column ungranted keeps it
-- service-role-only and out of the anon/authenticated PostgREST surface.
```

**Step 2: Apply to prod via the Management API**

```bash
cd /tmp
cat > mig_speech.json <<'EOF'
{"query":"ALTER TABLE yip.participants ADD COLUMN IF NOT EXISTS speech_finished boolean NOT NULL DEFAULT false;"}
EOF
TOKEN=$(cat ~/.supabase/access-token)
curl -s -X POST "https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @mig_speech.json
```
Expected: `[]` (success, no rows).

**Step 3: Verify column exists + is NOT anon/authenticated-granted**

```bash
cd /tmp
cat > verify_speech.json <<'EOF'
{"query":"SELECT column_name FROM information_schema.columns WHERE table_schema='yip' AND table_name='participants' AND column_name='speech_finished';"}
EOF
cat > verify_grant.json <<'EOF'
{"query":"SELECT grantee, privilege_type FROM information_schema.column_privileges WHERE table_schema='yip' AND table_name='participants' AND column_name='speech_finished' AND grantee IN ('anon','authenticated');"}
EOF
TOKEN=$(cat ~/.supabase/access-token)
echo "column exists:"; curl -s -X POST "https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @verify_speech.json
echo; echo "anon/auth grants (expect ONLY REFERENCES rows, NO SELECT):"; curl -s -X POST "https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @verify_grant.json
```
Expected: column row returned; grant query returns `[]` or only `REFERENCES` (NO `SELECT`). The deeper anon-read proof is Task 14.

**Step 4: Commit**

```bash
git add supabase/migrations/20260613120000_yip_participant_speech_finished.sql
git commit -m "feat(yip): add participants.speech_finished column (service-role only)"
```

---

### Task 2: Desk-scope matching helper (pure logic, TDD)

**Files:**
- Create: `lib/yip/yuva-desk.ts`
- Test: `lib/yip/__tests__/yuva-desk.test.ts`

**Step 1: Write the failing test (tsx harness, repo convention)**

```ts
/**
 * Desk-scope matching tests (tsx harness, same pattern as election-outcome).
 * Run: npx tsx lib/yip/__tests__/yuva-desk.test.ts
 */
import assert from "node:assert";
import { matchesDesk, deskScope, type DeskAssignment } from "../yuva-desk";

const A: DeskAssignment[] = [
  { party_id: "p1", committee_name: null },
  { party_id: null, committee_name: "Finance" },
];

// In-scope by party
assert.equal(matchesDesk({ party_id: "p1", committee_name: "Health" }, A), true);
// In-scope by committee
assert.equal(matchesDesk({ party_id: "p9", committee_name: "Finance" }, A), true);
// Out of scope on both
assert.equal(matchesDesk({ party_id: "p9", committee_name: "Health" }, A), false);
// No assignments -> nothing in scope (fail closed)
assert.equal(matchesDesk({ party_id: "p1", committee_name: "Finance" }, []), false);
// Null target fields never match a real desk
assert.equal(matchesDesk({ party_id: null, committee_name: null }, A), false);
// Empty-string committee must NOT match a null/blank assignment
assert.equal(matchesDesk({ party_id: null, committee_name: "" }, A), false);

// deskScope returns the distinct party ids + committee names for querying
const s = deskScope(A);
assert.deepEqual(s.partyIds.sort(), ["p1"]);
assert.deepEqual(s.committeeNames.sort(), ["Finance"]);

console.log("yuva-desk: all assertions passed");
```

**Step 2: Run it — expect failure (module missing)**

Run: `cd /Users/omm/PROJECTS/yi-connect/.claude/worktrees/yuva-dash && npx tsx lib/yip/__tests__/yuva-desk.test.ts`
Expected: FAIL — `Cannot find module '../yuva-desk'`.

**Step 3: Implement the helper**

```ts
// Pure desk-scope matching for YUVA volunteers. No "use server", no I/O —
// imported by server actions AND unit-tested directly.

export type DeskAssignment = {
  party_id: string | null;
  committee_name: string | null;
};

export type DeskTarget = {
  party_id: string | null;
  committee_name: string | null;
};

const clean = (s: string | null | undefined) => (s ?? "").trim();

/**
 * The distinct party ids and committee names a volunteer's assignments cover.
 * Blank/empty committee names are dropped so they can never match a blank
 * target (fail-closed).
 */
export function deskScope(assignments: DeskAssignment[]): {
  partyIds: string[];
  committeeNames: string[];
} {
  const partyIds = new Set<string>();
  const committeeNames = new Set<string>();
  for (const a of assignments) {
    if (a.party_id) partyIds.add(a.party_id);
    const c = clean(a.committee_name);
    if (c) committeeNames.add(c);
  }
  return { partyIds: [...partyIds], committeeNames: [...committeeNames] };
}

/**
 * True iff the target student falls inside the volunteer's desk: same party_id
 * as an assignment, OR same (non-blank) committee_name. No assignments -> false.
 */
export function matchesDesk(
  target: DeskTarget,
  assignments: DeskAssignment[]
): boolean {
  const { partyIds, committeeNames } = deskScope(assignments);
  if (target.party_id && partyIds.includes(target.party_id)) return true;
  const c = clean(target.committee_name);
  if (c && committeeNames.includes(c)) return true;
  return false;
}
```

**Step 4: Run the test — expect pass**

Run: `npx tsx lib/yip/__tests__/yuva-desk.test.ts`
Expected: `yuva-desk: all assertions passed`.

**Step 5: Commit**

```bash
git add lib/yip/yuva-desk.ts lib/yip/__tests__/yuva-desk.test.ts
git commit -m "feat(yip): desk-scope matching helper + unit tests"
```

---

### Task 3: `getMyYuvaAssignment` + `getMyDeskRoster` (volunteer reads)

**Files:**
- Create: `app/yip/actions/volunteer-desk.ts`

**Step 1: Write the action file (reads only — writes added in Task 5)**

```ts
"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireVolunteerSession } from "@/lib/yip/auth/yip-session";
import { matchesDesk, deskScope, type DeskAssignment } from "@/lib/yip/yuva-desk";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Untyped accessors (yuva_assignments not in generated types; participants
//    SELECT here must include speech_finished which is also not yet typed). ──
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type RawAssignment = {
  id: string;
  volunteer_id: string;
  party_id: string | null;
  committee_name: string | null;
};
type YuvaTable = {
  select: (cols?: string) => YuvaTable;
  eq: (col: string, val: unknown) => YuvaTable;
  then: Promise<{ data: RawAssignment[] | null; error: { message: string } | null }>["then"];
};
function yuvaTable(sb: ServiceClient): YuvaTable {
  return (sb as unknown as { from: (t: string) => YuvaTable }).from("yuva_assignments");
}

type RawDeskParticipant = {
  id: string;
  serial_no: number | null;
  full_name: string;
  constituency_name: string | null;
  party_id: string | null;
  committee_name: string | null;
  checked_in: boolean | null;
  speech_finished: boolean | null;
};
type PartTable = {
  select: (cols?: string) => PartTable;
  eq: (col: string, val: unknown) => PartTable;
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => PartTable;
  then: Promise<{ data: RawDeskParticipant[] | null; error: { message: string } | null }>["then"];
};
function partsTable(sb: ServiceClient): PartTable {
  return (sb as unknown as { from: (t: string) => PartTable }).from("participants");
}

// ── Public types ──
export type MyDesk = {
  parties: { id: string; name: string }[];
  committees: string[];
  hasDesk: boolean;
};

export type DeskRosterMember = {
  id: string;
  serial_no: number | null;
  full_name: string;
  constituency_name: string | null;
  checked_in: boolean;
  speech_finished: boolean;
  /** which part of the desk this student matched (for grouping) */
  via: "party" | "committee";
};

/** The logged-in volunteer's own desk: assigned parties (+names) and committees. */
export async function getMyYuvaAssignment(
  eventId: string
): Promise<ActionResult<MyDesk>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  const { data: rows } = await yuvaTable(supabase)
    .select("id, volunteer_id, party_id, committee_name")
    .eq("event_id", eventId)
    .eq("volunteer_id", session.volunteerId);

  const assignments = (rows ?? []) as RawAssignment[];
  const { partyIds, committeeNames } = deskScope(assignments);

  let parties: { id: string; name: string }[] = [];
  if (partyIds.length > 0) {
    const { data: pr } = await supabase
      .from("parties")
      .select("id, name")
      .in("id", partyIds);
    parties = (pr ?? []).map((p) => ({ id: p.id, name: p.name }));
  }

  return {
    success: true,
    data: {
      parties,
      committees: committeeNames,
      hasDesk: partyIds.length > 0 || committeeNames.length > 0,
    },
  };
}

/** The desk-scoped student roster (NON-PII) for attendance + speech marking. */
export async function getMyDeskRoster(
  eventId: string
): Promise<ActionResult<DeskRosterMember[]>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  const { data: aRows } = await yuvaTable(supabase)
    .select("id, volunteer_id, party_id, committee_name")
    .eq("event_id", eventId)
    .eq("volunteer_id", session.volunteerId);

  const assignments = (aRows ?? []) as DeskAssignment[];
  if (deskScope(assignments).partyIds.length === 0 &&
      deskScope(assignments).committeeNames.length === 0) {
    return { success: true, data: [] }; // no desk -> empty (fail closed)
  }

  // NON-PII columns ONLY. Do NOT add phone/email/school/parent_phone.
  const { data: roster } = await partsTable(supabase)
    .select(
      "id, serial_no, full_name, constituency_name, party_id, committee_name, checked_in, speech_finished"
    )
    .eq("event_id", eventId)
    .order("serial_no", { ascending: true, nullsFirst: false });

  const members = (roster ?? []) as RawDeskParticipant[];

  const inDesk = members
    .filter((m) => matchesDesk({ party_id: m.party_id, committee_name: m.committee_name }, assignments))
    .map<DeskRosterMember>((m) => {
      const { partyIds } = deskScope(assignments);
      const via: "party" | "committee" =
        m.party_id && partyIds.includes(m.party_id) ? "party" : "committee";
      return {
        id: m.id,
        serial_no: m.serial_no,
        full_name: m.full_name,
        constituency_name: m.constituency_name,
        checked_in: !!m.checked_in,
        speech_finished: !!m.speech_finished,
        via,
      };
    });

  return { success: true, data: inDesk };
}
```

**Step 2: Compile-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors in `app/yip/actions/volunteer-desk.ts`).

**Step 3: Commit**

```bash
git add app/yip/actions/volunteer-desk.ts
git commit -m "feat(yip): volunteer desk reads — getMyYuvaAssignment + getMyDeskRoster (desk-scoped, non-PII)"
```

---

### Task 4: `getVolunteerAgendaNow` (live-follow read)

**Files:**
- Modify: `app/yip/actions/volunteer-desk.ts` (append)

**Step 1: Append the action**

```ts
export type AgendaNow = {
  eventStatus: string | null;
  item: {
    title: string;
    description: string | null;
    agendaType: string | null;
    status: string | null;
    day: number | null;
  } | null;
};

/** What's live right now — volunteer-gated, read-only. Poll this ~5s. */
export async function getVolunteerAgendaNow(
  eventId: string
): Promise<ActionResult<AgendaNow>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };

  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("status, current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false, error: "Event not found" };

  if (!event.current_agenda_item_id) {
    return { success: true, data: { eventStatus: event.status ?? null, item: null } };
  }

  const { data: item } = await supabase
    .from("agenda")
    .select("title, description, agenda_type, status, day")
    .eq("id", event.current_agenda_item_id)
    .eq("event_id", eventId) // no cross-event leak
    .maybeSingle();

  return {
    success: true,
    data: {
      eventStatus: event.status ?? null,
      item: item
        ? {
            title: item.title,
            description: item.description,
            agendaType: item.agenda_type,
            status: item.status,
            day: item.day,
          }
        : null,
    },
  };
}
```

**Step 2: Compile-check** — `npx tsc --noEmit` → PASS.

**Step 3: Commit**

```bash
git add app/yip/actions/volunteer-desk.ts
git commit -m "feat(yip): getVolunteerAgendaNow live-follow read"
```

---

### Task 5: Volunteer desk-scoped writes — attendance + speech

**Files:**
- Modify: `app/yip/actions/volunteer-desk.ts` (append)

**Step 1: Add a shared desk-scope guard + the two write actions**

```ts
import { revalidatePath } from "next/cache";

// Verify a target participant is inside the caller volunteer's desk. Returns the
// service client on success so the write can run on the same connection.
async function assertTargetInMyDesk(
  eventId: string,
  participantId: string
): Promise<
  | { ok: true; supabase: ServiceClient }
  | { ok: false; error: string }
> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { ok: false, error: session.error };

  const supabase = await createServiceClient();

  const { data: aRows } = await yuvaTable(supabase)
    .select("id, volunteer_id, party_id, committee_name")
    .eq("event_id", eventId)
    .eq("volunteer_id", session.volunteerId);
  const assignments = (aRows ?? []) as DeskAssignment[];

  const { data: target } = await partsTable(supabase)
    .select("id, party_id, committee_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle?.() ?? { data: null };

  // partsTable lacks maybeSingle in its narrow type; fall back to a scoped read.
  let targetRow = target as { party_id: string | null; committee_name: string | null } | null;
  if (!targetRow) {
    const { data: rows } = await partsTable(supabase)
      .select("id, party_id, committee_name")
      .eq("id", participantId)
      .eq("event_id", eventId);
    targetRow = (rows ?? [])[0] ?? null;
  }
  if (!targetRow) return { ok: false, error: "Student not found for this event" };

  if (!matchesDesk(targetRow, assignments)) {
    return { ok: false, error: "That student is not at your desk." };
  }
  return { ok: true, supabase };
}

// Untyped participants UPDATE accessor (speech_finished/checked_in not all typed
// together on the update overload).
type PartWrite = {
  update: (row: Record<string, unknown>) => {
    eq: (c: string, v: unknown) => {
      eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
};
function partsWrite(sb: ServiceClient): PartWrite {
  return (sb as unknown as { from: (t: string) => PartWrite }).from("participants");
}

/** Desk-scoped check-in: flips the SAME checked_in column the organiser uses. */
export async function volunteerCheckInParticipant(
  eventId: string,
  participantId: string,
  checkedIn: boolean
): Promise<ActionResult<null>> {
  const guard = await assertTargetInMyDesk(eventId, participantId);
  if (!guard.ok) return { success: false, error: guard.error };

  const { error } = await partsWrite(guard.supabase)
    .update({
      checked_in: checkedIn,
      checked_in_at: checkedIn ? new Date().toISOString() : null,
    })
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Desk-scoped speech marker (reversible). */
export async function volunteerSetSpeechFinished(
  eventId: string,
  participantId: string,
  finished: boolean
): Promise<ActionResult<null>> {
  const guard = await assertTargetInMyDesk(eventId, participantId);
  if (!guard.ok) return { success: false, error: guard.error };

  const { error } = await partsWrite(guard.supabase)
    .update({ speech_finished: finished })
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}
```

> **Note for the implementer:** the `maybeSingle?.()` hedge above is ugly. Prefer to add `maybeSingle` to the `PartTable` narrow type at the top of the file and use it directly:
> ```ts
> type PartTable = { /* ...existing... */
>   maybeSingle: () => Promise<{ data: RawDeskParticipant | null; error: { message: string } | null }>;
> };
> ```
> Then `assertTargetInMyDesk` reads `const { data: targetRow } = await partsTable(supabase).select("id, party_id, committee_name").eq("id", participantId).eq("event_id", eventId).maybeSingle();` with no fallback. Do this cleanup before committing.

**Step 2: Compile-check** — `npx tsc --noEmit` → PASS.

**Step 3: Commit**

```bash
git add app/yip/actions/volunteer-desk.ts
git commit -m "feat(yip): desk-scoped volunteer check-in + speech-finished writes (server-side scope guard)"
```

---

### Task 6: Organiser `markSpeechFinished` action

**Files:**
- Modify: `app/yip/actions/participants.ts` (append after `setParliamentRole`)

**Step 1: Append the canManage-gated action (mirror `checkInParticipant`)**

```ts
// ─── Mark 90-second Speech Finished (organiser) ───────────────────
// canManage-gated, mirrors checkInParticipant. Reversible. The desk-scoped
// volunteer equivalent lives in app/yip/actions/volunteer-desk.ts.

export async function markSpeechFinished(
  participantId: string,
  eventId: string,
  finished: boolean
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  // speech_finished is not in the generated types yet — narrow untyped update.
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: Record<string, unknown>) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    }
  )
    .from("participants")
    .update({ speech_finished: finished })
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}
```

**Step 2: Compile-check** — `npx tsc --noEmit` → PASS.

**Step 3: Commit**

```bash
git add app/yip/actions/participants.ts
git commit -m "feat(yip): organiser markSpeechFinished action (canManage-gated)"
```

---

### Task 7: Organiser UI — speech-finished toggle on participants admin

**Files:**
- Modify: `app/yip/dashboard/events/[id]/participants/participants-client.tsx`

**Context:** This client already renders the roster and calls `checkInParticipant`. `getEventParticipants` does `.select("*")` on the service client, so each row now includes `speech_finished` (untyped — read it as `(p as { speech_finished?: boolean }).speech_finished`).

**Step 1: Wire a "Speech ✓" toggle per participant**

- Import `markSpeechFinished` from `@/app/yip/actions/participants`.
- Add a column/cell next to the existing check-in control: a button/checkbox showing `speech_finished`. On click, call `markSpeechFinished(p.id, eventId, !current)` with optimistic local state, then refresh on failure.
- Read the value defensively: `const speechDone = Boolean((p as { speech_finished?: boolean }).speech_finished);`
- Match the existing check-in control's visual treatment (same button sizing / saffron-green palette as the rest of the page).

**Step 2: Compile-check** — `npx tsc --noEmit` → PASS.

**Step 3: Browser-verify (organiser)** — deferred to Task 15 (needs a signed-in organiser).

**Step 4: Commit**

```bash
git add app/yip/dashboard/events/[id]/participants/participants-client.tsx
git commit -m "feat(yip): speech-finished toggle on participants admin (organiser)"
```

---

### Task 8: Volunteer dashboard shell (tabs) — keep the kiosk

**Files:**
- Modify: `app/yip/volunteer/page.tsx`
- Create: `app/yip/volunteer/dashboard-client.tsx`

**Step 1: Keep `page.tsx`'s gate; render the new client shell**

Keep the volunteer session gate and the tricolor/header chrome. Replace the bare `<KioskClient .../>` mount with `<VolunteerDashboard eventId={session.eventId} volunteerName={session.name} />`. The header label changes from "Vote Kiosk" to "{session.name}'s Desk" (kiosk becomes one tab). Keep the `GuideLauncher` (volunteer guide).

**Step 2: Build the tabbed shell** — `dashboard-client.tsx` ("use client"):

```tsx
"use client";
import { useState } from "react";
import { KioskClient } from "./kiosk-client";
import { DeskCard } from "./desk-client";
import { NowCard } from "./now-client";
import { DeskRoster } from "./roster-client";

type Tab = "desk" | "now" | "roster" | "vote";
const SAFFRON = "#FF9933";

export function VolunteerDashboard({ eventId, volunteerName }: { eventId: string; volunteerName: string }) {
  const [tab, setTab] = useState<Tab>("desk");
  return (
    <div className="space-y-4">
      {tab === "desk" && <DeskCard eventId={eventId} />}
      {tab === "now" && <NowCard eventId={eventId} />}
      {tab === "roster" && <DeskRoster eventId={eventId} />}
      {tab === "vote" && <KioskClient eventId={eventId} volunteerName={volunteerName} />}

      {/* Bottom tab bar — thumb-reachable on a phone */}
      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-[#1a1a3e]/10 bg-white">
        {([
          ["desk", "Desk"],
          ["now", "Now"],
          ["roster", "Students"],
          ["vote", "Vote"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-semibold"
            style={{ color: tab === t ? SAFFRON : "#1a1a3e80" }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="h-16" /> {/* spacer so content clears the fixed bar */}
    </div>
  );
}
```

**Step 3: Compile-check** — `npx tsc --noEmit` → PASS (will fail until Tasks 9–11 create the three card files; build them next, then re-run).

**Step 4: Commit** (after 9–11 compile)

```bash
git add app/yip/volunteer/page.tsx app/yip/volunteer/dashboard-client.tsx
git commit -m "feat(yip): volunteer dashboard tab shell (keeps vote kiosk as a tab)"
```

---

### Task 9: "Your Desk" + "Your Responsibilities" card

**Files:**
- Create: `app/yip/volunteer/desk-client.tsx`

**Step 1: Build the card**

```tsx
"use client";
import { useEffect, useState } from "react";
import { getMyYuvaAssignment, type MyDesk } from "@/app/yip/actions/volunteer-desk";

// Static responsibilities text per desk type (Key Decision: static per desk).
const RESPONSIBILITIES = [
  "Help students at your desk find their seats and understand the agenda.",
  "Mark attendance for your students as they arrive.",
  "When a student finishes their 90-second speech, mark it done.",
  "During an open vote, carry the device and hand it to each student to cast their own vote.",
];

export function DeskCard({ eventId }: { eventId: string }) {
  const [desk, setDesk] = useState<MyDesk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getMyYuvaAssignment(eventId).then((r) =>
      r.success ? setDesk(r.data) : setErr(r.error)
    );
  }, [eventId]);

  if (err) return <Banner>{err}</Banner>;
  if (!desk) return <Banner>Loading your desk…</Banner>;

  if (!desk.hasDesk) {
    return (
      <Banner tone="warn">
        You have not been assigned to a party or committee yet. Please see an
        organiser to get your desk.
      </Banner>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#FF9933]">Your Desk</h2>
        <div className="mt-2 space-y-1">
          {desk.parties.map((p) => (
            <p key={p.id} className="text-base font-semibold text-[#1a1a3e]">🏛️ {p.name}</p>
          ))}
          {desk.committees.map((c) => (
            <p key={c} className="text-base font-semibold text-[#1a1a3e]">📋 {c} Committee</p>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#FF9933]">Your Responsibilities</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[#1a1a3e]/80">
          {RESPONSIBILITIES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>
    </div>
  );
}

function Banner({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const cls = tone === "warn"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-[#1a1a3e]/8 bg-white text-[#1a1a3e]/70";
  return <div className={`rounded-2xl border px-4 py-6 text-center text-sm font-medium shadow-sm ${cls}`}>{children}</div>;
}
```

**Step 2: Commit** (with Task 8's shell once everything compiles).

---

### Task 10: "What's Happening Now" live-follow card

**Files:**
- Create: `app/yip/volunteer/now-client.tsx`

**Step 1: Build the polling card (reuse the kiosk poll cadence)**

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { getVolunteerAgendaNow, type AgendaNow } from "@/app/yip/actions/volunteer-desk";

export function NowCard({ eventId }: { eventId: string }) {
  const [now, setNow] = useState<AgendaNow | null>(null);

  const refresh = useCallback(async () => {
    const r = await getVolunteerAgendaNow(eventId);
    if (r.success) setNow(r.data);
  }, [eventId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000); // matches kiosk LIST cadence
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#FF9933]">Happening Now</h2>
      {!now?.item ? (
        <p className="mt-3 text-base text-[#1a1a3e]/55">
          {now?.eventStatus && now.eventStatus.includes("live")
            ? "Between sessions — stand by."
            : "The session has not started yet."}
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-xl font-black text-[#1a1a3e]">{now.item.title}</p>
          {now.item.description && (
            <p className="mt-1 text-sm text-[#1a1a3e]/60">{now.item.description}</p>
          )}
          {now.item.day && (
            <span className="mt-3 inline-block rounded-full bg-[#FF9933]/10 px-3 py-1 text-xs font-semibold text-[#FF9933]">
              Day {now.item.day}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
```

**Step 2: Commit** (with the shell).

---

### Task 11: Desk roster — attendance + speech toggles

**Files:**
- Create: `app/yip/volunteer/roster-client.tsx`

**Step 1: Build the list with per-student toggles + optimistic state**

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import {
  getMyDeskRoster,
  volunteerCheckInParticipant,
  volunteerSetSpeechFinished,
  type DeskRosterMember,
} from "@/app/yip/actions/volunteer-desk";

export function DeskRoster({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<DeskRosterMember[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // participantId in flight

  const refresh = useCallback(async () => {
    const r = await getMyDeskRoster(eventId);
    if (r.success) setRows(r.data);
    else setErr(r.error);
  }, [eventId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function toggleCheckIn(m: DeskRosterMember) {
    setBusy(m.id);
    setRows((rs) => rs.map((x) => x.id === m.id ? { ...x, checked_in: !x.checked_in } : x));
    const r = await volunteerCheckInParticipant(eventId, m.id, !m.checked_in);
    setBusy(null);
    if (!r.success) { setErr(r.error); await refresh(); }
  }
  async function toggleSpeech(m: DeskRosterMember) {
    setBusy(m.id);
    setRows((rs) => rs.map((x) => x.id === m.id ? { ...x, speech_finished: !x.speech_finished } : x));
    const r = await volunteerSetSpeechFinished(eventId, m.id, !m.speech_finished);
    setBusy(null);
    if (!r.success) { setErr(r.error); await refresh(); }
  }

  if (rows.length === 0 && !err) {
    return <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-4 py-10 text-center text-sm text-[#1a1a3e]/55 shadow-sm">No students at your desk yet.</div>;
  }

  return (
    <div className="space-y-3">
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">{err}</div>}
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.id} className="rounded-xl border border-[#1a1a3e]/8 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#1a1a3e]/5 px-1.5 font-mono text-sm font-bold text-[#1a1a3e]/70">
                {m.serial_no ?? "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-[#1a1a3e]">{m.full_name}</span>
                {m.constituency_name && <span className="block truncate text-xs text-[#1a1a3e]/45">{m.constituency_name}</span>}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Toggle on={m.checked_in} disabled={busy === m.id} onClick={() => toggleCheckIn(m)} labelOn="Checked in" labelOff="Check in" />
              <Toggle on={m.speech_finished} disabled={busy === m.id} onClick={() => toggleSpeech(m)} labelOn="Speech done" labelOff="Mark speech" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Toggle({ on, disabled, onClick, labelOn, labelOff }: {
  on: boolean; disabled: boolean; onClick: () => void; labelOn: string; labelOff: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        on
          ? "border-[#138808] bg-[#138808]/10 text-[#138808]"
          : "border-[#1a1a3e]/15 bg-white text-[#1a1a3e]/70"
      }`}
    >
      {on ? `✓ ${labelOn}` : labelOff}
    </button>
  );
}
```

**Step 2: Build-gate + commit the whole UI batch**

Run: `npx tsc --noEmit` → PASS.

```bash
git add app/yip/volunteer/page.tsx app/yip/volunteer/dashboard-client.tsx \
        app/yip/volunteer/desk-client.tsx app/yip/volunteer/now-client.tsx \
        app/yip/volunteer/roster-client.tsx
git commit -m "feat(yip): volunteer dashboard UI — desk, now, roster (attendance + speech), vote tab"
```

---

### Task 12: Integration sanity (dev server, smoke)

**Files:** none (verification)

**Step 1:** Start dev in the worktree and load the volunteer route shell (no auth needed to confirm it compiles/renders the redirect):

Run: `npm run dev` (worktree shares main `node_modules` via symlink). Hit `http://localhost:3000/yip/volunteer` → expect redirect to `/yip/join` (no volunteer session). Confirm no server error in the console. Full credentialed flow is Task 15.

**Step 2:** Stop dev. No commit.

---

### Task 13: Compile gate (authoritative)

Run (worktree): `npx tsc --noEmit` → PASS, zero errors.
After merge to master, re-run on the MAIN tree (project rule: worktree tsc can show false module noise; main-tree tsc + Vercel green is ground truth).

---

### Task 14: Adversarial-verify vs the LIVE DB (Agent)

Dispatch a `general-purpose` Agent (project pattern — caught real ship-blockers before) to verify against the live DB + real anon key, NOT just the code:

1. **`speech_finished` is not anon-readable.** Using the real anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `yi-connect/.env.local`) hit PostgREST: `GET /rest/v1/participants?select=speech_finished&limit=1` with `apikey`/`Authorization: Bearer <anon>` and schema `yip` → expect `permission denied for column speech_finished` (or empty/!=200), NOT a boolean value. (Management API gives false-green; use the real anon key — project memory `feedback_layer3_rls_was_open`.)
2. **Desk-scope holds server-side.** Re-derive: confirm `volunteerCheckInParticipant`/`volunteerSetSpeechFinished` both call `assertTargetInMyDesk` before any write, and that a participant whose `party_id`/`committee_name` is outside the caller's `yuva_assignments` is rejected with "not at your desk" — i.e. the UI filter is NOT the only gate.
3. **Reads are non-PII.** Confirm `getMyDeskRoster`'s SELECT omits `phone`, `parent_phone`, `email`, `school_name`.
4. **Volunteer gate everywhere.** Every export in `volunteer-desk.ts` calls `requireVolunteerSession(eventId)` (directly or via `assertTargetInMyDesk`) before touching data.
5. **Organiser gate.** `markSpeechFinished` checks `access.canManage`.

Fix anything flagged; re-run Task 13 after fixes.

---

### Task 15: Live browser QA on a throwaway clone (USER signs in)

Per project rules, Claude never types passwords — the USER signs in; Claude drives. Use a **clone**, never wipe ZZZ QA (`6ecd54d8`), Mizoram, or real Erode (`170c8e79`).

1. Pick/seed a test event with: ≥1 real volunteer (real access code, `is_yuva=true`) assigned to a party AND a committee in YUVA Desks; participants in that party/committee plus some outside it.
2. **Volunteer flow:** sign in as the volunteer → `/yip/volunteer`:
   - **Desk** tab shows the assigned party + committee, sensible responsibilities; a volunteer with no assignment shows the "see an organiser" banner.
   - **Students** tab lists ONLY desk students; toggling Check-in and Speech persists (reload → state holds); a student outside the desk never appears.
   - **Now** tab follows the live agenda when an organiser advances it (≤5s).
   - **Vote** tab: open a vote as organiser → kiosk list appears and a relayed vote records (regression check the kiosk still works).
3. **Organiser flow:** sign in as organiser/chair → participants admin → the Speech toggle marks/uns-marks and persists; cross-check the same student's `speech_finished` flips in the volunteer roster.
4. Confirm via SW-bypassed fetch / commit-status "Vercel" once deployed (PWA `yc-v3-runtime` page cache can mask deploys).

---

### Task 16: PR + deploy-verify

```bash
# from the worktree
git push origin HEAD:feat/yip-yuva-volunteer-dashboard
/opt/homebrew/bin/gh pr create -R JKKN-Institutions/yi-connect \
  --title "feat(yip): YUVA volunteer dashboard (desk, now, attendance, speech) + speech_finished" \
  --body "<summary + the 6 parts + desk-scoped decision + migration-already-applied note>"
```
- Migration was applied to prod in Task 1 (the SQL file is the record). Note this in the PR body so review knows code is safe to deploy.
- After merge: confirm Vercel deploy via the commit-status context **"Vercel"** (NOT the deployments API — that's Railway). Re-run the Task 13 main-tree tsc.

---

## Done = all true

- [ ] `participants.speech_finished` live in prod, not anon-readable (Task 14 #1 green).
- [ ] `npx tsx lib/yip/__tests__/yuva-desk.test.ts` passes.
- [ ] `npx tsc --noEmit` clean on the main tree post-merge.
- [ ] Volunteer dashboard: Desk / Now / Students / Vote all work; desk-scope enforced server-side; vote kiosk unchanged.
- [ ] Organiser speech toggle works and is consistent with the volunteer view.
- [ ] Adversarial-verify (Task 14) all green; live browser QA (Task 15) all green.
- [ ] PR merged; Vercel deploy verified via commit-status "Vercel".
