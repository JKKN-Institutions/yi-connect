"use server";

import { revalidatePath } from "next/cache";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import { toCsv } from "@/lib/yip/attendance-csv";
import {
  assertEligibleRoles,
  buildSelfNominationCsvRows,
  coerceStoredRoles,
  countSelfNominations,
  eligibleSelfNominationRoles,
  emptySelfNominationStats,
  isCabinetRole,
  normalizeCabinetMinistries,
  normalizeSelfNominationRoles,
  type NominationEligibility,
  SELF_NOMINATION_CSV_HEADERS,
  type SelfNominationActionResult,
  type SelfNominationResultRow,
  type SelfNominationRole,
  type SelfNominationRow,
  type SelfNominationStats,
} from "@/lib/yip/self-nomination";

// ═══════════════════════════════════════════════════════════════════════
// YIP Self-Nomination — server contract.
//
// TWO GATES, never mixed (house rule):
//   STUDENT actions  → identity comes from the httpOnly `yip_session` cookie
//                      ONLY. No action here accepts a participantId from the
//                      client, so a student can neither read nor rewrite
//                      another student's nomination. Students are MINORS: no
//                      action returns anyone else's nomination, name, or code.
//   ORGANISER actions → getYipEventAccess(eventId).canView / .canManage.
//
// Every student WRITE additionally refuses while the window is closed. The
// window is an explicit admin toggle (yip.events.self_nomination_open) — there
// is no date, no countdown, no auto-close (Director, 2026-08-14).
//
// This module NEVER touches vote_sessions / candidate selection. A nomination
// is a list the organiser reads.
// ═══════════════════════════════════════════════════════════════════════

type ActionResult<T = null> = SelfNominationActionResult<T>;

// ─── Narrow, file-local table accessors ─────────────────────────
//
// yip.self_nominations (new) and yip.events.self_nomination_open (new column)
// are NOT in types/yip/database.ts — the generated file is never regenerated
// here (the CLI appends a version banner that corrupts it). Same narrow-cast
// pattern as votesTable in app/yip/actions/voting.ts: only these two accesses
// are untyped; every other table in this file stays fully typed.

type PgErr = { code?: string; message: string };

