import { createServiceClient } from "@/lib/yi-future/supabase/server";

type HostChapter = {
  id: string;
  name: string;
  city: string;
  finale_region: string | null;
  finale_start_date: string | null;
  finale_end_date: string | null;
  chair_name: string | null;
  chair_email: string | null;
};

type RegionStats = {
  region: string;
  host: HostChapter | null;
  chapterCount: number;
};

async function loadData() {
  const svc = await createServiceClient();

  const { data: chapters } = await svc
    .schema("future")
    .from("chapters" as never)
    .select(
      "id, name, city, finale_region, finale_start_date, finale_end_date, is_finale_host, chair_name, chair_email"
    )
    .eq("is_active", true)
    .order("finale_region")
    .order("name");

  const all = (chapters as unknown as (HostChapter & { is_finale_host: boolean })[]) ?? [];

  const regionMap: Record<string, RegionStats> = {};
  for (const ch of all) {
    const r = ch.finale_region ?? "UNMAPPED";
    if (!regionMap[r]) regionMap[r] = { region: r, host: null, chapterCount: 0 };
    regionMap[r].chapterCount++;
    if (ch.is_finale_host) regionMap[r].host = ch;
  }

  const { data: tracks } = await svc
    .schema("future")
    .from("tracks")
    .select("id, name, icon, color_hex")
    .order("display_order");

  return {
    regions: Object.values(regionMap).sort((a, b) => a.region.localeCompare(b.region)),
    tracks: (tracks as unknown as { id: string; name: string; icon: string | null; color_hex: string | null }[]) ?? [],
  };
}

const REGION_LABELS: Record<string, string> = {
  ER: "East Region & North East",
  NR: "North Region",
  SRTKKA: "South — Kerala, Karnataka, AP",
  SRTN: "South — Tamil Nadu",
  WR: "West Region",
};

function formatDate(d: string | null): string {
  if (!d) return "TBA";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default async function HostAssignmentsPage() {
  const { regions, tracks } = await loadData();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">
          Regional Finale Hosts
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          5 regional finales — each host chapter runs all 4 tracks over 2 days.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((r) => (
          <div
            key={r.region}
            className={`bg-white border rounded-lg overflow-hidden ${
              r.host
                ? "border-yi-gold/30"
                : "border-red-200 bg-red-50/30"
            }`}
          >
            <div className="px-4 py-3 border-b border-navy/5 bg-navy/5">
              <div className="font-semibold text-navy">
                {REGION_LABELS[r.region] ?? r.region}
              </div>
              <div className="text-xs text-navy/50 mt-0.5">
                {r.chapterCount} chapters participating
              </div>
            </div>

            <div className="px-4 py-4 space-y-3">
              {r.host ? (
                <>
                  <div>
                    <div className="text-xs font-semibold text-navy/50 uppercase tracking-wider">
                      Host City
                    </div>
                    <div className="text-lg font-bold text-navy">
                      {r.host.name}
                    </div>
                    <div className="text-xs text-navy/50">{r.host.city}</div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-navy/50 uppercase tracking-wider">
                      Dates
                    </div>
                    <div className="text-sm font-medium text-navy">
                      {r.host.finale_start_date
                        ? `${formatDate(r.host.finale_start_date)} — ${formatDate(r.host.finale_end_date)}`
                        : "TBA"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-navy/50 uppercase tracking-wider">
                      Tracks
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {tracks.map((t) => (
                        <span
                          key={t.id}
                          className="px-2 py-0.5 text-[11px] font-semibold rounded"
                          style={{
                            backgroundColor: t.color_hex
                              ? `${t.color_hex}15`
                              : "#f5f5f5",
                            color: t.color_hex ?? "#333",
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {r.host.chair_name && (
                    <div>
                      <div className="text-xs font-semibold text-navy/50 uppercase tracking-wider">
                        Chair
                      </div>
                      <div className="text-sm text-navy">
                        {r.host.chair_name}
                      </div>
                      {r.host.chair_email && (
                        <div className="text-xs text-navy/50">
                          {r.host.chair_email}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-red-500 font-medium">
                  No host chapter assigned
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
