"use server";

import { createClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { revalidatePath } from "next/cache";

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
  state?: string;
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by, allocation_locked")
    .eq("id", eventId)
    .single();

  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

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

    revalidatePath(`/dashboard/events/${eventId}/participants`);
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by")
    .eq("id", eventId)
    .single();

  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

  const existingCodes = new Set<string>();
  const errors: string[] = [];
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
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate
    if (!row.name || !row.school) {
      errors.push(`Row ${i + 1}: Name and school are required`);
      continue;
    }
    if (!row.class || row.class < 9 || row.class > 12) {
      errors.push(`Row ${i + 1}: Class must be between 9 and 12`);
      continue;
    }

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
        home_state: row.state?.trim() || null,
        access_code: code,
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

  revalidatePath(`/dashboard/events/${eventId}/participants`);
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify event ownership and allocation lock
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by, allocation_locked")
    .eq("id", eventId)
    .single();

  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
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

  revalidatePath(`/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}

// ─── Check In Participant ─────────────────────────────────────────

export async function checkInParticipant(
  participantId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by")
    .eq("id", eventId)
    .single();

  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

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

  revalidatePath(`/dashboard/events/${eventId}/participants`);
  revalidatePath(`/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Check Out Participant ────────────────────────────────────────

export async function checkOutParticipant(
  participantId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by")
    .eq("id", eventId)
    .single();

  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

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

  revalidatePath(`/dashboard/events/${eventId}/participants`);
  revalidatePath(`/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Bulk Check In ────────────────────────────────────────────────

export async function bulkCheckIn(
  participantIds: string[],
  eventId: string
): Promise<ActionResult<{ checkedIn: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (participantIds.length === 0) {
    return { success: false, error: "No participants selected" };
  }

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by")
    .eq("id", eventId)
    .single();

  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

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

  revalidatePath(`/dashboard/events/${eventId}/participants`);
  revalidatePath(`/dashboard/events/${eventId}/control`);
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