type SelfNominationDbRow = {
  id: string;
  event_id: string;
  participant_id: string;
  roles: string[] | null;
  ministries: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

type SelfNominationsTable = {
  select: (cols: string) => SelfNominationsTable;
  upsert: (
    row: Record<string, unknown>,
    opts?: { onConflict?: string }
  ) => SelfNominationsTable;
  delete: () => SelfNominationsTable;
  eq: (col: string, val: unknown) => SelfNominationsTable;
  order: (col: string, opts?: { ascending?: boolean }) => SelfNominationsTable;
  range: (from: number, to: number) => SelfNominationsTable;
  maybeSingle: () => Promise<{
    data: SelfNominationDbRow | null;
    error: PgErr | null;
  }>;
  then: Promise<{
    data: SelfNominationDbRow[] | null;
    error: PgErr | null;
  }>["then"];
};

function selfNominations(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): SelfNominationsTable {
  return (
    sb as unknown as { from: (t: string) => SelfNominationsTable }
  ).from("self_nominations");
}

type EventFlagRow = { id: string; self_nomination_open: boolean | null };

type EventFlagsTable = {
  select: (cols: string) => EventFlagsTable;
  update: (row: Record<string, unknown>) => EventFlagsTable;
  eq: (col: string, val: unknown) => EventFlagsTable;
  maybeSingle: () => Promise<{ data: EventFlagRow | null; error: PgErr | null }>;
  then: Promise<{ data: EventFlagRow[] | null; error: PgErr | null }>["then"];
};

function eventFlags(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): EventFlagsTable {
  return (sb as unknown as { from: (t: string) => EventFlagsTable }).from(
    "events"
  );
}

// ─── Internals ──────────────────────────────────────────────────

function toRow(db: SelfNominationDbRow): SelfNominationRow {
  return {
    id: db.id,
    eventId: db.event_id,
    participantId: db.participant_id,
    roles: coerceStoredRoles(db.roles),
    ministries: Array.isArray(db.ministries)
      ? db.ministries.filter((m): m is string => typeof m === "string")
      : [],
    createdAt: db.created_at ?? "",
    updatedAt: db.updated_at ?? db.created_at ?? "",
  };
}

/** Read the window toggle. Fails CLOSED: any error/missing event ⇒ closed. */
async function readWindowOpen(
  sb: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<boolean> {
  const { data } = await eventFlags(sb)
    .select("id, self_nomination_open")
    .eq("id", eventId)
    .maybeSingle();
  return data?.self_nomination_open === true;
}

/**
 * Resolve the caller's participant identity from the signed session cookie and
 * check it is a session for THIS event. Never accepts a client id.
 */
async function requireMe(
  eventId: string
): Promise<
  { ok: true; participantId: string } | { ok: false; error: string }
> {
  const sess = await getYipSession();
  if (!sess || sess.type !== "participant") {
    return { ok: false, error: "Sign in with your access code first." };
  }
  if (sess.eventId !== eventId) {
    return { ok: false, error: "Your session is for a different event." };
  }
  return { ok: true, participantId: sess.id };
}

// Route names are the ones the UI lanes actually shipped: the student screen is
// /yip/me/nominate and the organiser screen is
// /yip/dashboard/events/[id]/nominations. Revalidating any other path is a
// silent no-op that leaves a stale window state on screen.
function revalidateStudent() {
  revalidatePath("/yip/me");
  revalidatePath("/yip/me/nominate");
}

function revalidateAdmin(eventId: string) {
  revalidatePath(`/yip/dashboard/events/${eventId}/nominations`);
}

// ═══════════════════════════════════════════════════════════════════════
// STUDENT actions — participant session only
// ═══════════════════════════════════════════════════════════════════════

/**
 * The caller's OWN nomination (or null) plus whether the window is open.
 *
 * Readable even when the window is closed — a student who nominated must still
 * be able to see what they put in after the organiser closes it. Only writes
 * are refused once closed.
 */
export async function getMySelfNomination(eventId: string): Promise<
  ActionResult<{
    open: boolean;
    nomination: SelfNominationRow | null;
    /**
     * Which roles THIS student may pick. The picker renders only these, so a
     * Ruling Member never sees Leader of Opposition and a Party Leader sees
     * neither later-stage role. Presentation only — submitSelfNomination
     * re-derives it server-side and is the check that actually holds.
     */
    eligibleRoles: SelfNominationRole[];
    /**
     * The portfolios THIS event offers, in the chapter's own order. Only
     * meaningful when a Cabinet/Shadow role is among eligibleRoles; the picker
     * shows it as a sub-list requiring exactly two.
     */
    offeredMinistries: string[];
  }>
> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };

  const sb = await createServiceClient();
  const open = await readWindowOpen(sb, eventId);
  const eligibleRoles = eligibleSelfNominationRoles(
    await readMyEligibility(sb, me.participantId)
  );
  const offeredMinistries = eligibleRoles.some(isCabinetRole)
    ? await readEventMinistries(sb, eventId)
    : [];

  const { data, error } = await selfNominations(sb)
    .select("id, event_id, participant_id, roles, ministries, created_at, updated_at")
    .eq("event_id", eventId)
    .eq("participant_id", me.participantId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      open,
      nomination: data ? toRow(data) : null,
      eligibleRoles,
      offeredMinistries,
    },
  };
}

/**
 * Create or REPLACE the caller's nomination — the "edit selection" path is the
 * same call (upsert on the unique (event_id, participant_id) index), so a
 * student always has exactly one row.
 *
 * Refuses when the window is closed. Validates + de-duplicates the role set
 * (normalizeSelfNominationRoles) before it reaches the CHECK constraint.
 */
/**
 * The caller's own bench + parliament role, for the PM/LOP eligibility gate.
 *
 * Fails CLOSED on any read problem: a missing row or a query error returns
 * nulls, and eligibleSelfNominationRoles() grants no later-stage role for a
 * null bench. Erring the other way would let an unallocated Member stand for
 * Prime Minister.
 */
/**
 * The portfolios THIS event offers — the chapter's own Cabinet list, falling
 * back to the platform defaults when it has not configured one. Same resolver
 * the Cabinet tab and Government Formation use, so the three never disagree.
 */
async function readEventMinistries(
  sb: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<string[]> {
  const { data, error } = await sb
    .from("events")
    .select("cabinet_ministries")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) return [];
  const row = data as { cabinet_ministries: unknown };
  return effectiveMinistries(row.cabinet_ministries).map((m) => m.label);
}

