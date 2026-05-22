import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";

type Edition = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kickoff_date: string | null;
  chapter_final_window_start: string | null;
  chapter_final_window_end: string | null;
  national_finals_window_start: string | null;
  national_finals_window_end: string | null;
  current_stage: string | null;
  is_active: boolean | null;
};

type Track = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color_hex: string | null;
  display_order: number | null;
  problem_statements: { id: string; title: string }[];
};

type Whitepaper = {
  id: string;
  title: string | null;
  pdf_url: string | null;
  tracks: { name: string; icon: string | null } | null;
  chapters: { name: string } | null;
};

type Award = {
  id: string;
  category: string;
  custom_label: string | null;
  citation: string | null;
  teams: {
    team_name: string;
    chapters: { name: string } | null;
    problem_statements: {
      tracks: { name: string; icon: string | null } | null;
    } | null;
  } | null;
  events: { name: string } | null;
};

async function getEdition(slug: string): Promise<Edition | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select(
      "id, slug, name, tagline, kickoff_date, chapter_final_window_start, chapter_final_window_end, national_finals_window_start, national_finals_window_end, current_stage, is_active"
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as unknown as Edition) ?? null;
}

async function getTracks(editionId: string): Promise<Track[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select(
      "id, slug, name, description, icon, color_hex, display_order, problem_statements(id, title)"
    )
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as Track[]) ?? [];
}

async function getWhitepapers(editionId: string): Promise<Whitepaper[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      "id, title, pdf_url, tracks(name, icon), chapters:chapters!whitepapers_host_chapter_id_fkey(name)"
    )
    .eq("edition_id", editionId)
    .eq("status", "published");
  return (data as unknown as Whitepaper[]) ?? [];
}

async function getAwards(editionId: string): Promise<Award[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("awards")
    .select(
      "id, category, custom_label, citation, teams(team_name, chapters(name), problem_statements(tracks(name, icon))), events!inner(edition_id, name)"
    )
    .eq("events.edition_id", editionId);
  return (data as unknown as Award[]) ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = await getEdition(slug);
  if (!e) return { title: "Edition · Future" };
  return {
    title: `${e.name} · Future`,
    description: e.tagline ?? undefined,
  };
}

export default async function PublicEditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const edition = await getEdition(slug);
  if (!edition) notFound();

  const [tracks, whitepapers, awards] = await Promise.all([
    getTracks(edition.id),
    getWhitepapers(edition.id),
    getAwards(edition.id),
  ]);

  return (
    <main className="min-h-screen bg-ivory">
      <header className="py-4 px-4 border-b border-navy/10 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/national"
            className="text-sm font-semibold text-navy hover:text-yi-gold"
          >
            National →
          </Link>
        </div>
      </header>

      <section className="px-4 pt-16 pb-10 max-w-4xl mx-auto text-center">
        <BrandStrip className="mb-6" />
        <div className="text-[10px] font-semibold tracking-[0.25em] uppercase text-yi-gold mb-3">
          Edition {edition.slug}
          {edition.is_active && <span className="ml-2">● ACTIVE</span>}
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-navy tracking-tight">
          {edition.name}
        </h1>
        {edition.tagline && (
          <p className="mt-4 text-xl text-navy/70">{edition.tagline}</p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-navy/60">
          {edition.kickoff_date && (
            <span>🚀 Kickoff {edition.kickoff_date}</span>
          )}
          {edition.chapter_final_window_start && (
            <span>
              🏛 Chapter finals {edition.chapter_final_window_start} –{" "}
              {edition.chapter_final_window_end}
            </span>
          )}
          {edition.national_finals_window_start && (
            <span>
              🇮🇳 National finals {edition.national_finals_window_start} –{" "}
              {edition.national_finals_window_end}
            </span>
          )}
        </div>
      </section>

      <section className="px-4 pb-16 max-w-5xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-navy/40 mb-4">
          Tracks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tracks.map((t) => (
            <article
              key={t.id}
              className="bg-white rounded-lg p-5 border-2"
              style={{ borderColor: t.color_hex ?? "#1a1a3e" }}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{t.icon ?? "•"}</span>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg font-bold"
                    style={{ color: t.color_hex ?? "#1a1a3e" }}
                  >
                    {t.name}
                  </h3>
                  {t.description && (
                    <p className="mt-1 text-sm text-navy/70">
                      {t.description}
                    </p>
                  )}
                </div>
              </div>
              {t.problem_statements.length > 0 && (
                <ul className="mt-3 pt-3 border-t border-navy/10 space-y-1.5">
                  {t.problem_statements.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/problems/${p.id}`}
                        className="text-sm text-navy hover:text-yi-gold font-semibold"
                      >
                        · {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      {awards.length > 0 && (
        <section className="px-4 pb-16 max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-navy/40 mb-4">
            🏆 Awards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {awards.map((a) => (
              <div
                key={a.id}
                className="bg-gradient-to-br from-yi-gold/10 to-yi-saffron/10 border-2 border-yi-gold/30 rounded-lg p-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold">
                  {a.custom_label ?? a.category}
                </div>
                <div className="mt-1 font-bold text-navy">
                  {a.teams?.team_name ?? "—"}
                </div>
                <div className="text-xs text-navy/50">
                  {a.teams?.chapters?.name}
                  {a.teams?.problem_statements?.tracks?.name &&
                    ` · ${a.teams.problem_statements.tracks.name}`}
                </div>
                {a.citation && (
                  <p className="mt-2 text-sm italic text-navy/80">
                    &ldquo;{a.citation}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {whitepapers.length > 0 && (
        <section className="px-4 pb-16 max-w-5xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-navy/40 mb-4">
            Whitepapers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {whitepapers.map((w) => (
              <a
                key={w.id}
                href={w.pdf_url ?? "#"}
                target="_blank"
                rel="noopener"
                className="bg-white border border-navy/10 rounded-lg p-4 hover:border-yi-gold/50"
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
