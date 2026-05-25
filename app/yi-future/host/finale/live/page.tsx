import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  aggregateEvaluations,
  rankTeams,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";
import { AdvanceTeamButton } from "./advance-button";

/* ── types ─────────────────────────────────────────────────── */

type FinalistTeam = {
  team_id: string;
  total_score: number | null;
  rank: number | null;
  teams: {
    id: string;
    team_name: string;
    status: string | null;
    chapters: { name: string } | null;
    problem_statements: { title: string } | null;
  } | null;
};

type Evaluation = {
  team_id: string;
  jury_id: string;
  criteria_scores: CriteriaScores;
  total_score: number;
  status: string | null;
  jury_assignments: { jury_name: string; archetype: string } | null;
};

type JuryMember = {
  id: string;
  jury_name: string;
  archetype: string;
  is_active: boolean | null;
};

type RubricRow = {
  id: string;
  total_max: number | null;
  threshold_for_national: number | null;
};

/* ── data fetching ─────────────────────────────────────────── */

async function getFinalistTeams(
  toEventId: string,
  hostFinaleRegion: string
): Promise<FinalistTeam[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "team_id, total_score, rank, teams(id, team_name, status, chapters(name), problem_statements(title))"
    )
    .eq("to_event_id", toEventId)
    .order("rank", { ascending: true });

  return (data as unknown as FinalistTeam[]) ?? [];
}

async function getFinaleEvaluations(eventId: string): Promise<Evaluation[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "team_id, jury_id, criteria_scores, total_score, status, jury_assignments(jury_name, archetype)"
    )
    .eq("event_id", eventId);
  return (data as unknown as Evaluation[]) ?? [];
}

async function getEventJury(eventId: string): Promise<JuryMember[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("id, jury_name, archetype, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true);
  return (data as unknown as JuryMember[]) ?? [];
}

async function getFinaleRubric(
  editionId: string
): Promise<RubricRow | null> {
  const svc = await createServiceClient();
  // Try national-scope rubric first, fall back to default
  const { data: national } = await svc
    .schema("future")
    .from("rubrics")
    .select("id, total_max, threshold_for_national")
    .eq("edition_id", editionId)
    .eq("scope", "national")
    .eq("is_default", true)
    .maybeSingle();
  if (national) return national as unknown as RubricRow;

  const { data: fallback } = await svc
    .schema("future")
    .from("rubrics")
    .select("id, total_max, threshold_for_national")
    .eq("edition_id", editionId)
    .eq("is_default", true)
    .maybeSingle();
  return (fallback as unknown as RubricRow) ?? null;
}

async function getHostFinaleRegion(chapterId: string): Promise<string | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("finale_region")
    .eq("id", chapterId)
    .single();
  return (data as unknown as { finale_region: string | null } | null)
    ?.finale_region ?? null;
}

/* ── page ──────────────────────────────────────────────────── */

