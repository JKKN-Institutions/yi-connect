"use server";

/**
 * Permission-letter management for Varnam Vizha — track one permission
 * request per (festival event × authority), generate the formal letter, and
 * walk the status pipeline (needed → drafted → submitted → approved).
 *
 * Security: EVERY action re-checks getVarnamAccess().canManage server-side
 * (the admin client bypasses RLS, so the action layer IS the permission
 * layer). Denials return an explicit { ok:false, message } — never a silent
 * redirect.
 */
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import {
  AUTHORITIES,
  generateLetter,
  PERMISSION_STATUSES,
  type PermissionStatus,
  type VarnamAuthorityKey,
} from "@/lib/varnam/letters";

export type ManagePermissionState = { ok: boolean; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAPERWORK_PATH = "/varnam-vizha/dashboard/paperwork";

function revalidatePermissionPaths(eventId: string | null) {
  revalidatePath(PAPERWORK_PATH);
  if (eventId) {
    revalidatePath(`/varnam-vizha/dashboard/events/${eventId}/permissions`);
  }
}

async function requireManage(): Promise<ManagePermissionState | null> {
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return {
      ok: false,
      message:
        "You don't have permission to manage paperwork. Ask the festival chair for organiser access.",
    };
  }
  return null;
}

type PermissionRow = {
  id: string;
  event_id: string;
  authority: string;
  status: string;
  letter_body: string | null;
  notes: string | null;
};

// ── Ensure rows exist ────────────────────────────────────────────────────────
/**
 * Insert the missing (event × authority) rows with status 'needed'.
 * Idempotent (upsert, duplicates ignored). Called server-side when the
 * event's permissions page loads, so it deliberately does NOT call
 * revalidatePath (that is unsupported during render — the page reads the
 * fresh rows in the same request anyway).
 */
export async function ensurePermissionRows(
  eventId: string
): Promise<ManagePermissionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test(eventId)) {
    return { ok: false, message: "Something went wrong — missing event." };
  }

  const sb = createAdminSupabaseClient();

  // Only festival-edition events carry paperwork.
  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, festival_edition_id")
    .eq("id", eventId)
    .maybeSingle();
  const event = eventRaw as { festival_edition_id: string | null } | null;
  if (!event || !event.festival_edition_id) {
    return {
      ok: false,
      message: "This event isn't part of the festival edition.",
    };
  }

  const { error } = await sb
    .schema("yi_connect")
    .from("varnam_permissions")
    .upsert(
      AUTHORITIES.map((a) => ({
        event_id: eventId,
        authority: a.key,
        status: "needed",
      })),
      { onConflict: "event_id,authority", ignoreDuplicates: true }
    );
  if (error) {
    return {
      ok: false,
      message: "Couldn't prepare the permission checklist — please try again.",
    };
  }

  return { ok: true, message: "" };
}

// ── Draft letter ─────────────────────────────────────────────────────────────
/**
 * Generate the formal letter for a permission row and move it
 * 'needed' → 'drafted'. Only forward from 'needed' — an existing draft is
 * never silently overwritten (use the status select to reset first).
 */
export async function draftLetter(
  permissionId: string
): Promise<ManagePermissionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test(permissionId)) {
    return { ok: false, message: "Something went wrong — missing request." };
  }

  const sb = createAdminSupabaseClient();

  const { data: permRaw } = await sb
    .schema("yi_connect")
    .from("varnam_permissions")
    .select("id, event_id, authority, status")
    .eq("id", permissionId)
    .maybeSingle();
  const perm = permRaw as PermissionRow | null;
  if (!perm) {
    return { ok: false, message: "That permission request no longer exists." };
  }
  if (perm.status !== "needed") {
    return {
      ok: false,
      message:
        "A letter can only be drafted while the request is at 'Needed'. Set the status back to Needed to re-draft.",
    };
  }
  const authorityKey = AUTHORITIES.find((a) => a.key === perm.authority)?.key;
  if (!authorityKey) {
    return { ok: false, message: "Unknown authority on this request." };
  }

  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select(
      "id, title, start_date, end_date, venue_address, max_capacity, category, festival_edition_id"
    )
    .eq("id", perm.event_id)
    .maybeSingle();
  const event = eventRaw as {
    title: string;
    start_date: string | null;
    end_date: string | null;
    venue_address: string | null;
    max_capacity: number | null;
    category: string | null;
    festival_edition_id: string | null;
  } | null;
  if (!event || !event.festival_edition_id) {
    return {
      ok: false,
      message: "This event isn't part of the festival edition.",
    };
  }

  const { data: editionRaw } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("name, year")
    .eq("id", event.festival_edition_id)
    .maybeSingle();
  const edition = editionRaw as { name: string; year: number } | null;
  if (!edition) {
    return { ok: false, message: "Couldn't load the festival edition." };
  }

  const letter = generateLetter(
    authorityKey as VarnamAuthorityKey,
    {
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      venue_address: event.venue_address,
      max_capacity: event.max_capacity,
      category: event.category,
    },
    { name: edition.name, year: edition.year }
  );

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("varnam_permissions")
    .update({
      // The generated body already carries the Subject line inside the
      // formal letter layout — store it as-is (plain text, printable).
      letter_body: letter.body,
      status: "drafted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", permissionId)
    .eq("status", "needed") // guard against a concurrent draft
    .select("id, status")
    .maybeSingle();
  if (error || !updated) {
    return {
      ok: false,
      message: "Couldn't save the drafted letter — please try again.",
    };
  }

  revalidatePermissionPaths(perm.event_id);
  return { ok: true, message: "Letter drafted — review, print and sign it." };
}

// ── Status ───────────────────────────────────────────────────────────────────
/** Set a permission request to any status in the pipeline. */
export async function setPermissionStatus(
  permissionId: string,
  status: string
): Promise<ManagePermissionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test(permissionId)) {
    return { ok: false, message: "Something went wrong — missing request." };
  }
  if (!(PERMISSION_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Please pick a valid status." };
  }

  const sb = createAdminSupabaseClient();
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("varnam_permissions")
    .update({
      status: status as PermissionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", permissionId)
    .select("id, event_id, status")
    .maybeSingle();
  if (error || !updated) {
    return {
      ok: false,
      message: "Couldn't update the status — please try again.",
    };
  }

  revalidatePermissionPaths((updated as { event_id: string }).event_id);
  return { ok: true, message: "Status updated." };
}

// ── Notes ────────────────────────────────────────────────────────────────────
/** Save the free-text notes on a permission request (max 2,000 characters). */
export async function saveNotes(
  permissionId: string,
  notes: string
): Promise<ManagePermissionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test(permissionId)) {
    return { ok: false, message: "Something went wrong — missing request." };
  }
  const trimmed = String(notes ?? "").trim();
  if (trimmed.length > 2000) {
    return {
      ok: false,
      message: "Notes are too long — keep them under 2,000 characters.",
    };
  }

  const sb = createAdminSupabaseClient();
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("varnam_permissions")
    .update({
      notes: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", permissionId)
    .select("id, event_id")
    .maybeSingle();
  if (error || !updated) {
    return {
      ok: false,
      message: "Couldn't save the notes — please try again.",
    };
  }

  revalidatePermissionPaths((updated as { event_id: string }).event_id);
  return { ok: true, message: "Notes saved." };
}
