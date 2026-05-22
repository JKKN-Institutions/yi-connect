import { createServiceClient } from "@/lib/yi-future/supabase/server";

type Whitepaper = {
  id: string;
  title: string | null;
  status: string | null;
  pdf_url: string | null;
  published_at: string | null;
  track_id: string;
  host_chapter_id: string | null;
  tracks: { name: string; icon: string | null } | null;
  chapters: { name: string } | null;
  editions: { name: string } | null;
};

async function getAll(): Promise<Whitepaper[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      "id, title, status, pdf_url, published_at, track_id, host_chapter_id, tracks(name, icon), chapters:chapters!whitepapers_host_chapter_id_fkey(name), editions(name)"
    )
    .order("updated_at", { ascending: false });
  return (data as unknown as Whitepaper[]) ?? [];
}

export default async function NationalWhitepapersPage() {
  const wps = await getAll();
  const published = wps.filter((w) => w.status === "published").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Whitepapers</h2>
        <p className="mt-1 text-sm text-navy/60">
          {wps.length} total · {published} published. One per
          (edition, track, host chapter).
        </p>
      </div>

      {wps.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No whitepapers started yet. Host chapters draft these from{" "}
          <code className="bg-navy/5 px-1 rounded">/host/whitepaper</code>.
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Track</th>
                <th className="text-left px-4 py-3 font-semibold">Host chapter</th>
                <th className="text-left px-4 py-3 font-semibold">Title</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Links</th>
              </tr>
            </thead>
            <tbody>
              {wps.map((w) => (
                <tr key={w.id} className="border-t border-navy/5">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {w.tracks?.icon ?? "•"} {w.tracks?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy/70 text-xs">
                    {w.chapters?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy/90">
                    {w.title ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        w.status === "published"
                          ? "bg-yi-green/10 text-yi-green"
                          : "bg-navy/5 text-navy/60"
                      }`}
                    >
                      {w.status ?? "draft"}
                    </span>
                    {w.published_at && (
                      <div className="text-[10px] text-navy/40 mt-1">
                        {new Date(w.published_at).toLocaleDateString("en-IN")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {w.pdf_url && (
                      <a
                        href={w.pdf_url}
                        target="_blank"
                        rel="noopener"
                        className="text-yi-gold font-semibold hover:underline"
                      >
                        PDF ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-navy/40">
        Compendium (bundled PDF of all whitepapers) will ship in Phase 16 /
        Phase 18 polish.
      </p>
    </div>
  );
}
