"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { INVITE_EXPIRY_DAYS, isInviteExpired } from "@/lib/yi-future/invite-expiry";

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

// ─── CREATE TEAM (delegate self-service) ────────────────────────────
export async function createTeamAsDelegate(
  teamName: string
): Promise<ActionResult & { teamId?: string }> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const name = teamName.trim();
  if (!name) return { ok: false, error: "Team name is required." };
  if (name.length > 80) return { ok: false, error: "Team name must be under 80 characters." };

  const svc = await createServiceClient();

  // Get delegate's chapter + edition
  const { data: me } = await svc
    .schema("future")
    .from("delegates")
    .select("chapter_id, edition_id")
    .eq("id", session.id)
    .maybeSingle();
  if (!me) return { ok: false, error: "Delegate record not found." };
  const { chapter_id, edition_id } = me as { chapter_id: string; edition_id: string };

  // Check delegate isn't already on a team
  const { data: existing } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "You're already on a team." };

  // Check name uniqueness in edition
  const { data: clash } = await svc
    .schema("future")
    .from("teams")
    .select("id")
    .eq("edition_id", edition_id)
    .eq("team_name", name)
    .maybeSingle();
  if (clash) return { ok: false, error: "Another team already has that name." };

  // Create team with this delegate as captain
  const { data: inserted, error: insErr } = await svc
    .schema("future")
    .from("teams")
    .insert({
      chapter_id,
      edition_id,
      team_name: name,
      captain_id: session.id,
      leader_delegate_id: session.id,
      status: "registered",
    } as never)
    .select("id")
    .maybeSingle();
  if (insErr) return { ok: false, error: insErr.message };

  const teamId = (inserted as { id: string } | null)?.id;
  if (!teamId) return { ok: false, error: "Failed to create team." };

  // Add delegate as first member (captain role)
  await svc
    .schema("future")
    .from("team_members")
    .insert({
      team_id: teamId,
      delegate_id: session.id,
      role_in_team: "captain",
    } as never);

  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  return { ok: true, message: "Team created! You are the captain.", teamId };
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
    .select("id, status, created_at")
    .eq("team_id", input.teamId)
    .eq("invited_delegate_id", input.toDelegateId)
    .maybeSingle();
  const existing = existingInvite as
    | { id: string; status: string; created_at: string }
    | null;
  // A still-valid pending invite blocks a duplicate; an expired one (past the
  // 7-day window) falls through and is re-sent below with a fresh clock.
  if (
    existing &&
    existing.status === "pending" &&
    !isInviteExpired(existing.created_at)
  ) {
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
    .select("id, team_id, invited_delegate_id, status, created_at")
    .eq("id", inviteId)
    .maybeSingle();
  const invite = inviteRaw as {
    id: string;
    team_id: string;
    invited_delegate_id: string;
    status: string;
    created_at: string;
  } | null;
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.invited_delegate_id !== session.id) {
    return { ok: false, error: "This invite is not addressed to you." };
  }
  if (invite.status !== "pending") {
    return { ok: false, error: "That invite is no longer pending." };
  }

  const nowIso = new Date().toISOString();

  // Time-based expiry: a pending invite older than the window can no longer be
  // acted on. Flip it to "expired" so the UI and future reads stay consistent.
  if (isInviteExpired(invite.created_at)) {
    await svc
      .schema("future")
      .from("team_invitations" as AnyClient)
      .update({ status: "expired", responded_at: nowIso } as never)
      .eq("id", inviteId);
    return {
      ok: false,
      error: `This invite has expired — invites are valid for ${INVITE_EXPIRY_DAYS} days. Ask the team to send you a new one.`,
    };
  }

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

