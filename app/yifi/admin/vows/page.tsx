import { createServiceClient } from "@/lib/yifi/supabase/server";
import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, EmptyState, StatTile } from "../_components";
import { VowsTable, type AdminVow } from "./vows-table";

export const metadata = {
  title: "YiFi Admin · Vow Wall",
};

export default async function YiFiVowsPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "vows")) {
    return <AccessDenied permission="vows" />;
  }

  const svc = await createServiceClient();
  const { data } = await svc.rpc("yifi_admin_list_vows", {
    p_edition_id: ctx.editionId,
  });

  const rows: AdminVow[] = Array.isArray(data) ? (data as AdminVow[]) : [];

  const engravedCount = rows.filter((r) => r.tile_engraved).length;
  const placedCount = rows.filter((r) => r.tile_placed).length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Vow Wall" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total Vows" value={rows.length} />
            <StatTile label="Engraved" value={engravedCount} />
            <StatTile label="Placed" value={placedCount} />
          </div>
        </section>

        <section>
          {rows.length === 0 ? (
            <EmptyState message="No vows made yet." />
          ) : (
            <VowsTable rows={rows} />
          )}
        </section>
      </div>
    </main>
  );
}
