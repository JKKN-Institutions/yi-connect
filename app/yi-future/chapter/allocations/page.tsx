import Link from "next/link";
import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  getAllocationMatrix,
  allocateProblem,
  autoAllocate,
  type MatrixProblem,
} from "@/app/yi-future/actions/allocations";
import { MIN_TEAMS_PER_PROBLEM } from "@/lib/yi-future/constants";

// Yi palette per-track color treatment. Cycles in track display order.
const TRACK_COLORS = [
  {
    band: "bg-navy text-ivory",
    cellBorder: "border-navy/15",
    cellHover: "hover:border-navy/60 hover:bg-navy/5",
    pillBg: "bg-navy/10 text-navy",
  },
  {
    band: "bg-yi-gold text-navy",
    cellBorder: "border-yi-gold/30",
    cellHover: "hover:border-yi-gold/70 hover:bg-yi-gold/10",
    pillBg: "bg-yi-gold/15 text-navy",
  },
  {
    band: "bg-yi-saffron text-navy",
    cellBorder: "border-yi-saffron/30",
    cellHover: "hover:border-yi-saffron/70 hover:bg-yi-saffron/10",
    pillBg: "bg-yi-saffron/15 text-navy",
  },
  {
    band: "bg-yi-green text-ivory",
    cellBorder: "border-yi-green/30",
    cellHover: "hover:border-yi-green/70 hover:bg-yi-green/10",
    pillBg: "bg-yi-green/15 text-yi-green",
  },
] as const;

