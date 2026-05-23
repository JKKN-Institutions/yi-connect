/**
 * GET /api/cron/auto-assign-problems
 *
 * Vercel Cron endpoint (hourly). For every active edition whose
 * `team_picks_deadline` has passed, finds teams in that edition with
 * `problem_statement_id IS NULL` and auto-assigns each one a problem
 * statement.
 *
 * Algorithm per team:
 *   1. Resolve captain's `preferred_track_slug` (if any).
 *   2. Pool active problem statements:
 *        - If captain has a preferred track → problems in that track.
 *        - Fallback → any active problem.
 *   3. Among the pool, prefer the problem with the FEWEST other teams in
 *      the same chapter (soft load-balance).
 *   4. Update team: set problem_statement_id, status='problem_selected',
 *      updated_at=now().
 *   5. Log a row to future.notification_log for the chapter chair so they
 *      see the auto-assignment in their feed.
 *
 * Idempotent: a team already assigned a problem is skipped.
 *
 * Auth: requires header X-Cron-Secret matching process.env.CRON_SECRET.
 *
 * Returns JSON:
 *   { editions_processed, teams_auto_assigned, teams_skipped, errors }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

// ─── Types ──────────────────────────────────────────────────────────────────

type Edition = {
  id: string;
  slug: string;
  name: string;
  team_picks_deadline: string | null;
};

type UnassignedTeam = {
  id: string;
  team_name: string;
  chapter_id: string;
  edition_id: string;
  captain_id: string | null;
};

type DelegateLite = {
  id: string;
  preferred_track_slug: string | null;
};

type ProblemRow = {
  id: string;
  title: string;
  track_id: string;
  tracks: { slug: string } | null;
};

type TeamCountRow = {
  problem_statement_id: string;
  chapter_id: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("x-cron-secret") === cronSecret;
}

function pickProblemForTeam(
  pool: ProblemRow[],
  countsForChapter: Map<string, number>
): ProblemRow | null {
  if (pool.length === 0) return null;
  // Sort by current usage in this chapter (ascending) — tie-break by display order via problem.id
  return [...pool].sort((a, b) => {
    const ca = countsForChapter.get(a.id) ?? 0;
    const cb = countsForChapter.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();

  // 1. Editions past their deadline.
  const { data: editions, error: edErr } = await svc
    .schema("future")
    .from("editions")
    .select("id, slug, name, team_picks_deadline" as never)
    .eq("is_active", true);

  if (edErr) {
    console.error("[auto-assign-problems] editions query failed:", edErr.message);
    return NextResponse.json({ error: edErr.message }, { status: 500 });
  }

  const dueEditions = ((editions as unknown as Edition[]) ?? []).filter(
    (e) => e.team_picks_deadline && e.team_picks_deadline < nowIso
  );

  if (dueEditions.length === 0) {
    return NextResponse.json({
      editions_processed: 0,
      teams_auto_assigned: 0,
      teams_skipped: 0,
      errors: [],
      message: "No editions past deadline.",
    });
  }

  let totalAssigned = 0;
  let totalSkipped = 0;
  const errors: { team_id: string; error: string }[] = [];

  for (const edition of dueEditions) {
    // 2. Unassigned teams in this edition.
    const { data: teams } = await svc
      .schema("future")
      .from("teams")
      .select("id, team_name, chapter_id, edition_id, captain_id")
      .eq("edition_id", edition.id)
      .is("problem_statement_id", null);

    const unassigned = (teams as UnassignedTeam[] | null) ?? [];
    if (unassigned.length === 0) continue;

    // 3. Active problems with track slugs.
    const { data: problems } = await svc
      .schema("future")
      .from("problem_statements")
      .select("id, title, track_id, tracks(slug)")
      .eq("is_active", true);

    const allProblems = (problems as unknown as ProblemRow[]) ?? [];
    if (allProblems.length === 0) continue;

    // 4. Current per-chapter counts (for load-balancing).
    const { data: existing } = await svc
      .schema("future")
      .from("teams")
      .select("problem_statement_id, chapter_id")
      .eq("edition_id", edition.id)
      .not("problem_statement_id", "is", null);

    const countsByChapter = new Map<string, Map<string, number>>();
    for (const t of (existing as TeamCountRow[] | null) ?? []) {
      let m = countsByChapter.get(t.chapter_id);
      if (!m) {
        m = new Map();
        countsByChapter.set(t.chapter_id, m);
      }
      m.set(t.problem_statement_id, (m.get(t.problem_statement_id) ?? 0) + 1);
    }

    // 5. Captain preferred-track lookup.
    const captainIds = unassigned.map((t) => t.captain_id).filter(Boolean) as string[];
    const { data: captains } = captainIds.length
      ? await svc
          .schema("future")
          .from("delegates")
          .select("id, preferred_track_slug")
          .in("id", captainIds)
      : { data: [] };

    const captainById = new Map<string, DelegateLite>();
    for (const c of (captains as DelegateLite[] | null) ?? []) {
      captainById.set(c.id, c);
    }

    // 6. Assign one by one.
    for (const team of unassigned) {
      try {
        const captain = team.captain_id ? captainById.get(team.captain_id) : null;
        const preferredSlug = captain?.preferred_track_slug ?? null;

        let pool: ProblemRow[];
        if (preferredSlug) {
          pool = allProblems.filter((p) => p.tracks?.slug === preferredSlug);
          if (pool.length === 0) pool = allProblems; // fallback
        } else {
          pool = allProblems;
        }

        const counts = countsByChapter.get(team.chapter_id) ?? new Map<string, number>();
        const chosen = pickProblemForTeam(pool, counts);
        if (!chosen) {
          totalSkipped++;
          continue;
        }

        const { error: updErr } = await svc
          .schema("future")
          .from("teams")
          .update({
            problem_statement_id: chosen.id,
            status: "problem_selected",
            updated_at: nowIso,
          })
          .eq("id", team.id);

        if (updErr) {
          errors.push({ team_id: team.id, error: updErr.message });
          continue;
        }

        // Update local count so the next pick in the same loop knows.
        counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1);
        countsByChapter.set(team.chapter_id, counts);

        // Notify chapter chair (best-effort; ignore failures).
        await svc
          .schema("future")
          .from("notification_log" as never)
          .insert({
            recipient_email: "",
            subject_line: `Auto-assigned: ${team.team_name}`,
            body_preview: `Team "${team.team_name}" missed the team-picks deadline. System auto-assigned: "${chosen.title}". Admin can override via the team detail page.`,
            status: "pending",
            related_team_id: team.id,
            related_edition_id: edition.id,
          } as never)
          .then(() => undefined, () => undefined);

        totalAssigned++;
      } catch (e) {
        errors.push({
          team_id: team.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return NextResponse.json({
    editions_processed: dueEditions.length,
    teams_auto_assigned: totalAssigned,
    teams_skipped: totalSkipped,
    errors,
  });
}
