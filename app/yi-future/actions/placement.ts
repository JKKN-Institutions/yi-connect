"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — approve a reviewed batch of team placements.
//
// SUGGEST-THEN-APPROVE. This action is the ONLY write path of the placement
// screen and it runs only on an explicit human click, with the exact rows the
// reviewer left ticked. There is no auto-assign entry point anywhere.
//
// It does NOT insert future.team_members. It calls the existing consent-based
// `inviteMember`, which creates a pending future.team_invitations row — the
// student still has to accept before they join a team (locked product decision
// 2026-06-20 after the Nashik report: an admin must not be able to drop a
// student onto a team). So a half-applied batch can never corrupt a roster;
// the worst case is that some students got an invitation and others didn't,
// and this action reports that row by row.
//
// This file is "use server": every export is async. Types and the batch cap
// live in lib/yi-future/placement.ts (a non-async export here breaks the
// Vercel build for the whole app).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { fetchAllRows } from "@/lib/pagination";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { PLACEMENT_BATCH_MAX } from "@/lib/yi-future/placement";
import type {
  PlacementBatchResult,
  PlacementRowResult,
} from "@/lib/yi-future/placement";
import { inviteMember } from "@/app/yi-future/actions/members";

type Pair = { delegateId: string; teamId: string };

/**
 * Send invitations for the (delegate → team) pairs a chapter admin approved.
 *
 * Nothing in the payload is trusted: the caller is gated on `chapterId`, then
 * every delegate id and team id is re-resolved against that chapter and the
 * active edition. A pair naming another chapter's team — or a team that filled
 * up since the page rendered — is rejected as its own row, not silently
 * dropped and not allowed to poison the rest of the batch.
 */
export async function approvePlacements(
  chapterId: string,
  pairs: Pair[]
): Promise<PlacementBatchResult> {
  // Fails CLOSED (null/unknown chapter denies) and denies EXPLICITLY by
  // redirecting to /yi-future/forbidden — never a silent bounce to a dashboard.
  await requireChapterAdmin(chapterId);

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return { ok: false, error: "Nothing was selected." };
  }
  if (pairs.length > PLACEMENT_BATCH_MAX) {
    return {
      ok: false,
      error: `Too many at once — approve up to ${PLACEMENT_BATCH_MAX} students per click (you sent ${pairs.length}).`,
    };
  }

  const svc = await createServiceClient();

  const { data: edRaw } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  const editionId = (edRaw as { id: string } | null)?.id ?? null;
  if (!editionId) {
    return { ok: false, error: "No active edition — nothing was sent." };
  }

  // ─── Re-resolve the chapter's teams (with live size + pending invites) ───
  type TeamRow = {
    id: string;
    team_name: string;
    is_frozen: boolean | null;
    captain_id: string | null;
    leader_delegate_id: string | null;
    team_members: { delegate_id: string }[] | null;
    team_invitations:
      | { invited_delegate_id: string; status: string | null; created_at: string }[]
      | null;
  };
  // team_invitations is not in the generated types (as everywhere it is read),
  // so this one select goes through a loose client — the established pattern.
  const loose = svc as any;
  const teamRows = await fetchAllRows<TeamRow>((from, to) =>
    loose
      .schema("future")
      .from("teams")
      .select(
        "id, team_name, is_frozen, captain_id, leader_delegate_id, team_members(delegate_id), team_invitations(invited_delegate_id, status, created_at)"
      )
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: TeamRow[] | null;
      error: unknown;
    }>
  );
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  // ─── Re-resolve the chapter's active, still-unteamed delegates ───────────
  type DelRow = {
    id: string;
    full_name: string;
    team_members: { team_id: string }[] | null;
  };
  const delRows = await fetchAllRows<DelRow>((from, to) =>
    svc
      .schema("future")
      .from("delegates")
      .select("id, full_name, team_members(team_id)")
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: DelRow[] | null;
      error: unknown;
    }>
  );
  const delById = new Map(delRows.map((d) => [d.id, d]));

  // Seats still sendable per team = max size − members − live pending invites.
  // Pending invites count against the cap because `respondInvite` re-checks the
  // size at acceptance: over-inviting would hand some students an invitation
  // that fails the moment they tap Accept.
  const seatsLeft = new Map<string, number>();
  for (const t of teamRows) {
    const members = (t.team_members ?? []).length;
    const pending = (t.team_invitations ?? []).filter(
      (i) => i.status === "pending" && !isInviteExpired(i.created_at)
    ).length;
    seatsLeft.set(t.id, Math.max(0, TEAM_SIZE_MAX - members - pending));
  }

  const rows: PlacementRowResult[] = [];
  const seenDelegates = new Set<string>();

  for (const p of pairs) {
    const team = teamById.get(p.teamId);
    const del = delById.get(p.delegateId);
    const teamName = team?.team_name ?? "Unknown team";
    const delegateName = del?.full_name ?? "Unknown student";
    const key = `${p.delegateId}:${p.teamId}`;

    const skip = (detail: string) =>
      rows.push({ key, delegateName, teamName, status: "skipped", detail });

    if (!del) {
      skip("Not an active delegate of this chapter — nothing sent.");
      continue;
    }
    if (!team) {
      skip("That team does not belong to this chapter — nothing sent.");
      continue;
    }
    if (seenDelegates.has(p.delegateId)) {
      skip("Already handled earlier in this batch.");
      continue;
    }
    if ((del.team_members ?? []).length > 0) {
      skip("Joined a team since this page loaded — no invite needed.");
      continue;
    }
    if (team.is_frozen) {
      skip("Team is locked — unlock it first.");
      continue;
    }
    if (!(team.captain_id ?? team.leader_delegate_id)) {
      skip("Team has no captain yet — set a captain, then re-run.");
      continue;
    }
    if ((seatsLeft.get(team.id) ?? 0) <= 0) {
      skip(
        `Team is full at ${TEAM_SIZE_MAX} counting members and pending invites.`
      );
      continue;
    }

    seenDelegates.add(p.delegateId);
    let res: { ok: boolean; message?: string; error?: string };
    try {
      res = await inviteMember(p.teamId, p.delegateId);
    } catch (e) {
      rows.push({
        key,
        delegateName,
        teamName,
        status: "failed",
        detail:
          e instanceof Error
            ? e.message
            : "The invite could not be sent (unknown error).",
      });
      continue;
    }

    if (res.ok) {
      seatsLeft.set(team.id, (seatsLeft.get(team.id) ?? 1) - 1);
      rows.push({
        key,
        delegateName,
        teamName,
        status: "sent",
        detail: "Invitation sent — they must accept to join.",
      });
    } else {
      rows.push({
        key,
        delegateName,
        teamName,
        status: "failed",
        detail: res.error ?? "The invite could not be sent.",
      });
    }
  }

  revalidatePath("/yi-future/chapter/placement");
  revalidatePath(`/yi-future/national/admin/delegates/unteamed/${chapterId}`);
  revalidatePath("/yi-future/national/admin/delegates/unteamed");

  return {
    ok: true,
    rows,
    sent: rows.filter((r) => r.status === "sent").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}
