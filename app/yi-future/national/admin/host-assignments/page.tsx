import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";

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
    allChapters: all.map((ch) => ({ id: ch.id, name: ch.name, city: ch.city })),
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  const { regions, tracks, allChapters } = await loadData();

  async function updateHost(formData: FormData) {
    "use server";
    const chapterId = String(formData.get("chapter_id") ?? "");
    const city = String(formData.get("city") ?? "").trim();
    const startDate = String(formData.get("finale_start_date") ?? "").trim() || null;
    const endDate = String(formData.get("finale_end_date") ?? "").trim() || null;
    if (!chapterId) return;
    const svc = await createServiceClient();
    await svc.schema("yi").from("chapters")
      .update({
        city: city || undefined,
        finale_start_date: startDate,
        finale_end_date: endDate,
      } as never)
      .eq("id", chapterId);
    revalidatePath("/yi-future/national/admin/host-assignments");
  }

  async function assignHost(formData: FormData) {
    "use server";
    const region = String(formData.get("region") ?? "");
    const chapterId = String(formData.get("new_host_id") ?? "");
    if (!region || !chapterId) return;
    const svc = await createServiceClient();
    // Unset previous host for this region
    await svc.schema("future").from("chapters" as never)
      .update({ is_finale_host: false } as never)
      .eq("finale_region", region)
      .eq("is_finale_host", true);
    // Set new host
    await svc.schema("future").from("chapters" as never)
      .update({ is_finale_host: true, finale_region: region } as never)
      .eq("id", chapterId);
    revalidatePath("/yi-future/national/admin/host-assignments");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">
          Regional Finale Hosts
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          5 regional finales — each host chapter runs all 4 tracks over 2 days. Edit dates and cities inline.
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
                <form action={updateHost} className="space-y-3">
                  <input type="hidden" name="chapter_id" value={r.host.id} />

                  <div>
                    <label className="text-xs font-semibold text-navy/50 uppercase tracking-wider block">
                      Host chapter
                    </label>
                    <div className="text-lg font-bold text-navy">
                      {r.host.name}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-navy/50 uppercase tracking-wider block mb-1">
                      City
                    </label>
                    <input
                      name="city"
                      defaultValue={r.host.city}
                      className="w-full px-2 py-1.5 border border-navy/20 rounded text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-navy/50 uppercase tracking-wider block mb-1">
                        Start date
                      </label>
                      <input
                        name="finale_start_date"
                        type="date"
                        defaultValue={r.host.finale_start_date ?? ""}
                        className="w-full px-2 py-1.5 border border-navy/20 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-navy/50 uppercase tracking-wider block mb-1">
                        End date
                      </label>
                      <input
                        name="finale_end_date"
                        type="date"
                        defaultValue={r.host.finale_end_date ?? ""}
                        className="w-full px-2 py-1.5 border border-navy/20 rounded text-sm"
                      />
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

                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
                  >
                    Save changes
                  </button>
                </form>
              ) : (
                <form action={assignHost} className="space-y-3">
                  <input type="hidden" name="region" value={r.region} />
                  <div className="text-sm text-red-500 font-medium">
                    No host chapter assigned
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-navy/50 uppercase tracking-wider block mb-1">
                      Assign host chapter
                    </label>
                    <select
                      name="new_host_id"
                      required
                      className="w-full px-2 py-1.5 border border-navy/20 rounded text-sm bg-white"
                    >
                      <option value="">— Pick a chapter —</option>
                      {allChapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name} ({ch.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-md bg-[#F5A623] text-navy text-xs font-bold hover:bg-[#F5A623]/90"
                  >
                    Assign as host
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
