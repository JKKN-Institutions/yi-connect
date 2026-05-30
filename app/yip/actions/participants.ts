"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
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
  school_name: string;
  class: number;
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
  email?: string;
  city?: string;
  // Roster home state (legacy alias `state` still accepted on the client; the
  // client decides whether the spreadsheet's `state` column means home_state
  // or constituency_state and forwards the correct field below).
  home_state?: string;
  // NEW — allocation columns (all optional, back-compat)
  party_letter?: string;        // "A".."Z" — case-insensitive
  constituency_name?: string;
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
        school_name: data.school_name,
        class: data.class,
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

// ─── Import Participants (batch) ───────────────────────────────────

export async function importParticipants(
  eventId: string,
  rows: ImportRow[]
): Promise<ActionResult<{ imported: number; errors: string[] }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const existingCodes = new Set<string>();
  const errors: string[] = [];

  // ── Pre-pass: validate party_letter values & collect unique letters ──
  const uniqueLetters = new Set<string>();
  const validRowIdx: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.name || !row.school) {
      errors.push(`Row ${i + 1}: Name and school are required`);
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
  // First letter alphabetically -> ruling, rest -> opposition (organizer can flip later).
  const sortedLetters = [...uniqueLetters].sort();
  const partyMap = new Map<string, { id: string; side: PartySide; number: number }>();

  if (sortedLetters.length > 0) {
    // Fetch existing parties for the event in one round-trip
    const { data: existingParties, error: partyFetchErr } = await supabase
      .from("parties")
      .select("id, name, party_number, side")
      .eq("event_id", eventId);

    if (partyFetchErr) {
      return { success: false, error: `Failed to read parties: ${partyFetchErr.message}` };
    }

    const byName = new Map<string, { id: string; side: PartySide; number: number }>();
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
      // Side default: only assign 'ruling' if NO ruling party exists yet for the event
      // (covers re-import + multi-batch scenarios cleanly).
      const hasRuling =
        [...byName.values()].some((p) => p.side === "ruling") ||
        [...partyMap.values()].some((p) => p.side === "ruling");
      const side: PartySide = hasRuling ? "opposition" : "ruling";
      const number = letterToIndex(letter);

      const { data: inserted, error: insErr } = await supabase
        .from("parties")
        .insert({ event_id: eventId, name, party_number: number, side })
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
    email: string | null;
    city: string | null;
    home_state: string | null;
    access_code: string;
    party_id: string | null;
    party_number: number | null;
    party_side: PartySide | null;
    constituency_name: string | null;
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
      (committee_number !== null ? `Committee ${committee_number}` : null);

    try {
      const code = await generateUniqueCode(supabase, eventId, existingCodes);
      inserts.push({
        event_id: eventId,
        full_name: row.name.trim(),
        school_name: row.school.trim(),
        class: row.class,
        phone: row.phone?.trim() || null,
        email: row.email?.trim() || null,
        city: row.city?.trim() || null,
        home_state: row.home_state?.trim() || null,
        access_code: code,
        party_id,
        party_number,
        party_side,
        constituency_name: row.constituency_name?.trim() || null,
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

// ─── Check In Participant ─────────────────────────────────────────

export async function checkInParticipant(
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
      checked_in: true,
      checked_in_at: new Date().toISOString(),
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

// ─── Check Out Participant ────────────────────────────────────────

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

// ─── Bulk Check In ────────────────────────────────────────────────

export async function bulkCheckIn(
  participantIds: string[],
  eventId: string
): Promise<ActionResult<{ checkedIn: number }>> {
  if (participantIds.length === 0) {
    return { success: false, error: "No participants selected" };
  }

  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("participants")
    .update({
      checked_in: true,
      checked_in_at: new Date().toISOString(),
    })
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

export async function getParticipants(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

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


