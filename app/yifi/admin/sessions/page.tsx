import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { SessionForm } from "./session-form";
import { SessionsTable, type AdminSession } from "./sessions-table";

export const metadata = {
  title: "YiFi Admin · Sessions & Transcripts",
};

export default async function YiFiSessionsPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "sessions")) {
    return <AccessDenied permission="sessions" />;
  }

  const svc = await createServiceClient();
  const { data } = await svc.rpc("yifi_admin_list_sessions", {
    p_edition_id: ctx.editionId,
  });

  const rows: AdminSession[] = Array.isArray(data) ? (data as AdminSession[]) : [];

  const total = rows.length;
  const withTranscript = rows.filter((r) => r.has_transcript).length;
  const consented = rows.filter((r) => r.consent_archiving).length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Sessions & Transcripts" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Explainer */}
        <p className="text-white/50 text-sm max-w-3xl">
          Sessions are the raw material the AI dossier engine filters per
          attendee. Enter each stage session here and paste/link its transcript
          after the event.
        </p>

        {/* Stat tiles */}
        <section>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Total" value={total} />
            <StatTile label="With transcript" value={withTranscript} />
            <StatTile label="Consented" value={consented} />
          </div>
        </section>

        {/* Add new */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Add a session</h2>
          <SessionForm />
        </section>

        {/* Existing sessions */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Sessions ({total})
          </h2>
          <SessionsTable rows={rows} />
        </section>
      </div>
    </main>
  );
}
