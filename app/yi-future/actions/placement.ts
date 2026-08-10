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
import {
  PLACEMENT_BATCH_MAX,
  PLACEMENT_NEW_TEAMS_MAX,
  GROW_TO_SIX_BLOCKED_REASON,
  buildPlacementPlan,
} from "@/lib/yi-future/placement";
import type {
  PlacementBatchResult,
  PlacementRowResult,
  PlacementStepResult,
  PlacementStepRow,
  PlacementStrategyId,
} from "@/lib/yi-future/placement";
import {
  getActivePlacementEdition,
  getPlacementChapter,
  getTeamsForPlacement,
  getUnteamedForPlacement,
} from "@/lib/yi-future/placement-data";
import { inviteMember } from "@/app/yi-future/actions/members";

type Pair = { delegateId: string; teamId: string };

const STRATEGIES = new Set<PlacementStrategyId>([
  "unlock_frozen",
  "grow_to_six",
  "new_teams",
  "leave_unteamed",
]);

/** Revalidate both routes that render the placement screen, plus the list above it. */
function revalidatePlacement(chapterId: string): void {
  revalidatePath("/yi-future/chapter/placement");
  revalidatePath(`/yi-future/national/admin/delegates/unteamed/${chapterId}`);
  revalidatePath("/yi-future/national/admin/delegates/unteamed");
  revalidatePath("/yi-future/chapter/teams");
}

/**
 * Send invitations for the (delegate → team) pairs a chapter admin approved.
 *
 * Nothing in the payload is trusted: the caller is gated on `chapterId`, then
 * every delegate id and team id is re-resolved against that chapter and the
 * active edition. A pair naming another chapter's team — or a team that filled
 * up since the page rendered — is rejected as its own row, not silently
 * dropped and not allowed to poison the rest of the batch.
 *
 * `strategy` is the option the chapter picked on screen. It is required, so a
 * batch can never be sent by a screen that has not made the seat decision
 * explicit, and it is validated here rather than trusted.
 *
 * `teamSizeMax` is the per-call cap override for the "6 per team" option. It is
 * accepted so the override is a visible parameter of this code path (rather than
 * an edit to the global TEAM_SIZE_MAX, which this feature never touches) and it
 * is REFUSED above TEAM_SIZE_MAX, because the limit is also enforced by a
 * Postgres trigger and by the student's Accept step — see
 * GROW_TO_SIX_BLOCKED_REASON.
 */