// ─── UNFREEZE TEAM (chapter-admin auth) ─────────────────────────────
// The UI copy tells delegates to "ask your chapter admin to unfreeze".
// freezeTeam gates by team ownership (leader/captain); the chapter-admin
// equivalent of that ownership check is getChapterContext + the same
// chapter ownership check the team-detail page enforces.
export async function unfreezeTeam(teamId: string): Promise<ActionResult> {
  const ctx = await getChapterContext();
  if (!ctx) {
    return { ok: false, error: "Sign in as a chapter admin first." };
  }

  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };

  // Ownership: the team must belong to the admin's chapter.
  if (team.chapter_id !== ctx.chapterId) {
    return {
      ok: false,
      error: "Only the team's chapter admin can unfreeze it.",
    };
  }

  if (!team.is_frozen) {
    return { ok: false, error: "Team is not frozen." };
  }

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({
      is_frozen: false,
      frozen_at: null,
      updated_at: nowIso,
    } as never)
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  revalidatePath("/yi-future/me/team/invites");
  return { ok: true, message: "Team unfrozen." };
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

  if (team.is_frozen) {
    return {
      ok: false,
      error:
        "Team is frozen — ask your chapter admin to unfreeze before changing the problem.",
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

// ─── RENAME TEAM (captain self-service) ─────────────────────────────
// BUG-452/458/459: the delegate "My team" page called the admin-gated
// updateTeamName, bouncing every captain to /yi-future/forbidden.
export async function renameTeamAsCaptain(
  teamId: string,
  newName: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const name = newName.trim();
  if (!name) return { ok: false, error: "Team name is required." };
  if (name.length > 80) {
    return { ok: false, error: "Team name must be under 80 characters." };
  }

  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };
  if (!team.captain_id || team.captain_id !== session.id) {
    return { ok: false, error: "Only the team captain can rename the team." };
  }
  if (team.is_frozen) {
    return {
      ok: false,
      error:
        "Your team is submitted and locked — ask your chapter admin to unlock it before renaming.",
    };
  }

  const svc = await createServiceClient();
  const { data: clash } = await svc
    .schema("future")
    .from("teams")
    .select("id")
    .eq("edition_id", team.edition_id)
    .eq("team_name", name)
    .neq("id", teamId)
    .maybeSingle();
  if (clash) {
    return { ok: false, error: "Another team already has that name." };
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .update({ team_name: name, updated_at: new Date().toISOString() } as never)
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/team");
  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  return { ok: true, message: "Team name updated." };
}

// ─── LEAVE MY TEAM (member self-service) ────────────────────────────
// BUG-454/467/443: membership could only be ended by an admin. A member can
// now leave their own (unlocked) team. Captains can't leave — they delete the
// team (if it was a mistake) or ask the chapter admin to transfer captaincy.
export async function leaveMyTeam(): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const { data: membership } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "You're not on a team." };
  const teamId = (membership as { team_id: string }).team_id;

  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };
  if (team.is_frozen) {
    return {
      ok: false,
      error:
        "Your team is submitted and locked — ask your chapter admin to unlock it before leaving.",
    };
  }
  if (team.captain_id === session.id) {
    return {
      ok: false,
      error:
        "You're the team captain. Delete the team if you created it by mistake, or ask your chapter admin to transfer captaincy first.",
    };
  }

  const { error } = await svc
    .schema("future")
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("delegate_id", session.id);
  if (error) return { ok: false, error: error.message };

  // If the leaver was the designated leader, hand leadership back to the captain.
  if (team.leader_delegate_id === session.id) {
    await svc
      .schema("future")
      .from("teams")
      .update({
        leader_delegate_id: team.captain_id,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", teamId);
  }

  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  revalidatePath("/yi-future/me/team/invites");
  return { ok: true, message: "You left the team." };
}

// ─── DELETE TEAM (captain self-service) ─────────────────────────────
// BUG-403/414/420/468: mis-created teams could only be removed by an admin.
// The captain can delete their own team ONLY while it is unlocked and has no
// evaluations, submissions, advancements, or awards — evaluations/submissions
// CASCADE on team delete, so this guard is what protects scored work.
export async function deleteMyTeamAsCaptain(
  teamId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };
  if (!team.captain_id || team.captain_id !== session.id) {
    return { ok: false, error: "Only the team captain can delete the team." };
  }
  if (team.is_frozen) {
    return {
      ok: false,
      error:
        "Your team is submitted and locked — ask your chapter admin if it really needs to be deleted.",
    };
  }

  const svc = await createServiceClient();
  const guards: [table: string, label: string][] = [
    ["evaluations", "jury evaluations"],
    ["mentor_evaluations", "mentor evaluations"],
    ["submissions", "submissions"],
    ["advancements", "round advancements"],
    ["awards", "awards"],
  ];
  for (const [table, label] of guards) {
    const { count } = await (svc as AnyClient)
      .schema("future")
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `This team already has ${label} — it can't be deleted. Contact your chapter admin.`,
      };
    }
  }

  const { error } = await svc
    .schema("future")
    .from("teams")
    .delete()
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me");
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  revalidatePath("/yi-future/me/team/invites");
  revalidatePath("/yi-future/chapter/teams");
  return { ok: true, message: "Team deleted." };
}

