"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

// ─── ADD MEMBER ─────────────────────────────────────────────────────
export async function addMember(
  teamId: string,
  delegateId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  // Check current size
  const { count } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if ((count ?? 0) >= TEAM_SIZE_MAX) {
    return {
      ok: false,
      error: `Team is already full (max ${TEAM_SIZE_MAX} members).`,
    };
  }

  // Check this delegate isn't already on a different team (uniq idx exists, but surface a friendly error)
  const { data: existing } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", delegateId)
    .maybeSingle();
  if (existing) {
    const ex = existing as { team_id: string };
    if (ex.team_id === teamId) {
      return { ok: false, error: "Already on this team." };
    }
    return {
      ok: false,
      error: "This delegate is already on another team in this edition.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("team_members")
    .insert({ team_id: teamId, delegate_id: delegateId, role_in_team: "member" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team");
  return { ok: true, message: "Member added." };
}

// ─── REMOVE MEMBER ──────────────────────────────────────────────────
export async function removeMember(
  teamId: string,
  delegateId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  // If captain, clear captain_id on the team
  const { data: team } = await svc
    .schema("future")
    .from("teams")
    .select("captain_id")
    .eq("id", teamId)
    .maybeSingle();
  const wasCaptain = (team as { captain_id: string | null } | null)?.captain_id === delegateId;
  if (wasCaptain) {
    await svc
      .schema("future")
      .from("teams")
      .update({ captain_id: null })
      .eq("id", teamId);
  }

  const { error } = await svc
    .schema("future")
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("delegate_id", delegateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team");
  return { ok: true, message: "Member removed." };
}

// ─── SET ROLE ───────────────────────────────────────────────────────
export async function setMemberRole(
  teamId: string,
  delegateId: string,
  role: string
): Promise<ActionResult> {
  await requireAuth();
  const allowed = ["member", "captain", "researcher", "presenter"];
  if (!allowed.includes(role)) {
    return { ok: false, error: "Invalid role." };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("team_members")
    .update({ role_in_team: role })
    .eq("team_id", teamId)
    .eq("delegate_id", delegateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  return { ok: true };
}
