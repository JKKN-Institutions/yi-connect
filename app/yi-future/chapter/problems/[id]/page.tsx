import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { aggregateEvaluations, rankTeams } from "@/lib/yi-future/rubric";
import type { CriteriaScores } from "@/lib/yi-future/rubric";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type Problem = {
  id: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  tracks: { name: string; color_hex: string | null } | null;
};

type TeamRow = {
  id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  team_members: {
    delegate_id: string;
    role_in_team: string | null;
    delegates: { full_name: string } | null;
  }[];
};

async function getProblem(
  problemId: string,
  editionId: string
): Promise<Problem | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, full_description, tracks!inner(name, color_hex, edition_id)"
    )
    .eq("id", problemId)
    .eq("tracks.edition_id", editionId)
    .maybeSingle();
  return (data as unknown as Problem) ?? null;
}

async function getTeams(
  chapterId: string,
  editionId: string,
  problemId: string
): Promise<TeamRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, status, captain_id, team_members(delegate_id, role_in_team, delegates(full_name))"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("problem_statement_id", problemId)
    .order("team_name", { ascending: true });
  return (data as unknown as TeamRow[]) ?? [];
}

async function getTeamScores(
  teamIds: string[]
): Promise<Map<string, { total: number; count: number }>> {
  const out = new Map<string, { total: number; count: number }>();
  if (teamIds.length === 0) return out;
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select("team_id, criteria_scores, total_score")
    .in("team_id", teamIds);
  const byTeam = new Map<
    string,
    { criteria_scores: CriteriaScores; total_score: number }[]
  >();
  for (const e of (data as unknown as {
    team_id: string;
    criteria_scores: CriteriaScores;
    total_score: number;
  }[]) ?? []) {
    const arr = byTeam.get(e.team_id) ?? [];
    arr.push({ criteria_scores: e.criteria_scores, total_score: e.total_score });
    byTeam.set(e.team_id, arr);
  }
  for (const [teamId, evals] of byTeam) {
    const agg = aggregateEvaluations(evals);
    out.set(teamId, { total: agg.averageTotal, count: agg.count });
  }
  return out;
}

function statusLabel(s: string | null): string {
  return (s ?? "registered")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default async function ProblemTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");
  const { id } = await params;

  const problem = await getProblem(id, ctx.editionId);
  if (!problem) {
    return (
      <div className="space-y-4">
        <Link
          href="/yi-future/chapter/problems"
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: `${NAVY}80` }}
        >
          ← All problems
        </Link>
        <div
          className="rounded-lg border bg-white p-6 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          Problem statement not found in this edition.
        </div>
      </div>
    );
  }

  const teams = await getTeams(ctx.chapterId, ctx.editionId, id);
  const scores = await getTeamScores(teams.map((t) => t.id));

  // Split scored vs unscored; rank the scored teams by average total.
  const scoredInput = teams
    .filter((t) => (scores.get(t.id)?.count ?? 0) > 0)
    .map((t) => ({ team_id: t.id, total: scores.get(t.id)!.total }));
  const ranked = rankTeams(scoredInput);
  const rankByTeam = new Map(ranked.map((r) => [r.team_id, r.rank]));

  const scoredTeams = teams
    .filter((t) => rankByTeam.has(t.id))
    .sort((a, b) => (rankByTeam.get(a.id)! - rankByTeam.get(b.id)!));
  const unscoredTeams = teams.filter((t) => !rankByTeam.has(t.id));

  const accent = problem.tracks?.color_hex || NAVY;
  const totalDelegates = teams.reduce(
    (s, t) => s + t.team_members.length,
    0
  );

  function TeamCard({ t, rank }: { t: TeamRow; rank: number | null }) {
    const sc = scores.get(t.id);
    return (
      <div
        className="rounded-xl border bg-white p-5"
        style={{ borderColor: rank && rank <= 3 ? GOLD : `${NAVY}1a` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {rank !== null && (
              <span className="text-lg" aria-label={`rank ${rank}`}>
                {medal(rank)}
              </span>
            )}
            <Link
              href={`/yi-future/chapter/teams/${t.id}`}
              className="font-bold truncate"
              style={{ color: NAVY }}
            >
              {t.team_name}
            </Link>
          </div>
          <div className="text-right shrink-0">
            {sc && sc.count > 0 ? (
              <>
                <div className="text-lg font-extrabold" style={{ color: NAVY }}>
                  {sc.total.toFixed(1)}
                </div>
                <div
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: `${NAVY}66` }}
                >
                  {sc.count} jury
                </div>
              </>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: `${NAVY}0d`, color: `${NAVY}80` }}
              >
                Not scored
              </span>
            )}
          </div>
        </div>

        <div className="mt-2">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: `${NAVY}0d`, color: `${NAVY}99` }}
          >
            {statusLabel(t.status)}
          </span>
        </div>

        <div className="mt-3 border-t pt-3" style={{ borderColor: `${NAVY}0f` }}>
          <div
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: `${NAVY}59` }}
          >
            Delegates ({t.team_members.length})
          </div>
          {t.team_members.length === 0 ? (
            <p className="text-xs" style={{ color: `${NAVY}66` }}>
              No members yet.
            </p>
          ) : (
            <ul className="space-y-0.5 text-sm" style={{ color: `${NAVY}cc` }}>
              {t.team_members.map((m) => (
                <li
                  key={m.delegate_id}
                  className="flex items-center justify-between"
                >
                  <span>{m.delegates?.full_name ?? "(unknown)"}</span>
                  {m.delegate_id === t.captain_id && (
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: GOLD }}
                    >
                      CAPTAIN
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/chapter/problems"
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: `${NAVY}80` }}
        >
          ← All problems
        </Link>
        <div
          className="mt-2 border-l-4 pl-3"
          style={{ borderColor: accent }}
        >
          {problem.tracks?.name && (
            <div
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: accent }}
            >
              {problem.tracks.name}
            </div>
          )}
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
            {problem.title}
          </h2>
        </div>
        <p className="mt-2 text-sm" style={{ color: `${NAVY}99` }}>
          {teams.length} team{teams.length === 1 ? "" : "s"} ·{" "}
          {totalDelegates} delegate{totalDelegates === 1 ? "" : "s"} in{" "}
          {ctx.chapterName}
        </p>
        {problem.short_description && (
          <p className="mt-2 text-sm" style={{ color: `${NAVY}b3` }}>
            {problem.short_description}
          </p>
        )}
      </div>

      {teams.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          No teams in your chapter have picked this problem yet.
        </div>
      ) : (
        <div className="space-y-4">
          {scoredTeams.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {scoredTeams.map((t) => (
                <TeamCard key={t.id} t={t} rank={rankByTeam.get(t.id) ?? null} />
              ))}
            </div>
          )}
          {unscoredTeams.length > 0 && (
            <div>
              {scoredTeams.length > 0 && (
                <div
                  className="mb-2 mt-2 text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: `${NAVY}59` }}
                >
                  Not yet scored
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {unscoredTeams.map((t) => (
                  <TeamCard key={t.id} t={t} rank={null} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