export default async function AllocationsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const matrix = await getAllocationMatrix(ctx.chapterId, ctx.editionId);

  // Lookup helpers
  const problemById = new Map(matrix.problems.map((p) => [p.id, p]));

  // Group problems by track in encountered order. Per Piyush 2026-05-06,
  // every chapter sees all 4 tracks × 3 problems = 12 columns.
  const trackOrder: string[] = [];
  const trackMeta: Record<
    string,
    { id: string; name: string; icon: string | null; problems: MatrixProblem[] }
  > = {};
  for (const p of matrix.problems) {
    if (!trackMeta[p.track_id]) {
      trackOrder.push(p.track_id);
      trackMeta[p.track_id] = {
        id: p.track_id,
        name: p.track_name,
        icon: p.track_icon,
        problems: [],
      };
    }
    trackMeta[p.track_id].problems.push(p);
  }
  const trackColorFor = (trackId: string) => {
    const idx = trackOrder.indexOf(trackId);
    return TRACK_COLORS[idx % TRACK_COLORS.length];
  };

  async function allocateAction(formData: FormData) {
    "use server";
    const teamId = String(formData.get("team_id") ?? "");
    const problemId = String(formData.get("problem_id") ?? "");
    if (!teamId || !problemId) return;
    await allocateProblem(teamId, problemId);
  }

  async function autoAction() {
    "use server";
    await autoAllocate(ctx!.chapterId, ctx!.editionId);
  }

  const totalTeams = matrix.teams.length;
  const allocatedTeams = Object.keys(matrix.allocations).length;
  const unallocatedTeams = totalTeams - allocatedTeams;

  // Distribution warnings: any problem with > MIN_TEAMS_PER_PROBLEM allocations
  const overloaded = matrix.problems.filter(
    (p) => (matrix.problemStats[p.id]?.allocated_count ?? 0) > MIN_TEAMS_PER_PROBLEM
  );

  // Map for quick reverse lookup of preference rank by team & problem
  const prefRankByTeamProblem = new Map<string, 1 | 2 | 3>();
  for (const [tid, slot] of Object.entries(matrix.preferences)) {
    if (slot[1]) prefRankByTeamProblem.set(`${tid}:${slot[1]}`, 1);
    if (slot[2]) prefRankByTeamProblem.set(`${tid}:${slot[2]}`, 2);
    if (slot[3]) prefRankByTeamProblem.set(`${tid}:${slot[3]}`, 3);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-navy">Problem allocation</h2>
          <p className="mt-1 text-sm text-navy/60">
            Every chapter has all 4 tracks × 3 problems = 12 problem statements.
            Click any cell to allocate that problem to that team. Aim for ≤{" "}
            {MIN_TEAMS_PER_PROBLEM} teams per problem.
          </p>
          <p className="mt-2 text-xs text-navy/50">
            {allocatedTeams} of {totalTeams} teams allocated · {unallocatedTeams}{" "}
            pending
          </p>
        </div>
        <form action={autoAction}>
          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Auto-allocate all
          </button>
        </form>
      </div>

      {overloaded.length > 0 && (
        <div className="bg-yi-saffron/10 border border-yi-saffron/30 rounded-lg p-4 text-sm text-navy">
          <strong>Distribution warning:</strong>{" "}
          {overloaded.length} problem
          {overloaded.length === 1 ? " has" : "s have"} more than{" "}
          {MIN_TEAMS_PER_PROBLEM} teams allocated. Consider re-balancing for the
          finale (CPB §8).
          <ul className="mt-2 ml-5 list-disc text-xs">
            {overloaded.map((p) => (
              <li key={p.id}>
                {p.track_name} — {p.title} —{" "}
                <strong>
                  {matrix.problemStats[p.id].allocated_count} teams
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Distribution helper: 12 numbers, grouped by track, saffron warning if over cap */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Teams allocated per problem
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trackOrder.map((tid) => {
            const meta = trackMeta[tid];
            const colors = trackColorFor(tid);
            return (
              <div key={tid} className="rounded-md overflow-hidden border border-navy/10">
                <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${colors.band}`}>
                  <span className="mr-1">{meta.icon ?? "•"}</span>
                  {meta.name}
                </div>
                <div className="grid grid-cols-3 divide-x divide-navy/10 bg-white">
                  {meta.problems.map((p) => {
                    const stat = matrix.problemStats[p.id] ?? {
                      allocated_count: 0,
                      preferred_count: 0,
                    };
                    const over = stat.allocated_count > MIN_TEAMS_PER_PROBLEM;
                    return (
                      <div
                        key={p.id}
                        className={`p-3 text-center ${
                          over ? "bg-yi-saffron/10" : ""
                        }`}
                        title={p.title}
                      >
                        <div
                          className={`text-2xl font-bold ${
                            over ? "text-yi-saffron" : "text-navy"
                          }`}
                        >
                          {stat.allocated_count}
                        </div>
                        <div className="text-[10px] text-navy/50 line-clamp-2 mt-0.5">
                          {p.title}
                        </div>
                        <div className="text-[10px] text-navy/40 mt-0.5">
                          {stat.preferred_count} ranked
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Allocation matrix: rows = teams, cols = 12 problems grouped by track */}
      {matrix.teams.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No teams in this chapter yet.
        </div>
      ) : matrix.problems.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No problem statements published yet.
        </div>
      ) : (
        <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                {/* Row 1: Track band headers spanning each track's 3 problem columns */}
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-white px-3 py-2 text-left text-xs uppercase tracking-widest text-navy/60 border-b border-navy/10"
                    style={{ minWidth: "180px" }}
                  >
                    Team
                  </th>
                  {trackOrder.map((tid) => {
                    const meta = trackMeta[tid];
                    const colors = trackColorFor(tid);
                    return (
                      <th
                        key={tid}
                        colSpan={meta.problems.length}
                        className={`px-3 py-2 text-center text-xs uppercase tracking-wider font-bold ${colors.band}`}
                      >
                        <span className="mr-1">{meta.icon ?? "•"}</span>
                        {meta.name}
                      </th>
                    );
                  })}
                </tr>
                {/* Row 2: per-problem column headers */}
                <tr className="bg-navy/5">
                  <th
                    className="sticky left-0 z-20 bg-navy/5 px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy/60 border-b border-navy/10"
                    style={{ minWidth: "180px" }}
                  >
                    &nbsp;
                  </th>
                  {trackOrder.map((tid) =>
                    trackMeta[tid].problems.map((p) => (
                      <th
                        key={p.id}
                        className="px-2 py-2 text-left text-[10px] font-semibold text-navy/70 border-b border-navy/10 align-top"
                        style={{ minWidth: "150px", maxWidth: "180px" }}
                        title={p.title}
                      >
                        <span className="line-clamp-3 normal-case font-semibold">
                          {p.title}
                        </span>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {matrix.teams.map((team) => {
                  const allocId = matrix.allocations[team.id];

                  return (
                    <tr key={team.id} className="align-top hover:bg-navy/[0.02]">
                      <td
                        className="sticky left-0 z-10 bg-white px-3 py-3 border-r border-navy/10"
                        style={{ minWidth: "180px" }}
                      >
                        <div className="font-semibold text-navy text-sm">
                          {team.team_name}
                        </div>
                        <div className="text-[11px] text-navy/50">
                          {team.captain_name ?? "no captain"} ·{" "}
                          {team.member_count} member
                          {team.member_count === 1 ? "" : "s"}
                        </div>
                        {team.is_frozen && (
                          <span className="mt-1 inline-block text-[10px] font-semibold bg-navy/10 text-navy/70 px-1.5 py-0.5 rounded">
                            FROZEN
                          </span>
                        )}
                        {allocId && (
                          <div className="mt-1 text-[10px] text-yi-green font-semibold flex items-center gap-1">
                            <span>✓</span>
                            <span className="line-clamp-1">
                              {problemById.get(allocId)?.title ?? "allocated"}
                            </span>
                          </div>
                        )}
                      </td>
                      {trackOrder.map((tid) =>
                        trackMeta[tid].problems.map((prob) => {
                          const colors = trackColorFor(tid);
                          const isAllocated = allocId === prob.id;
                          const prefRank = prefRankByTeamProblem.get(
                            `${team.id}:${prob.id}`
                          );
                          return (
                            <td
                              key={prob.id}
                              className="p-1.5 align-top"
                              style={{ minWidth: "150px", maxWidth: "180px" }}
                            >
                              <form action={allocateAction}>
                                <input
                                  type="hidden"
                                  name="team_id"
                                  value={team.id}
                                />
                                <input
                                  type="hidden"
                                  name="problem_id"
                                  value={prob.id}
                                />
                                <button
                                  type="submit"
                                  disabled={isAllocated}
                                  className={`min-h-[44px] w-full text-left text-xs leading-snug rounded p-2 transition-colors border ${
                                    isAllocated
                                      ? "bg-yi-gold/25 border-yi-gold cursor-default"
                                      : `${colors.cellBorder} ${colors.cellHover}`
                                  }`}
                                  title={`Allocate "${prob.title}" to ${team.team_name}`}
                                >
                                  {isAllocated ? (
                                    <span className="font-bold text-navy text-[11px]">
                                      ✓ ALLOCATED
                                    </span>
                                  ) : prefRank ? (
                                    <span
                                      className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.pillBg}`}
                                    >
                                      Pref #{prefRank}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-navy/30">
                                      —
                                    </span>
                                  )}
                                </button>
                              </form>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-navy/10 bg-navy/[0.02] text-[11px] text-navy/50 sm:hidden">
            ← Scroll horizontally to see all 12 problems →
          </div>
        </section>
      )}

      <div className="text-xs text-navy/50">
        <Link
          href="/yi-future/chapter/teams"
          className="font-semibold hover:text-navy"
        >
          ← Back to teams
        </Link>
      </div>
    </div>
  );
}
