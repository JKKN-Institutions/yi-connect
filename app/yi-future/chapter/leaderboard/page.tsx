import { redirect } from "next/navigation";
import Link from "next/link";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  getChapterLeaderboard,
  type LeaderboardRow,
} from "@/app/yi-future/actions/leaderboards";
import {
  aggregateEvaluations,
  rankTeams,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";

type Team = {
  id: string;
  team_name: string;
  problem_statement_id: string | null;
  problem_statements: {
    title: string;
    track_id: string | null;
    tracks: { id: string; name: string } | null;
  } | null;
};

type Evaluation = {
  team_id: string;
  criteria_scores: CriteriaScores;
  total_score: number;
  status: string | null;
};

type TrackRef = { id: string; name: string };

type RankedRow = {
  team_id: string;
  team_name: string;
  problem_title: string;
  track_name: string;
  track_id: string | null;
  total: number;
  count: number;
  rank: number;
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
      "id, team_name, problem_statement_id, problem_statements(title, track_id, tracks(id, name))"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId);
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
      "team_id, criteria_scores, total_score, status, teams!inner(chapter_id, edition_id)"
    )
    .eq("teams.chapter_id", chapterId)
    .eq("teams.edition_id", editionId);
  return (data as unknown as Evaluation[]) ?? [];
}

// All tracks for this edition — so we render a card even for tracks with no
// scored teams yet. Inline (per spec: don't add to leaderboards.ts).
async function getAllTracks(editionId: string): Promise<TrackRef[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("id, name")
    .eq("edition_id", editionId)
    .order("name");
  return (data as TrackRef[] | null) ?? [];
}

function rankColor(rank: number): string {
  if (rank === 1) return "bg-yi-gold/15 border-yi-gold/40";
  if (rank === 2) return "bg-yi-saffron/10 border-yi-saffron/40";
  if (rank === 3) return "bg-yi-green/10 border-yi-green/40";
  return "bg-white border-navy/10";
}

// Stable, brand-aligned palette for the 4 track cards.
// Yi gold / saffron / green + navy fallback. INFERRED — no handbook spec for
// per-track colors yet.
const TRACK_PALETTE: { header: string; border: string; chip: string }[] = [
  { header: "bg-yi-gold", border: "border-yi-gold/40", chip: "text-yi-gold" },
  {
    header: "bg-yi-saffron",
    border: "border-yi-saffron/40",
    chip: "text-yi-saffron",
  },
  { header: "bg-yi-green", border: "border-yi-green/40", chip: "text-yi-green" },
  { header: "bg-navy", border: "border-navy/40", chip: "text-navy" },
];

