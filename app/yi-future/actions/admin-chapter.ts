"use server";

// National admin "open a chapter" switch (field request 2026-08-10).
//
// Chapter pages resolve which chapter you are in from core-team membership
// only. A national admin who is not on a chapter's core team could ACT on that
// chapter (requireChapterAdmin lets national through) but could not OPEN it.
// This stores the chapter they picked; getChapterContext honours it.
//
// Gated on isPlatform, NOT isNational: Yi-Future's national roles are held by
// 12 chapter-facing people, while standing in any chapter as its admin is a
// platform-operator capability. Only platform admins get the switch.
//
// The cookie is a hint, never a grant: getChapterContext re-checks isPlatform
// against yi_directory on every read, so a hand-set cookie gives nothing.
// Setting it here is gated as well, so the cookie is not even written for
// someone who could not use it.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { ADMIN_CHAPTER_COOKIE } from "@/lib/yi-future/chapter-context";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type SwitchableChapter = { id: string; name: string; city: string | null };

/** Active chapters a platform admin may switch into. Returns [] for everyone
 *  else, so the picker simply does not render for them. */
export async function listSwitchableChapters(): Promise<SwitchableChapter[]> {
  const access = await resolveFutureAccessOrNull();
  if (!access?.isPlatform) return [];

  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as unknown as SwitchableChapter[]) ?? [];
}

/** Switch into a chapter, or pass null to return to your own. */
export async function setAdminChapter(
  chapterId: string | null
): Promise<ActionResult> {
  const access = await resolveFutureAccessOrNull();
  if (!access?.isPlatform) {
    return { ok: false, error: "Only platform admins can switch chapters." };
  }

  const jar = await cookies();

  if (!chapterId) {
    jar.delete(ADMIN_CHAPTER_COOKIE);
    revalidatePath("/yi-future/chapter", "layout");
    return { ok: true, message: "Back to your own chapter." };
  }

  // Confirm the chapter exists and is active before storing it, so a bad id
  // cannot leave the admin stuck on a screen that renders nothing.
  const svc = await createServiceClient();
  const { data: chapter } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .eq("id", chapterId)
    .eq("is_active", true)
    .maybeSingle();
  if (!chapter) return { ok: false, error: "That chapter was not found." };

  jar.set(ADMIN_CHAPTER_COOKIE, chapterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Session-length: switching is a deliberate act, and a stale chapter
    // silently persisting across days is how an admin edits the wrong one.
  });

  revalidatePath("/yi-future/chapter", "layout");
  return {
    ok: true,
    message: `Now viewing ${(chapter as { name: string }).name}.`,
  };
}
