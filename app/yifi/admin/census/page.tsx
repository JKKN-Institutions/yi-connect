import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, EmptyState, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { IncompleteList } from "./incomplete-list";

export const metadata = {
  title: "YiFi Census Monitor",
};

interface SectorCount {
  sector: string | null;
  count: number;
}

interface IncompletePerson {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
}

interface CensusSummary {
  total: number;
  complete: number;
  incomplete: number;
  completion_rate: number;
  by_sector: SectorCount[];
  incomplete_list: IncompletePerson[];
}

const EMPTY_SUMMARY: CensusSummary = {
  total: 0,
  complete: 0,
  incomplete: 0,
  completion_rate: 0,
  by_sector: [],
  incomplete_list: [],
};

export default async function CensusMonitorPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "census")) {
    return <AccessDenied permission="census" />;
  }

  const svc = await createServiceClient();
  const { data } = await svc.rpc("yifi_admin_census_summary", {
    p_edition_id: ctx.editionId,
  });

  const s: CensusSummary = (data as CensusSummary | null) ?? EMPTY_SUMMARY;

  const completionRate = Math.max(0, Math.min(100, Number(s.completion_rate) || 0));
  const bySector = Array.isArray(s.by_sector) ? s.by_sector : [];
  const maxSectorCount = bySector.reduce((max, item) => Math.max(max, item.count || 0), 0);
  const incompleteList = Array.isArray(s.incomplete_list) ? s.incomplete_list : [];

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Census Monitor" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero — completion rate */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide">
              Census Completion
            </h2>
            <span className="text-4xl font-bold text-[#FD7215]">
              {completionRate.toFixed(completionRate % 1 === 0 ? 0 : 1)}%
            </span>
          </div>
          <div
            className="h-3 w-full rounded-full bg-white/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(completionRate)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[#FD7215] transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </section>

        {/* Stat tiles */}
        <section>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total" value={s.total ?? 0} />
            <StatTile label="Complete" value={s.complete ?? 0} />
            <StatTile label="Incomplete" value={s.incomplete ?? 0} />
          </div>
        </section>

        {/* By Sector */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">By Sector</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            {bySector.length === 0 ? (
              <p className="text-white/40 text-sm">No sector data yet.</p>
            ) : (
              <div className="space-y-3">
                {bySector.map((item, i) => {
                  const width =
                    maxSectorCount > 0 ? ((item.count || 0) / maxSectorCount) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-sm">
                          {item.sector || "Unspecified"}
                        </span>
                        <span className="text-white/50 text-xs">{item.count ?? 0}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#229434] transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Incomplete list */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Incomplete Census ({incompleteList.length})
          </h2>
          {incompleteList.length === 0 ? (
            <EmptyState message="Everyone has completed their census. 🎉" />
          ) : (
            <IncompleteList items={incompleteList} />
          )}
        </section>
      </div>
    </main>
  );
}
