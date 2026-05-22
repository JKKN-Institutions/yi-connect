"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import {
  aggregateEvaluations,
  rankTeams,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

/**
 * Compute ranked team results for a chapter final event.
 * Returns ranked list with average totals.
 */
export type TeamResult = {
  team_id: string;
  team_name: string;
  problem_title: string | null;
  jurors_count: number;
  average_total: number;
  rank: number | null;
  clears: boolean;
};

export async function computeChapterResults(
  chapterId: string,
  editionId: string,
  threshold: number | null
): Promise<TeamResult[]> {
  const svc = await createServiceClient();
  const { data: teams } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, problem_statement_id, problem_statements(title)"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId);
  const teamList = (teams as unknown as {
    id: string;
    team_name: string;
    problem_statements: { title: string } | null;
  }[]) ?? [];

  const { data: evals } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "team_id, criteria_scores, total_score, status, teams!inner(chapter_id, edition_id)"
    )
    .eq("teams.chapter_id", chapterId)
    .eq("teams.edition_id", editionId)
    .eq("status", "submitted");
  const evalList = (evals as unknown as {
    team_id: string;
    criteria_scores: CriteriaScores;
    total_score: number;
  }[]) ?? [];

  const byTeam = new Map<string, typeof evalList>();
  for (const e of evalList) {
    if (!byTeam.has(e.team_id)) byTeam.set(e.team_id, []);
    byTeam.get(e.team_id)!.push(e);
  }

  const base = teamList.map((t) => {
    const list = byTeam.get(t.id) ?? [];
    const agg = aggregateEvaluations(list);
    return {
      team_id: t.id,
      team_name: t.team_name,
      problem_title: t.problem_statements?.title ?? null,
      jurors_count: agg.count,
      average_total: agg.averageTotal,
      total: agg.averageTotal,
    };
  });

  const ranked = rankTeams(base.filter((b) => b.jurors_count > 0));
  const rankMap = new Map(ranked.map((r) => [r.team_id, r.rank]));

  return base.map((b) => ({
    team_id: b.team_id,
    team_name: b.team_name,
    problem_title: b.problem_title,
    jurors_count: b.jurors_count,
    average_total: b.average_total,
    rank: rankMap.get(b.team_id) ?? null,
    clears:
      threshold !== null &&
      b.jurors_count > 0 &&
      b.average_total >= threshold,
  }));
}

/**
 * Resolve the regional finale event id for a team.
 *
 * Steps:
 * 1. Look up the team's chapter_id → chapters.finale_region
 * 2. Find the finale-host chapter for that region (is_finale_host = true)
 * 3. Find the national_track_final event owned by that finale chapter for this edition
 * 4. Return the event id, or null if the host chapter hasn't created the event yet
 */
export async function resolveRegionalFinaleEventId(
  teamId: string,
  editionId: string
): Promise<string | null> {
  const svc = await createServiceClient();

  // Step 1: team → chapter → finale_region
  const { data: teamRow } = await svc
    .schema("future")
    .from("teams")
    .select("chapter_id, chapters(finale_region)")
    .eq("id", teamId)
    .single();

  const row = teamRow as unknown as {
    chapter_id: string | null;
    chapters: { finale_region: string | null } | null;
  } | null;

  const finaleRegion = row?.chapters?.finale_region ?? null;
  if (!finaleRegion) return null;

  // Step 2: find the finale-host chapter for this region
  const { data: hostChapterRow } = await svc
    .schema("yi")
    .from("chapters")
    .select("id")
    .eq("finale_region", finaleRegion as never)
    .eq("is_finale_host", true as never)
    .limit(1)
    .maybeSingle();

  const finaleHostId = (hostChapterRow as unknown as { id: string } | null)?.id ?? null;
  if (!finaleHostId) return null;

  // Step 3: find the national_track_final event for that chapter + edition
  const { data: eventRow } = await svc
    .schema("future")
    .from("events")
    .select("id")
    .eq("chapter_id", finaleHostId)
    .eq("type", "national_track_final" as never)
    .eq("edition_id", editionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (eventRow as unknown as { id: string } | null)?.id ?? null;
}

/**
 * Publish the chapter shortlist — writes advancements rows for teams above
 * the threshold, routing each team to its regional finale event (by
 * chapters.finale_region → is_finale_host → national_track_final event).
 * If the finale event hasn't been created yet, to_event_id is left NULL so
 * the host admin can backfill later.
 */
export async function publishShortlist(input: {
  chapterFinalEventId: string;
  chapterId: string;
  editionId: string;
  threshold: number | null;
  maxAdvancements: number | null;
}): Promise<ActionResult> {
  const userId = await requireAuth();
  const svc = await createServiceClient();

  const results = await computeChapterResults(
    input.chapterId,
    input.editionId,
    input.threshold
  );

  // Sort by rank (nulls last)
  const sorted = [...results].sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  let pick = sorted.filter((r) => r.clears);
  if (input.maxAdvancements != null) {
    pick = pick.slice(0, input.maxAdvancements);
  }

  if (pick.length === 0) {
    return {
      ok: false,
      error: "No teams clear the threshold — nothing to shortlist.",
    };
  }

  // Resolve regional finale event id for each team in parallel
  const toEventIds = await Promise.all(
    pick.map((p) => resolveRegionalFinaleEventId(p.team_id, input.editionId))
  );

  // Insert advancement rows; to_event_id may be null if the finale event
  // doesn't exist yet — the host admin creates it and a backfill can link it.
  const rows = pick.map((p, i) => ({
    team_id: p.team_id,
    from_event_id: input.chapterFinalEventId,
    to_event_id: toEventIds[i] ?? null,
    total_score: p.average_total,
    rank: p.rank ?? null,
    advanced_by: userId,
  }));

  const { error } = await svc
    .schema("future")
    .from("advancements")
    .upsert(rows as never, { onConflict: "from_event_id,team_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/chapter/final/${input.chapterFinalEventId}`);
  revalidatePath("/chapter/results");
  return {
    ok: true,
    message: `Shortlisted ${rows.length} team(s).`,
  };
}
