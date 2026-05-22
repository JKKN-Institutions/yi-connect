import { createServiceClient } from "@/lib/yi-future/supabase/server";

type Media = {
  id: string;
  outlet: string | null;
  headline: string | null;
  url: string | null;
  media_type: string | null;
  publication_date: string | null;
  reach_estimate: number | null;
  events: {
    name: string;
    chapters: { name: string } | null;
  } | null;
};

async function getAll(): Promise<Media[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("media_coverage")
    .select(
      "id, outlet, headline, url, media_type, publication_date, reach_estimate, events(name, chapters(name))"
    )
    .order("publication_date", { ascending: false, nullsFirst: false });
  return (data as unknown as Media[]) ?? [];
}

export default async function NationalMediaPage() {
  const items = await getAll();
  const totalReach = items.reduce((s, i) => s + (i.reach_estimate ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Media coverage</h2>
        <p className="mt-1 text-sm text-navy/60">
          {items.length} item(s) across all hosts
          {totalReach > 0 && ` · ~${totalReach.toLocaleString()} total reach`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No coverage logged yet. Hosts add coverage at{" "}
          <code className="bg-navy/5 px-1 rounded">/host/media</code>.
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Outlet</th>
                <th className="text-left px-4 py-3 font-semibold">Headline</th>
                <th className="text-left px-4 py-3 font-semibold">Host</th>
                <th className="text-right px-4 py-3 font-semibold">Reach</th>
                <th className="text-right px-4 py-3 font-semibold">URL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {m.publication_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{m.outlet ?? "—"}</div>
                    {m.media_type && (
                      <div className="text-[10px] text-navy/50">
                        {m.media_type}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-md truncate">
                    {m.headline ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/60">
                    {m.events?.chapters?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {m.reach_estimate
                      ? m.reach_estimate.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.url ? (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-semibold text-yi-gold hover:underline"
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="text-xs text-navy/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
