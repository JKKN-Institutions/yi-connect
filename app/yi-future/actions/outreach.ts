"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";

/**
 * Chapter-scoped gate for an existing outreach entry — a chair of chapter A
 * must not delete chapter B's log. Fails closed: an entry with no chapter
 * resolves to null → deny.
 */
async function requireOutreachChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("outreach_log")
    .select("chapter_id")
    .eq("id", id)
    .maybeSingle();
  await requireChapterAdmin(
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
}

// ─── LOG ACTIVITY ───────────────────────────────────────────────────
export async function logOutreachActivity(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  // Validate the caller-supplied chapter — this value is written straight to
  // chapter_id, so an unchecked id lets a chair log against any chapter.
  const { userId } = await requireChapterAdmin(input.chapterId);
  const activity_type = String(formData.get("activity_type") ?? "").trim();
  const activity_date =
    String(formData.get("activity_date") ?? "").trim() || null;
  const college_id = String(formData.get("college_id") ?? "").trim() || null;
  const attendees_raw = String(formData.get("attendees_count") ?? "").trim();
  const attendees_count = attendees_raw ? Number(attendees_raw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!activity_type) {
    return { ok: false, error: "Activity type is required." };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("outreach_log")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      activity_type,
      activity_date,
      college_id,
      attendees_count,
      notes,
      logged_by: userId,
    });
  if (error) return { ok: false, error: safeError(error.message, "outreach.logOutreachActivity") };

  revalidatePath("/yi-future/chapter/outreach");
  redirect("/yi-future/chapter/outreach");
}

// ─── DELETE LOG ENTRY ───────────────────────────────────────────────
export async function deleteOutreachEntry(id: string): Promise<ActionResult> {
  await requireOutreachChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("outreach_log")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "outreach.deleteOutreachEntry") };
  revalidatePath("/yi-future/chapter/outreach");
  return { ok: true, message: "Entry removed." };
}
