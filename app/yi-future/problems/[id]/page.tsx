import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { TrackIcon } from "@/components/yi-future/TrackIcon";

type Problem = {
  id: string;
  title: string;
  short_description: string;
  full_description: string | null;
  national_priority_context: string | null;
  sdg_alignment: string[] | null;
  display_order: number | null;
  is_active: boolean | null;
  tracks: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    color_hex: string | null;
    editions: { slug: string; name: string } | null;
  } | null;
};

async function getProblem(id: string): Promise<Problem | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, full_description, national_priority_context, sdg_alignment, display_order, is_active, tracks(id, slug, name, icon, color_hex, editions!tracks_edition_id_fkey(slug, name))"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Problem) ?? null;
}

async function getSiblings(trackId: string, excludeId: string) {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id, title, short_description")
    .eq("track_id", trackId)
    .eq("is_active", true)
    .neq("id", excludeId)
    .order("display_order", { ascending: true });
  return (data as unknown as {
    id: string;
    title: string;
    short_description: string;
  }[]) ?? [];
}

export default async function PublicProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProblem(id);
  if (!p) notFound();

  const color = p.tracks?.color_hex ?? "#1a1a3e";
  const siblings = p.tracks?.id ? await getSiblings(p.tracks.id, p.id) : [];

  return (
    <main className="min-h-screen bg-ivory">
      <header className="py-4 px-4 border-b border-navy/10 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/tracks"
            className="text-sm font-semibold text-navy hover:text-yi-gold"
          >
            All tracks →
          </Link>
        </div>
      </header>

      <section className="px-4 pt-16 pb-12 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <TrackIcon icon={p.tracks?.icon} name={p.tracks?.name} size={36} />
          <Link
            href={`/tracks`}
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color }}
          >
            {p.tracks?.name ?? "—"}
          </Link>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-navy tracking-tight">
          {p.title}
        </h1>

        <p className="mt-4 text-lg text-navy/70 leading-relaxed">
          {p.short_description}
        </p>

        {p.sdg_alignment && p.sdg_alignment.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {p.sdg_alignment.map((sdg) => (
              <span
                key={sdg}
                className="px-2 py-0.5 rounded bg-yi-green/10 text-yi-green text-xs font-semibold"
              >
                {sdg}
              </span>
            ))}
          </div>
        )}

        {p.full_description && (
          <article className="mt-8 prose-sm bg-white border border-navy/10 rounded-lg p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
              Context
            </h3>
            <p className="text-sm text-navy/80 whitespace-pre-line leading-relaxed">
              {p.full_description}
            </p>
          </article>
        )}

        {p.national_priority_context && (
          <div className="mt-4 p-4 rounded-lg border-l-4" style={{ borderColor: color }}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-1">
              National priority context
            </div>
            <p className="text-sm text-navy/80">
              {p.national_priority_context}
            </p>
          </div>
        )}
      </section>

      {siblings.length > 0 && (
        <section className="px-4 pb-16 max-w-3xl mx-auto">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            Other problems in this track
          </h3>
          <ul className="space-y-3">
            {siblings.map((s) => (
              <li
                key={s.id}
                className="bg-white border border-navy/10 rounded-lg p-4"
              >
                <Link
                  href={`/problems/${s.id}`}
                  className="font-bold text-navy hover:text-yi-gold"
                >
                  {s.title}
                </Link>
                <p className="mt-1 text-sm text-navy/60">
                  {s.short_description}
                </p>
              </li>
            ))}
          </ul>
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