async function readMyEligibility(
  sb: Awaited<ReturnType<typeof createServiceClient>>,
  participantId: string
): Promise<NominationEligibility> {
  const { data, error } = await sb
    .from("participants")
    .select("party_side, parliament_role")
    .eq("id", participantId)
    .maybeSingle();
  if (error || !data) return { partySide: null, parliamentRole: null };
  const row = data as {
    party_side: "ruling" | "opposition" | null;
    parliament_role: string | null;
  };
  return {
    partySide: row.party_side ?? null,
    parliamentRole: row.parliament_role ?? null,
  };
}

export async function submitSelfNomination(
  eventId: string,
  roles: string[],
  /** Portfolios, required only when a Cabinet/Shadow role is among `roles`. */
  ministries: string[] = []
): Promise<ActionResult<SelfNominationRow>> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };

  const parsed = normalizeSelfNominationRoles(roles);
  if (!parsed.ok) return { success: false, error: parsed.error };

  const sb = await createServiceClient();

  // Eligibility for the later-stage roles (PM / LOP) is decided by the
  // Member's OWN row, never by what the client sent. The picker hides
  // ineligible roles, but a hand-rolled POST never goes near the picker, so
  // this server-side check is the one that actually holds. Fails closed: a
  // participant row we cannot read yields no later-stage eligibility.
  const eligible = await readMyEligibility(sb, me.participantId);
  const allowed = assertEligibleRoles(parsed.roles, eligible);
  if (!allowed.ok) return { success: false, error: allowed.error };

  // Portfolios travel with a Cabinet/Shadow nomination and only with one. They
  // are validated against the EVENT's own ministry list, so a chapter running
  // eight portfolios cannot receive a nomination for a ninth.
  const wantsCabinet = parsed.roles.some(isCabinetRole);
  let ministryPicks: string[] | null = null;
  if (wantsCabinet) {
    const offered = await readEventMinistries(sb, eventId);
    const picked = normalizeCabinetMinistries(ministries, offered);
    if (!picked.ok) return { success: false, error: picked.error };
    ministryPicks = picked.ministries;
  }

  if (!(await readWindowOpen(sb, eventId))) {
    return {
      success: false,
      error: "Self-nomination is closed for this event.",
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await selfNominations(sb)
    .upsert(
      {
        event_id: eventId,
        participant_id: me.participantId,
        roles: parsed.roles,
        // Cleared when the student edits down to a non-Cabinet selection —
        // the CHECK requires "cabinet role ⇒ exactly 2, otherwise none", so a
        // stale array would reject the whole upsert.
        ministries: ministryPicks,
        updated_at: now,
      },
      { onConflict: "event_id,participant_id" }
    )
    .select("id, event_id, participant_id, roles, ministries, created_at, updated_at")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) {
    return { success: false, error: "Could not save your nomination." };
  }

  revalidateStudent();
  revalidateAdmin(eventId);
  return { success: true, data: toRow(data) };
}

/**
 * Remove the caller's nomination entirely.
 *
 * The spec's student flow is "edit selection", not withdraw — but the role set
 * is required to be non-empty, so "I no longer want to stand" is otherwise
 * unrepresentable and a student would be locked into at least one role
 * forever. Same window rule as submit: only while open. Idempotent — deleting
 * a nomination that isn't there succeeds.
 */
export async function withdrawSelfNomination(
  eventId: string
): Promise<ActionResult<null>> {
  const me = await requireMe(eventId);
  if (!me.ok) return { success: false, error: me.error };

  const sb = await createServiceClient();
  if (!(await readWindowOpen(sb, eventId))) {
    return {
      success: false,
      error: "Self-nomination is closed for this event.",
    };
  }

  const { error } = await selfNominations(sb)
    .delete()
    .eq("event_id", eventId)
    .eq("participant_id", me.participantId);
  if (error) return { success: false, error: error.message };

  revalidateStudent();
  revalidateAdmin(eventId);
  return { success: true, data: null };
}

// ═══════════════════════════════════════════════════════════════════════
// ORGANISER actions — getYipEventAccess
// ═══════════════════════════════════════════════════════════════════════

/** Current state of the window. canView is enough to read it. */
export async function getSelfNominationOpen(
  eventId: string
): Promise<ActionResult<{ open: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }
  const sb = await createServiceClient();
  return { success: true, data: { open: await readWindowOpen(sb, eventId) } };
}

/**
 * Open or close the nomination window. Explicit toggle only — no schedule.
 * Closing does NOT delete anything; existing nominations stay readable by the
 * organiser and by the student who made them.
 */
