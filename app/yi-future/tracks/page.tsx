import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";

type Track = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  icon: string | null;
  display_order: number | null;
  editions: { slug: string; name: string } | null;
  problem_statements: { id: string }[];
};

async function getTracks(): Promise<Track[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select(
      "id, slug, name, description, color_hex, icon, display_order, editions!inner(slug, name, is_active), problem_statements(id)"
    )
    .eq("editions.is_active", true)
    .order("display_order", { ascending: true });
  return (data as unknown as Track[]) ?? [];
}

export const metadata = {
  title: "Tracks · Future 6.0",
  description:
    "The four thematic tracks college students work on in Yi YUVA Future 6.0.",
};

export default async function PublicTracksPage() {
  const tracks = await getTracks();

  return (
    <main className="min-h-screen bg-ivory">
      <header className="py-4 px-4 border-b border-navy/10 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/join"
            className="text-sm font-semibold text-navy hover:text-yi-gold"
          >
            Register →
          </Link>
        </div>
      </header>

      <section className="px-4 pt-16 pb-10 max-w-4xl mx-auto text-center">
        <BrandStrip className="mb-6" />
        <h1 className="text-5xl font-bold text-navy tracking-tight">
          The 4 Tracks
        </h1>
        <p className="mt-4 text-lg text-navy/70">
          Every chapter runs all 4 tracks simultaneously. Delegates form teams
          of 3–5, pick the problem that matters to them, and build a
          policy-ready solution across 90 days.
        </p>
      </section>

      <section className="px-4 pb-20 max-w-6xl mx-auto">
        {tracks.length === 0 ? (
          <div className="text-center text-navy/50 text-sm py-8">
            Tracks for the current edition will be announced shortly.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tracks.map((t) => (
              <article
                key={t.id}
                className="bg-white rounded-lg p-6 border-2 transition-all hover:shadow-lg"
                style={{ borderColor: t.color_hex ?? "#1a1a3e" }}
              >
                <div className="flex items-start gap-4">
                  <div className="text-5xl">{t.icon ?? "•"}</div>
                  <div className="flex-1 min-w-0">
                    <h2
                      className="text-2xl font-bold mb-2"
                      style={{ color: t.color_hex ?? "#1a1a3e" }}
                    >
                      {t.name}
                    </h2>
                    <p className="text-sm text-navy/70 leading-relaxed">
                      {t.description ?? ""}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-semibold text-navy/50">
                        {t.problem_statements.length} problem statement
                        {t.problem_statements.length !== 1 && "s"}
                      </span>
                      {t.editions?.slug && (
                        <Link
                          href={`/editions/${t.editions.slug}`}
                          className="text-xs font-semibold text-navy hover:text-yi-gold"
                        >
                          Edition →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-navy/10 py-8 px-4 bg-white">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <BrandStrip />
          <p className="text-xs text-navy/40">
            © 2026 Yi · Yi YUVA · CII. Future 6.0 is a Yi YUVA flagship
            program.
          </p>
        </div>
      </footer>
    </main>
  );
}
