"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";

// `team_invitations` was added in migration 120 but generated types haven't
// been regenerated yet — treat the schema client as untyped at the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

type TeamRow = {
  id: string;
  edition_id: string;
  chapter_id: string;
  captain_id: string | null;
  leader_delegate_id: string | null;
  is_frozen: boolean | null;
};

async function loadTeam(teamId: string): Promise<TeamRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, edition_id, chapter_id, captain_id, leader_delegate_id, is_frozen"
    )
    .eq("id", teamId)
    .maybeSingle();
  return (data as unknown as TeamRow) ?? null;
}

// ─── SEND INVITE ────────────────────────────────────────────────────
export async function sendInvite(input: {
  teamId: string;
  toDelegateId: string;
  message?: string;
}): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const team = await loadTeam(input.teamId);
  if (!team) return { ok: false, error: "Team not found." };

  // Caller must be on the team
  const { data: callerMember } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", input.teamId)
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (!callerMember) {
    return { ok: false, error: "Only team members can send invites." };
  }

  if (team.is_frozen) {
    return {
      ok: false,
      error: "This team is frozen — no new invites can be sent.",
    };
  }

  // Cannot invite past max size (5)
  const { count: memberCount } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id", { count: "exact", head: true })
    .eq("team_id", input.teamId);
  if ((memberCount ?? 0) >= TEAM_SIZE_MAX) {
    return {
      ok: false,
      error: `Team is already at the maximum of ${TEAM_SIZE_MAX} members.`,
    };
  }

  // Cannot invite a delegate who is already on the team
  const { data: alreadyMember } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", input.teamId)
    .eq("delegate_id", input.toDelegateId)
    .maybeSingle();
  if (alreadyMember) {
    return { ok: false, error: "That delegate is already on this team." };
  }

  // Cannot duplicate pending invite (UNIQUE(team_id, invited_delegate_id))
  const { data: existingInvite } = await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .select("id, status")
    .eq("team_id", input.teamId)
    .eq("invited_delegate_id", input.toDelegateId)
    .maybeSingle();
  const existing = existingInvite as { id: string; status: string } | null;
  if (existing && existing.status === "pending") {
    return {
      ok: false,
      error: "You already have a pending invite for that delegate.",
    };
  }

  // If a previous invite exists (declined/expired), update it back to pending.
  // Otherwise insert fresh. (Keeps the UNIQUE constraint happy.)
  if (existing) {
    const { error } = await svc
      .schema("future")
      .from("team_invitations" as AnyClient)
      .update({
        status: "pending",
        invited_by: session.id,
        message: input.message ?? null,
        created_at: new Date().toISOString(),
        responded_at: null,
      } as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await svc
      .schema("future")
      .from("team_invitations" as AnyClient)
      .insert({
        team_id: input.teamId,
        invited_by: session.id,
        invited_delegate_id: input.toDelegateId,
        message: input.message ?? null,
        status: "pending",
      } as never);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/yi-future/me/team/directory");
  revalidatePath("/yi-future/me/team/invites");
  return { ok: true, message: "Invite sent." };
}

// ─── RESPOND TO INVITE ──────────────────────────────────────────────
export async function respondInvite(
  inviteId: string,
  response: "accepted" | "declined"
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();

  const { data: inviteRaw } = await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .select("id, team_id, invited_delegate_id, status")
    .eq("id", inviteId)
    .maybeSingle();
  const invite = inviteRaw as {
    id: string;
    team_id: string;
    invited_delegate_id: string;
    status: string;
  } | null;
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.invited_delegate_id !== session.id) {
    return { ok: false, error: "This invite is not addressed to you." };
  }
  if (invite.status !== "pending") {
    return { ok: false, error: "That invite is no longer pending." };
  }

  const nowIso = new Date().toISOString();

  if (response === "declined") {
    const { error } = await svc
      .schema("future")
      .from("team_invitations" as AnyClient)
      .update({ status: "declined", responded_at: nowIso } as never)
      .eq("id", inviteId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/yi-future/me/team/invites");
    return { ok: true, message: "Invite declined." };
  }

  // ACCEPTED — must check team frozen + size + UNIQUE-per-edition
  const team = await loadTeam(invite.team_id);
  if (!team) return { ok: false, error: "Team no longer exists." };
  if (team.is_frozen) {
    return { ok: false, error: "That team is frozen — can't accept." };
  }

  const { count: memberCount } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id", { count: "exact", head: true })
    .eq("team_id", invite.team_id);
  if ((memberCount ?? 0) >= TEAM_SIZE_MAX) {
    return {
      ok: false,
      error: `That team is already at ${TEAM_SIZE_MAX} members.`,
    };
  }

  // Insert into team_members (UNIQUE INDEX uniq_delegate_per_edition will block
  // a delegate from joining a 2nd team in the same edition).
  const { error: insErr } = await svc
    .schema("future")
    .from("team_members")
    .insert({
      team_id: invite.team_id,
      delegate_id: session.id,
      role_in_team: "member",
    } as never);
  if (insErr) {
    return {
      ok: false,
      error:
        insErr.message ??
        "Couldn't join that team. You may already be on another team this edition.",
    };
  }

  // Mark this invite accepted
  const { error: upErr } = await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .update({ status: "accepted", responded_at: nowIso } as never)
    .eq("id", inviteId);
  if (upErr) return { ok: false, error: upErr.message };

  // Auto-decline ALL OTHER pending invites for this delegate (one team / edition).
  await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .update({ status: "declined", responded_at: nowIso } as never)
    .eq("invited_delegate_id", session.id)
    .eq("status", "pending")
    .neq("id", inviteId);

  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/invites");
  revalidatePath("/yi-future/me/team/directory");
  return { ok: true, message: "You joined the team." };
}

// ─── FREEZE TEAM ────────────────────────────────────────────────────
export async function freezeTeam(teamId: string): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };

  // Leader OR captain (back-compat) can freeze
  const isLeader = team.leader_delegate_id === session.id;
  const isCaptain = team.captain_id === session.id;
  if (!isLeader && !isCaptain) {
    return {
      ok: false,
      error: "Only the team leader or captain can freeze the team.",
    };
  }

  if (team.is_frozen) {
    return { ok: false, error: "Team is already frozen." };
  }

  const nowIso = new Date().toISOString();
  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      is_frozen: true,
      frozen_at: nowIso,
      updated_at: nowIso,
    } as never)
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  // Cancel all pending invites for this team
  await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .update({ status: "expired", responded_at: nowIso } as never)
    .eq("team_id", teamId)
    .eq("status", "pending");

  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  revalidatePath("/yi-future/me/team/invites");
  return { ok: true, message: "Team frozen." };
}