export async function setSelfNominationOpen(
  eventId: string,
  open: boolean
): Promise<ActionResult<{ open: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const sb = await createServiceClient();
  const { error } = await eventFlags(sb)
    .update({ self_nomination_open: open })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidateAdmin(eventId);
  revalidateStudent();
  return { success: true, data: { open } };
}

/**
 * Page through every nomination for the event.
 *
 * PostgREST caps an unbounded select at 1000 rows and a 1000+ delegate event is
 * realistic, so this pages with an EXPLICIT .range() until a short page comes
 * back. Same discipline for the participant hydration below (chunked .in()).
 */
const PAGE = 1000;

async function readAllNominations(
  sb: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<
  { ok: true; rows: SelfNominationDbRow[] } | { ok: false; error: string }
> {
  const out: SelfNominationDbRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await selfNominations(sb)
      .select("id, event_id, participant_id, roles, ministries, created_at, updated_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { ok: false, error: error.message };
    const page = data ?? [];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return { ok: true, rows: out };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Every nomination joined to the student's name, constituency and PARTY, plus
 * the headline counts. The party columns are what let the organiser run each
 * party's leader ballot (Director decision 3). Organiser-only: students never
 * see this shape.
 */
export async function getSelfNominationResults(eventId: string): Promise<
  ActionResult<{
    open: boolean;
    rows: SelfNominationResultRow[];
    stats: SelfNominationStats;
  }>
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }

  const sb = await createServiceClient();
  const open = await readWindowOpen(sb, eventId);

  const noms = await readAllNominations(sb, eventId);
  if (!noms.ok) return { success: false, error: noms.error };
  if (noms.rows.length === 0) {
    return {
      success: true,
      data: { open, rows: [], stats: emptySelfNominationStats() },
    };
  }

  // Hydrate only the nominated students — chunked .in() so a big event never
  // trips the URL-length limit or the row cap.
  type PartRow = {
    id: string;
    full_name: string;
    constituency_name: string | null;
    constituency_number: number | null;
    party_id: string | null;
    party_side: "ruling" | "opposition" | null;
  };
  const byId = new Map<string, PartRow>();
  for (const ids of chunk(
    [...new Set(noms.rows.map((n) => n.participant_id))],
    300
  )) {
    const { data, error } = await sb
      .from("participants")
      .select(
        "id, full_name, constituency_name, constituency_number, party_id, party_side"
      )
      .in("id", ids);
    if (error) return { success: false, error: error.message };
    for (const p of (data ?? []) as PartRow[]) byId.set(p.id, p);
  }

  // Party names for the event (one small read — a chapter round has < 20
  // parties; the explicit range keeps it honest anyway).
  const partyName = new Map<string, string>();
  {
    const { data, error } = await sb
      .from("parties")
      .select("id, name")
      .eq("event_id", eventId)
      .range(0, PAGE - 1);
    if (error) return { success: false, error: error.message };
    for (const p of data ?? []) partyName.set(p.id, p.name);
  }

  const rows: SelfNominationResultRow[] = noms.rows.map((n) => {
    const p = byId.get(n.participant_id);
    return {
      nominationId: n.id,
      participantId: n.participant_id,
      // A nomination whose participant row vanished cannot normally exist (the
      // FK cascades) — render defensively rather than crash the table.
      fullName: p?.full_name ?? "(removed student)",
      constituencyName: p?.constituency_name ?? null,
      constituencyNumber: p?.constituency_number ?? null,
      partyName: p?.party_id ? partyName.get(p.party_id) ?? null : null,
      partySide: p?.party_side ?? null,
      roles: coerceStoredRoles(n.roles),
      submittedAt: n.created_at ?? "",
      updatedAt: n.updated_at ?? n.created_at ?? "",
    };
  });

  return { success: true, data: { open, rows, stats: countSelfNominations(rows) } };
}

/**
 * The same results as a ready-to-download CSV string. Follows the house export
 * pattern (lib/yip/attendance-csv.ts toCsv → the client makes the Blob), so
 * nothing here writes a file or sets a header.
 */
export async function exportSelfNominationsCsv(
  eventId: string
): Promise<ActionResult<{ filename: string; csv: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const res = await getSelfNominationResults(eventId);
  if (!res.success) return res;

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    success: true,
    data: {
      filename: `yip-self-nominations-${stamp}.csv`,
      csv: toCsv(
        [...SELF_NOMINATION_CSV_HEADERS],
        buildSelfNominationCsvRows(res.data.rows)
      ),
    },
  };
}
