import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, EmptyState, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { DossiersTable } from "./dossiers-table";
import { GeneratePanel } from "./generate-panel";

export const metadata = {
  title: "YiFi Dossier Pipeline",
};

export interface DossierRegistrant {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
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

/** Phone is not on the existing list RPC; this is the shape we merge in. */
interface RegistrantPhoneRow {
  id: string;
  phone: string | null;
}

export default async function DossierPipelinePage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "dossiers")) {
    return <AccessDenied permission="dossiers" />;
  }

  const svc = await createServiceClient();

  // Board rows (existing list RPC) + a phone lookup (engine's own RPC) so the
  // per-row Deliver button has a number to send to without changing the
  // shared list RPC.
  const [{ data: listData }, { data: registrantData }] = await Promise.all([
    svc.rpc("yifi_admin_list_dossiers", { p_edition_id: ctx.editionId }),
    svc.rpc("yifi_get_registrants_for_dossier", { p_edition_id: ctx.editionId }),
  ]);

  const rawRows: DossierRow[] = Array.isArray(listData)
    ? (listData as DossierRow[])
    : [];

  const phoneById = new Map<string, string | null>();
  if (Array.isArray(registrantData)) {
    for (const r of registrantData as RegistrantPhoneRow[]) {
      phoneById.set(r.id, r.phone ?? null);
    }
  }

  // Merge phone into each row's registrant so the table can deliver.
  const rows: DossierRow[] = rawRows.map((row) => ({
    ...row,
    registrant: row.registrant
      ? { ...row.registrant, phone: phoneById.get(row.registrant.id) ?? row.registrant.phone ?? null }
      : null,
  }));

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

        {/* Generate control */}
        <GeneratePanel />

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
            <EmptyState message="No dossiers generated yet. Use Generate above once the summit's session content and census are in." />
          ) : (
            <DossiersTable rows={rows} />
          )}
        </section>
      </div>
    </main>
  );
}
