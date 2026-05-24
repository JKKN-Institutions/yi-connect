"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
}

// ─── CREATE TEAM ────────────────────────────────────────────────────
export async function createTeam(
  input: { chapterId: string; editionId: string },
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const team_name = String(formData.get("team_name") ?? "").trim();
  if (!team_name) return { ok: false, error: "Team name is required." };
  if (team_name.length > 80) {
    return { ok: false, error: "Team name must be under 80 characters." };
  }

  const svc = await createServiceClient();

  // Check uniqueness within the edition
  const { data: existing } = await svc
    .schema("future")
    .from("teams")
    .select("id")
    .eq("edition_id", input.editionId)
    .eq("team_name", team_name)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: "Another team in this edition already has that name.",
    };
  }

  const { data: inserted, error } = await svc
    .schema("future")
    .from("teams")
    .insert({
      chapter_id: input.chapterId,
      edition_id: input.editionId,
      team_name,
      status: "registered",
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/chapter/teams");
  const newId = (inserted as { id: string } | null)?.id;
  if (newId) {
    redirect(`/yi-future/chapter/teams/${newId}`);
  }
  redirect("/yi-future/chapter/teams");
}

// ─── UPDATE TEAM NAME ───────────────────────────────────────────────
export async function updateTeamName(
  id: string,
  editionId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const team_name = String(formData.get("team_name") ?? "").trim();
  if (!team_name) return { ok: false, error: "Team name is required." };

  const svc = await createServiceClient();

  const { data: clash } = await svc
    .schema("future")
    .from("teams")
    .select("id")
    .eq("edition_id", editionId)
    .eq("team_name", team_name)
    .neq("id", id)
    .maybeSingle();
  if (clash) {
    return { ok: false, error: "Another team has that name already." };
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({ team_name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${id}`);
  return { ok: true, message: "Team name updated." };
}

// ─── SET CAPTAIN ────────────────────────────────────────────────────
export async function setTeamCaptain(
  teamId: string,
  delegateId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  // Verify delegate is on the team
  const { data: member } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", teamId)
    .eq("delegate_id", delegateId)
    .maybeSingle();
  if (!member) {
    return {
      ok: false,
      error: "That delegate is not on this team. Add them first.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({ captain_id: delegateId, updated_at: new Date().toISOString() })
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  // Mark member's role_in_team = "captain" for clarity
  await svc
    .schema("future")
    .from("team_members")
    .update({ role_in_team: "captain" })
    .eq("team_id", teamId)
    .eq("delegate_id", delegateId);

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team");
  return { ok: true, message: "Captain set." };
}

// ─── PICK PROBLEM STATEMENT ─────────────────────────────────────────
// Multiple teams in the same chapter MAY pick the same problem statement
// — explicit product decision 2026-05-23. Diverse approaches enrich the
// chapter final. Admin sees distribution on /chapter/allocations and can
// re-allocate manually if balance becomes a concern.
export async function pickProblemStatement(
  teamId: string,
  problemId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      problem_statement_id: problemId,
      status: "problem_selected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team");
  return { ok: true, message: "Problem selected." };
}

// ─── CLEAR PROBLEM (let them re-pick) ───────────────────────────────
export async function clearProblem(teamId: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      problem_statement_id: null,
      status: "registered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  return { ok: true };
}

// ─── DELETE TEAM ────────────────────────────────────────────────────
export async function deleteTeam(id: string): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();
  // team_members cascade; submissions etc. will FK-block if present
  const { error } = await svc
    .schema("future")
    .from("teams")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/yi-future/chapter/teams");
  return { ok: true, message: "Team deleted." };
}

// NOTE: validateTeamForSubmission moved to src/lib/team-validation.ts
// (files marked "use server" can only export async functions).