export default async function ChapterLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const tab = (await searchParams).tab === "cross" ? "cross" : "tracks";

  const [teams, evaluations, chapterRows, allTracks] = await Promise.all([
    getTeams(ctx.chapterId, ctx.editionId),
    getEvaluations(ctx.chapterId, ctx.editionId),
    getChapterLeaderboard(ctx.editionId),
    getAllTracks(ctx.editionId),
  ]);

  // Group submitted evals per team
  const byTeam = new Map<string, Evaluation[]>();
  for (const e of evaluations) {
    if (e.status !== "submitted") continue;
    if (!byTeam.has(e.team_id)) byTeam.set(e.team_id, []);
    byTeam.get(e.team_id)!.push(e);
  }

  const scoredTeamRows = teams
    .map((t) => {
      const list = byTeam.get(t.id) ?? [];
      const agg = aggregateEvaluations(list);
      return {
        team_id: t.id,
        team_name: t.team_name,
        problem_title: t.problem_statements?.title ?? "—",
        track_name: t.problem_statements?.tracks?.name ?? "—",
        track_id: t.problem_statements?.track_id ?? null,
        total: agg.averageTotal,
        count: agg.count,
      };
    })
    .filter((r) => r.count > 0);

  // Cross-track flat ranking (existing behavior)
  const crossRanked: RankedRow[] = rankTeams(scoredTeamRows);

  // Per-track ranking — independent rank-1 within each track. Build a
  // per-track ranked list by passing only that track's rows to rankTeams.
  type TrackGroup = { id: string | null; name: string; rows: RankedRow[] };
  const groupMap = new Map<string, { name: string; rows: typeof scoredTeamRows }>();

  // Seed every track from this edition so empty cards still render.
  for (const t of allTracks) {
    groupMap.set(t.id, { name: t.name, rows: [] });
  }
  for (const r of scoredTeamRows) {
    const key = r.track_id ?? "_none";
    const cur = groupMap.get(key) ?? { name: r.track_name, rows: [] };
    cur.rows.push(r);
    groupMap.set(key, cur);
  }

  const trackGroups: TrackGroup[] = Array.from(groupMap.entries())
    .map(([id, g]) => ({
      id: id === "_none" ? null : id,
      name: g.name,
      rows: rankTeams(g.rows).slice(0, 5),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Chapter Leaderboard</h2>
        <p className="mt-1 text-sm text-navy/60">
          {ctx.chapterName} · {crossRanked.length} scored team
          {crossRanked.length === 1 ? "" : "s"} across {trackGroups.length}{" "}
          track{trackGroups.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Chapter rank within edition */}
      <div className="bg-white border border-navy/10 rounded-lg p-4">
        <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-2">
          Your chapter vs others
        </div>
        {chapterRows.length === 0 ? (
          <p className="text-xs text-navy/50">
            Other chapters haven&apos;t finalized scoring yet.
          </p>
        ) : (
          <ChapterRankPreview rows={chapterRows} myChapter={ctx.chapterName} />
        )}
      </div>

      {/* Tabs — per-track is the default; cross-track is opt-in */}
      <div className="flex gap-1 border-b border-navy/10">
        <Link
          href="/yi-future/chapter/leaderboard"
          className={`min-h-[44px] inline-flex items-center px-4 text-sm font-semibold border-b-2 -mb-px ${
            tab === "tracks"
              ? "border-navy text-navy"
              : "border-transparent text-navy/50 hover:text-navy"
          }`}
        >
          By Track
        </Link>
        <Link
          href="/yi-future/chapter/leaderboard?tab=cross"
          className={`min-h-[44px] inline-flex items-center px-4 text-sm font-semibold border-b-2 -mb-px ${
            tab === "cross"
              ? "border-navy text-navy"
              : "border-transparent text-navy/50 hover:text-navy"
          }`}
        >
          Cross-track view
        </Link>
      </div>

      {tab === "tracks" ? (
        <>
          <p className="text-xs text-navy/50 -mt-2">
            Each chapter runs all 4 tracks. Teams are ranked within their own
            track — cross-track totals aren&apos;t comparable.
          </p>
          {trackGroups.length === 0 ? (
            <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
              No tracks defined for this edition yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {trackGroups.map((g, i) => (
                <TrackCard
                  key={g.id ?? `_none-${i}`}
                  name={g.name}
                  rows={g.rows}
                  palette={TRACK_PALETTE[i % TRACK_PALETTE.length]}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-navy/50 -mt-2">
            Single combined ranking. Useful for admin overview only — not used
            for advancement decisions.
          </p>
          <RankedList rows={crossRanked} />
        </>
      )}
    </div>
  );
}

function TrackCard({
  name,
  rows,
  palette,
}: {
  name: string;
  rows: RankedRow[];
  palette: { header: string; border: string; chip: string };
}) {
  return (
    <section
      className={`bg-white border rounded-lg overflow-hidden ${palette.border}`}
    >
      <header className={`${palette.header} px-3 py-2`}>
        <h3 className="text-sm font-bold text-white truncate">{name}</h3>
        <p className="text-[10px] text-white/80">
          Top {rows.length === 0 ? 5 : Math.min(rows.length, 5)} ·{" "}
          {rows.length === 0 ? "no scores yet" : "by avg total"}
        </p>
      </header>
      <div className="p-3">
        {rows.length === 0 ? (
          <p className="text-xs text-navy/50 text-center py-6">
            No scored teams yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.team_id}
                className={`flex items-center gap-2 p-2 border rounded-md min-h-[44px] ${rankColor(
                  r.rank
                )}`}
              >
                <div
                  className={`w-7 text-center font-mono font-bold text-sm ${palette.chip}`}
                >
                  #{r.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy text-sm truncate">
                    {r.team_name}
                  </div>
                  <div className="text-[11px] text-navy/60 truncate">
                    {r.problem_title}
                  </div>
                </div>
                <div className="font-mono font-bold text-navy text-sm">
                  {r.total}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RankedList({
  rows,
}: {
  rows: {
    team_id: string;
    team_name: string;
    problem_title: string;
    track_name: string;
    total: number;
    rank: number;
  }[];
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
        No scored teams yet.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.team_id}
          className={`flex items-center gap-3 p-3 border rounded-lg min-h-[44px] ${rankColor(r.rank)}`}
        >
          <div className="w-10 text-center font-mono font-bold text-navy">
            #{r.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy truncate">{r.team_name}</div>
            <div className="text-xs text-navy/60 truncate">
              {r.track_name} · {r.problem_title}
            </div>
          </div>
          <div className="font-mono font-bold text-navy">{r.total}</div>
        </li>
      ))}
    </ul>
  );
}

function ChapterRankPreview({
  rows,
  myChapter,
}: {
  rows: LeaderboardRow[];
  myChapter: string;
}) {
  const top = rows.slice(0, 5);
  const me = rows.find((r) => r.label === myChapter);
  const showMe = me && !top.some((r) => r.label === myChapter);

  return (
    <ul className="space-y-1">
      {top.map((r) => (
        <li
          key={`${r.rank}-${r.label}`}
          className={`flex items-center gap-3 p-2 rounded ${
            r.label === myChapter ? "bg-yi-gold/10 font-semibold" : ""
          }`}
        >
          <span className="w-8 text-center font-mono text-xs text-navy/60">
            #{r.rank}
          </span>
          <span className="flex-1 truncate text-sm">{r.label}</span>
          <span className="font-mono text-sm">{r.score}</span>
        </li>
      ))}
      {showMe && me && (
        <li className="flex items-center gap-3 p-2 rounded bg-yi-gold/10 font-semibold border-t border-navy/10 mt-1">
          <span className="w-8 text-center font-mono text-xs text-navy/60">
            #{me.rank}
          </span>
          <span className="flex-1 truncate text-sm">{me.label}</span>
          <span className="font-mono text-sm">{me.score}</span>
        </li>
      )}
    </ul>
  );
}
