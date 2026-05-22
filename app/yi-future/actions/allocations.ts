"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { MIN_TEAMS_PER_PROBLEM } from "@/lib/yi-future/constants";
import type { ActionResult } from "./editions";

// ─── TYPES ──────────────────────────────────────────────────────────
export type MatrixTeam = {
  id: string;
  team_name: string;
  captain_name: string | null;
  member_count: number;
  is_frozen: boolean;
  allocated_problem_id: string | null;
  allocated_problem_title: string | null;
};

export type MatrixProblem = {
  id: string;
  title: string;
  track_id: string;
  track_name: string;
  track_icon: string | null;
};

export type AllocationMatrix = {
  teams: MatrixTeam[];
  problems: MatrixProblem[];
  preferences: Record<string, { 1?: string; 2?: string; 3?: string }>;
  allocations: Record<string, string>;
  problemStats: Record<
    string,
    { allocated_count: number; preferred_count: number }
  >;
};

// ─── ADMIN GUARD ────────────────────────────────────────────────────
async function requireChapterAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return { userId: user.id };
}

async function verifyAdminOnChapter(
  userId: string,
  chapterId: string,
  editionId: string
): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("chapter_core_team")
    .select("id")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

// ─── BUILD MATRIX ───────────────────────────────────────────────────
export async function getAllocationMatrix(
  chapterId: string,
  editionId: string
): Promise<AllocationMatrix> {
  const svc = await createServiceClient();

  // Teams in this chapter+edition
  const { data: teamData } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, problem_statement_id, is_frozen, captain:delegates!teams_captain_id_fkey(full_name), problem_statements(title), team_members(delegate_id)"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });

  const teamRows =
    (teamData as unknown as {
      id: string;
      team_name: string;
      problem_statement_id: string | null;
      is_frozen: boolean | null;
      captain: { full_name: string } | null;
      problem_statements: { title: string } | null;
      team_members: { delegate_id: string }[];
    }[]) ?? [];

  const teams: MatrixTeam[] = teamRows.map((t) => ({
    id: t.id,
    team_name: t.team_name,
    captain_name: t.captain?.full_name ?? null,
    member_count: t.team_members?.length ?? 0,
    is_frozen: t.is_frozen === true,
    allocated_problem_id: t.problem_statement_id,
    allocated_problem_title: t.problem_statements?.title ?? null,
  }));

  // Problem statements in this edition (any track)
  const { data: probData } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id, title, tracks!inner(id, name, icon, edition_id)")
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId)
    .order("display_order", { ascending: true });

  const probRows =
    (probData as unknown as {
      id: string;
      title: string;
      tracks: { id: string; name: string; icon: string | null };
    }[]) ?? [];

  const problems: MatrixProblem[] = probRows.map((p) => ({
    id: p.id,
    title: p.title,
    track_id: p.tracks.id,
    track_name: p.tracks.name,
    track_icon: p.tracks.icon,
  }));

  // Preferences for these teams
  const teamIds = teams.map((t) => t.id);
  const preferences: Record<string, { 1?: string; 2?: string; 3?: string }> = {};
  if (teamIds.length > 0) {
    const { data: prefData } = await svc
      .schema("future")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("problem_preferences" as any)
      .select("team_id, rank, problem_statement_id")
      .in("team_id", teamIds);

    const prefRows =
      (prefData as unknown as {
        team_id: string;
        rank: number;
        problem_statement_id: string;
      }[]) ?? [];

    for (const r of prefRows) {
      if (!preferences[r.team_id]) preferences[r.team_id] = {};
      const slot = preferences[r.team_id];
      if (r.rank === 1) slot[1] = r.problem_statement_id;
      else if (r.rank === 2) slot[2] = r.problem_statement_id;
      else if (r.rank === 3) slot[3] = r.problem_statement_id;
    }
  }

  // Allocations + per-problem stats
  const allocations: Record<string, string> = {};
  const problemStats: Record<
    string,
    { allocated_count: number; preferred_count: number }
  > = {};
  for (const p of problems) {
    problemStats[p.id] = { allocated_count: 0, preferred_count: 0 };
  }
  for (const t of teams) {
    if (t.allocated_problem_id) {
      allocations[t.id] = t.allocated_problem_id;
      const stat = problemStats[t.allocated_problem_id];
      if (stat) stat.allocated_count += 1;
    }
  }
  for (const tid of Object.keys(preferences)) {
    const slot = preferences[tid];
    const seen = new Set<string>();
    for (const k of [1, 2, 3] as const) {
      const pid = slot[k];
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        const stat = problemStats[pid];
        if (stat) stat.preferred_count += 1;
      }
    }
  }

  return { teams, problems, preferences, allocations, problemStats };
}

