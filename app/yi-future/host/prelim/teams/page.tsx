import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";

type TeamMember = {
  delegate_id: string;
  role_in_team: string | null;
  delegates: { full_name: string; email: string | null } | null;
};

type Team = {
  id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  problem_statement_id: string | null;
  problem_statements: { title: string } | null;
  team_members: TeamMember[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  forming: { label: "Forming", color: "bg-navy/10 text-navy/60" },
  problem_selected: {
    label: "Problem Selected",
    color: "bg-blue-100 text-blue-700",
  },
  frozen: { label: "Frozen", color: "bg-purple-100 text-purple-700" },
  evaluated: { label: "Evaluated", color: "bg-yi-gold/20 text-yi-gold" },
  advanced: { label: "Advanced", color: "bg-yi-green/20 text-yi-green" },
};

async function getChapterTeams(
  chapterId: string,
  editionId: string
): Promise<Team[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, status, captain_id, problem_statement_id, problem_statements(title), team_members(delegate_id, role_in_team, delegates(full_name, email))"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .in("status", [
      "problem_selected",
      "frozen",
      "evaluated",
      "advanced",
    ])
    .order("team_name");

  return (data as unknown as Team[]) ?? [];
}

export default async function PrelimTeamsPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/login");

  const teams = await getChapterTeams(ctx.chapterId, ctx.editionId);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-1">
          Chapter Prelim
        </div>
        <h2 className="text-2xl font-bold text-navy">
          Prelim Teams
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {teams.length} team(s) from {ctx.chapterName} in{" "}
          {ctx.editionName}
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No teams with problem selected yet. Teams will appear here once
          delegates form teams and select their problem statements.
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const captain = team.team_members.find(
              (m) => m.delegate_id === team.captain_id
            );
            const statusInfo =
              STATUS_LABELS[team.status ?? ""] ?? {
                label: team.status ?? "Unknown",
                color: "bg-navy/10 text-navy/60",
              };

            return (
              <div
                key={team.id}
                className="bg-white border border-navy/10 rounded-lg p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-navy text-lg">
                      {team.team_name}
                    </h3>
                    {team.problem_statements?.title && (
                      <p className="text-sm text-navy/60 mt-0.5">
                        {team.problem_statements.title}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {captain && (
                  <div className="text-xs text-navy/50 mb-3">
                    Captain:{" "}
                    <span className="font-semibold text-navy">
                      {captain.delegates?.full_name ?? "Unknown"}
                    </span>
                  </div>
                )}

                <div className="border-t border-navy/5 pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-navy/60 p-2">
                          Member
                        </th>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-navy/60 p-2">
                          Role
                        </th>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-navy/60 p-2">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.team_members.map((m) => (
                        <tr
                          key={m.delegate_id}
                          className="border-t border-navy/5"
                        >
                          <td className="p-2 font-semibold text-navy">
                            {m.delegates?.full_name ?? "Unknown"}
                            {m.delegate_id === team.captain_id && (
                              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-yi-gold">
                                CPT
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-navy/60 text-xs">
                            {m.role_in_team ?? "—"}
                          </td>
                          <td className="p-2 text-navy/50 text-xs">
                            {m.delegates?.email ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
