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

  revalidatePath("/chapter/jury");
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

  revalidatePath("/chapter/jury");
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
  revalidatePath("/chapter/jury");
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
  revalidatePath("/chapter/jury");
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
  revalidatePath("/chapter/jury");
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
  revalidatePath("/chapter/jury");
  return { ok: true, message: "Unassigned." };
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

  revalidatePath("/chapter/jury");
  return {
    ok: true,
    message: `Allocated ${rows.length} assignments across ${teamList.length} teams.`,
  };
}