export default async function FinaleLivePage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/login");
  if (!ctx.isHost) redirect("/yi-future/host");
  if (!ctx.nationalEvent) redirect("/yi-future/host");

  const eventId = ctx.nationalEvent.id;
  const hostFinaleRegion = await getHostFinaleRegion(ctx.chapterId);
  if (!hostFinaleRegion) redirect("/yi-future/host");

  const [finalists, evals, juryMembers, rubric] = await Promise.all([
    getFinalistTeams(eventId, hostFinaleRegion),
    getFinaleEvaluations(eventId),
    getEventJury(eventId),
    getFinaleRubric(ctx.editionId),
  ]);

  const totalJury = juryMembers.length;
  const totalMax = rubric?.total_max ?? 100;

  // Group evaluations by team (only submitted)
  const evalsByTeam = new Map<string, Evaluation[]>();
  for (const e of evals) {
    if (e.status !== "submitted") continue;
    if (!evalsByTeam.has(e.team_id)) evalsByTeam.set(e.team_id, []);
    evalsByTeam.get(e.team_id)!.push(e);
  }

  // Build leaderboard rows
  const rows = finalists.map((f) => {
    const teamEvals = evalsByTeam.get(f.team_id) ?? [];
    const agg = aggregateEvaluations(teamEvals);
    return {
      team_id: f.team_id,
      team_name: f.teams?.team_name ?? "(unnamed)",
      chapter: f.teams?.chapters?.name ?? "—",
      problem: f.teams?.problem_statements?.title ?? "—",
      status: f.teams?.status ?? "advanced",
      juryScored: agg.count,
      total: agg.averageTotal,
      chapterScore: f.total_score,
    };
  });

  const rankedRows = rankTeams(rows.filter((r) => r.juryScored > 0));
  const rankByTeam = new Map(rankedRows.map((r) => [r.team_id, r.rank]));

  // Sort: ranked teams first (by rank), then unscored teams
  const sortedRows = [...rows].sort((a, b) => {
    const ra = rankByTeam.get(a.team_id) ?? 999;
    const rb = rankByTeam.get(b.team_id) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.team_name.localeCompare(b.team_name);
  });

  const scoredCount = rows.filter((r) => r.juryScored > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-1">
          Regional Finale
        </div>
        <h2 className="text-2xl font-bold text-navy">Finale Live</h2>
        <p className="mt-1 text-sm text-navy/60">
          {ctx.chapterName} &middot;{" "}
          <span className="inline-flex items-center gap-1">
            {ctx.trackIcon ?? "•"} {ctx.trackName}
          </span>{" "}
          &middot; {finalists.length} finalist team(s)
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Finalist Teams
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">
            {finalists.length}
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Active Jury
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">{totalJury}</div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Teams Scored
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">
            {scoredCount}{" "}
            <span className="text-sm font-normal text-navy/40">
              / {finalists.length}
            </span>
          </div>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
            Max Score
          </div>
          <div className="mt-1 text-2xl font-bold text-navy">{totalMax}</div>
        </div>
      </div>

      {/* Leaderboard */}
      {finalists.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No finalist teams yet. Teams will appear once chapters publish their
          shortlists.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRows.map((row) => {
            const rank = rankByTeam.get(row.team_id);
            const pct =
              totalJury > 0
                ? Math.round((row.juryScored / totalJury) * 100)
                : 0;

            return (
              <div
                key={row.team_id}
                className="bg-white border border-navy/10 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: rank + team info */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center">
                      {rank ? (
                        <span className="text-sm font-bold text-navy">
                          #{rank}
                        </span>
                      ) : (
                        <span className="text-xs text-navy/30">—</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-navy truncate">
                        {row.team_name}
                      </div>
                      <div className="text-xs text-navy/60 mt-0.5">
                        {row.chapter}
                      </div>
                      <div className="text-xs text-navy/40 mt-0.5 truncate">
                        {row.problem}
                      </div>
                    </div>
                  </div>

                  {/* Right: scores + status */}
                  <div className="flex-shrink-0 text-right space-y-1">
                    {row.juryScored > 0 ? (
                      <div className="font-mono font-bold text-lg text-navy">
                        {row.total}{" "}
                        <span className="text-xs font-normal text-navy/40">
                          / {totalMax}
                        </span>
                      </div>
                    ) : (
                      <div className="font-mono text-lg text-navy/30">—</div>
                    )}

                    {row.chapterScore != null && (
                      <div className="text-[10px] text-navy/40">
                        chapter: {row.chapterScore}
                      </div>
                    )}

                    {row.status === "advanced" && (
                      <span className="bg-yi-green/10 text-yi-green px-2 py-0.5 rounded-full text-xs font-bold">
                        Advanced
                      </span>
                    )}
                  </div>
                </div>

                {/* Scoring progress bar */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-navy/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yi-gold transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-navy/60 whitespace-nowrap">
                    {row.juryScored}/{totalJury} jury scored
                  </div>
                </div>

                {/* Per-jury breakdown (collapsed) */}
                {row.juryScored > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 cursor-pointer hover:text-navy/60">
                      Jury breakdown
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {(evalsByTeam.get(row.team_id) ?? []).map((e) => (
                        <li
                          key={`${e.team_id}-${e.jury_id}`}
                          className="flex items-center justify-between p-2 border border-navy/5 rounded text-sm"
                        >
                          <div>
                            <span className="font-semibold text-navy">
                              {e.jury_assignments?.jury_name ?? "—"}
                            </span>
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                              {e.jury_assignments?.archetype ?? ""}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-navy">
                            {e.total_score} / {totalMax}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Advancement decisions section */}
      {scoredCount > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-navy">
            Advancement Decisions
          </h3>
          <p className="text-xs text-navy/60">
            Mark teams that will advance to the National Finals. This is a
            manual decision by the host admin.
          </p>
          <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Rank</th>
                  <th className="text-left px-4 py-3 font-semibold">Team</th>
                  <th className="text-left px-4 py-3 font-semibold">
                    Chapter
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Avg Score
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Jury
                  </th>
                  <th className="text-center px-4 py-3 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows
                  .filter((r) => r.juryScored > 0)
                  .map((row) => {
                    const rank = rankByTeam.get(row.team_id);
                    return (
                      <tr
                        key={row.team_id}
                        className="border-t border-navy/5"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-navy">
                          {rank ? `#${rank}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-navy">
                          {row.team_name}
                        </td>
                        <td className="px-4 py-3 text-xs text-navy/60">
                          {row.chapter}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-navy">
                          {row.total} / {totalMax}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-navy/60">
                          {row.juryScored}/{totalJury}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <AdvanceTeamButton
                            teamId={row.team_id}
                            teamName={row.team_name}
                            currentStatus={row.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
