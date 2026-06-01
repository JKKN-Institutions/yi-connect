import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
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
  nationalEvents: HostEvent[];
  selectedEvent: HostEvent | null;
  /** @deprecated Use selectedEvent — kept for backward compatibility */
  nationalEvent: HostEvent | null;
  trackId: string | null;
  trackName: string | null;
  trackIcon: string | null;
};

export async function getHostContext(
  selectedTrackId?: string
): Promise<HostContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = await createServiceClient();

  const { data: membership } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select(
      "chapter_id, edition_id, chapters(name, is_finale_host), editions!inner(name, is_active)"
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
    chapters: { name: string; is_finale_host: boolean | null } | null;
    editions: { name: string };
  };
  const m = membership as unknown as Row;
  const isHost = m.chapters?.is_finale_host === true;

  // The regional model: one all-4-tracks "regional_finale" event per host
  // chapter. Prefer those. Fall back to the legacy per-track
  // "national_track_final" events so pre-existing data still renders.
  //
  // NOTE: the generated database.ts enum is stale (only lists
  // chapter_final | national_track_final), but the live future.event_type
  // enum DOES include "regional_finale" (verified against the DB on
  // 2026-05-31 — a control probe with a bogus value returns 22P02 while
  // "regional_finale" returns HTTP 200). Hence the `as never` cast on the
  // type filter, matching the existing pattern in actions/events.ts and
  // actions/shortlist.ts.
  const selectCols =
    "id, name, start_date, end_date, venue, is_published, track_id, tagline";

  const { data: regionalEvents } = await svc
    .schema("future")
    .from("events")
    .select(selectCols)
    .eq("chapter_id", m.chapter_id)
    .eq("edition_id", m.edition_id)
    .eq("type", "regional_finale" as never)
    .order("created_at", { ascending: false });

  let events = regionalEvents;
  if (!events || events.length === 0) {
    const { data: legacyEvents } = await svc
      .schema("future")
      .from("events")
      .select(selectCols)
      .eq("chapter_id", m.chapter_id)
      .eq("edition_id", m.edition_id)
      .eq("type", "national_track_final")
      .order("created_at", { ascending: false });
    events = legacyEvents;
  }

  const nationalEvents = (events as unknown as HostEvent[]) ?? [];

  const selected = selectedTrackId
    ? nationalEvents.find((e) => e.track_id === selectedTrackId) ?? nationalEvents[0] ?? null
    : nationalEvents[0] ?? null;

  let trackName: string | null = null;
  let trackIcon: string | null = null;
  if (selected?.track_id) {
    const { data: track } = await svc
      .schema("future")
      .from("tracks")
      .select("name, icon")
      .eq("id", selected.track_id)
      .maybeSingle();
    const t = track as { name: string; icon: string | null } | null;
    trackName = t?.name ?? null;
    trackIcon = t?.icon ?? null;
  }

  return {
    chapterId: m.chapter_id,
    editionId: m.edition_id,
    chapterName: m.chapters?.name ?? "Unknown",
    editionName: m.editions.name,
    isHost,
    nationalEvents,
    selectedEvent: selected,
    nationalEvent: selected,
    trackId: selected?.track_id ?? null,
    trackName,
    trackIcon,
  };
}

export type { Database };
