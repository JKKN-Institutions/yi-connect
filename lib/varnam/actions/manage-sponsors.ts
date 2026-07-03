"use server";

/**
 * Sponsor board actions — add / edit / soft-remove sponsors from the committee
 * dashboard. Every action RE-CHECKS authorization server-side (never trust
 * hidden buttons); writes go through the admin client (RLS bypass), so the
 * access check here IS the permission layer.
 *
 * Live-DB note: the sponsors phone column is `contact_phone` (verified against
 * production — `contact_person_phone` does not exist on yi_connect.sponsors).
 */
import { revalidatePath } from "next/cache";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";

export type BoardActionState = { ok: boolean; message: string };

const ERODE_CHAPTER_ID = "fe71c429-2647-4262-b35b-e356c960903d";
const RELATIONSHIP_STATUSES = ["prospect", "contacted", "active"];
const PRIORITIES = ["high", "medium", "low"];

type ManagerCheck =
  | { allowed: true; userId: string }
  | { allowed: false; message: string };

/** Server-side gate: varnam canManage + a live auth session. */
async function requireManager(): Promise<ManagerCheck> {
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return {
      allowed: false,
      message: "You don't have permission to manage sponsors.",
    };
  }
  const sb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return {
      allowed: false,
      message: "Your session has expired — please sign in again.",
    };
  }
  return { allowed: true, userId: user.id };
}

/** "" → null; otherwise a finite number ≥ 0, else an error. */
function parseAmount(
  raw: FormDataEntryValue | null
): { value: number | null; error: string | null } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: null, error: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    return { value: null, error: "Amount must be a number of 0 or more." };
  }
  return { value: n, error: null };
}

function revalidateSponsorRoutes() {
  revalidatePath("/varnam-vizha/dashboard/sponsors");
  revalidatePath("/varnam-vizha/dashboard");
}

export async function addSponsor(
  _prev: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const gate = await requireManager();
  if (!gate.allowed) return { ok: false, message: gate.message };

  const organizationName = String(formData.get("organization_name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const relationshipStatus = String(
    formData.get("relationship_status") ?? "prospect"
  ).trim();
  const priority = String(formData.get("priority") ?? "medium").trim();
  const contactPersonName = String(
    formData.get("contact_person_name") ?? ""
  ).trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (organizationName.length < 2 || organizationName.length > 120) {
    return {
      ok: false,
      message: "Organisation name must be between 2 and 120 characters.",
    };
  }
  if (!RELATIONSHIP_STATUSES.includes(relationshipStatus)) {
    return { ok: false, message: "Please pick a valid relationship status." };
  }
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, message: "Please pick a valid priority." };
  }
  const amount = parseAmount(formData.get("current_year_amount"));
  if (amount.error) return { ok: false, message: amount.error };

  const sb = createAdminSupabaseClient();
  const { data: inserted, error } = await sb
    .schema("yi_connect")
    .from("sponsors")
    .insert({
      chapter_id: ERODE_CHAPTER_ID,
      organization_name: organizationName,
      industry: industry || null,
      relationship_status: relationshipStatus,
      current_year_amount: amount.value,
      priority,
      contact_person_name: contactPersonName || null,
      contact_phone: contactPhone || null,
      notes: notes || null,
      is_active: true,
      created_by: gate.userId,
    })
    .select("id");
  if (error || !inserted || inserted.length === 0) {
    return {
      ok: false,
      message: "Couldn't add the sponsor — please try again.",
    };
  }

  revalidateSponsorRoutes();
  return { ok: true, message: `${organizationName} added to the pipeline.` };
}

export async function updateSponsor(
  _prev: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const gate = await requireManager();
  if (!gate.allowed) return { ok: false, message: gate.message };

  const sponsorId = String(formData.get("sponsor_id") ?? "").trim();
  if (!sponsorId) {
    return { ok: false, message: "Something went wrong — missing sponsor." };
  }

  const relationshipStatus = String(
    formData.get("relationship_status") ?? ""
  ).trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const contactPersonName = String(
    formData.get("contact_person_name") ?? ""
  ).trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!RELATIONSHIP_STATUSES.includes(relationshipStatus)) {
    return { ok: false, message: "Please pick a valid relationship status." };
  }
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, message: "Please pick a valid priority." };
  }
  const amount = parseAmount(formData.get("current_year_amount"));
  if (amount.error) return { ok: false, message: amount.error };

  const sb = createAdminSupabaseClient();
  // .select() the row back so a silently-blocked write surfaces as a failure.
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("sponsors")
    .update({
      relationship_status: relationshipStatus,
      priority,
      current_year_amount: amount.value,
      contact_person_name: contactPersonName || null,
      contact_phone: contactPhone || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sponsorId)
    .eq("chapter_id", ERODE_CHAPTER_ID)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return {
      ok: false,
      message: "Couldn't save the changes — the sponsor may have been removed.",
    };
  }

  revalidateSponsorRoutes();
  return { ok: true, message: "Sponsor updated." };
}

/** Soft delete: is_active=false (row keeps its history + deals). */
export async function removeSponsor(
  sponsorId: string
): Promise<BoardActionState> {
  const gate = await requireManager();
  if (!gate.allowed) return { ok: false, message: gate.message };

  const id = String(sponsorId ?? "").trim();
  if (!id) {
    return { ok: false, message: "Something went wrong — missing sponsor." };
  }

  const sb = createAdminSupabaseClient();
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("sponsors")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("chapter_id", ERODE_CHAPTER_ID)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return {
      ok: false,
      message: "Couldn't remove the sponsor — please try again.",
    };
  }

  revalidateSponsorRoutes();
  return { ok: true, message: "Sponsor removed from the pipeline." };
}
