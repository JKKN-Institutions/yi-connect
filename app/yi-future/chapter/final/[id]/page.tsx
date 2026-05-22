import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  setEventPublished,
  activateSection,
  updateSectionNotes,
} from "@/app/yi-future/actions/events";
import { publishShortlist } from "@/app/yi-future/actions/shortlist";
import {
  CHAPTER_FINAL_SECTIONS,
  CHAPTER_FINAL_SECTION_LABELS,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";

type CFSection = Database["future"]["Enums"]["chapter_final_section"];

type Event = {
  id: string;
  chapter_id: string | null;
  edition_id: string;
  name: string;
  tagline: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  venue_address: string | null;
  is_published: boolean | null;
};

type Section = {
  event_id: string;
  section: CFSection;
  title: string | null;
  notes: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
};

async function getEvent(id: string): Promise<Event | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select(
      "id, chapter_id, edition_id, name, tagline, start_date, end_date, venue, venue_address, is_published"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Event) ?? null;
}

async function getSections(eventId: string): Promise<Section[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_final_sections")
    .select("event_id, section, title, notes, starts_at, ends_at, is_active")
    .eq("event_id", eventId);
  return (data as unknown as Section[]) ?? [];
}

export default async function ChapterFinalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  if (event.chapter_id && event.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/chapter/final");
  }

  const sections = await getSections(id);
  const secByKey = new Map<CFSection, Section>();
  for (const s of sections) secByKey.set(s.section, s);

  async function togglePublish() {
    "use server";
    await setEventPublished(id, !event!.is_published);
  }

  async function activate(formData: FormData) {
    "use server";
    const section = String(formData.get("section") ?? "") as CFSection;
    await activateSection(id, section);
  }

  async function saveNotes(formData: FormData) {
    "use server";
    const section = String(formData.get("section") ?? "") as CFSection;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    await updateSectionNotes(id, section, notes);
  }

  async function doShortlist(formData: FormData) {
    "use server";
    const thresholdRaw = String(formData.get("threshold") ?? "").trim();
    const maxRaw = String(formData.get("max") ?? "").trim();
    await publishShortlist({
      chapterFinalEventId: id,
      chapterId: ctx!.chapterId,
      editionId: ctx!.editionId,
      threshold: thresholdRaw ? Number(thresholdRaw) : null,
      maxAdvancements: maxRaw ? Number(maxRaw) : null,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/chapter/final"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Chapter final events
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-navy">{event.name}</h2>
            {event.tagline && (
              <p className="mt-1 text-sm text-navy/60">{event.tagline}</p>
            )}
            <p className="mt-1 text-xs text-navy/50">
              {event.start_date ?? "—"}
              {event.venue && <span> · {event.venue}</span>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <form action={togglePublish}>
              <button
                type="submit"
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  event.is_published
                    ? "bg-yi-green/10 text-yi-green hover:bg-yi-green/20"
                    : "bg-navy text-ivory hover:bg-navy-dark"
                }`}
              >
                {event.is_published ? "✓ Published — unpublish" : "Publish"}
              </button>
            </form>
            <Link
              href={`/chapter/final/${id}/live`}
              className="text-xs font-semibold text-yi-gold hover:underline"
            >
              Open live panel →
            </Link>
            <Link
              href={`/event/${id}/display`}
              target="_blank"
              className="text-xs text-navy/60 hover:text-yi-gold"
            >
              Open projector view ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Agenda with notes */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-4">
          Agenda ({CHAPTER_FINAL_SECTIONS.length} handbook sections)
        </h3>
        <div className="space-y-3">
          {CHAPTER_FINAL_SECTIONS.map((k, i) => {
            const s = secByKey.get(k);
            return (
              <div
                key={k}
                className={`border rounded-md p-3 ${
                  s?.is_active
                    ? "border-yi-gold bg-yi-gold/5"
                    : "border-navy/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-navy/40 font-mono text-xs">
                      {i + 1}.
                    </span>
                    <span className="font-semibold text-navy text-sm">
                      {CHAPTER_FINAL_SECTION_LABELS[k]}
                    </span>
                    {s?.is_active && (
                      <span className="text-[10px] font-semibold text-yi-gold bg-yi-gold/15 px-1.5 py-0.5 rounded">
                        LIVE
                      </span>
                    )}
                  </div>
                  {!s?.is_active && (
                    <form action={activate}>
                      <input type="hidden" name="section" value={k} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-navy hover:text-yi-gold"
                      >
                        Go live →
                      </button>
                    </form>
                  )}
                </div>
                <form action={saveNotes} className="flex gap-2">
                  <input type="hidden" name="section" value={k} />
                  <input
                    name="notes"
                    defaultValue={s?.notes ?? ""}
                    placeholder="Speaker / team / notes"
                    className="flex-1 px-2 py-1 text-xs border border-navy/20 rounded"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs font-semibold text-navy/70 border border-navy/20 rounded hover:border-navy/40"
                  >
                    Save
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      {/* Shortlist */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Publish shortlist
        </h3>
        <p className="text-xs text-navy/60 mb-3">
          Aggregates submitted jury evaluations and writes advancement rows
          for teams clearing the threshold. Safe to re-run.
        </p>
        <form action={doShortlist} className="flex gap-2">
          <input
            name="threshold"
            type="number"
            min={0}
            step="0.5"
            placeholder="70"
            defaultValue="70"
            className="px-3 py-2 border border-navy/20 rounded-md text-sm w-24"
          />
          <input
            name="max"
            type="number"
            min={1}
            placeholder="Max"
            className="px-3 py-2 border border-navy/20 rounded-md text-sm w-24"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Publish shortlist
          </button>
        </form>
        <p className="mt-2 text-xs text-navy/40">
          Threshold = minimum average score. Max = cap on advancements
          (optional).
        </p>
      </section>
    </div>
  );
}
