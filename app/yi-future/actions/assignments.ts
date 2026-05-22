"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";

type TrackHostRole = Database["future"]["Enums"]["track_host_role"];

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

// ─── ASSIGN CHAPTER TO TRACK ─────────────────────────────────────────
export async function assignChapterToTrack(
  input: {
    editionId: string;
    chapterId: string;
    trackId: string;
    role: TrackHostRole;
  }
): Promise<ActionResult> {
  await requireAdmin();
  const svc = await createServiceClient();

  // If host role: enforce one host per (track, edition)
  if (input.role === "host") {
    const { data: existing } = await svc
      .schema("future")
      .from("chapter_track_assignments")
      .select("chapter_id")
      .eq("edition_id", input.editionId)
      .eq("track_id", input.trackId)
      .eq("role", "host")
      .maybeSingle();
    const existingHost = existing as { chapter_id: string } | null;
    if (existingHost && existingHost.chapter_id !== input.chapterId) {
      return {
        ok: false,
        error:
          "Another chapter is already the host for this track. Remove that assignment first.",
      };
    }
  }

  // Upsert: allow switching roles without dup conflict
  const { error } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .upsert(
      {
        edition_id: input.editionId,
        chapter_id: input.chapterId,
        track_id: input.trackId,
        role: input.role,
      },
      { onConflict: "edition_id,chapter_id" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/host-assignments");
  revalidatePath("/national/admin/chapter-assignments");
  return { ok: true, message: "Assignment saved." };
}

// ─── REMOVE ASSIGNMENT ───────────────────────────────────────────────
export async function removeAssignment(input: {
  editionId: string;
  chapterId: string;
  trackId: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const svc = await createServiceClient();
  // PK is (edition_id, chapter_id), so track_id is implicitly uniquely determined
  const { error } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .delete()
    .eq("edition_id", input.editionId)
    .eq("chapter_id", input.chapterId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/host-assignments");
  revalidatePath("/national/admin/chapter-assignments");
  return { ok: true, message: "Assignment removed." };
}
