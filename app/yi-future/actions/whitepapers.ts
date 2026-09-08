"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";

/**
 * Chapter-scoped gate. `whitepapers.host_chapter_id` is the owning host chapter
 * — a chair of chapter A must not edit, publish or delete chapter B's
 * whitepaper. Looks up the target row's host chapter, then requires admin of
 * THAT chapter (or national). Fails closed: a whitepaper with no host chapter
 * (a national one) resolves to null → only national admins pass.
 */
async function requireWhitepaperChapterAdmin(id: string): Promise<void> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("whitepapers")
    .select("host_chapter_id")
    .eq("id", id)
    .maybeSingle();
  await requireChapterAdmin(
    (data as { host_chapter_id: string | null } | null)?.host_chapter_id ?? null
  );
}

type Section = {
  heading: string;
  body: string;
};

function parseSections(raw: string): Section[] {
  // Sections separated by blank lines; first line is heading, rest is body
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((b) => {
    const lines = b.split("\n");
    const heading = lines.shift()?.trim() ?? "";
    const body = lines.join("\n").trim();
    return { heading, body };
  });
}

// ─── CREATE WHITEPAPER ─────────────────────────────────────────────
export async function createWhitepaper(
  input: { editionId: string; trackId: string; hostChapterId: string | null },
  formData: FormData
): Promise<ActionResult> {
  // Validate the caller-supplied host chapter — this value is written straight
  // to host_chapter_id, so an unchecked id lets a chair file under any chapter.
  await requireChapterAdmin(input.hostChapterId);
  const title = String(formData.get("title") ?? "").trim();
  const executive_summary =
    String(formData.get("executive_summary") ?? "").trim() || null;
  const sections = parseSections(String(formData.get("sections") ?? ""));
  const cover_image_url =
    String(formData.get("cover_image_url") ?? "").trim() || null;
  const pdf_url = String(formData.get("pdf_url") ?? "").trim() || null;

  if (!title) return { ok: false, error: "Title is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("whitepapers")
    .insert({
      edition_id: input.editionId,
      track_id: input.trackId,
      host_chapter_id: input.hostChapterId,
      title,
      executive_summary,
      sections,
      cover_image_url,
      pdf_url,
      status: "draft",
    });
  if (error) return { ok: false, error: safeError(error.message, "whitepapers.createWhitepaper") };

  revalidatePath("/yi-future/host/whitepaper");
  revalidatePath("/national/admin/whitepapers");
  redirect("/yi-future/host/whitepaper");
}

// ─── UPDATE ────────────────────────────────────────────────────────
export async function updateWhitepaper(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireWhitepaperChapterAdmin(id);
  const title = String(formData.get("title") ?? "").trim();
  const executive_summary =
    String(formData.get("executive_summary") ?? "").trim() || null;
  const sections = parseSections(String(formData.get("sections") ?? ""));
  const cover_image_url =
    String(formData.get("cover_image_url") ?? "").trim() || null;
  const pdf_url = String(formData.get("pdf_url") ?? "").trim() || null;

  if (!title) return { ok: false, error: "Title is required." };

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("whitepapers")
    .update({
      title,
      executive_summary,
      sections,
      cover_image_url,
      pdf_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "whitepapers.updateWhitepaper") };

  revalidatePath("/yi-future/host/whitepaper");
  revalidatePath("/national/admin/whitepapers");
  return { ok: true, message: "Whitepaper updated." };
}

// ─── PUBLISH ───────────────────────────────────────────────────────
export async function publishWhitepaper(id: string): Promise<ActionResult> {
  await requireWhitepaperChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("whitepapers")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "whitepapers.publishWhitepaper") };
  revalidatePath("/yi-future/host/whitepaper");
  revalidatePath("/national/admin/whitepapers");
  return { ok: true, message: "Published." };
}

export async function unpublishWhitepaper(id: string): Promise<ActionResult> {
  await requireWhitepaperChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("whitepapers")
    .update({ status: "draft", published_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "whitepapers.unpublishWhitepaper") };
  revalidatePath("/yi-future/host/whitepaper");
  revalidatePath("/national/admin/whitepapers");
  return { ok: true };
}

export async function deleteWhitepaper(id: string): Promise<ActionResult> {
  await requireWhitepaperChapterAdmin(id);
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("whitepapers")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: safeError(error.message, "whitepapers.deleteWhitepaper") };
  revalidatePath("/yi-future/host/whitepaper");
  revalidatePath("/national/admin/whitepapers");
  return { ok: true, message: "Deleted." };
}