// ─── PICK PROBLEM STATEMENT (delegate auth — any team member) ───────
export async function pickProblemAsDelegate(
  teamId: string,
  problemId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };

  if (!team.is_frozen) {
    return {
      ok: false,
      error: "Confirm your team first (freeze it) before picking a problem.",
    };
  }

  const { data: member } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", teamId)
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (!member) {
    return { ok: false, error: "You must be on this team to pick a problem." };
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      problem_statement_id: problemId,
      status: "problem_selected",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me");
  return { ok: true, message: "Problem selected." };
}

// ─── CLEAR PROBLEM (delegate auth — captain/leader only) ────────────
export async function clearProblemAsDelegate(
  teamId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };

  const isLeader = team.leader_delegate_id === session.id;
  const isCaptain = team.captain_id === session.id;
  if (!isLeader && !isCaptain) {
    return {
      ok: false,
      error: "Only the team leader or captain can re-pick the problem.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      problem_statement_id: null,
      status: "registered",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me");
  return { ok: true };
}

// ─── SET LEADER (captain-only) ──────────────────────────────────────
export async function setLeader(
  teamId: string,
  delegateId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };

  if (team.captain_id !== session.id) {
    return { ok: false, error: "Only the captain can change the leader." };
  }

  if (team.is_frozen) {
    return { ok: false, error: "Team is frozen — leader can't be changed." };
  }

  // The new leader must be on the team
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
      error: "That delegate is not on this team.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      leader_delegate_id: delegateId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me/team");
  return { ok: true, message: "Leader updated." };
}
