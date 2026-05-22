"use server";

import { createServiceClient } from "@/lib/yi-future/supabase/server";

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
