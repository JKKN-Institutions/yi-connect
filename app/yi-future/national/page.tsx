import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";

type NationalEvent = {
  id: string;
  name: string;
  tagline: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  is_published: boolean | null;
  chapter_id: string | null;
  track_id: string | null;
  chapters: { name: string; city: string } | null;
  tracks: { name: string; icon: string | null; color_hex: string | null } | null;
};

type Whitepaper = {
  id: string;
  title: string | null;
  pdf_url: string | null;
  tracks: { name: string; icon: string | null } | null;
  chapters: { name: string } | null;
};

async function getNationalEvents(): Promise<NationalEvent[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select(
      "id, name, tagline, start_date, end_date, venue, is_published, chapter_id, track_id, chapters(name, city), tracks(name, icon, color_hex)"
    )
    .eq("type", "national_track_final")
    .eq("is_published", true)
    .order("start_date", { ascending: true });
  return (data as unknown as NationalEvent[]) ?? [];
}

async function getPublishedWhitepapers(): Promise<Whitepaper[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      "id, title, pdf_url, tracks(name, icon), chapters:chapters!whitepapers_host_chapter_id_fkey(name)"
    )
    .eq("status", "published")
    .limit(12);
  return (data as unknown as Whitepaper[]) ?? [];
}

export const metadata = {
  title: "National · Future 6.0",
  description:
    "The 5 National Track Finals of Yi YUVA Future 6.0 — 2-day conclaves hosted across India.",
};

export default async function PublicNationalPage() {
  const [events, whitepapers] = await Promise.all([
    getNationalEvents(),
    getPublishedWhitepapers(),
  ]);

  return (
    <main className="min-h-screen bg-ivory">
      <header className="py-4 px-4 border-b border-navy/10 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/tracks"
            className="text-sm font-semibold text-navy hover:text-yi-gold"
          >
            Tracks →
          </Link>
        </div>
      </header>

      <section className="px-4 pt-16 pb-10 max-w-4xl mx-auto text-center">
        <BrandStrip className="mb-6" />
        <h1 className="text-5xl md:text-6xl font-bold text-navy tracking-tight">
          National Finals
        </h1>
        <p className="mt-4 text-lg text-navy/70">
          5 host chapters run 2-day National Track Finals — Day 1 is learning
          (keynotes, masterclasses, town hall), Day 2 is competition (semis,
          grand final, opportunity interviews, awards).
        </p>
      </section>

      <section className="px-4 pb-16 max-w-5xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-navy/40 mb-4">
          Upcoming events
        </h2>
        {events.length === 0 ? (
          <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
            National events will be announced shortly.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((e) => (
              <article
                key={e.id}
                className="bg-white rounded-lg p-6 border-2"
                style={{ borderColor: e.tracks?.color_hex ?? "#1a1a3e" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{e.tracks?.icon}</span>
                  <span
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: e.tracks?.color_hex ?? "#1a1a3e" }}
                  >
                    {e.tracks?.name ?? "—"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-navy">{e.name}</h3>
                {e.tagline && (
                  <p className="mt-1 text-sm text-navy/60">{e.tagline}</p>
                )}
                <div className="mt-4 text-sm text-navy/70">
                  <div>📅 {e.start_date ?? "—"}</div>
                  {e.venue && <div>📍 {e.venue}</div>}
                  {e.chapters && (
                    <div className="mt-1 text-xs text-navy/50">
                      Hosted by {e.chapters.name}
                      {e.chapters.city && `, ${e.chapters.city}`}
                    </div>
                  )}
                </div>
                <Link
                  href={`/event/${e.id}/display`}
                  target="_blank"
                  className="mt-4 inline-block text-xs font-semibold text-yi-gold hover:underline"
                >
                  Live view ↗
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {whitepapers.length > 0 && (
        <section className="px-4 pb-16 max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-navy/40 mb-4">
            Published whitepapers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {whitepapers.map((w) => (
              <a
                key={w.id}
                href={w.pdf_url ?? "#"}
                target="_blank"
                rel="noopener"
                className="bg-white border border-navy/10 rounded-lg p-4 hover:border-yi-gold/50 transition-all"
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
                  <span className="mr-1">{w.tracks?.icon}</span>
                  {w.tracks?.name}
                </div>
                <div className="mt-1 font-bold text-navy">
                  {w.title ?? "Untitled"}
                </div>
                <div className="mt-0.5 text-xs text-navy/50">
                  {w.chapters?.name}
                </div>
                {w.pdf_url && (
                  <div className="mt-2 text-xs text-yi-gold">Open PDF ↗</div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-navy/10 py-8 px-4 bg-white">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <BrandStrip />
        </div>
      </footer>
    </main>
  );
}
