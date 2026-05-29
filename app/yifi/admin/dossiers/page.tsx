import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, EmptyState, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { DossiersTable } from "./dossiers-table";

export const metadata = {
  title: "YiFi Dossier Pipeline",
};

export interface DossierRegistrant {
  id: string;
  full_name: string | null;
  email: string | null;
  organisation: string | null;
}

export interface DossierRow {
  id: string;
  status: string | null;
  delivered_at: string | null;
  viewed_at: string | null;
  view_count: number | null;
  created_at: string | null;
  registrant: DossierRegistrant | null;
}

export default async function DossierPipelinePage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "dossiers")) {
    return <AccessDenied permission="dossiers" />;
  }

  const svc = await createServiceClient();
  const { data } = await svc.rpc("yifi_admin_list_dossiers", {
    p_edition_id: ctx.editionId,
  });

  const rows: DossierRow[] = Array.isArray(data) ? (data as DossierRow[]) : [];

  const total = rows.length;
  const delivered = rows.filter((r) => r.delivered_at != null).length;
  const viewed = rows.filter((r) => (r.view_count ?? 0) > 0).length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Dossier Pipeline" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Explainer */}
        <p className="text-white/50 text-sm max-w-3xl">
          Dossiers are the personalised post-event content generated for each
          attendee — sector-filtered session takeaways drawn from the summit&apos;s
          content, then delivered to each person on WhatsApp.
        </p>

        {/* Stat tiles */}
        <section>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total" value={total} />
            <StatTile label="Delivered" value={delivered} />
            <StatTile label="Viewed" value={viewed} />
          </div>
        </section>

        {/* Pipeline */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Dossiers ({total})
          </h2>
          {rows.length === 0 ? (
            <EmptyState message="No dossiers generated yet. They are produced after the summit from session content." />
          ) : (
            <DossiersTable rows={rows} />
          )}
        </section>
      </div>
    </main>
  );
}
