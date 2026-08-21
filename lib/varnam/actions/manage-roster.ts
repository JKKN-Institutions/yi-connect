"use server";

/**
 * Volunteer roster management for the Varnam Vizha run-sheet page —
 * add / update / remove people on an event's day-of roster
 * (yi_connect.varnam_event_roster).
 *
 * Authorization: every action RE-CHECKS getVarnamAccess().canManage
 * server-side (hidden buttons are never trusted). Writes go via the admin
 * client (RLS on the table is closed by default), which is exactly why the
 * re-check is mandatory.
 */
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";

export type RosterActionState = { ok: boolean; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const runsheetPath = (eventId: string) =>
  `/varnam-vizha/dashboard/events/${eventId}/runsheet`;

/** Committee members who can manage content may edit the roster. */
async function denyUnlessManager(): Promise<RosterActionState | null> {
  const access = await getVarnamAccess();
  if (!access.canView) return { ok: false, message: access.reason };
  if (!access.canManage) {
    return {
      ok: false,
      message:
        "Your role can view the run sheet but not edit the roster. Ask the festival chair for organiser access.",
    };
  }
  return null;
}

/** Trim a form value; empty string → null (keeps the table tidy). */
function cleanOptional(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
}

/**
 * Add a person to an event's roster. Form-action shape (useActionState):
 * fields event_id (hidden), person_name (required), phone, duty, station.
 */
export async function addRosterEntry(
  _prev: RosterActionState,
  formData: FormData
): Promise<RosterActionState> {
  const denied = await denyUnlessManager();
  if (denied) return denied;

  const eventId = String(formData.get("event_id") ?? "").trim();
  const personName = String(formData.get("person_name") ?? "").trim();
  const phone = cleanOptional(formData.get("phone"));
  const duty = cleanOptional(formData.get("duty"));
  const station = cleanOptional(formData.get("station"));

  if (!UUID_RE.test(eventId)) {
    return { ok: false, message: "Missing event — please reload the page." };
  }
  if (!personName) {
    return { ok: false, message: "Please enter the person's name." };
  }

  const sb = createAdminSupabaseClient();

  // The roster only exists for real festival events — verify before writing.
  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, festival_edition_id")
    .eq("id", eventId)
    .maybeSingle();
  const event = eventRaw as {
    id: string;
    festival_edition_id: string | null;
  } | null;
  if (!event || !event.festival_edition_id) {
    return { ok: false, message: "Event not found." };
  }

  const { data: inserted, error } = await sb
    .schema("yi_connect")
    .from("varnam_event_roster")
    .insert({
      event_id: eventId,
      person_name: personName,
      phone,
      duty,
      station,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) {
    return { ok: false, message: "Couldn't add them — please try again." };
  }

  revalidatePath(runsheetPath(eventId));
  return { ok: true, message: `${personName} added to the roster.` };
}

export type RosterEntryFields = {
  person_name?: string;
  phone?: string | null;
  duty?: string | null;
  station?: string | null;
  notes?: string | null;
  sort?: number;
};

/** Update fields on an existing roster entry (verified with .select() back). */
export async function updateRosterEntry(
  id: string,
  fields: RosterEntryFields
): Promise<RosterActionState> {
  const denied = await denyUnlessManager();
  if (denied) return denied;
  if (!UUID_RE.test((id ?? "").trim())) {
    return { ok: false, message: "Missing roster entry." };
  }

  // Build the patch from whitelisted fields only.
  const patch: Record<string, unknown> = {};
  if (fields.person_name !== undefined) {
    const name = String(fields.person_name).trim();
    if (!name) return { ok: false, message: "Name can't be empty." };
    patch.person_name = name;
  }
  if (fields.phone !== undefined) {
    const v = fields.phone == null ? null : String(fields.phone).trim();
    patch.phone = v || null;
  }
  if (fields.duty !== undefined) {
    const v = fields.duty == null ? null : String(fields.duty).trim();
    patch.duty = v || null;
  }
  if (fields.station !== undefined) {
    const v = fields.station == null ? null : String(fields.station).trim();
    patch.station = v || null;
  }
  if (fields.notes !== undefined) {
    const v = fields.notes == null ? null : String(fields.notes).trim();
    patch.notes = v || null;
  }
  if (fields.sort !== undefined) {
    const n = Number(fields.sort);
    if (!Number.isFinite(n)) return { ok: false, message: "Invalid order value." };
    patch.sort = Math.trunc(n);
  }
  if (Object.keys(patch).length === 0) {
    return { ok: true, message: "Nothing to update." };
  }
  patch.updated_at = new Date().toISOString();

  const sb = createAdminSupabaseClient();
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("varnam_event_roster")
    .update(patch)
    .eq("id", id)
    .select("id, event_id")
    .maybeSingle();
  const row = updated as { id: string; event_id: string } | null;
  if (error || !row) {
    return { ok: false, message: "Couldn't save — please try again." };
  }

  revalidatePath(runsheetPath(row.event_id));
  return { ok: true, message: "Roster updated." };
}

/** Remove a person from the roster (hard delete — a roster row is not a record). */
export async function removeRosterEntry(id: string): Promise<RosterActionState> {
  const denied = await denyUnlessManager();
  if (denied) return denied;
  if (!UUID_RE.test((id ?? "").trim())) {
    return { ok: false, message: "Missing roster entry." };
  }

  const sb = createAdminSupabaseClient();

  // Read first so we know which run sheet to refresh; a second click on an
  // already-removed row stays idempotent.
  const { data: existingRaw } = await sb
    .schema("yi_connect")
    .from("varnam_event_roster")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle();
  const existing = existingRaw as { id: string; event_id: string } | null;
  if (!existing) return { ok: true, message: "Already removed." };

  const { data: deleted, error } = await sb
    .schema("yi_connect")
    .from("varnam_event_roster")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return { ok: false, message: "Couldn't remove them — please try again." };
  }

  revalidatePath(runsheetPath(existing.event_id));
  return { ok: true, message: "Removed from the roster." };
}
