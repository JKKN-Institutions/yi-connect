"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateAccessCode } from "@/lib/yi-future/access-code";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import { JURY_ARCHETYPES } from "@/lib/yi-future/constants";

type JuryArchetype = Database["future"]["Enums"]["jury_archetype"];

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

function isArchetype(x: string): x is JuryArchetype {
  return (JURY_ARCHETYPES as readonly string[]).includes(x);
}

async function uniqueAccessCode(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const code = generateAccessCode();
    const { data } = await svc
      .schema("future")
      .from("jury_assignments")
      .select("id")
      .eq("access_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate unique jury access code.");
}

// ─── CREATE JURY ────────────────────────────────────────────────────
export async function createJury(
  input: { editionId: string; scope: string; eventId: string | null },
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const jury_name = String(formData.get("jury_name") ?? "").trim();
  const jury_title = String(formData.get("jury_title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const archetype = String(formData.get("archetype") ?? "").trim();

  if (!jury_name) return { ok: false, error: "Name is required." };
  if (!isArchetype(archetype)) {
    return { ok: false, error: "Pick an archetype." };
  }

  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);

  const { error } = await svc
    .schema("future")
    .from("jury_assignments")
    .insert({
      edition_id: input.editionId,
      event_id: input.eventId,
      scope: input.scope,
      archetype: archetype as JuryArchetype,
      jury_name,
      jury_title,
      organization,
      email,
      phone,
      bio,
      access_code,
      is_active: true,
    });
  if (error) return { ok: false, error: error.message };

  // Upsert yi_directory.people — cross-app identity bridge
  if (email) {
    await svc
      .schema("yi_directory" as "public")
      .from("people")
      .upsert(
        {
          full_name: jury_name,
          email,
          phone: phone || null,
          is_active: true,
        } as never,
        { onConflict: "email" }
      );
  }

  revalidatePath("/yi-future/chapter/jury");
  redirect("/yi-future/chapter/jury");
}

export async function updateJury(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const jury_name = String(formData.get("jury_name") ?? "").trim();
  const jury_title = String(formData.get("jury_title") ?? "").trim() || null;
  const organization =
    String(formData.get("organization") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const archetype = String(formData.get("archetype") ?? "").trim();

  if (!jury_name) return { ok: false, error: "Name is required." };
  if (!isArchetype(archetype)) {
    return { ok: false, error: "Pick an archetype." };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("jury_assignments")
    .update({
      jury_name,
      jury_title,
      organization,
      email,
      phone,
      bio,
      archetype: archetype as JuryArchetype,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/jury");
  redirect("/yi-future/chapter/jury");
}

export async function regenerateJuryCode(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const access_code = await uniqueAccessCode(svc);
  const { error } = await svc
    .schema("future")
    .from("jury_assignments")
    .update({ access_code })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/jury");
  return { ok: true, message: `New code: ${access_code}` };
}

export async function deleteJury(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  // Remove team assignments first
  await svc
    .schema("future")
    .from("jury_team_assignments")
    .delete()
    .eq("jury_id", id);
  const { error } = await svc
    .schema("future")
    .from("jury_assignments")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/jury");
  return { ok: true, message: "Jury removed." };
}

// ─── ASSIGN / UNASSIGN ──────────────────────────────────────────────
export async function assignJuryToTeam(
  juryId: string,
  teamId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .upsert(
      { jury_id: juryId, team_id: teamId },
      { onConflict: "jury_id,team_id" }
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/jury");
  return { ok: true, message: "Assigned." };
}

export async function unassignJuryFromTeam(
  juryId: string,
  teamId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .delete()
    .eq("jury_id", juryId)
    .eq("team_id", teamId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/jury");
  return { ok: true, message: "Unassigned." };
}

// ─── UPDATE JURY TRACK (category) ──────────────────────────────────
export async function updateJuryTrack(
  juryId: string,
  trackId: string | null
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("jury_assignments")
    .update({ track_id: trackId || null })
    .eq("id", juryId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/jury");
  revalidatePath("/yi-future/chapter/jury/categories");
  return { ok: true, message: "Track updated." };
}

// ─── AUTO-ASSIGN JURY TO TEAMS BY TRACK ────────────────────────────
// For each track: every jury assigned to that track gets assigned to
// every team whose problem_statement belongs to that track.
export async function autoAssignJuryToTeams(
  chapterId: string,
  editionId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  // 1. Fetch all jury with a track_id set
  const { data: juryRows } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("id, track_id")
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .not("track_id", "is", null);

  const juryList = (juryRows as unknown as { id: string; track_id: string }[]) ?? [];
  if (juryList.length === 0)
    return { ok: false, error: "No jury members have a track assigned." };

  // 2. Fetch teams with their problem_statement → track mapping
  const { data: teamRows } = await svc
    .schema("future")
    .from("teams")
    .select("id, problem_statement_id, problem_statements(track_id)")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .not("problem_statement_id", "is", null);

  type TeamRow = {
    id: string;
    problem_statement_id: string;
    problem_statements: { track_id: string } | null;
  };
  const teamList = (teamRows as unknown as TeamRow[]) ?? [];
  if (teamList.length === 0)
    return { ok: false, error: "No teams with problem statements found." };

  // 3. Build jury-by-track and teams-by-track maps
  const juryByTrack = new Map<string, string[]>();
  for (const j of juryList) {
    const arr = juryByTrack.get(j.track_id) ?? [];
    arr.push(j.id);
    juryByTrack.set(j.track_id, arr);
  }

  const teamsByTrack = new Map<string, string[]>();
  for (const t of teamList) {
    const trackId = t.problem_statements?.track_id;
    if (!trackId) continue;
    const arr = teamsByTrack.get(trackId) ?? [];
    arr.push(t.id);
    teamsByTrack.set(trackId, arr);
  }

  // 4. Create cross-product assignments per track
  const rows: { jury_id: string; team_id: string }[] = [];
  for (const [trackId, juryIds] of juryByTrack) {
    const teamIds = teamsByTrack.get(trackId) ?? [];
    for (const juryId of juryIds) {
      for (const teamId of teamIds) {
        rows.push({ jury_id: juryId, team_id: teamId });
      }
    }
  }

  if (rows.length === 0)
    return {
      ok: false,
      error: "No matching track↔team combinations found.",
    };

  const { error } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .upsert(rows, { onConflict: "jury_id,team_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/jury");
  revalidatePath("/yi-future/chapter/jury/categories");
  return {
    ok: true,
    message: `Created ${rows.length} assignments across ${juryByTrack.size} tracks.`,
  };
}

// ─── AUTO ALLOCATE (bipartite with archetype diversity) ──────────
export async function autoAllocateJury(
  chapterId: string,
  editionId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  const [{ data: teams }, { data: jury }] = await Promise.all([
    svc
      .schema("future")
      .from("teams")
      .select("id")
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("jury_assignments")
      .select("id, archetype")
      .eq("edition_id", editionId)
      .eq("is_active", true),
  ]);
  const teamList = (teams as unknown as { id: string }[]) ?? [];
  const juryList =
    (jury as unknown as { id: string; archetype: JuryArchetype }[]) ?? [];

  if (teamList.length === 0)
    return { ok: false, error: "No teams to allocate." };
  if (juryList.length < 3)
    return {
      ok: false,
      error: "Need at least 3 jury members (for 3 reviewers per team).",
    };

  // Simple round-robin assignment: each team gets 3 jurors with different archetypes when possible.
  const rows: { team_id: string; jury_id: string }[] = [];
  for (let ti = 0; ti < teamList.length; ti++) {
    const team = teamList[ti];
    const picked = new Set<string>(); // archetypes picked so far
    const assigned: string[] = [];
    // Rotate the jury list starting at a different index per team for spread
    const rotated = [
      ...juryList.slice(ti % juryList.length),
      ...juryList.slice(0, ti % juryList.length),
    ];
    // First pass: try unique archetypes
    for (const j of rotated) {
      if (assigned.length >= 3) break;
      if (!picked.has(j.archetype)) {
        assigned.push(j.id);
        picked.add(j.archetype);
      }
    }
    // Second pass: fill remainder
    for (const j of rotated) {
      if (assigned.length >= 3) break;
      if (!assigned.includes(j.id)) assigned.push(j.id);
    }
    for (const jid of assigned) rows.push({ team_id: team.id, jury_id: jid });
  }

  const { error } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .upsert(rows, { onConflict: "jury_id,team_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/jury");
  return {
    ok: true,
    message: `Allocated ${rows.length} assignments across ${teamList.length} teams.`,
  };
}
