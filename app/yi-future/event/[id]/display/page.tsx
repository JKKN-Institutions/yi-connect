import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  CHAPTER_FINAL_SECTION_LABELS,
  NATIONAL_DAY1_SECTIONS,
  NATIONAL_DAY1_SECTION_LABELS,
  NATIONAL_DAY2_SECTIONS,
  NATIONAL_DAY2_SECTION_LABELS,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";

type CFSection = Database["future"]["Enums"]["chapter_final_section"];

type Event = {
  id: string;
  name: string;
  tagline: string | null;
  venue: string | null;
  is_published: boolean | null;
  type: string | null;
};

type ChapterSection = {
  section: CFSection;
  title: string | null;
  notes: string | null;
  starts_at: string | null;
  is_active: boolean | null;
};

type NationalSection = {
  day: number;
  section_key: string;
  title: string | null;
  notes: string | null;
  starts_at: string | null;
  is_active: boolean | null;
};

type ActiveDisplay = {
  label: string;
  subtitle: string | null;
  notes: string | null;
  starts_at: string | null;
  kicker: string;
};

async function getEvent(id: string): Promise<Event | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, name, tagline, venue, is_published, type")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Event) ?? null;
}

async function getActiveChapterSection(
  eventId: string
): Promise<ChapterSection | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_final_sections")
    .select("section, title, notes, starts_at, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as ChapterSection) ?? null;
}

async function getActiveNationalSection(
  eventId: string
): Promise<NationalSection | null> {
  const svc = await createServiceClient();
  // national_event_sections (migration 116) isn't in generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (svc as any).schema("future").from("national_event_sections");
  const { data } = await tbl
    .select("day, section_key, title, notes, starts_at, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as NationalSection) ?? null;
}

// Refresh every 10 seconds to sync with control panel
export const revalidate = 10;

export default async function EventDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [activeChapter, activeNational] = await Promise.all([
    getActiveChapterSection(id),
    getActiveNationalSection(id),
  ]);

  // Only one should be active in practice; national wins if both are set.
  let active: ActiveDisplay | null = null;
  let eventKicker = "Future 6.0";

  if (activeNational) {
    const label =
      activeNational.day === 1
        ? NATIONAL_DAY1_SECTION_LABELS[
            activeNational.section_key as (typeof NATIONAL_DAY1_SECTIONS)[number]
          ] ?? activeNational.section_key
        : NATIONAL_DAY2_SECTION_LABELS[
            activeNational.section_key as (typeof NATIONAL_DAY2_SECTIONS)[number]
          ] ?? activeNational.section_key;

    active = {
      label,
      subtitle:
        activeNational.title && activeNational.title !== label
          ? activeNational.title
          : null,
      notes: activeNational.notes,
      starts_at: activeNational.starts_at,
      kicker: `National Track Final · Day ${activeNational.day}`,
    };
    eventKicker = "Future 6.0 · National Track Final";
  } else if (activeChapter) {
    const label = CHAPTER_FINAL_SECTION_LABELS[activeChapter.section];
    active = {
      label,
      subtitle:
        activeChapter.title && activeChapter.title !== label
          ? activeChapter.title
          : null,
      notes: activeChapter.notes,
      starts_at: activeChapter.starts_at,
      kicker: "Chapter Final",
    };
    eventKicker = "Future 6.0 · Chapter Final";
  } else if (event.type === "national_track_final") {
    eventKicker = "Future 6.0 · National Track Final";
  } else if (event.type === "chapter_final") {
    eventKicker = "Future 6.0 · Chapter Final";
  }

  return (
    <div className="fixed inset-0 bg-navy text-ivory flex flex-col overflow-hidden">
      {/* Header strip */}
      <header className="px-8 py-5 border-b border-ivory/10 flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-[0.25em] uppercase text-yi-gold">
          Yi · Yi YUVA · CII
        </div>
        <div className="text-[10px] font-semibold tracking-[0.25em] uppercase text-ivory/60">
          {eventKicker}
        </div>
      </header>

      {/* Main display */}
      <main className="flex-1 flex flex-col items-center justify-center px-12 text-center">
        {active ? (
          <>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-yi-gold mb-6">
              Now on stage · {active.kicker}
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-ivory leading-tight">
              {active.label}
            </h1>
            {active.subtitle && (
              <p className="mt-6 text-2xl text-ivory/70">{active.subtitle}</p>
            )}
            {active.notes && (
              <p className="mt-8 text-lg text-ivory/60 max-w-3xl">
                {active.notes}
              </p>
            )}
            <div className="mt-12 h-1 w-40 rounded-full bg-gradient-to-r from-yi-gold to-yi-saffron animate-pulse" />
          </>
        ) : (
          <>
            <h1 className="text-7xl md:text-8xl font-black text-ivory leading-tight">
              {event.name}
            </h1>
            {event.tagline && (
              <p className="mt-6 text-3xl text-yi-gold font-semibold">
                {event.tagline}
              </p>
            )}
            {event.venue && (
              <p className="mt-8 text-xl text-ivory/50">{event.venue}</p>
            )}
            <div className="mt-16 text-sm font-semibold tracking-[0.3em] uppercase text-ivory/40">
              Event starts shortly
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-ivory/10 flex items-center justify-between text-[10px] font-semibold tracking-[0.25em] uppercase text-ivory/40">
        <span>A Yi YUVA flagship program</span>
        <span className="font-mono">Auto-refresh · 10s</span>
      </footer>
    </div>
  );
}
