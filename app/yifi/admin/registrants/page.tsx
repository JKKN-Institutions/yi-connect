import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, EmptyState, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { RegistrantsTable, type Registrant } from "./registrants-table";

export const metadata = {
  title: "Registrants · YiFi Admin",
};

export default async function RegistrantsPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "registrants")) {
    return <AccessDenied permission="registrants" />;
  }

  const svc = await createServiceClient();
  const { data } = await svc.rpc("yifi_admin_list_registrants", {
    p_edition_id: ctx.editionId,
  });
  const rows: Registrant[] = Array.isArray(data) ? data : [];

  const total = rows.length;
  const checkedIn = rows.filter((r) => r.checked_in).length;
  const censusComplete = rows.filter((r) => r.census_complete).length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Registrants" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <section>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total" value={total} />
            <StatTile label="Checked In" value={checkedIn} />
            <StatTile label="Census Complete" value={censusComplete} />
          </div>
        </section>

        {rows.length === 0 ? (
          <EmptyState message="No registrants yet." />
        ) : (
          <RegistrantsTable rows={rows} />
        )}
      </div>
    </main>
  );
}
