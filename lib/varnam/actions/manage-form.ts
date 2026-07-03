"use server";

/**
 * Organiser-side save of an event's extra registration questions. The builder
 * UI does NOT validate — this action is the single source of validation (gate
 * canManage, shape-check every field, cap at MAX_FORM_FIELDS) so hidden
 * buttons and crafted requests can never bypass the rules.
 */
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import {
  MAX_FORM_FIELDS,
  parseFormFields,
} from "@/lib/varnam/forms/types";

export type SaveFormState = { ok: boolean; message: string };

export async function saveRegistrationForm(
  eventId: string,
  rawFields: unknown
): Promise<SaveFormState> {
  // Re-check authorization server-side — never trust the client.
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return {
      ok: false,
      message:
        access.reason ||
        "Your role can view the dashboard but not edit registration forms.",
    };
  }

  if (typeof eventId !== "string" || eventId.trim() === "") {
    return { ok: false, message: "Something went wrong — missing event." };
  }
  if (!Array.isArray(rawFields)) {
    return { ok: false, message: "Invalid form data — please refresh and try again." };
  }
  if (rawFields.length > MAX_FORM_FIELDS) {
    return {
      ok: false,
      message: `A form can have at most ${MAX_FORM_FIELDS} extra questions.`,
    };
  }

  const fields = parseFormFields(rawFields);
  if (fields.length !== rawFields.length) {
    return { ok: false, message: "Invalid form data — please refresh and try again." };
  }
  const seenIds = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f.label) {
      return { ok: false, message: `Question ${i + 1} needs a label.` };
    }
    if (f.type === "select" && (!f.options || f.options.length === 0)) {
      return {
        ok: false,
        message: `"${f.label}" is a dropdown — add at least one option.`,
      };
    }
    if (seenIds.has(f.id)) {
      return { ok: false, message: "Invalid form data — duplicate question ids." };
    }
    seenIds.add(f.id);
  }

  const sb = createAdminSupabaseClient();

  // Only festival edition events have a public registration form.
  const { data: event } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, public_slug, festival_edition_id")
    .eq("id", eventId)
    .maybeSingle();
  const ev = event as {
    id: string;
    public_slug: string | null;
    festival_edition_id: string | null;
  } | null;
  if (!ev || !ev.festival_edition_id) {
    return { ok: false, message: "This event isn't part of the festival." };
  }

  // .select() the row back so a silently-blocked write surfaces as a failure.
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("events")
    .update({ registration_form_fields: fields })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, message: "Couldn't save the form — please try again." };
  }

  revalidatePath("/varnam-vizha/dashboard/events");
  if (ev.public_slug) {
    revalidatePath(`/varnam-vizha/events/${ev.public_slug}`);
  }

  return {
    ok: true,
    message: `Saved — ${fields.length} extra question${fields.length === 1 ? "" : "s"} on the form.`,
  };
}
