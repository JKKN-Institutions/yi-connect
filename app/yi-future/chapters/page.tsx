import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";

type Chapter = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  region: string | null;
  logo_url: string | null;
};

async function getChapters(): Promise<Chapter[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city, state, region, logo_url")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as unknown as Chapter[]) ?? [];
}

export const metadata = {
  title: "Chapters · Future 6.0",
  description: "Participating Yi chapters across India.",
};

export default async function PublicChaptersPage() {
  const chapters = await getChapters();

  // Group by state
  const byState = new Map<string, Chapter[]>();
  for (const c of chapters) {
    const key = c.state ?? "—";
    if (!byState.has(key)) byState.set(key, []);
    byState.get(key)!.push(c);
  }

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

      <section className="px-4 pt-16 pb-12 max-w-5xl mx-auto">
        <div className="text-center">
          <BrandStrip className="mb-6" />
          <h1 className="text-5xl font-bold text-navy tracking-tight">
            Chapters
          </h1>
          <p className="mt-4 text-lg text-navy/70">
            {chapters.length} active Yi chapters participating in Future 6.0.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          {[...byState.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([state, cs]) => (
              <section key={state}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-navy/40 mb-3">
                  {state}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {cs.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white border border-navy/10 rounded-lg p-4 flex items-center gap-3"
                    >
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.logo_url}
                          alt={c.name}
                          className="h-10 w-10 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded bg-yi-gold/10 flex-shrink-0 flex items-center justify-center font-bold text-yi-gold"
                        >
                          {c.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-navy truncate">
                          {c.name}
                        </div>
                        <div className="text-xs text-navy/50 truncate">
                          {c.city}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </section>

      <footer className="border-t border-navy/10 py-8 px-4 bg-white">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <BrandStrip />
        </div>
      </footer>
    </main>
  );
}
