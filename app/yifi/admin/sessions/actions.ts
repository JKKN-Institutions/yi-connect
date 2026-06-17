"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { getAdminContext, hasPermission } from "../_guard";

type ActionResult = { success: true; id?: string } | { error: string };

const VALID_SESSION_TYPES = [
  "keynote",
  "panel",
  "fireside",
  "workshop",
  "tour",
  "peer",
];

/** "" / whitespace-only → null. Prevents the known empty-string-saved-as-null
 *  silent-failure bug (e.g. a "" datetime persisted as an invalid value). */
function nz(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Parse a CSV / newline-separated themes string into a clean string[] (or null). */
function parseThemes(value: FormDataEntryValue | null): string[] | null {
  if (typeof value !== "string") return null;
  const parts = value
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return parts.length > 0 ? parts : null;
}

/**
 * Insert (no id) or update (id present) a single session.
 * Authorisation: requires the "sessions" permission (super-admins with "*" pass).
 */
export async function upsertSession(formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "sessions")) {
    return { error: "You don't have the 'sessions' permission." };
  }

  const title = nz(formData.get("title"));
  if (!title) {
    return { error: "Title is required." };
  }

  const sessionType = nz(formData.get("session_type"));
  if (sessionType !== null && !VALID_SESSION_TYPES.includes(sessionType)) {
    return { error: "Invalid session type." };
  }

  const id = nz(formData.get("id"));

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc("yifi_admin_upsert_session", {
    p_id: id,
    p_edition_id: ctx.editionId,
    p_title: title,
    p_speaker_name: nz(formData.get("speaker_name")),
    p_speaker_bio: nz(formData.get("speaker_bio")),
    p_session_type: sessionType,
    p_start_time: nz(formData.get("start_time")),
    p_end_time: nz(formData.get("end_time")),
    p_consent_archiving: formData.get("consent_archiving") === "on",
    p_transcript_url: nz(formData.get("transcript_url")),
    p_transcript_text: nz(formData.get("transcript_text")),
    p_themes: parseThemes(formData.get("themes")),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/yifi/admin/sessions");
  return { success: true, id: typeof data === "string" ? data : undefined };
}

/**
 * Delete a single session by id.
 * Authorisation: requires the "sessions" permission (super-admins with "*" pass).
 */
export async function deleteSession(formData: FormData): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "sessions")) {
    return { error: "You don't have the 'sessions' permission." };
  }

  const id = nz(formData.get("id"));
  if (!id) {
    return { error: "Session id is required." };
  }

  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_admin_delete_session", { p_id: id });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/yifi/admin/sessions");
  return { success: true };
}
