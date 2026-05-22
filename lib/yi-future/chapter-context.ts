import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

export type ChapterContext = {
  userId: string;
  userEmail: string | null;
  chapterId: string;
  chapterName: string;
  chapterCity: string;
  editionId: string;
  editionSlug: string;
  editionName: string;
  editionStage: Database["future"]["Enums"]["edition_stage"] | null;
  role: CoreTeamRole;
  trackId: string | null;
  trackName: string | null;
  trackIcon: string | null;
  trackHostRole: Database["future"]["Enums"]["track_host_role"] | null;
};

/**
 * Returns the signed-in user's chapter context if they are on an active
 * `chapter_core_team` row for an active edition. Returns null otherwise —
 * page code should handle that case (most commonly with a "no chapter
 * assigned" screen).
 */
export async function getChapterContext(): Promise<ChapterContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = await createServiceClient();

  // Find core-team membership on the active edition
  const { data: membership } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select(
      "chapter_id, edition_id, role, is_active, chapters(name, city), editions!inner(slug, name, current_stage, is_active)"
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("editions.is_active", true)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  type Row = {
    chapter_id: string;
    edition_id: string;
    role: CoreTeamRole;
    chapters: { name: string; city: string } | null;
    editions: {
      slug: string;
      name: string;
      current_stage: Database["future"]["Enums"]["edition_stage"] | null;
    };
  };
  const m = membership as unknown as Row;

  // Fetch this chapter's track assignment for the active edition
  const { data: assignment } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .select("role, tracks(id, name, icon)")
    .eq("chapter_id", m.chapter_id)
    .eq("edition_id", m.edition_id)
    .maybeSingle();

  const a = assignment as unknown as {
    role: Database["future"]["Enums"]["track_host_role"];
    tracks: { id: string; name: string; icon: string | null } | null;
  } | null;

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    chapterId: m.chapter_id,
    chapterName: m.chapters?.name ?? "Unknown chapter",
    chapterCity: m.chapters?.city ?? "",
    editionId: m.edition_id,
    editionSlug: m.editions.slug,
    editionName: m.editions.name,
    editionStage: m.editions.current_stage,
    role: m.role,
    trackId: a?.tracks?.id ?? null,
    trackName: a?.tracks?.name ?? null,
    trackIcon: a?.tracks?.icon ?? null,
    trackHostRole: a?.role ?? null,
  };
}
