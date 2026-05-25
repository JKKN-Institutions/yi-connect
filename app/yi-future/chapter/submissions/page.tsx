import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { PHASES, PHASE_LABELS, type Phase } from "@/lib/yi-future/constants";

type SubRow = {
  team_id: string;
  phase: Phase;
  status: string | null;
  submitted_at: string | null;
  teams: { team_name: string } | null;
};

type TeamRow = { id: string; team_name: string };

async function getTeams(
  chapterId: string,
  editionId: string
): Promise<TeamRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as TeamRow[]) ?? [];
}

async function getSubs(
  chapterId: string,
  editionId: string
): Promise<SubRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("submissions")
    .select("team_id, phase, status, submitted_at, teams!inner(team_name, chapter_id, edition_id)")
    .eq("teams.chapter_id", chapterId)
    .eq("teams.edition_id", editionId);
  return (data as unknown as SubRow[]) ?? [];
}

const STATUS_CELL: Record<string, string> = {
  "": "bg-navy/5 text-navy/30",
  draft: "bg-navy/10 text-navy/50",
  submitted: "bg-yi-saffron/15 text-yi-saffron",
  approved: "bg-yi-green/15 text-yi-green",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  "": "—",
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function SubmissionsMatrixPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [teams, subs] = await Promise.all([
    getTeams(ctx.chapterId, ctx.editionId),
    getSubs(ctx.chapterId, ctx.editionId),
  ]);

  // Index by (team_id, phase)
  const matrix = new Map<string, Map<Phase, SubRow>>();
  for (const s of subs) {
    if (!matrix.has(s.team_id)) matrix.set(s.team_id, new Map());
    matrix.get(s.team_id)!.set(s.phase, s);
  }

  const pendingCount = subs.filter((s) => s.status === "submitted").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Submissions</h2>
          <p className="mt-1 text-sm text-navy/60">
            {teams.length} teams · {pendingCount} awaiting review
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50 text-sm">
          No teams yet — create teams first.
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Team</th>
                {PHASES.map((p) => (
                  <th key={p} className="text-left px-4 py-3 font-semibold">
                    {PHASE_LABELS[p].replace(/ — .*/, "")}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-semibold">View</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-t border-navy/5">
                  <td className="px-4 py-3 font-semibold">{t.team_name}</td>
                  {PHASES.map((p) => {
                    const s = matrix.get(t.id)?.get(p);
                    const status = s?.status ?? "";
                    return (
                      <td key={p} className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest ${
                            STATUS_CELL[status] ?? STATUS_CELL[""]
                          }`}
                        >
                          {STATUS_LABEL[status] ?? "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/yi-future/chapter/submissions/${t.id}`}
                      className="text-xs font-semibold text-navy hover:text-yi-gold"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
