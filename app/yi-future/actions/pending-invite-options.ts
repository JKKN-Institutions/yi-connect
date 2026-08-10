"use server";

/**
 * Re-read the invitations a delegate is STILL holding, after an Accept failed
 * because the team filled up.
 *
 * This is deliberately a fresh server read, not a filter over a list the client
 * already had: the reason we are here at all is that the world changed in the
 * last few seconds. A stale list would offer the student another team that has
 * since filled, which just moves the dead end.
 *
 * READ-ONLY. This file performs no INSERT/UPDATE/DELETE of any kind, which is
 * what makes it safe against the one real hazard here: respondInvite
 * auto-declines a delegate's other pending invitations when one is accepted, so
 * anything that wrote status back to 'pending' could resurrect an invitation
 * that was deliberately closed. Nothing here writes, and the read is filtered
 * to status = 'pending', so an auto-declined row can never reappear.
 *
 * A "use server" file may export ONLY async functions — the types this returns
 * live in lib/yi-future/invite-options.ts.
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import type {
  InviteOption,
  RemainingInvitesResult,
} from "@/lib/yi-future/invite-options";

// team_invitations was added in migration 120 and generated types haven't been
// regenerated — the schema client is untyped at these call sites, same as every
// other reader of this table.
type AnyClient = any;

/**
 * How many alternatives we offer. The observed maximum held by one student is 4
 * (Erode: 51 students hold 1, 37 hold 2, 4 hold 3, 1 holds 4) and
 * UNIQUE(team_id, invited_delegate_id) caps the theoretical maximum at one per
 * team, so this read cannot approach the 1,000-row PostgREST cap.
 */
const OPTIONS_CAP = 6;

type InviteRow = {
  id: string;
  created_at: string;
  teams: {
    id: string;
    team_name: string;
    is_frozen: boolean | null;
  } | null;
  invited_by_delegate: { full_name: string } | null;
};

export async function getRemainingInviteOptions(
  /** Invitations already known to be dead ends — the ones the student just tried. */
  excludeInviteIds: string[]
): Promise<RemainingInvitesResult> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return {
      ok: false,
      error:
        "Your sign-in seems to have expired. Reload the page and enter your access code again.",
    };
  }

  const svc = await createServiceClient();
  const exclude = new Set(excludeInviteIds.filter(Boolean));

  // Did the student end up on a team after all? Their Accept may in fact have
  // landed, or they may have joined by another route in another tab. Either way
  // no invitation is offerable — uniq_delegate_per_edition would reject it.
  const { data: membership, error: memErr } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", session.id)
    .maybeSingle();
  if (memErr) {
    return {
      ok: false,
      error: "We couldn't check your invitations just now.",
    };
  }
  if (membership) {
    return { ok: true, alreadyOnTeam: true, options: [], blockedCount: 0 };
  }

  const { data: rows, error: invErr } = await (svc as AnyClient)
    .schema("future")
    .from("team_invitations")
    .select(
      "id, created_at, teams(id, team_name, is_frozen), invited_by_delegate:delegates!team_invitations_invited_by_fkey(full_name)"
    )
    .eq("invited_delegate_id", session.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (invErr) {
    return {
      ok: false,
      error: "We couldn't check your invitations just now.",
    };
  }

  const all = ((rows as unknown as InviteRow[]) ?? []).filter(
    (i) => i.teams && !exclude.has(i.id) && !isInviteExpired(i.created_at)
  );
  if (all.length === 0) {
    return { ok: true, alreadyOnTeam: false, options: [], blockedCount: 0 };
  }

  // Live capacity for the candidate teams. A locked team is out regardless of
  // size, and a team at TEAM_SIZE_MAX is out because offering it would repeat
  // the exact failure the student just hit.
  const candidates = all.slice(0, OPTIONS_CAP);
  const teamIds = Array.from(new Set(candidates.map((i) => i.teams!.id)));
  const { data: memberRows, error: cntErr } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds);
  if (cntErr) {
    return {
      ok: false,
      error: "We couldn't check which of your teams still have room.",
    };
  }

  const counts = new Map<string, number>();
  for (const m of (memberRows as { team_id: string }[] | null) ?? []) {
    counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
  }

  const options: InviteOption[] = [];
  let blockedCount = 0;
  for (const inv of candidates) {
    const team = inv.teams!;
    const memberCount = counts.get(team.id) ?? 0;
    const seatsLeft = TEAM_SIZE_MAX - memberCount;
    if (team.is_frozen || seatsLeft <= 0) {
      blockedCount += 1;
      continue;
    }
    options.push({
      id: inv.id,
      teamName: team.team_name,
      inviterName: inv.invited_by_delegate?.full_name ?? null,
      memberCount,
      seatsLeft,
    });
  }

  // Anything past the display cap is still real, so it is counted as blocked
  // rather than silently dropped — the UI links to the full invitations page.
  blockedCount += all.length - candidates.length;

  return { ok: true, alreadyOnTeam: false, options, blockedCount };
}