export async function approvePlacements(
  chapterId: string,
  pairs: Pair[],
  strategy: PlacementStrategyId,
  teamSizeMax?: number
): Promise<PlacementBatchResult> {
  // Fails CLOSED (null/unknown chapter denies) and denies EXPLICITLY by
  // redirecting to /yi-future/forbidden — never a silent bounce to a dashboard.
  await requireChapterAdmin(chapterId);

  if (!STRATEGIES.has(strategy)) {
    return {
      ok: false,
      error: "Pick one of the four options above before sending anything.",
    };
  }
  if (strategy === "grow_to_six") {
    return { ok: false, error: GROW_TO_SIX_BLOCKED_REASON };
  }
  if (typeof teamSizeMax === "number" && teamSizeMax > TEAM_SIZE_MAX) {
    return { ok: false, error: GROW_TO_SIX_BLOCKED_REASON };
  }

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

  revalidatePlacement(chapterId);

  return {
    ok: true,
    rows,
    sent: rows.filter((r) => r.status === "sent").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY 1 — UNLOCK LOCKED TEAMS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Unlock exactly the teams a chapter admin named, and nothing else.
 *
 * A locked team locked itself: a student pressed Freeze to say the team was
 * final. Unlocking cancels that decision, so this is deliberately its OWN step
 * with its own confirmation — it is never folded into the invitation batch, and
 * it never unlocks "all frozen teams in the chapter" from a count. The caller
 * sends explicit team ids and gets one result row per team back.
 *
 * It does NOT invite anybody. After this returns, the screen re-reads the
 * chapter and the reviewer approves the new suggestions separately, so an unlock
 * that succeeds while a later invitation fails leaves a state that is visible
 * and reversible (a captain can freeze the team again) rather than half-applied.
 *
 * WHY NOT `unfreezeTeam` from app/yi-future/actions/team-invites.ts:
 * that action gates on `getChapterContext()` — the chapter of the signed-in
 * user's own core-team row — so a Yi-Future NATIONAL admin drilling into a
 * chapter is refused by it ("Only the team's chapter admin can unfreeze it").
 * This route serves both roles, so it gates with `requireChapterAdmin(chapterId)`
 * (national short-circuits, a chair is scoped to their own chapter, null denies).
 * Widening `unfreezeTeam`'s gate is the right long-term fix but that file is
 * owned elsewhere — reported as a follow-up rather than edited here.
 */
export async function unlockTeamsForPlacement(
  chapterId: string,
  teamIds: string[]
): Promise<PlacementStepResult> {
  await requireChapterAdmin(chapterId);

  if (!Array.isArray(teamIds) || teamIds.length === 0) {
    return { ok: false, error: "No team was selected — nothing was unlocked." };
  }
  // The payload is never trusted for size either: a chapter has tens of teams,
  // so anything past the batch cap is a malformed call, not a real request.
  if (teamIds.length > PLACEMENT_BATCH_MAX) {
    return {
      ok: false,
      error: `That is more teams than one click may unlock (limit ${PLACEMENT_BATCH_MAX}). Nothing was unlocked.`,
    };
  }

  const svc = await createServiceClient();
  const edition = await getActivePlacementEdition();
  if (!edition) {
    return { ok: false, error: "No active edition — nothing was unlocked." };
  }

  // Re-resolve every id against THIS chapter and edition. A team id from another
  // chapter is rejected as its own row, never silently ignored.
  type TeamRow = {
    id: string;
    team_name: string;
    is_frozen: boolean | null;
    captain_id: string | null;
    leader_delegate_id: string | null;
  };
  const teamRows = await fetchAllRows<TeamRow>((from, to) =>
    svc
      .schema("future")
      .from("teams")
      .select("id, team_name, is_frozen, captain_id, leader_delegate_id")
      .eq("chapter_id", chapterId)
      .eq("edition_id", edition.id)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: TeamRow[] | null;
      error: unknown;
    }>
  );
  const byId = new Map(teamRows.map((t) => [t.id, t]));

  const rows: PlacementStepRow[] = [];
  const seen = new Set<string>();
  const nowIso = new Date().toISOString();
  // future.team_unlock_requests is not in the generated types (same as
  // team_invitations) → loose client for that one write, the established pattern.
  const loose = svc as any;

  for (const teamId of teamIds) {
    const team = byId.get(teamId);
    const label = team?.team_name ?? "Unknown team";
    const push = (status: PlacementStepRow["status"], detail: string) =>
      rows.push({ key: teamId, label, status, detail });

    if (!team) {
      push("skipped", "Not a team of this chapter — left alone.");
      continue;
    }
    if (seen.has(teamId)) {
      push("skipped", "Listed twice — handled once.");
      continue;
    }
    seen.add(teamId);
    if (!team.is_frozen) {
      push("skipped", "Already unlocked — nothing to do.");
      continue;
    }

    const { error } = await svc
      .schema("future")
      .from("teams")
      .update({ is_frozen: false, frozen_at: null, updated_at: nowIso })
      .eq("id", teamId)
      // Only flip a row that is still frozen, so two admins clicking at once
      // cannot both "unlock" and report success for the same team.
      .eq("is_frozen", true);
    if (error) {
      push("failed", error.message || "The team could not be unlocked.");
      continue;
    }

    // Unfreezing IS the resolution of an open unlock request — same side effect
    // as unfreezeTeam, so a captain who asked for this does not keep nagging.
    await loose
      .schema("future")
      .from("team_unlock_requests")
      .update({ status: "resolved", resolved_at: nowIso })
      .eq("team_id", teamId)
      .eq("status", "open");

    push(
      "done",
      (team.captain_id ?? team.leader_delegate_id)
        ? "Unlocked — it can take invitations now."
        : "Unlocked, but it still has no captain, so no invitation can be sent from it yet."
    );
  }

  revalidatePlacement(chapterId);
  for (const teamId of seen) {
    revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  }
  revalidatePath("/yi-future/me/team");

  return {
    ok: true,
    rows,
    done: rows.filter((r) => r.status === "done").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STRATEGY 3 — CREATE NEW TEAMS FOR THE LEFTOVERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create up to `count` new teams for the students no existing team can seat.
 *
 * `count` is a request, not an instruction: the server rebuilds the plan from
 * the live roster and creates only as many teams as are still needed. If the
 * shortfall closed since the page rendered (someone else unlocked a team, or
 * students accepted invitations) it creates NOTHING and says so, rather than
 * leaving empty teams behind.
 *
 * Each new team is created with a leftover student as its captain/leader but
 * WITHOUT a membership row. That is deliberate on both counts:
 *   • `team_invitations.invited_by` is NOT NULL and `inviteMember` refuses a team
 *     with no captain, so a team created with nobody named can never be invited
 *     into — it would be dead on arrival.
 *   • writing the membership row is exactly the thing the 2026-06-20 rule
 *     forbids. The named student is invited like everybody else and joins only
 *     when they accept.
 * So this mirrors `createTeamAsDelegate` minus the membership insert.
 *
 * WHY NOT `createTeam` from app/yi-future/actions/teams.ts: it ends in
 * `redirect()`, which throws NEXT_REDIRECT and would abort the loop after the
 * first team. Extracting a non-redirecting core there is the right fix but that
 * file is owned elsewhere — reported as a follow-up rather than edited here.
 */
export async function createTeamsForPlacement(
  chapterId: string,
  count: number
): Promise<PlacementStepResult> {
  await requireChapterAdmin(chapterId);

  const asked = Math.floor(Number(count));
  if (!Number.isFinite(asked) || asked <= 0) {
    return { ok: false, error: "No teams were requested — nothing was created." };
  }
  if (asked > PLACEMENT_NEW_TEAMS_MAX) {
    return {
      ok: false,
      error: `That is more teams than one click may create (limit ${PLACEMENT_NEW_TEAMS_MAX}). Nothing was created.`,
    };
  }

  const edition = await getActivePlacementEdition();
  if (!edition) {
    return { ok: false, error: "No active edition — nothing was created." };
  }
  const chapter = await getPlacementChapter(chapterId);
  if (!chapter) {
    return { ok: false, error: "Chapter not found — nothing was created." };
  }

  // Re-derive the shortfall from live data. The client's number is never trusted
  // to decide how many teams get written.
  const [unteamed, teams] = await Promise.all([
    getUnteamedForPlacement(chapterId, edition.id),
    getTeamsForPlacement(chapterId, edition.id),
  ]);
  const plan = buildPlacementPlan({ unteamed, teams });
  const leftovers = plan.blocked;
  if (leftovers.length === 0) {
    // Two very different situations, and telling them apart matters. Erode hits
    // the first one: 23 students genuinely have no chair, but every one of them
    // is holding an invitation nobody has answered, so a new team created now
    // would sit empty. Saying "everyone has a seat" there would be a lie.
    const chairShortfall = Math.max(
      0,
      plan.stats.unteamed - plan.stats.openSeatsPhysical
    );
    return {
      ok: false,
      error:
        chairShortfall > 0
          ? `Nothing was created. ${chairShortfall} student${chairShortfall === 1 ? "" : "s"} have no chair in this chapter, but every student without a team is already holding an invitation nobody has answered — a new team would sit empty. Chase those answers (or let them expire), then come back.`
          : "Nothing was created. Every student without a team can already be offered a seat in an existing team — approve the list instead.",
    };
  }

  const needed = Math.min(
    asked,
    Math.ceil(leftovers.length / TEAM_SIZE_MAX),
    PLACEMENT_NEW_TEAMS_MAX
  );

  const svc = await createServiceClient();

  // Team names are UNIQUE per EDITION (future.teams_edition_id_team_name_key) —
  // not per chapter — so a plain "Team 4" would collide with another chapter's.
  // Names are prefixed with the chapter and probed against the whole edition.
  const { data: takenRaw } = await svc
    .schema("future")
    .from("teams")
    .select("team_name")
    .eq("edition_id", edition.id)
    .ilike("team_name", `${chapter.name} Team %`);
  const taken = new Set(
    ((takenRaw as { team_name: string }[] | null) ?? []).map((t) =>
      t.team_name.trim().toLowerCase()
    )
  );

  const rows: PlacementStepRow[] = [];
  let nextNumber = 1;
  const nameFor = (): string => {
    for (;;) {
      const candidate = `${chapter.name} Team ${nextNumber}`;
      nextNumber += 1;
      if (!taken.has(candidate.trim().toLowerCase())) {
        taken.add(candidate.trim().toLowerCase());
        return candidate;
      }
    }
  };

  for (let i = 0; i < needed; i += 1) {
    // One leftover student per new team becomes its named leader.
    const seed = leftovers[i * TEAM_SIZE_MAX];
    if (!seed) break;
    const teamName = nameFor();
    const key = `new:${i}:${seed.delegateId}`;

    const { data: inserted, error } = await svc
      .schema("future")
      .from("teams")
      .insert({
        chapter_id: chapterId,
        edition_id: edition.id,
        team_name: teamName,
        captain_id: seed.delegateId,
        leader_delegate_id: seed.delegateId,
        status: "registered",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      rows.push({
        key,
        label: teamName,
        status: "failed",
        detail:
          error.message ||
          "The team could not be created. No student was affected.",
      });
      continue;
    }
    const newId = (inserted as { id: string } | null)?.id ?? null;
    if (!newId) {
      rows.push({
        key,
        label: teamName,
        status: "failed",
        detail: "The team was not created. No student was affected.",
      });
      continue;
    }

    rows.push({
      key,
      label: teamName,
      status: "done",
      detail: `Created. ${seed.delegateName} is named its leader and will be invited — nobody is on it until they accept.`,
    });
  }

  revalidatePlacement(chapterId);

  return {
    ok: true,
    rows,
    done: rows.filter((r) => r.status === "done").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}
