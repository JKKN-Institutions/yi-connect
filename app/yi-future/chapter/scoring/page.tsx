import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  aggregateEvaluations,
  meetsThreshold,
  rankTeams,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";

type Team = {
  id: string;
  team_name: string;
  problem_statement_id: string | null;
  problem_statements: { title: string } | null;
};

type Evaluation = {
  team_id: string;
  jury_id: string;
  criteria_scores: CriteriaScores;
  total_score: number;
  status: string | null;
  jury_assignments: { jury_name: string; archetype: string } | null;
};

type RubricRow = {
  id: string;
  total_max: number | null;
  threshold_for_national: number | null;
};

async function getTeams(
  chapterId: string,
  editionId: string
): Promise<Team[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, problem_statement_id, problem_statements(title)"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as Team[]) ?? [];
}

async function getEvaluations(
  chapterId: string,
  editionId: string
): Promise<Evaluation[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "team_id, jury_id, criteria_scores, total_score, status, teams!inner(chapter_id, edition_id), jury_assignments(jury_name, archetype)"
    )
    .eq("teams.chapter_id", chapterId)
    .eq("teams.edition_id", editionId);
  return (data as unknown as Evaluation[]) ?? [];
}

async function getDefaultRubric(editionId: string): Promise<RubricRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("rubrics")
    .select("id, total_max, threshold_for_national")
    .eq("edition_id", editionId)
    .eq("scope", "chapter_final")
    .eq("is_default", true)
    .maybeSingle();
  return (data as unknown as RubricRow) ?? null;
}

export default async function ScoringPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [teams, evals, rubric] = await Promise.all([
    getTeams(ctx.chapterId, ctx.editionId),
    getEvaluations(ctx.chapterId, ctx.editionId),
    getDefaultRubric(ctx.editionId),
  ]);

  // Group evals by team
  const byTeam = new Map<string, Evaluation[]>();
  for (const e of evals) {
    if (e.status !== "submitted") continue;
    if (!byTeam.has(e.team_id)) byTeam.set(e.team_id, []);
    byTeam.get(e.team_id)!.push(e);
  }

  const teamAggregates = teams.map((t) => {
    const list = byTeam.get(t.id) ?? [];
    const agg = aggregateEvaluations(list);
    return {
      team_id: t.id,
      team_name: t.team_name,
      problem_title: t.problem_statements?.title ?? "—",
      count: agg.count,
      total: agg.averageTotal,
      clears:
        rubric && list.length > 0
          ? meetsThreshold(agg.averageTotal, {
              name: "",
              criteria: [],
              total_max: rubric.total_max ?? 0,
              threshold_for_national: rubric.threshold_for_national ?? 0,
            })
          : false,
    };
  });

  const ranked = rankTeams(teamAggregates.filter((a) => a.count > 0));
  const rankByTeam = new Map(ranked.map((r) => [r.team_id, r.rank]));

  const totalMax = rubric?.total_max ?? 100;
  const threshold = rubric?.threshold_for_national ?? 70;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-1">
            Visible to chapter admin only
          </div>
          <h2 className="text-2xl font-bold text-navy">Scoring</h2>
          <p className="mt-1 text-sm text-navy/60">
            Evaluations averaged across jurors. Threshold {threshold}/
            {totalMax} to advance to nationals.
          </p>
        </div>
        <Link
          href={`/api/csv/scoring?chapter_id=${ctx.chapterId}`}
          className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
        >
          <span>↓</span> CSV
        </Link>
      </div>

      {!rubric && (
        <div className="bg-yi-saffron/10 border border-yi-saffron/30 rounded-md p-3 text-sm text-yi-saffron">
          No default chapter_final rubric — configure one in national admin.
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Rank</th>
              <th className="text-left px-4 py-3 font-semibold">Team</th>
              <th className="text-left px-4 py-3 font-semibold">Problem</th>
              <th className="text-right px-4 py-3 font-semibold">Jurors</th>
              <th className="text-right px-4 py-3 font-semibold">Average</th>
              <th className="text-right px-4 py-3 font-semibold">Threshold</th>
            </tr>
          </thead>
          <tbody>
            {teamAggregates.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-navy/40"
                >
                  No teams.
                </td>
              </tr>
            ) : (
              teamAggregates.map((a) => {
                const rank = rankByTeam.get(a.team_id);
                return (
                  <tr key={a.team_id} className="border-t border-navy/5">
                    <td className="px-4 py-3 font-mono font-bold text-navy">
                      {rank ? `#${rank}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{a.team_name}</td>
                    <td className="px-4 py-3 text-xs text-navy/60 truncate max-w-[200px]">
                      {a.problem_title}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {a.count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {a.count > 0 ? (
                        <>
                          {a.total} / {totalMax}
                        </>
                      ) : (
                        <span className="text-navy/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.count === 0 ? (
                        <span className="text-navy/30 text-xs">—</span>
                      ) : a.clears ? (
                        <span className="text-xs font-semibold text-yi-green">
                          ✓ clears
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-navy/40">
                          below
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Per-team jury breakdown */}
      {teamAggregates.some((a) => a.count > 0) && (
        <section>
          <h3 className="text-sm font-bold text-navy mb-3">
            Juror-by-juror breakdown
          </h3>
          <div className="space-y-3">
            {teams.map((t) => {
              const list = byTeam.get(t.id) ?? [];
              if (list.length === 0) return null;
              return (
                <div
                  key={t.id}
                  className="bg-white border border-navy/10 rounded-lg p-4"
                >
                  <div className="font-bold text-navy mb-2">{t.team_name}</div>
                  <ul className="space-y-1 text-sm">
                    {list.map((e) => (
                      <li
                        key={`${e.team_id}-${e.jury_id}`}
                        className="flex items-center justify-between p-2 border border-navy/10 rounded"
                      >
                        <div>
                          <div className="font-semibold">
                            {e.jury_assignments?.jury_name ?? "—"}
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                            {e.jury_assignments?.archetype ?? "—"}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-navy">
                          {e.total_score} / {totalMax}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-xs text-navy/40">
        <Link
          href="/yi-future/chapter/jury"
          className="underline hover:text-navy"
        >
          Manage jury
        </Link>{" "}
        ·{" "}
        <Link
          href="/yi-future/national/admin/rubrics"
          className="underline hover:text-navy"
        >
          Edit rubric
        </Link>
      </p>
    </div>
  );
}
