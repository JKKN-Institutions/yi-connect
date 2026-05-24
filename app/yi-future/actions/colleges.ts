"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

// ─── CREATE ─────────────────────────────────────────────────────────
export async function createCollege(
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const website_url = String(formData.get("website_url") ?? "").trim() || null;
  const primary_contact_name =
    String(formData.get("primary_contact_name") ?? "").trim() || null;
  const primary_contact_email =
    String(formData.get("primary_contact_email") ?? "").trim() || null;
  const primary_contact_phone =
    String(formData.get("primary_contact_phone") ?? "").trim() || null;
  const is_yuva = formData.get("is_yuva") === "on";

  if (!name) return { ok: false, error: "College name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("colleges")
    .insert({
      chapter_id: chapterId,
      name,
      city,
      state,
      website_url,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      is_yuva,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/colleges");
  redirect("/yi-future/chapter/colleges");
}

// ─── UPDATE ─────────────────────────────────────────────────────────
export async function updateCollege(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const website_url = String(formData.get("website_url") ?? "").trim() || null;
  const primary_contact_name =
    String(formData.get("primary_contact_name") ?? "").trim() || null;
  const primary_contact_email =
    String(formData.get("primary_contact_email") ?? "").trim() || null;
  const primary_contact_phone =
    String(formData.get("primary_contact_phone") ?? "").trim() || null;
  const is_yuva = formData.get("is_yuva") === "on";

  if (!name) return { ok: false, error: "College name is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("colleges")
    .update({
      name,
      city,
      state,
      website_url,
      primary_contact_name,
      primary_contact_email,
      primary_contact_phone,
      is_yuva,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/colleges");
  redirect("/yi-future/chapter/colleges");
}

// ─── DELETE ─────────────────────────────────────────────────────────
export async function deleteCollege(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  // Guard: if any delegates are linked, block
  const { count } = await svc
    .schema("future")
    .from("delegates")
    .select("id", { count: "exact", head: true })
    .eq("college_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Cannot delete — ${count} delegate(s) are linked to this college.`,
    };
  }

  const { error } = await svc
    .schema("future")
    .from("colleges")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/colleges");
  return { ok: true, message: "College deleted." };
}

// ─── APPROVE PENDING (from registration) ────────────────────────────
export async function approvePendingCollege(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("colleges")
    .update({ is_approved: true } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/colleges");
  return { ok: true, message: "College approved." };
}

// ─── MERGE PENDING into APPROVED ────────────────────────────────────
// Re-links every delegate currently on `sourceId` to `targetId`, then
// soft-deletes the source by setting merged_into. Source row is kept
// for audit (per spec — soft merge, not hard delete).
export async function mergePendingCollege(
  sourceId: string,
  targetId: string
): Promise<ActionResult> {
  await requireAuth();
  if (sourceId === targetId) {
    return { ok: false, error: "Source and target must differ." };
  }

  const svc = await createServiceClient();

  // Verify both belong to the same chapter (per-chapter list rule)
  const { data: rows } = await svc
    .schema("future")
    .from("colleges")
    .select("id, chapter_id, is_approved")
    .in("id", [sourceId, targetId]);
  const cols = (rows as { id: string; chapter_id: string; is_approved: boolean }[] | null) ?? [];
  const source = cols.find((c) => c.id === sourceId);
  const target = cols.find((c) => c.id === targetId);
  if (!source || !target) return { ok: false, error: "College not found." };
  if (source.chapter_id !== target.chapter_id) {
    return { ok: false, error: "Cross-chapter merges not allowed." };
  }
  if (target.is_approved !== true) {
    return { ok: false, error: "Target college must be approved first." };
  }

  // Re-link delegates
  const { error: relinkErr } = await svc
    .schema("future")
    .from("delegates")
    .update({ college_id: targetId } as never)
    .eq("college_id", sourceId);
  if (relinkErr) return { ok: false, error: relinkErr.message };

  // Soft-delete source
  const { error: mergeErr } = await svc
    .schema("future")
    .from("colleges")
    .update({ merged_into: targetId, is_approved: false } as never)
    .eq("id", sourceId);
  if (mergeErr) return { ok: false, error: mergeErr.message };

  revalidatePath("/yi-future/chapter/colleges");
  return { ok: true, message: "Merged successfully." };
}

// ─── EDIT and APPROVE (rename + approve in one step) ────────────────
export async function editAndApprovePendingCollege(
  id: string,
  newName: string,
  newCity: string | null
): Promise<ActionResult> {
  await requireAuth();
  const cleanName = newName.trim();
  if (!cleanName) return { ok: false, error: "Name is required." };
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("colleges")
    .update({
      name: cleanName,
      city: newCity?.trim() || null,
      is_approved: true,
    } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/colleges");
  return { ok: true, message: "Approved." };
}
