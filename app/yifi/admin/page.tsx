import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { LogoutButton } from "./logout-button";

export const metadata = {
  title: "YiFi Admin",
};

async function getOrganiserAccess(email: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_check_organiser", {
    p_email: email,
    p_edition_id: await getEditionId(),
  });
  return data;
}

async function getEditionId() {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_current_edition");
  return data?.id;
}

async function getOrganisers(editionId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_list_organisers", { p_edition_id: editionId });
  return data ?? [];
}

async function getStats(editionId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase.rpc("yifi_get_stats", { p_edition_id: editionId });
  return data;
}

export default async function YiFiAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/yifi/login");

  const editionId = await getEditionId();
  if (!editionId) {
    return (
      <main className="min-h-screen bg-[#000066] flex items-center justify-center">
        <p className="text-white/50">No active YiFi edition found.</p>
      </main>
    );
  }

  const [roles, organisers, stats] = await Promise.all([
    getOrganiserAccess(user.email),
    getOrganisers(editionId),
    getStats(editionId),
  ]);

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return (
      <main className="min-h-screen bg-[#000066] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm mb-4">
            {user.email} is not an organiser for YiFi 2026.
          </p>
          <Link href="/yifi" className="text-[#FD7215] hover:underline text-sm">
            ← Back to YiFi
          </Link>
        </div>
      </main>
    );
  }

  const userRoles = roles.map((r: any) => r.role).join(", ");
  const permissions = [...new Set(roles.flatMap((r: any) => r.permissions || []))];

  return (
    <main className="min-h-screen bg-[#000066]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/yifi" className="text-[#FD7215] font-bold text-lg">YiFi</Link>
            <span className="text-white/30">·</span>
            <span className="text-white/50 text-sm">Event Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-xs">{userRoles}</span>
            <span className="text-white/70 text-sm">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Live Stats */}
        {permissions.includes("stats") && stats && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Live Event Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Registrants" value={stats.total_registrants} />
              <StatCard label="Census Complete" value={`${stats.problem_clusters} clusters`} />
              <StatCard label="Matches Made" value={stats.introductions_made} />
              <StatCard label="Vows" value={stats.vows_made} />
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Event Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {permissions.includes("registrants") && (
              <ActionCard
                title="Registrants"
                desc="View and manage all YiFi registrants, check-in status, census completion"
                href="/yifi/admin/registrants"
                icon="👥"
              />
            )}
            {permissions.includes("census") && (
              <ActionCard
                title="Census Monitor"
                desc="Track census completion rate, nudge incomplete registrants"
                href="/yifi/admin/census"
                icon="📊"
              />
            )}
            {permissions.includes("matches") && (
              <ActionCard
                title="Match Curation"
                desc="Review and curate 1-on-1 routing matches, assign slots and tables"
                href="/yifi/admin/matches"
                icon="🎯"
              />
            )}
            {permissions.includes("vows") && (
              <ActionCard
                title="Vow Wall"
                desc="Monitor vow submissions, track engraving and tile placement"
                href="/yifi/admin/vows"
                icon="🪨"
              />
            )}
            {permissions.includes("reveal") && (
              <ActionCard
                title="Reveal Screen"
                desc="Control the live reveal display — open in projector mode"
                href="/yifi/reveal"
                icon="📺"
                external
              />
            )}
            {permissions.includes("dossiers") && (
              <ActionCard
                title="Dossier Pipeline"
                desc="Monitor personalised dossier generation and delivery status"
                href="/yifi/admin/dossiers"
                icon="📋"
              />
            )}
          </div>
        </section>

        {/* Organiser Team */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Organising Team</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">Chapter</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">Access</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(organisers) ? organisers : []).map((org: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white">{org.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        org.role === "architect" ? "bg-[#FD7215]/20 text-[#FD7215]" :
                        org.role === "host_chair" ? "bg-[#229434]/20 text-[#229434]" :
                        org.role.startsWith("national") ? "bg-purple-500/20 text-purple-400" :
                        "bg-white/10 text-white/60"
                      }`}>
                        {org.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden md:table-cell">{org.chapter_name || "National"}</td>
                    <td className="px-4 py-3 text-white/30 text-xs hidden md:table-cell">
                      {org.permissions?.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Yi Connect link */}
        <section className="border-t border-white/10 pt-8">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-[#FD7215] text-sm hover:underline">
              ← Yi Connect Dashboard
            </Link>
            <Link href="/yifi" className="text-white/50 text-sm hover:text-white/70">
              Public YiFi Page →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-[#FD7215]">{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

function ActionCard({ title, desc, href, icon, external }: {
  title: string; desc: string; href: string; icon: string; external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-[#FD7215]/30 transition-colors block"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <p className="text-white/50 text-sm">{desc}</p>
    </Link>
  );
}
