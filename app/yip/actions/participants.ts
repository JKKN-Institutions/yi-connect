"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { COMMITTEES } from "@/lib/yip/constants";
import {
  CONSTITUENCIES,
  PROMINENT_CONSTITUENCIES,
} from "@/lib/yip/data/constituencies";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/yip/database";

// Why service client for gated writes: yip.* tables have RLS enabled with
// read-only policies for `authenticated` (no write policy), so session-client
// inserts/updates fail ("new row violates row-level security policy"). The
// getYipEventAccess() capability check IS the authorization gate; the
// privileged write then runs on the service client. (2026-05-30 — fixes the
// UI import RLS write-block.)

type ParliamentRole = Database["public"]["Enums"]["parliament_role"];

// ─── Types ─────────────────────────────────────────────────────────

interface AddParticipantData {
  full_name: string;
  // Name-only registration: the student's name is the only personal data
  // collected (with consent — see the privacy notice on /yip/join). school_name
  // is NOT NULL and class has a 9–12 CHECK, so they default rather than collect.
  school_name?: string;
  class?: number;
  phone?: string;
  email?: string;
  city?: string;
  home_state?: string;
}

interface ImportRow {
  name: string;
  school: string;
  class: number;
  phone?: string;
  // Parent / guardian mobile — the reachable contact for minors → parent_phone.
  parent_phone?: string;
  email?: string;
  city?: string;
  // Roster home state (legacy alias `state` still accepted on the client; the
  // client decides whether the spreadsheet's `state` column means home_state
  // or constituency_state and forwards the correct field below).
  home_state?: string;
  // NEW — allocation columns (all optional, back-compat)
  party_letter?: string;        // "A".."Z" — case-insensitive
  constituency_name?: string;
  constituency_number?: number; // platform seat number (e.g. 101)
  constituency_state?: string;
  committee_number?: number;
  committee_name?: string;
}

type PartySide = Database["public"]["Enums"]["party_side"];

/** Letter -> 1-based index. "A" -> 1, "B" -> 2, ... */
function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 64;
}

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Helper: generate unique code ──────────────────────────────────

async function generateUniqueCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  existingCodes: Set<string>
): Promise<string> {
  let code = generateAccessCode();
  let attempts = 0;

  while (attempts < 20) {
    if (!existingCodes.has(code)) {
      // Check DB
      const { data: existing } = await supabase
        .from("participants")
        .select("id")
        .eq("event_id", eventId)
        .eq("access_code", code)
        .maybeSingle();

      if (!existing) {
        // Also check jury
        const { data: juryExisting } = await supabase
          .from("jury_assignments")
          .select("id")
          .eq("event_id", eventId)
          .eq("access_code", code)
          .maybeSingle();

        if (!juryExisting) {
          existingCodes.add(code);
          return code;
        }
      }
    }
    code = generateAccessCode();
    attempts++;
  }

  throw new Error("Failed to generate unique access code after 20 attempts");
}

// ─── Add Single Participant ────────────────────────────────────────

