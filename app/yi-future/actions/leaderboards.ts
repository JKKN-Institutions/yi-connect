"use server";

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import {
  computeTeamJourneyScore,
  JOURNEY_MAX,
} from "@/lib/yi-future/gamification-scoring";

export type LeaderboardRow = {
  rank: number;
  label: string;
  score: number;
  meta: string;
};

function assignRanks(rows: LeaderboardRow[]): LeaderboardRow[] {
  let currentRank = 1;
  let prev: number | null = null;
  return rows.map((r, idx) => {
    if (prev !== null && r.score < prev) currentRank = idx + 1;
    prev = r.score;
    return { ...r, rank: currentRank };
  });
}

// ─── Institution leaderboard ──────────────────────────────────────────────────
// 1 SQL call: future.leaderboard_institution(edition_id)
// Aggregates avg(evaluation.total_score) per college via a SECURITY DEFINER fn.

export async function getInstitutionLeaderboard(
  editionId: string
): Promise<LeaderboardRow[]> {
  const svc = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.schema("future") as any).rpc(
    "leaderboard_institution",
    { p_edition_id: editionId }
  );

  if (error) throw error;

  const rows = (
    data as {
      college_id: string;
      college_name: string;
      avg_score: number | null;
      team_count: number;
    }[]
  )
    .filter((r) => r.avg_score !== null && r.avg_score > 0)
    .map((r) => ({
      rank: 0,
      label: r.college_name ?? "(unknown college)",
      score: Number((r.avg_score ?? 0).toFixed(2)),
      meta: `${r.team_count} team${r.team_count === 1 ? "" : "s"}`,
    }));

  return assignRanks(rows);
}

// ─── Chapter leaderboard ──────────────────────────────────────────────────────
// 1 SQL call: future.leaderboard_chapter(edition_id)

export async function getChapterLeaderboard(
  editionId: string
): Promise<LeaderboardRow[]> {
  const svc = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.schema("future") as any).rpc(
    "leaderboard_chapter",
    { p_edition_id: editionId }
  );

  if (error) throw error;

  const rows = (
    data as {
      chapter_id: string;
      chapter_name: string;
      avg_score: number | null;
      team_count: number;
    }[]
  ).map((r) => ({
    rank: 0,
    label: r.chapter_name ?? "(unknown chapter)",
    score: Number((r.avg_score ?? 0).toFixed(2)),
    meta: `${r.team_count} team${r.team_count === 1 ? "" : "s"} · avg`,
  }));

  return assignRanks(rows);
}

// ─── Problem statement leaderboard ───────────────────────────────────────────
// 1 SQL call: future.leaderboard_problem(edition_id)
// Returns top 3 teams per problem statement via a window function inside the fn.

export async function getProblemStatementLeaderboard(
  editionId: string
): Promise<LeaderboardRow[]> {
  const svc = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.schema("future") as any).rpc(
    "leaderboard_problem",
    { p_edition_id: editionId }
  );

  if (error) throw error;

  return (
    data as {
      problem_id: string;
      problem_title: string;
      team_id: string;
      team_name: string;
      chapter_name: string;
      avg_score: number | null;
      rk: number;
    }[]
  ).map((r) => ({
    rank: r.rk,
    label: `${r.problem_title} — ${r.team_name}`,
    score: Number((r.avg_score ?? 0).toFixed(2)),
    meta: r.chapter_name ?? "—",
  }));
}

// ─── Track leaderboard ────────────────────────────────────────────────────────
// 1 SQL call: future.leaderboard_track(edition_id)
// Returns all teams ranked within their track via a window function.

export async function getTrackLeaderboard(
  editionId: string
): Promise<LeaderboardRow[]> {
  const svc = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.schema("future") as any).rpc(
    "leaderboard_track",
    { p_edition_id: editionId }
  );

  if (error) throw error;

  return (
    data as {
      track_id: string;
      track_name: string;
      team_id: string;
      team_name: string;
      chapter_name: string;
      avg_score: number | null;
      rk: number;
    }[]
  ).map((r) => ({
    rank: r.rk,
    label: `${r.track_name} — ${r.team_name}`,
    score: Number((r.avg_score ?? 0).toFixed(2)),
    meta: r.chapter_name ?? "—",
  }));
}

// ─── Composite leaderboard (jury 80% + journey 20%) ─────────────────────────
// Formula: composite = jury_avg * 0.8 + (journey_avg / 15) * 20
// jury_avg is out of 100, journey_avg is out of 15 → composite max = 100.

export async function getCompositeLeaderboard(
  editionId: string,
): Promise<LeaderboardRow[]> {
  const svc = await createServiceClient();

  // 1. Get all teams for this edition with their chapter.
  // Row-cap fix: a bare select stopped at ~1000 teams, so every team past the
  // cap vanished from the composite board entirely.
  type CompositeTeam = {
    id: string;
    team_name: string;
    chapter_id: string;
    chapters: { name: string } | null;
  };
  const teams = await fetchAllRows<CompositeTeam>((from, to) =>
    svc
      .schema("future")
      .from("teams")
      .select("id, team_name, chapter_id, chapters(name)")
      .eq("edition_id", editionId)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: CompositeTeam[] | null;
      error: unknown;
    }>
  );

  if (teams.length === 0) return [];

  // 2. Get all evaluations, then keep the ones belonging to this edition's teams.
  // Row-cap fix (double): the evaluations select truncated at ~1000 AND the old
  // .in("team_id", teamIds) list would blow the request URL once the edition had
  // >1000 teams. Page the child table whole and intersect in JS instead.
  const teamIdSet = new Set(teams.map((t) => t.id));
  const evaluations = await fetchAllRows<{
    team_id: string;
    total_score: number;
  }>((from, to) =>
    svc
      .schema("future")
      .from("evaluations")
      .select("team_id, total_score")
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: { team_id: string; total_score: number }[] | null;
      error: unknown;
    }>
  );

  // Build jury avg map: team_id → average total_score
  const juryMap = new Map<string, { sum: number; count: number }>();
  for (const ev of evaluations) {
    if (!teamIdSet.has(ev.team_id)) continue;
    const entry = juryMap.get(ev.team_id) ?? { sum: 0, count: 0 };
    entry.sum += ev.total_score;
    entry.count += 1;
    juryMap.set(ev.team_id, entry);
  }

  // 3. Compute composite for each team
  const rows: LeaderboardRow[] = [];

  for (const t of teams) {
    const juryEntry = juryMap.get(t.id);
    const juryAvg = juryEntry && juryEntry.count > 0
      ? juryEntry.sum / juryEntry.count
      : 0;

    // Journey score (team average)
    const journey = await computeTeamJourneyScore(t.id, t.chapter_id, editionId);

    // composite = jury_avg * 0.8 + (journey_avg / 15) * 20
    const composite = Number(
      (juryAvg * 0.8 + (journey.avgPoints / JOURNEY_MAX) * 20).toFixed(2),
    );

    const juryPart = Number((juryAvg * 0.8).toFixed(1));
    const journeyPart = Number(((journey.avgPoints / JOURNEY_MAX) * 20).toFixed(1));

    rows.push({
      rank: 0,
      label: t.team_name,
      score: composite,
      meta: `${t.chapters?.name ?? "—"} · jury ${juryPart} + journey ${journeyPart}`,
    });
  }

  // Sort descending by score then assign ranks
  rows.sort((a, b) => b.score - a.score);
  return assignRanks(rows);
}
