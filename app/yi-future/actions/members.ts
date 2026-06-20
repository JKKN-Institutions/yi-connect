"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";

// team_invitations isn't in the generated types yet — untyped at the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function requireAuth(): Promise<void> {
  await requireFutureAdmin();
}

// ─── INVITE MEMBER (admin) ──────────────────────────────────────────
// Consent-based: an admin/chair can SEND an invite, but the student must
// accept it before they join (mirrors the captain's own invite flow). An
// admin can no longer drop a student straight onto a team — and never onto a
// locked team. (2026-06-20, Nashik report: a student was placed on a frozen
// team without accepting, which then blocked them from forming their own.)
export async function inviteMember(
  teamId: string,
  delegateId: string
): Promise<ActionResult> {
  await requireAuth();
  const svc = await createServiceClient();

  // Load the team — invited_by is NOT NULL (use the captain) and we must not
  // target a locked team.
  const { data: teamRaw } = await svc
    .schema("future")
    .from("teams")
    .select("id, captain_id, leader_delegate_id, is_frozen")
    .eq("id", teamId)
    .maybeSingle();
  const team = teamRaw as {
    id: string;
    captain_id: string | null;
    leader_delegate_id: string | null;
    is_frozen: boolean | null;
  } | null;
  if (!team) return { ok: false, error: "Team not found." };
  if (team.is_frozen) {
    return {
      ok: false,
      error: "This team is locked — you can't invite new members.",
    };
  }
  const invitedBy = team.captain_id ?? team.leader_delegate_id;
  if (!invitedBy) {
    return { ok: false, error: "Set a team captain before inviting members." };
  }

  // Size check
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

  // Already on a team? (the unique index allows only one team per delegate)
  const { data: member } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", delegateId)
    .maybeSingle();
  if (member) {
    const m = member as { team_id: string };
    return {
      ok: false,
      error:
        m.team_id === teamId
          ? "Already on this team."
          : "This delegate is already on another team in this edition.",
    };
  }

  // Create / re-send the invite, respecting UNIQUE(team_id, invited_delegate_id).
  const { data: existingRaw } = await (svc as AnyClient)
    .schema("future")
    .from("team_invitations")
    .select("id, status, created_at")
    .eq("team_id", teamId)
    .eq("invited_delegate_id", delegateId)
    .maybeSingle();
  const existing = existingRaw as
    | { id: string; status: string; created_at: string }
    | null;
  if (
    existing &&
    existing.status === "pending" &&
    !isInviteExpired(existing.created_at)
  ) {
    return {
      ok: false,
      error: "That delegate already has a pending invite to this team.",
    };
  }

  const nowIso = new Date().toISOString();
  if (existing) {
    const { error } = await (svc as AnyClient)
      .schema("future")
      .from("team_invitations")
      .update({
        status: "pending",
        invited_by: invitedBy,
        created_at: nowIso,
        responded_at: null,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (svc as AnyClient)
      .schema("future")
      .from("team_invitations")
      .insert({
        team_id: teamId,
        invited_by: invitedBy,
        invited_delegate_id: delegateId,
        status: "pending",
      });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team/invites");
  return {
    ok: true,
    message: "Invitation sent — the student must accept it to join.",
  };
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
