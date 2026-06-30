import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { aggregateEvaluations, rankTeams } from "@/lib/yi-future/rubric";
import type { CriteriaScores } from "@/lib/yi-future/rubric";

export const metadata = {
  title: "Problem teams · Yi National · Yi Future 6.0",
};

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type Problem = {
  id: string;
  title: string;
  short_description: string | null;
  edition_id: string;
  tracks: { name: string; color_hex: string | null } | null;
};

type TeamRow = {
  id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  chapter_id: string;
  team_members: {
    delegate_id: string;
    delegates: { full_name: string } | null;
  }[];
};

async function getProblem(problemId: string): Promise<Problem | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id, title, short_description, tracks!inner(name, color_hex, edition_id)")
    .eq("id", problemId)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as {
    id: string;
    title: string;
    short_description: string | null;
    tracks: { name: string; color_hex: string | null; edition_id: string } | null;
  };
  return {
    id: d.id,
    title: d.title,
    short_description: d.short_description,
    edition_id: d.tracks?.edition_id ?? "",
    tracks: d.tracks ? { name: d.tracks.name, color_hex: d.tracks.color_hex } : null,
  };
}

async function getTeams(problemId: string, editionId: string): Promise<TeamRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, status, captain_id, chapter_id, team_members(delegate_id, delegates(full_name))"
    )
    .eq("problem_statement_id", problemId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as TeamRow[]) ?? [];
}

async function getChapterNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data } = await svc
    .schema("future")
    .from("chapters")
    .select("id, name, city")
    .in("id", ids);
  for (const c of (data as { id: string; name: string; city: string | null }[]) ?? []) {
    out.set(c.id, c.city ? `${c.name} · ${c.city}` : c.name);
  }
  return out;
}

async function getScores(
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
  for (const [tid, evals] of byTeam) {
    const agg = aggregateEvaluations(evals);
    out.set(tid, { total: agg.averageTotal, count: agg.count });
  }
  return out;
}

function statusLabel(s: string | null): string {
  return (s ?? "registered").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

export default async function NationalProblemTeamsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await getProblem(id);

  if (!problem) {
    return (
      <div className="space-y-4">
        <Link
          href="/yi-future/national/admin/problems"
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: `${NAVY}80` }}
        >
          ← All problems
        </Link>
        <div
          className="rounded-lg border bg-white p-6 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          Problem not found.
        </div>
      </div>
    );
  }

  const teams = await getTeams(problem.id, problem.edition_id);
  const [chapterNames, scores] = await Promise.all([
    getChapterNames([...new Set(teams.map((t) => t.chapter_id))]),
    getScores(teams.map((t) => t.id)),
  ]);

  // Global ranking across all chapters for scored teams.
  const ranked = rankTeams(
    teams
      .filter((t) => (scores.get(t.id)?.count ?? 0) > 0)
      .map((t) => ({ team_id: t.id, total: scores.get(t.id)!.total }))
  );
  const rankByTeam = new Map(ranked.map((r) => [r.team_id, r.rank]));

  // Group by chapter.
  const byChapter = new Map<string, TeamRow[]>();
  for (const t of teams) {
    const arr = byChapter.get(t.chapter_id) ?? [];
    arr.push(t);
    byChapter.set(t.chapter_id, arr);
  }
  const chapterBuckets = [...byChapter.entries()]
    .map(([cid, ts]) => ({
      cid,
      name: chapterNames.get(cid) ?? "Chapter",
      teams: ts.sort(
        (a, b) =>
          (rankByTeam.get(a.id) ?? 1e9) - (rankByTeam.get(b.id) ?? 1e9) ||
          a.team_name.localeCompare(b.team_name)
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const accent = problem.tracks?.color_hex || NAVY;
  const totalDelegates = teams.reduce((s, t) => s + t.team_members.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/national/admin/problems"
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: `${NAVY}80` }}
        >
          ← All problems
        </Link>
        <div className="mt-2 border-l-4 pl-3" style={{ borderColor: accent }}>
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
          {chapterBuckets.length} chapter{chapterBuckets.length === 1 ? "" : "s"}{" "}
          · {totalDelegates} delegate{totalDelegates === 1 ? "" : "s"}
        </p>
      </div>

      {teams.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-8 text-center text-sm"
          style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
        >
          No teams have picked this problem yet.
        </div>
      ) : (
        <div className="space-y-6">
          {chapterBuckets.map((ch) => (
            <section key={ch.cid} className="space-y-2">
              <h3
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: `${NAVY}99` }}
              >
                {ch.name} ({ch.teams.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {ch.teams.map((t) => {
                  const sc = scores.get(t.id);
                  const rank = rankByTeam.get(t.id) ?? null;
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border bg-white p-4"
                      style={{ borderColor: rank && rank <= 3 ? GOLD : `${NAVY}1a` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {rank !== null && <span className="text-base">{medal(rank)}</span>}
                          <span className="font-bold truncate" style={{ color: NAVY }}>
                            {t.team_name}
                          </span>
                        </div>
                        {sc && sc.count > 0 ? (
                          <span className="text-right shrink-0">
                            <span className="block text-base font-extrabold" style={{ color: NAVY }}>
                              {sc.total.toFixed(1)}
                            </span>
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
                            style={{ background: `${NAVY}0d`, color: `${NAVY}80` }}
                          >
                            Not scored
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: `${NAVY}0d`, color: `${NAVY}99` }}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-0.5 text-sm" style={{ color: `${NAVY}cc` }}>
                        {t.team_members.map((m) => (
                          <li key={m.delegate_id} className="flex items-center justify-between">
                            <span>{m.delegates?.full_name ?? "(unknown)"}</span>
                            {m.delegate_id === t.captain_id && (
                              <span className="text-[10px] font-bold" style={{ color: GOLD }}>
                                CAPTAIN
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
