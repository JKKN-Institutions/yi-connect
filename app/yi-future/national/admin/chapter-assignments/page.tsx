import { createServiceClient } from "@/lib/yi-future/supabase/server";

type Chapter = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  finale_region: string | null;
  is_finale_host: boolean | null;
};

async function getChapters(): Promise<Chapter[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapters" as never)
    .select("id, name, city, state, finale_region, is_finale_host")
    .eq("is_active", true)
    .order("finale_region")
    .order("name");
  return (data as unknown as Chapter[]) ?? [];
}

export default async function ChapterAssignmentsPage() {
  const chapters = await getChapters();

  const regions: Record<string, Chapter[]> = {};
  for (const ch of chapters) {
    const r = ch.finale_region ?? "UNMAPPED";
    (regions[r] ??= []).push(ch);
  }

  const regionLabels: Record<string, string> = {
    SRTN: "South Region — Tamil Nadu",
    SRTKKA: "South Region — Kerala, Karnataka, AP",
    ER: "East Region & North East",
    NR: "North Region",
    WR: "West Region",
    UNMAPPED: "No Region Assigned",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Chapter Assignments</h2>
        <p className="mt-1 text-sm text-navy/60">
          Every chapter participates in all 4 tracks. Chapters are grouped by
          their regional finale location.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(regions).map(([r, chs]) => {
          const host = chs.find((c) => c.is_finale_host);
          return (
            <div
              key={r}
              className="bg-white border border-navy/10 rounded-lg p-3 text-center"
            >
              <div className="text-xs font-semibold text-navy/50 uppercase tracking-wider">
                {r}
              </div>
              <div className="text-2xl font-bold text-navy mt-1">
                {chs.length}
              </div>
              <div className="text-[11px] text-navy/50">chapters</div>
              {host && (
                <div className="mt-1 text-[11px] text-yi-gold font-semibold">
                  Finale: {host.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.entries(regions).map(([r, chs]) => {
        const host = chs.find((c) => c.is_finale_host);
        return (
          <div
            key={r}
            className="bg-white border border-navy/10 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 bg-navy/5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-navy">
                  {regionLabels[r] ?? r}
                </span>
                <span className="ml-2 text-xs text-navy/50">
                  {chs.length} chapters
                </span>
              </div>
              {host && (
                <span className="text-xs font-semibold text-yi-gold">
                  Finale host: {host.name}
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="text-navy/60 text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">
                    Chapter
                  </th>
                  <th className="text-left px-4 py-2 font-semibold">City</th>
                  <th className="text-left px-4 py-2 font-semibold">Tracks</th>
                  <th className="text-left px-4 py-2 font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {chs.map((c) => (
                  <tr key={c.id} className="border-t border-navy/5">
                    <td className="px-4 py-2 font-medium text-navy">
                      {c.name}
                    </td>
                    <td className="px-4 py-2 text-navy/60">
                      {c.city}
                      {c.state ? `, ${c.state}` : ""}
                    </td>
                    <td className="px-4 py-2 text-navy/60">All 4</td>
                    <td className="px-4 py-2">
                      {c.is_finale_host ? (
                        <span className="px-2 py-0.5 bg-yi-gold/10 text-yi-gold text-xs font-semibold rounded">
                          Finale Host
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-navy/5 text-navy/50 text-xs rounded">
                          participating
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