export async function addParticipant(
  eventId: string,
  data: AddParticipantData
): Promise<ActionResult<{ id: string; access_code: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  try {
    const accessCode = await generateUniqueCode(supabase, eventId, new Set());

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({
        event_id: eventId,
        full_name: data.full_name,
        school_name: data.school_name || "",
        class: data.class ?? 9,
        phone: data.phone || null,
        email: data.email || null,
        city: data.city || null,
        home_state: data.home_state || null,
        access_code: accessCode,
      })
      .select("id, access_code")
      .single();

    if (error || !participant) {
      return { success: false, error: error?.message ?? "Failed to add participant" };
    }

    revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
    return {
      success: true,
      data: { id: participant.id, access_code: participant.access_code },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Quick Add Walk-in (auto-assign) ──────────────────────────────
//
// Director ruling: a late walk-in is created AND auto-assigned in one shot so
// the organizer doesn't have to hand-pick a balanced slot during a live event.
// Unlike runAllocationAction (the bulk engine), this writes ONE participant and
// works even when allocation is LOCKED — it never touches anyone else's row and
// never re-runs the engine, so no unlock is required.
//
// Assignment rules (all computed from the CURRENT roster, not the engine):
//   • Party  — the bench (ruling/opposition) with FEWER current members; within
//              that bench, the party (yip.parties) with the fewest members. If
//              parties exist we set party_id + party_side + party_number;
//              otherwise just party_side.
//   • Seat   — first constituency (PROMINENT first, then full list) whose
//              (name,state) is NOT already used in this event AND whose state is
//              not the event's host state (host-state exclusion).
//   • Cmte   — the committee with the FEWEST current members (event.committee_topics
//              if set, else the default COMMITTEES).
//   • Role   — plain "mp".

interface QuickAddData {
  full_name: string;
  // Name-only: school/class default (NOT NULL + 9–12 CHECK), not collected.
  school_name?: string;
  class?: number;
  phone?: string;
  email?: string;
  city?: string;
  home_state?: string;
}

interface QuickAddAssignment {
  party_side: PartySide;
  party_name: string | null;
  constituency_name: string;
  constituency_state: string;
  committee_name: string;
}

/** Read committee names from an event's committee_topics, falling back to the
 * default COMMITTEES. Array form = a list of committee names. Object form =
 * a { committeeName → topic } map, so the KEYS are the committee names (the
 * values are the debate topics). Mirrors the allocation action. */
function committeesFromTopics(topics: unknown): string[] {
  if (Array.isArray(topics) && topics.length > 0) {
    return topics.map(String).filter((s) => s.trim().length > 0);
  }
  if (topics && typeof topics === "object") {
    const keys = Object.keys(topics as Record<string, unknown>)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (keys.length > 0) return keys;
  }
  return [...COMMITTEES];
}

export async function quickAddWalkIn(
  eventId: string,
  data: QuickAddData
): Promise<ActionResult<{ id: string; access_code: string; assignment: QuickAddAssignment }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!data.full_name?.trim()) {
    return { success: false, error: "Student name is required" };
  }

  const supabase = await createServiceClient();

  try {
    // ── Event context: host state + committee config ──
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, state, committee_topics")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return { success: false, error: "Event not found" };
    }
    const hostState = (event.state ?? "").trim().toLowerCase();
    const committeeNames = committeesFromTopics(
      (event as { committee_topics?: unknown }).committee_topics
    );

    // ── Current roster (only the columns the auto-assign needs) ──
    const { data: roster, error: rosterErr } = await supabase
      .from("participants")
      .select("party_side, party_id, constituency_name, constituency_state, committee_name")
      .eq("event_id", eventId);

    if (rosterErr) {
      return { success: false, error: rosterErr.message };
    }
    const existing = roster ?? [];

    // ── Party: pick the bench with fewer members ──
    const rulingCount = existing.filter((p) => p.party_side === "ruling").length;
    const oppositionCount = existing.filter((p) => p.party_side === "opposition").length;
    // Tie → ruling (matches the engine's ~55% ruling-leaning default).
    const chosenSide: PartySide = oppositionCount < rulingCount ? "opposition" : "ruling";

    // Within the chosen bench, find the party (if any) with the fewest members.
    const { data: parties, error: partyErr } = await supabase
      .from("parties")
      .select("id, name, party_number, side")
      .eq("event_id", eventId)
      .eq("side", chosenSide);

    if (partyErr) {
      return { success: false, error: partyErr.message };
    }

    let party_id: string | null = null;
    let party_number: number | null = null;
    let party_name: string | null = null;
    if (parties && parties.length > 0) {
      const memberCount = new Map<string, number>();
      for (const p of existing) {
        if (p.party_id) memberCount.set(p.party_id, (memberCount.get(p.party_id) ?? 0) + 1);
      }
      // Smallest party on this bench; ties broken by party_number for determinism.
      const sorted = [...parties].sort((a, b) => {
        const ca = memberCount.get(a.id) ?? 0;
        const cb = memberCount.get(b.id) ?? 0;
        if (ca !== cb) return ca - cb;
        return a.party_number - b.party_number;
      });
      const chosen = sorted[0];
      party_id = chosen.id;
      party_number = chosen.party_number;
      party_name = chosen.name;
    }

    // ── Constituency: first free seat (prominent first) not in the host state ──
    const usedSeats = new Set(
      existing
        .filter((p) => p.constituency_name)
        .map((p) => `${p.constituency_name}|${p.constituency_state ?? ""}`)
    );
    const seatPool = [...PROMINENT_CONSTITUENCIES, ...CONSTITUENCIES];
    let constituency_name = "";
    let constituency_state = "";
    for (const c of seatPool) {
      if (hostState && c.state.trim().toLowerCase() === hostState) continue;
      const key = `${c.name}|${c.state}`;
      if (usedSeats.has(key)) continue;
      constituency_name = c.name;
      constituency_state = c.state;
      break;
    }
    // Fallback (pool exhausted by exclusions/usage): any non-host seat, else any.
    if (!constituency_name) {
      const fallback =
        seatPool.find((c) => !hostState || c.state.trim().toLowerCase() !== hostState) ??
        seatPool[0];
      constituency_name = fallback.name;
      constituency_state = fallback.state;
    }

    // ── Committee: the one with the fewest current members ──
    const committeeCount = new Map<string, number>();
    for (const name of committeeNames) committeeCount.set(name, 0);
    for (const p of existing) {
      if (p.committee_name && committeeCount.has(p.committee_name)) {
        committeeCount.set(p.committee_name, (committeeCount.get(p.committee_name) ?? 0) + 1);
      }
    }
    let committee_name = committeeNames[0];
    let lowest = Infinity;
    for (const name of committeeNames) {
      const c = committeeCount.get(name) ?? 0;
      if (c < lowest) {
        lowest = c;
        committee_name = name;
      }
    }

    // ── Write the single participant ──
    const accessCode = await generateUniqueCode(supabase, eventId, new Set());

    const { data: participant, error } = await supabase
      .from("participants")
      .insert({
        event_id: eventId,
        full_name: data.full_name.trim(),
        school_name: data.school_name?.trim() || "",
        class: data.class ?? 9,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        city: data.city?.trim() || null,
        home_state: data.home_state?.trim() || null,
        access_code: accessCode,
        party_side: chosenSide,
        party_id,
        party_number,
        parliament_role: "mp",
        constituency_name,
        constituency_state,
        committee_name,
      })
      .select("id, access_code")
      .single();

    if (error || !participant) {
      return { success: false, error: error?.message ?? "Failed to add walk-in" };
    }

    await logAuditAction({
      action_type: "create",
      target_table: "participants",
      target_id: participant.id,
      target_event_id: eventId,
      metadata: {
        quick_add: true,
        party_side: chosenSide,
        party_name,
        constituency_name,
        constituency_state,
        committee_name,
      },
    });

    revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
    revalidatePath(`/yip/dashboard/events/${eventId}/control`);
    return {
      success: true,
      data: {
        id: participant.id,
        access_code: participant.access_code,
        assignment: {
          party_side: chosenSide,
          party_name,
          constituency_name,
          constituency_state,
          committee_name,
        },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Import Participants (batch) ───────────────────────────────────

export async function importParticipants(
  eventId: string,
  rows: ImportRow[],
  opts?: { assignBenches?: boolean }
): Promise<ActionResult<{ imported: number; errors: string[] }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  // Committee numbers in the uploaded sheet map to the event's committees
  // (committee_topics keys, 1-based) so uploaded events show the real ministry
  // name — same as in-app allocation. Empty when the event has no committees,
  // which keeps the "Committee N" fallback below.
  const { data: importEvent } = await supabase
    .from("events")
    .select("committee_topics")
    .eq("id", eventId)
    .single();
  const eventCommitteeNames = ((): string[] => {
    const ct = (importEvent as { committee_topics?: unknown } | null)
      ?.committee_topics;
    if (Array.isArray(ct))
      return ct.map(String).map((s) => s.trim()).filter(Boolean);
    if (ct && typeof ct === "object")
      return Object.keys(ct).map((s) => s.trim()).filter(Boolean);
    return [];
  })();

  // Benches (government/opposition): when false, lettered parties import as a
  // FLAT house — the parties are still created (so party names show on the
  // dashboard) but each participant's party_side is left null. The organiser
  // can assign benches later if they ever want them. Default true preserves
  // the original 2-bench behavior for chapters that do split. (Nashik 2026:
  // 5 lettered parties, no ruling/opposition split — director decision.)
  const assignBenches = opts?.assignBenches !== false;

  const existingCodes = new Set<string>();
  const errors: string[] = [];

  // ── Pre-pass: validate party_letter values & collect unique letters ──
  const uniqueLetters = new Set<string>();
  const validRowIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Name-only registration: only the student's name is required.
    if (!row.name) {
      errors.push(`Row ${i + 1}: Name is required`);
      continue;
    }
    if (!row.class || row.class < 9 || row.class > 12) {
      errors.push(`Row ${i + 1}: Class must be between 9 and 12`);
      continue;
    }
    if (row.party_letter !== undefined && row.party_letter !== "") {
      const letter = row.party_letter.trim().toUpperCase();
      if (!/^[A-Z]$/.test(letter)) {
        errors.push(`Row ${i + 1}: party must be a single letter A-Z (got "${row.party_letter}")`);
        continue;
      }
      uniqueLetters.add(letter);
    }
    if (
      row.committee_number !== undefined &&
      row.committee_number !== null &&
      (!Number.isInteger(row.committee_number) || row.committee_number <= 0)
    ) {
      errors.push(`Row ${i + 1}: committee must be a positive integer`);
      continue;
    }
    validRowIdx.push(i);
  }

  // ── Create-or-find parties for this event ──
  // Benchless model: parties are created with NO side. Ruling/opposition is
  // decided on event day, off-app — never auto-assigned at upload. (Matches
  // in-app allocation, which also creates side-less parties.)
  const sortedLetters = [...uniqueLetters].sort();
  const partyMap = new Map<string, { id: string; side: PartySide | null; number: number }>();

  if (sortedLetters.length > 0) {
    // Fetch existing parties for the event in one round-trip
    const { data: existingParties, error: partyFetchErr } = await supabase
      .from("parties")
      .select("id, name, party_number, side")
      .eq("event_id", eventId);

    if (partyFetchErr) {
      return { success: false, error: `Failed to read parties: ${partyFetchErr.message}` };
    }

    const byName = new Map<string, { id: string; side: PartySide | null; number: number }>();
    for (const p of existingParties ?? []) {
      byName.set(p.name, { id: p.id, side: p.side, number: p.party_number });
    }

    for (const letter of sortedLetters) {
      const name = `Party ${letter}`;
      const found = byName.get(name);
      if (found) {
        partyMap.set(letter, found);
        continue;
      }
      const number = letterToIndex(letter);

      const { data: inserted, error: insErr } = await supabase
        .from("parties")
        .insert({ event_id: eventId, name, party_number: number, side: null })
        .select("id, side, party_number")
        .single();

      if (insErr || !inserted) {
        return {
          success: false,
          error: `Failed to create party ${name}: ${insErr?.message ?? "unknown"}`,
        };
      }
      const rec = { id: inserted.id, side: inserted.side, number: inserted.party_number };
      partyMap.set(letter, rec);
      byName.set(name, rec);
    }
  }

  // ── Build participant inserts ──
  const inserts: Array<{
    event_id: string;
    full_name: string;
    school_name: string;
    class: number;
    phone: string | null;
    parent_phone: string | null;
    email: string | null;
    city: string | null;
    home_state: string | null;
    access_code: string;
    party_id: string | null;
    party_number: number | null;
    party_side: PartySide | null;
    constituency_name: string | null;
    constituency_number: number | null;
    constituency_state: string | null;
    committee_number: number | null;
    committee_name: string | null;
  }> = [];

  for (const i of validRowIdx) {
    const row = rows[i];

    let party_id: string | null = null;
    let party_number: number | null = null;
    let party_side: PartySide | null = null;
    if (row.party_letter) {
      const letter = row.party_letter.trim().toUpperCase();
      const rec = partyMap.get(letter);
      if (rec) {
        party_id = rec.id;
        party_number = rec.number;
        party_side = rec.side;
      }
    }

    const committee_number =
      row.committee_number !== undefined && row.committee_number !== null
        ? row.committee_number
        : null;
    const committee_name =
      row.committee_name?.trim() ||
      (committee_number !== null
        ? eventCommitteeNames[committee_number - 1] ??
          `Committee ${committee_number}`
        : null);

    try {
      const code = await generateUniqueCode(supabase, eventId, existingCodes);
      inserts.push({
        event_id: eventId,
        full_name: row.name.trim(),
        school_name: row.school.trim(),
        class: row.class,
        phone: row.phone?.trim() || null,
        parent_phone: row.parent_phone?.trim() || null,
        email: row.email?.trim() || null,
        city: row.city?.trim() || null,
        home_state: row.home_state?.trim() || null,
        access_code: code,
        party_id,
        party_number,
        party_side: assignBenches ? party_side : null,
        constituency_name: row.constituency_name?.trim() || null,
        constituency_number:
          row.constituency_number !== undefined &&
          row.constituency_number !== null
            ? row.constituency_number
            : null,
        constituency_state: row.constituency_state?.trim() || null,
        committee_number,
        committee_name,
      });
    } catch {
      errors.push(`Row ${i + 1}: Failed to generate access code`);
    }
  }

  if (inserts.length === 0) {
    return {
      success: false,
      error: errors.length > 0 ? errors.join("; ") : "No valid rows to import",
    };
  }

  // Batch insert
  const { error: insertError } = await supabase
    .from("participants")
    .insert(inserts);

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  await logAuditAction({
    action_type: "import",
    target_table: "participants",
    target_event_id: eventId,
    metadata: {
      imported: inserts.length,
      attempted: rows.length,
      errors_count: errors.length,
      assign_benches: assignBenches,
    },
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return {
    success: true,
    data: { imported: inserts.length, errors },
  };
}

// ─── Delete Participant ────────────────────────────────────────────

export async function deleteParticipant(
  participantId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can delete participants" };
  }
  const supabase = await createServiceClient();

  // Allocation lock still blocks deletion even for the chair (data integrity).
  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  if (event.allocation_locked) {
    return { success: false, error: "Cannot delete participant after allocation is locked" };
  }

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditAction({
    action_type: "delete",
    target_table: "participants",
    target_id: participantId,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}

// ─── Delete ALL participants (chapter chair only — full roster reset) ──────
//
// A destructive "start over" used when a chapter re-imports a corrected roster.
// Chair-only (canDelete) and blocked while allocation is locked, mirroring the
// single-row delete. The client guards it behind a two-step type-to-confirm
// dialog; this is the authoritative server-side enforcement.
export async function deleteAllParticipants(
  eventId: string
): Promise<ActionResult<{ deleted: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return {
      success: false,
      error: "Only the chapter chair can delete all registrants",
    };
  }
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { success: false, error: "Event not found" };
  }
  if (event.allocation_locked) {
    return {
      success: false,
      error: "Unlock allocation before deleting all registrants.",
    };
  }

  const { data: deleted, error } = await supabase
    .from("participants")
    .delete()
    .eq("event_id", eventId)
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditAction({
    action_type: "delete",
    target_table: "participants",
    target_id: eventId,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  return { success: true, data: { deleted: deleted?.length ?? 0 } };
}

// ─── Two-day check-in (YA2) ───────────────────────────────────────
// A YIP event runs over two days. Attendance is tracked per day via
// checked_in_day1 / checked_in_day2; the legacy `checked_in` is kept as the
// derived "present on at least one day" flag (= day1 OR day2) so every existing
// reader (voting eligibility, control-panel count, scoring) is untouched.

type CheckInDay = 1 | 2;

/** Set one day's check-in for a participant and recompute the derived `checked_in`. */
async function applyDayCheckIn(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  participantId: string,
  eventId: string,
  day: CheckInDay,
  value: boolean
): Promise<ActionResult<null>> {
  const { data: cur } = await supabase
    .from("participants")
    .select("checked_in_day1, checked_in_day2")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!cur) return { success: false, error: "Participant not found for this event" };

  const day1 = day === 1 ? value : !!cur.checked_in_day1;
  const day2 = day === 2 ? value : !!cur.checked_in_day2;
  const present = day1 || day2;
  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    checked_in: present,
    checked_in_at: present ? nowIso : null,
  };
  if (day === 1) {
    patch.checked_in_day1 = value;
    patch.checked_in_day1_at = value ? nowIso : null;
  } else {
    patch.checked_in_day2 = value;
    patch.checked_in_day2_at = value ? nowIso : null;
  }

  const { error } = await supabase
    .from("participants")
    .update(patch)
    .eq("id", participantId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Organiser sets a participant's Day 1 / Day 2 check-in. canManage-gated. */
export async function setDayCheckIn(
  participantId: string,
  eventId: string,
  day: CheckInDay,
  value: boolean
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (day !== 1 && day !== 2) {
    return { success: false, error: "Day must be 1 or 2." };
  }
  const supabase = await createServiceClient();
  return applyDayCheckIn(supabase, participantId, eventId, day, value);
}

// ─── Check In Participant (legacy = Day 1) ────────────────────────

export async function checkInParticipant(
  participantId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  return applyDayCheckIn(supabase, participantId, eventId, 1, true);
}

// ─── Check Out Participant (clears BOTH days) ─────────────────────

export async function checkOutParticipant(
  participantId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("participants")
    .update({
      checked_in: false,
      checked_in_at: null,
      checked_in_day1: false,
      checked_in_day1_at: null,
      checked_in_day2: false,
      checked_in_day2_at: null,
    })
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Bulk Check In (a single day for many) ────────────────────────

export async function bulkCheckIn(
  participantIds: string[],
  eventId: string,
  day: CheckInDay = 1
): Promise<ActionResult<{ checkedIn: number }>> {
  if (participantIds.length === 0) {
    return { success: false, error: "No participants selected" };
  }
  if (day !== 1 && day !== 2) {
    return { success: false, error: "Day must be 1 or 2." };
  }

  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const nowIso = new Date().toISOString();
  // Setting a day TRUE always makes the participant present, so checked_in can
  // be set unconditionally (no per-row read needed for a bulk check-IN).
  const patch: Record<string, unknown> = { checked_in: true, checked_in_at: nowIso };
  if (day === 1) {
    patch.checked_in_day1 = true;
    patch.checked_in_day1_at = nowIso;
  } else {
    patch.checked_in_day2 = true;
    patch.checked_in_day2_at = nowIso;
  }

  const { error } = await supabase
    .from("participants")
    .update(patch)
    .eq("event_id", eventId)
    .in("id", participantIds);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { checkedIn: participantIds.length } };
}

// ─── Get Participants ──────────────────────────────────────────────

/**
 * Read the full participant roster (incl. access_code + PII) for an event.
 *
 * Uses the SERVICE-ROLE client and is gated by getYipEventAccess(): a logged-in
 * user only receives rows for an event they actually manage. This replaces the
 * old pattern where the participants dashboard page read
 * `participants.select("*")` with the AUTHENTICATED client — which exposed
 * `access_code` (the student login credential) + email/phone/parent_phone to any
 * logged-in user for ANY event over the raw PostgREST surface. Migration
 * 20260609000000_yip_scope_access_code_authenticated.sql revokes those columns
 * from the `authenticated` role, so the sensitive columns MUST now be read via
 * service_role here. Mirrors listVolunteers() in volunteers.ts.
 */
export async function getEventParticipants(eventId: string) {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return [];

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .order("full_name");

  return data ?? [];
}
export async function setParliamentRole(
  participantId: string,
  role: ParliamentRole | null
): Promise<ActionResult<null>> {
  const supabase = await createServiceClient();

  // Look up the participant + event in one round-trip
  const { data: participant } = await supabase
    .from("participants")
    .select("id, event_id")
    .eq("id", participantId)
    .single();

  if (!participant) {
    return { success: false, error: "Participant not found" };
  }

  const access = await getYipEventAccess(participant.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await supabase
    .from("participants")
    .update({ parliament_role: role })
    .eq("id", participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${participant.event_id}/control`);
  revalidatePath(`/yip/dashboard/events/${participant.event_id}/participants`);
  return { success: true, data: null };
}

// ─── Mark 90-second Speech Finished (organiser) ───────────────────
// canManage-gated, mirrors checkInParticipant. Reversible. The desk-scoped
// volunteer equivalent lives in app/yip/actions/volunteer-desk.ts.
// speech_finished is not in the generated DB types yet — narrow untyped update.

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

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (row: Record<string, unknown>) => {
          eq: (c: string, v: unknown) => {
            eq: (
              c: string,
              v: unknown
            ) => Promise<{ error: { message: string } | null }>;
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
  revalidatePath(`/yip/dashboard/events/${eventId}/speeches`);
  return { success: true, data: null };
}