// ─── ALLOCATE ONE TEAM → ONE PROBLEM ────────────────────────────────
export async function allocateProblem(
  teamId: string,
  problemStatementId: string
): Promise<ActionResult> {
  const { userId } = await requireChapterAdmin();
  const svc = await createServiceClient();

  // Get team's chapter/edition + members + their captain email for notification
  const { data: teamRow } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, chapter_id, edition_id, team_name, captain:delegates!teams_captain_id_fkey(full_name, email), team_members(delegates(full_name, email))"
    )
    .eq("id", teamId)
    .maybeSingle();

  if (!teamRow) return { ok: false, error: "Team not found." };
  const t = teamRow as unknown as {
    id: string;
    chapter_id: string;
    edition_id: string;
    team_name: string;
    captain: { full_name: string | null; email: string | null } | null;
    team_members: {
      delegates: { full_name: string | null; email: string | null } | null;
    }[];
  };

  const adminOk = await verifyAdminOnChapter(userId, t.chapter_id, t.edition_id);
  if (!adminOk) {
    return {
      ok: false,
      error: "You're not on the core team for this team's chapter.",
    };
  }

  // Verify problem exists + active + same edition
  const { data: probRow } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id, title, tracks!inner(edition_id)")
    .eq("id", problemStatementId)
    .maybeSingle();
  if (!probRow) return { ok: false, error: "Problem statement not found." };
  const p = probRow as unknown as {
    id: string;
    title: string;
    tracks: { edition_id: string };
  };
  if (p.tracks.edition_id !== t.edition_id) {
    return {
      ok: false,
      error: "Problem belongs to a different edition.",
    };
  }

  // Update teams.problem_statement_id
  const { error: updErr } = await svc
    .schema("future")
    .from("teams")
    .update({
      problem_statement_id: problemStatementId,
      status: "problem_selected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId);
  if (updErr) return { ok: false, error: updErr.message };

  // Notification log entry per member with email
  const emails = new Set<string>();
  if (t.captain?.email) emails.add(t.captain.email);
  for (const m of t.team_members ?? []) {
    if (m.delegates?.email) emails.add(m.delegates.email);
  }

  if (emails.size > 0) {
    const subject = `Your team has been allocated: ${p.title}`;
    const preview = `Team ${t.team_name} has been allocated the problem "${p.title}". Begin Phase A research.`;
    const logRows = Array.from(emails).map((em) => ({
      trigger_type: "problem_allocated",
      recipient_email: em,
      recipient_subject_type: "team",
      recipient_subject_id: teamId,
      subject_line: subject,
      body_preview: preview,
      status: "pending",
    }));

    await svc
      .schema("future")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("notification_log" as any)
      .insert(logRows as never);
  }

  revalidatePath("/chapter/allocations");
  revalidatePath(`/chapter/teams/${teamId}`);
  revalidatePath("/me/team");
  return { ok: true, message: `Allocated: ${p.title}` };
}

// ─── AUTO-ALLOCATE (greedy bipartite assignment) ────────────────────
export async function autoAllocate(
  chapterId: string,
  editionId: string
): Promise<ActionResult> {
  const { userId } = await requireChapterAdmin();

  const adminOk = await verifyAdminOnChapter(userId, chapterId, editionId);
  if (!adminOk) {
    return {
      ok: false,
      error: "You're not on the core team for this chapter.",
    };
  }

  const matrix = await getAllocationMatrix(chapterId, editionId);
  const cap = MIN_TEAMS_PER_PROBLEM; // soft target — at most this many per problem during auto-pass

  // counts so far (from already-allocated rows in matrix)
  const counts: Record<string, number> = {};
  for (const p of matrix.problems) counts[p.id] = 0;
  for (const tid of Object.keys(matrix.allocations)) {
    const pid = matrix.allocations[tid];
    counts[pid] = (counts[pid] ?? 0) + 1;
  }

  type Pending = { team: MatrixTeam; ranked: string[] };
  const pending: Pending[] = [];
  for (const team of matrix.teams) {
    if (team.allocated_problem_id) continue; // already allocated, skip
    const slot = matrix.preferences[team.id] ?? {};
    const ranked: string[] = [];
    if (slot[1]) ranked.push(slot[1]);
    if (slot[2]) ranked.push(slot[2]);
    if (slot[3]) ranked.push(slot[3]);
    pending.push({ team, ranked });
  }

  // Sort: teams that have all 3 prefs come first (more info => assign earlier)
  pending.sort((a, b) => b.ranked.length - a.ranked.length);

  let allocatedCount = 0;
  const failed: string[] = [];

  for (const { team, ranked } of pending) {
    let pickedPid: string | null = null;

    // Try #1, #2, #3 in order, respecting the soft cap
    for (const pid of ranked) {
      if ((counts[pid] ?? 0) < cap) {
        pickedPid = pid;
        break;
      }
    }

    // Fallback: any problem with allocated_count < cap
    if (!pickedPid) {
      const fallback = matrix.problems.find(
        (p) => (counts[p.id] ?? 0) < cap
      );
      if (fallback) pickedPid = fallback.id;
    }

    // Final fallback: any problem at all (cap was hit everywhere)
    if (!pickedPid && matrix.problems.length > 0) {
      // Pick the least-loaded problem
      let least = matrix.problems[0];
      for (const p of matrix.problems) {
        if ((counts[p.id] ?? 0) < (counts[least.id] ?? 0)) least = p;
      }
      pickedPid = least.id;
    }

    if (!pickedPid) {
      failed.push(team.team_name);
      continue;
    }

    const result = await allocateProblem(team.id, pickedPid);
    if (result.ok) {
      counts[pickedPid] = (counts[pickedPid] ?? 0) + 1;
      allocatedCount += 1;
    } else {
      failed.push(team.team_name);
    }
  }

  revalidatePath("/chapter/allocations");

  if (failed.length > 0) {
    return {
      ok: true,
      message: `Allocated ${allocatedCount}. Could not allocate: ${failed.join(", ")}.`,
    };
  }
  if (allocatedCount === 0) {
    return { ok: true, message: "All teams already allocated." };
  }
  return { ok: true, message: `Allocated ${allocatedCount} team(s).` };
}
