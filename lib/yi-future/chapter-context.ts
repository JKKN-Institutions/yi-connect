import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { isPlatformAdminEmail } from "@/lib/yi-future/auth/platform-admin";
import type { Database } from "@/types/yi-future/database";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

/** Chapter a national admin has switched into. A hint only — see the
 *  fail-closed note in getChapterContext. */
export const ADMIN_CHAPTER_COOKIE = "yf_admin_chapter";

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
  /** True when a national admin has switched into a chapter they are not a
   *  core-team member of. The shell shows a banner so it is never ambiguous
   *  whose chapter is on screen. */
  viewingAsNational: boolean;
};

/** Build a chapter context for a national admin who has switched into a
 *  chapter. Callers MUST have confirmed the platform tier first. */
async function buildNationalContext(
  user: { id: string; email?: string | null },
  chapterId: string
): Promise<ChapterContext | null> {
  const svc = await createServiceClient();

  const { data: chapter } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chapter) return null;

  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id, slug, name, current_stage")
    .eq("is_active", true)
    .maybeSingle();
  if (!edition) return null;

  const c = chapter as { id: string; name: string; city: string | null };
  const e = edition as {
    id: string;
    slug: string;
    name: string;
    current_stage: Database["future"]["Enums"]["edition_stage"] | null;
  };

  const { data: assignment } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .select("role, tracks(id, name, icon)")
    .eq("chapter_id", c.id)
    .eq("edition_id", e.id)
    .limit(1)
    .maybeSingle();
  const a = assignment as unknown as {
    role: Database["future"]["Enums"]["track_host_role"];
    tracks: { id: string; name: string; icon: string | null } | null;
  } | null;

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    chapterId: c.id,
    chapterName: c.name,
    chapterCity: c.city ?? "",
    editionId: e.id,
    editionSlug: e.slug,
    editionName: e.name,
    editionStage: e.current_stage,
    // Full oversight, matching what requireChapterAdmin already grants a
    // national admin. The banner makes clear this is a stand-in, not a real
    // core-team seat.
    role: "chapter_chair" as CoreTeamRole,
    trackId: a?.tracks?.id ?? null,
    trackName: a?.tracks?.name ?? null,
    trackIcon: a?.tracks?.icon ?? null,
    trackHostRole: a?.role ?? null,
    viewingAsNational: true,
  };
}

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

  // ─── National admin viewing a chapter ─────────────────────────────
  // Chapter pages resolve "which chapter am I in?" purely from core-team
  // membership, and national status has never counted here. So a national
  // admin who is not on a chapter's core team could act on that chapter
  // (requireChapterAdmin lets national through) but could not OPEN it — the
  // page had no chapter to render. This is the switch that closes that gap.
  //
  // Gated on the PLATFORM tier (3 accounts), not on isNational (13). Standing
  // inside another chapter as its admin is a platform-operator capability, not
  // something the whole Yi national team needs.
  //
  // FAIL CLOSED: the cookie is only a hint. The platform tier is re-checked on
  // EVERY read, so setting the cookie by hand grants nothing — anyone else
  // simply falls through to their own membership below.
  const picked = (await cookies()).get(ADMIN_CHAPTER_COOKIE)?.value;
  if (picked) {
    if (await isPlatformAdminEmail(user.email)) {
      const asChapter = await buildNationalContext(user, picked);
      if (asChapter) return asChapter;
      // Chapter or active edition has gone away — fall through rather than
      // stranding the admin on a blank screen.
    }
  }

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

  // Fetch this chapter's track assignment for the active edition.
  // Future 6.0: chapters run all 4 tracks; this returns one primary assignment
  // only — do NOT use trackId to filter problem lists.
  const { data: assignment } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .select("role, tracks(id, name, icon)")
    .eq("chapter_id", m.chapter_id)
    .eq("edition_id", m.edition_id)
    .limit(1)
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
    viewingAsNational: false,
  };
}
