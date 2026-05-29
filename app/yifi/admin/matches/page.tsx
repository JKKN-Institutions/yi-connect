import { createServiceClient } from "@/lib/yifi/supabase/server";
import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, EmptyState, StatTile } from "../_components";
import { MatchesTable, type MatchRow } from "./matches-table";

export const metadata = {
  title: "Match Curation · YiFi Admin",
};

export default async function YiFiMatchesPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "matches")) {
    return <AccessDenied permission="matches" />;
  }

  const svc = await createServiceClient();
  const { data } = await svc.rpc("yifi_admin_list_matches", {
    p_edition_id: ctx.editionId,
  });

  const rows: MatchRow[] = Array.isArray(data) ? (data as MatchRow[]) : [];

  const total = rows.length;
  const scheduled = rows.filter((r) => r.slot_time != null).length;
  const walkups = rows.filter((r) => r.is_walkup).length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Match Curation" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total Matches" value={total} />
            <StatTile label="Scheduled" value={scheduled} />
            <StatTile label="Walk-ups" value={walkups} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Matches</h2>
          {rows.length === 0 ? (
            <EmptyState message="No matches generated yet." />
          ) : (
            <MatchesTable rows={rows} />
          )}
        </section>
      </div>
    </main>
  );
}
