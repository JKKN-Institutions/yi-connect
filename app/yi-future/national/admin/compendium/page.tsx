import { createServiceClient } from "@/lib/yi-future/supabase/server";

type Section = { heading: string; body: string };

type Whitepaper = {
  id: string;
  title: string | null;
  status: string | null;
  executive_summary: string | null;
  sections: Section[] | null;
  pdf_url: string | null;
  published_at: string | null;
  tracks: { name: string; icon: string | null; color_hex: string | null } | null;
  chapters: { name: string; city: string } | null;
  editions: { name: string; slug: string } | null;
};

async function getPublished(): Promise<Whitepaper[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      "id, title, status, executive_summary, sections, pdf_url, published_at, tracks(name, icon, color_hex), chapters:chapters!whitepapers_host_chapter_id_fkey(name, city), editions(name, slug)"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data as unknown as Whitepaper[]) ?? [];
}

export default async function CompendiumPage() {
  const wps = await getPublished();

  // Group by edition (name -> papers) and capture slug per edition name.
  const byEdition = new Map<string, Whitepaper[]>();
  const editionSlugs = new Map<string, string>();
  for (const w of wps) {
    const key = w.editions?.name ?? "—";
    if (!byEdition.has(key)) byEdition.set(key, []);
    byEdition.get(key)!.push(w);
    if (w.editions?.slug && !editionSlugs.has(key)) {
      editionSlugs.set(key, w.editions.slug);
    }
  }

  const downloadableEditions = [...byEdition.entries()].filter(
    ([name, ws]) => ws.length > 0 && editionSlugs.has(name)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Compendium</h2>
        <p className="mt-1 text-sm text-navy/60">
          Published whitepapers across all editions. Download a bundled PDF
          compendium per edition below.
        </p>
      </div>

      {downloadableEditions.length > 0 && (
        <div className="bg-white border border-navy/10 rounded-lg p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            Download bundled compendium
          </div>
          <div className="flex flex-wrap gap-2">
            {downloadableEditions.map(([name, ws]) => {
              const slug = editionSlugs.get(name)!;
              return (
                <a
                  key={slug}
                  href={`/api/compendium/${slug}/pdf`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yi-gold text-white text-sm font-semibold hover:bg-yi-gold/90 transition-colors"
                >
                  <span>Download compendium for {name}</span>
                  <span className="text-xs opacity-80">
                    ({ws.length} paper{ws.length === 1 ? "" : "s"})
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {wps.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No published whitepapers yet.
        </div>
      ) : (
        <div className="space-y-6">
          {[...byEdition.entries()].map(([editionName, ws]) => (
            <section key={editionName}>
              <h3 className="text-sm font-bold text-navy mb-3">
                {editionName}
              </h3>
              <div className="space-y-3">
                {ws.map((w) => (
                  <article
                    key={w.id}
                    className="bg-white border border-navy/10 rounded-lg p-5"
                    style={{
                      borderLeft: `4px solid ${w.tracks?.color_hex ?? "#1a1a3e"}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
                          <span className="mr-1">{w.tracks?.icon}</span>
                          {w.tracks?.name ?? "—"}
                          {" · "}
                          {w.chapters?.name ?? "—"}
                        </div>
                        <h4
                          className="mt-1 text-lg font-bold"
                          style={{ color: w.tracks?.color_hex ?? "#1a1a3e" }}
                        >
                          {w.title ?? "Untitled"}
                        </h4>
                      </div>
                      {w.pdf_url && (
                        <a
                          href={w.pdf_url}
                          target="_blank"
                          rel="noopener"
                          className="flex-shrink-0 px-3 py-1.5 rounded bg-yi-gold/10 text-yi-gold text-xs font-semibold hover:bg-yi-gold/20"
                        >
                          PDF ↗
                        </a>
                      )}
                    </div>
                    {w.executive_summary && (
                      <p className="text-sm text-navy/70">
                        {w.executive_summary}
                      </p>
                    )}
                    {w.sections && w.sections.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-navy/10">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-1">
                          Sections
                        </div>
                        <ul className="text-xs text-navy/70 flex flex-wrap gap-x-3 gap-y-1">
                          {w.sections.map((s, i) => (
                            <li key={i}>• {s.heading}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {w.published_at && (
                      <div className="mt-2 text-[10px] text-navy/40">
                        Published{" "}
                        {new Date(w.published_at).toLocaleDateString("en-IN")}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