// ─── REMOVE MEMBER (captain self-service) ───────────────────────────
// BUG-432/444: only admins could remove a member. The captain can now remove
// a (non-self) member from their own unlocked team; the removed delegate can
// be re-invited later or join another team.
export async function removeMemberAsCaptain(
  teamId: string,
  delegateId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const team = await loadTeam(teamId);
  if (!team) return { ok: false, error: "Team not found." };
  if (!team.captain_id || team.captain_id !== session.id) {
    return { ok: false, error: "Only the team captain can remove members." };
  }
  if (team.is_frozen) {
    return {
      ok: false,
      error:
        "Your team is submitted and locked — ask your chapter admin to unlock it before changing members.",
    };
  }
  if (delegateId === session.id) {
    return {
      ok: false,
      error:
        "You can't remove yourself — delete the team if it was a mistake.",
    };
  }

  const svc = await createServiceClient();
  const { data: member } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", teamId)
    .eq("delegate_id", delegateId)
    .maybeSingle();
  if (!member) {
    return { ok: false, error: "That delegate is not on this team." };
  }

  const { error } = await svc
    .schema("future")
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("delegate_id", delegateId);
  if (error) return { ok: false, error: error.message };

  // If the removed member was the designated leader, hand it back to the captain.
  if (team.leader_delegate_id === delegateId) {
    await svc
      .schema("future")
      .from("teams")
      .update({
        leader_delegate_id: team.captain_id,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", teamId);
  }

  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  return { ok: true, message: "Member removed." };
}

// ─── CANCEL PENDING INVITE (team-member self-service) ───────────────
// BUG-444: an invite sent to the wrong person could not be withdrawn. Any
// current member of the team (same policy as sendInvite) can cancel a
// still-pending invite; the invitee simply stops seeing it.
export async function cancelTeamInvite(
  inviteId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate first." };
  }

  const svc = await createServiceClient();
  const { data: inviteRaw } = await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .select("id, team_id, status")
    .eq("id", inviteId)
    .maybeSingle();
  const invite = inviteRaw as {
    id: string;
    team_id: string;
    status: string;
  } | null;
  if (!invite) return { ok: false, error: "Invite not found." };

  const { data: callerMember } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id")
    .eq("team_id", invite.team_id)
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (!callerMember) {
    return { ok: false, error: "Only team members can cancel this invite." };
  }
  if (invite.status !== "pending") {
    return { ok: false, error: "That invite is no longer pending." };
  }

  const { error } = await svc
    .schema("future")
    .from("team_invitations" as AnyClient)
    .update({
      status: "expired",
      responded_at: new Date().toISOString(),
    } as never)
    .eq("id", inviteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/directory");
  revalidatePath("/yi-future/me/team/invites");
  return { ok: true, message: "Invite cancelled." };
}
