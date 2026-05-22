import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import type { Database } from "@/types/yi-future/database";

type HostEvent = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  is_published: boolean | null;
  track_id: string | null;
  tagline: string | null;
};

export type HostContext = {
  chapterId: string;
  editionId: string;
  chapterName: string;
  editionName: string;
  isHost: boolean;
  nationalEvent: HostEvent | null;
  trackId: string | null;
  trackName: string | null;
  trackIcon: string | null;
};

/**
 * Resolve the Yi chapter that the signed-in admin represents AND check if
 * this chapter is a HOST chapter for the current edition.
 * Returns the chapter's national_track_final event (if any).
 */
export async function getHostContext(): Promise<HostContext | null> {
  const ctx = await getChapterContext();
  if (!ctx) return null;

  const isHost = ctx.trackHostRole === "host";

  const svc = await createServiceClient();
  const { data: ev } = await svc
    .schema("future")
    .from("events")
    .select(
      "id, name, start_date, end_date, venue, is_published, track_id, tagline"
    )
    .eq("chapter_id", ctx.chapterId)
    .eq("edition_id", ctx.editionId)
    .eq("type", "national_track_final")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nationalEvent = (ev as unknown as HostEvent) ?? null;

  return {
    chapterId: ctx.chapterId,
    editionId: ctx.editionId,
    chapterName: ctx.chapterName,
    editionName: ctx.editionName,
    isHost,
    nationalEvent,
    trackId: ctx.trackId,
    trackName: ctx.trackName,
    trackIcon: ctx.trackIcon,
  };
}

export type { Database };
