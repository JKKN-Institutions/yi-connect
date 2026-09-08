"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — STAFF OVERRIDE: place ONE named student on ONE named team.
//
// The locked rule is untouched. `approvePlacements` (app/yi-future/actions/
// placement.ts) still routes every batch through the consent path — it calls
// `inviteMember`, the student accepts, and only then do they join. This file is
// the narrow exception the Director added on 2026-08-11: "keep consent, but add
// a staff override", case by case, "and every such override must be recorded so
// you can see who was placed without consenting and by whom".
//
// FOUR PROPERTIES THIS FILE IS BUILT AROUND
//
// 1. ONE STUDENT PER CALL. The signature takes a single delegateId and a single
//    teamId. There is no array anywhere in this file, so there is nothing for a
//    future "select all" button to hook into.
//
// 2. THE RECORD IS WRITTEN FIRST. future.team_placement_overrides is inserted
//    BEFORE future.team_members, and if that insert fails NOTHING is placed.
//    An override that cannot be recorded does not happen — which also means the
//    whole feature is inert until the (deliberately unapplied) migration is run,
//    and says so on screen rather than failing obscurely.
//
// 3. NOTHING IN THE PAYLOAD IS TRUSTED. The caller is gated on chapterId, then
//    the delegate and the team are re-resolved against THAT chapter and the
//    active edition, the team's live size is re-counted, and the frozen flag is
//    re-read. A stale page cannot place a student on another chapter's team, or
//    into a team that filled up while the panel was open.
//
// 4. EVERY REFUSAL SAYS WHETHER ANYTHING WAS PLACED. "It failed" without that
//    is the message this codebase keeps having to fix.
//
// Every export here is async — a `"use server"` file may export nothing else,
// and one exported const or type breaks the Vercel build for the whole app. The
// types, the reason cap and the shared sentences live in
// lib/yi-future/placement-override.ts.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import {
  createClient,
  createServiceClient,
} from "@/lib/yi-future/supabase/server";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";
import {
  OVERRIDE_FROZEN_REFUSAL,
  OVERRIDE_LOG_UNAVAILABLE_REASON,
  OVERRIDE_REASON_MAX,
  overrideFullRefusal,
} from "@/lib/yi-future/placement-override";
import type { PlacementOverrideResult } from "@/lib/yi-future/placement-override";

// future.team_placement_overrides and future.team_invitations are not in the
// generated types (as everywhere else they are touched) → loose client for those
// statements, the established pattern.
type AnyClient = any;

/**
 * Place one student on one team WITHOUT their consent, and record it.
 *
 * @param input.acknowledged must be true — the UI's per-student acknowledgement.
 *   Re-checked here so the action cannot be driven without it, not because the
 *   server can see a checkbox.
 * @param input.reason optional ("optionally why" — the Director's words). Stored
 *   verbatim, and its ABSENCE is recorded honestly rather than back-filled.
 */
export async function placeDelegateDirectly(input: {
  chapterId: string;
  delegateId: string;
  teamId: string;
  reason?: string;
  acknowledged: boolean;
}): Promise<PlacementOverrideResult> {
  // Fails CLOSED (a null/unknown chapter denies) and denies EXPLICITLY by
  // redirecting to /yi-future/forbidden — never a silent bounce to a dashboard.
  const access = await requireChapterAdmin(input.chapterId);

  const refuse = (error: string): PlacementOverrideResult => ({
    ok: false,
    error,
    attemptRecorded: false,
  });

  if (input.acknowledged !== true) {
    return refuse(
      "Nothing was placed. Tick the box confirming you are placing this student without their agreement — a direct placement is never sent without it."
    );
  }
  if (!input.chapterId || !input.delegateId || !input.teamId) {
    // A blank chapter reaches here only for a national admin, whose gate
    // short-circuits on scope. Everything below re-resolves against the chapter
    // anyway, so this would fail closed regardless — it is refused early so the
    // message names the missing piece instead of "student not in this chapter".
    return refuse(
      "Nothing was placed. Choose one student and one team before confirming."
    );
  }

  const reason = (input.reason ?? "").trim();
  if (reason.length > OVERRIDE_REASON_MAX) {
    return refuse(
      `Nothing was placed. The reason is ${reason.length} characters; keep it under ${OVERRIDE_REASON_MAX} so it fits in the record.`
    );
  }

  const svc = await createServiceClient();
  const loose = svc as AnyClient;

  // ─── Active edition ────────────────────────────────────────────────────
  const { data: edRaw } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  const editionId = (edRaw as { id: string } | null)?.id ?? null;
  if (!editionId) {
    return refuse("Nothing was placed. There is no active Future edition.");
  }

  // ─── Re-resolve the student against THIS chapter + edition ─────────────
  const { data: delRaw } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, chapter_id, edition_id, is_active")
    .eq("id", input.delegateId)
    .maybeSingle();
  const del = delRaw as {
    id: string;
    full_name: string;
    chapter_id: string | null;
    edition_id: string | null;
    is_active: boolean | null;
  } | null;
  if (
    !del ||
    del.chapter_id !== input.chapterId ||
    del.edition_id !== editionId ||
    del.is_active !== true
  ) {
    return refuse(
      "Nothing was placed. That student is not an active delegate of this chapter in the current edition — reload this page and pick again."
    );
  }

  // ─── Re-resolve the team against THIS chapter + edition ────────────────
  const { data: teamRaw } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name, chapter_id, edition_id, is_frozen")
    .eq("id", input.teamId)
    .maybeSingle();
  const team = teamRaw as {
    id: string;
    team_name: string;
    chapter_id: string | null;
    edition_id: string | null;
    is_frozen: boolean | null;
  } | null;
  if (
    !team ||
    team.chapter_id !== input.chapterId ||
    team.edition_id !== editionId
  ) {
    return refuse(
      "Nothing was placed. That team does not belong to this chapter in the current edition — reload this page and pick again."
    );
  }

  // ─── Already on a team? ────────────────────────────────────────────────
  // future.team_members carries UNIQUE INDEX uniq_delegate_per_edition on
  // delegate_id, so this is also enforced by Postgres. Checked here so the
  // admin gets a sentence instead of a constraint name.
  const { data: memberRaw } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", del.id)
    .maybeSingle();
  const existingTeamId = (memberRaw as { team_id: string } | null)?.team_id ?? null;
  if (existingTeamId) {
    return refuse(
      existingTeamId === team.id
        ? `Nothing was placed. ${del.full_name} is already on ${team.team_name} — somebody got there first, or this page was open a while.`
        : `Nothing was placed. ${del.full_name} has joined another team in this edition since this page loaded. Reload to see which one.`
    );
  }

  // ─── Frozen teams refuse an override ──────────────────────────────────
  // RULING: a frozen team said "we are final" — a captain pressed Freeze, or the
  // chapter's own lock deadline swept it (future.team_lock_schedule). An override
  // already sets aside the STUDENT's consent; letting the same click also set
  // aside the TEAM's decision would be one button overriding two separate
  // decisions, and neither the team nor the log would show that it had. The extra
  // explicit step is the unlock that already exists on this screen
  // (`unlockTeamsForPlacement`), which names each team, resolves its unlock
  // request, and leaves it visibly unlocked so the team can freeze it again.
  if (team.is_frozen) {
    return refuse(`Nothing was placed. ${team.team_name}: ${OVERRIDE_FROZEN_REFUSAL}`);
  }

  // ─── TEAM_SIZE_MAX ────────────────────────────────────────────────────
  // Also enforced by future.check_team_size(), a BEFORE INSERT trigger on
  // team_members with max_size CONSTANT INT := 5, so Postgres refuses the 6th
  // member whatever the app believes. Counted here so a full team produces a
  // sentence rather than a raised exception, and counted with an exact count
  // (never by measuring a returned array, which the ~1000-row page cap truncates).
  const { count: memberCount, error: countErr } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id", { count: "exact", head: true })
    .eq("team_id", team.id);
  if (countErr) {
    return refuse(
      `Nothing was placed. The team's current size could not be read (${countErr.message}), and an override must never risk overfilling a team.`
    );
  }
  const size = memberCount ?? 0;
  if (size >= TEAM_SIZE_MAX) {
    return refuse(
      `Nothing was placed. ${team.team_name}: ${overrideFullRefusal(size, TEAM_SIZE_MAX)}`
    );
  }

  // ─── Was the student mid-decision? (recorded, never a blocker) ─────────
  const { data: invRaw } = await loose
    .schema("future")
    .from("team_invitations")
    .select("id, status, created_at")
    .eq("invited_delegate_id", del.id)
    .eq("status", "pending");
  const pendingInvites = (
    (invRaw as { id: string; status: string; created_at: string }[] | null) ?? []
  ).filter((i) => !isInviteExpired(i.created_at));
  const hadPendingInvite = pendingInvites.length > 0;

  // ─── Who is doing this (snapshot for the record) ───────────────────────
  const actor = await describeActor(access.userId);

  // ─── 1. THE RECORD, BEFORE THE PLACEMENT ──────────────────────────────
  // If this insert fails, nothing is placed. That is the point: an override that
  // cannot be recorded must not happen. The most likely cause today is the
  // migration not having been applied, so the message names it.
  const nowIso = new Date().toISOString();
  const { data: recRaw, error: recErr } = await loose
    .schema("future")
    .from("team_placement_overrides")
    .insert({
      chapter_id: input.chapterId,
      edition_id: editionId,
      delegate_id: del.id,
      delegate_name: del.full_name,
      team_id: team.id,
      team_name: team.team_name,
      placed_by_user_id: access.userId,
      placed_by_name: actor.name,
      placed_by_email: actor.email,
      placed_by_scope: access.isNational ? "national" : "chapter",
      had_pending_invite: hadPendingInvite,
      reason: reason.length > 0 ? reason : null,
      outcome: "pending",
      created_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  const recordId = (recRaw as { id: string } | null)?.id ?? null;
  if (recErr) {
    return refuse(
      `${OVERRIDE_LOG_UNAVAILABLE_REASON} Nothing was placed. (${
        recErr.message ?? "unknown error"
      })`
    );
  }
  if (!recordId) {
    // Insert reported no error but gave nothing back, so the outcome of this
    // entry could never be finalised. Stopping here is the honest move: the log
    // may hold an "attempted" row, and the student is definitely not placed.
    return {
      ok: false,
      error:
        "Nothing was placed. The override log took the entry but did not confirm it, so the placement was not carried out. Reload this page and check the log below before trying again.",
      attemptRecorded: true,
    };
  }

  // ─── 2. THE PLACEMENT ─────────────────────────────────────────────────
  const { error: joinErr } = await svc
    .schema("future")
    .from("team_members")
    .insert({
      team_id: team.id,
      delegate_id: del.id,
      role_in_team: "member",
    } as never);

  if (joinErr) {
    // The attempt stays in the log, marked failed with the reason. Audit rows are
    // never deleted — a refused override is a fact worth keeping.
    await loose
      .schema("future")
      .from("team_placement_overrides")
      .update({
        outcome: "failed",
        error_detail: joinErr.message ?? "unknown error",
      })
      .eq("id", recordId);
    revalidateAfterOverride(input.chapterId, team.id);
    return {
      ok: false,
      error: `${del.full_name} was NOT placed on ${team.team_name}: ${
        joinErr.message ?? "the database refused the change"
      }. The attempt is in the override log below. Reload this page before trying again.`,
      attemptRecorded: true,
    };
  }

  // ─── 3. FINALISE THE RECORD ───────────────────────────────────────────
  // The student is on the team from here on, so a failure below is a caveat on a
  // completed placement, never a claim that nothing happened.
  const caveats: string[] = [];
  const { error: finErr } = await loose
    .schema("future")
    .from("team_placement_overrides")
    .update({ outcome: "applied", applied_at: new Date().toISOString() })
    .eq("id", recordId);
  if (finErr) {
    caveats.push(
      "The log entry still reads “attempted” because it could not be updated — the placement itself went through."
    );
  }

  // ─── 4. CLOSE OFF INVITATIONS THAT CAN NO LONGER BE ANSWERED ──────────
  // Exactly what `respondInvite` does after a student joins: every other pending
  // invitation becomes "declined", because one delegate can hold one team per
  // edition (uniq_delegate_per_edition). Without this, the student opens their
  // invitations page, taps Accept, and gets a raw unique-violation message.
  //
  // "declined" and not "accepted": the student never agreed, and writing
  // "accepted" would forge the consent this whole record exists to show was
  // absent. (The allowed values are pending/accepted/declined/expired — there is
  // no "superseded", and inventing one needs a migration on a table this feature
  // does not own.)
  if (hadPendingInvite) {
    const { error: invErr } = await loose
      .schema("future")
      .from("team_invitations")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("invited_delegate_id", del.id)
      .eq("status", "pending");
    if (invErr) {
      caveats.push(
        `${del.full_name} still has an unanswered invitation on file; if they tap Accept it will fail because they are already on a team. Close it from the team page.`
      );
    }
  }

  revalidateAfterOverride(input.chapterId, team.id);

  return {
    ok: true,
    delegateName: del.full_name,
    teamName: team.team_name,
    caveat: caveats.length > 0 ? caveats.join(" ") : null,
  };
}

// ─── helpers (not exported — a "use server" file may export only async
//     functions, and these are called from inside this module) ────────────

/**
 * Best-effort name/email for the acting admin, snapshotted into the record so
 * "by whom" reads in plain English years later. Never throws and never blocks
 * the override: an unnamed record is still a record.
 */
async function describeActor(
  userId: string
): Promise<{ name: string | null; email: string | null }> {
  let email: string | null = null;
  let name: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  } catch {
    // Session read failed — the gate already passed, so carry on unnamed.
  }
  try {
    const svc = await createServiceClient();
    // yi_directory is the canonical identity spine and is not in the generated
    // future types → loose client, the established cross-schema pattern.
    const { data } = await (svc as AnyClient)
      .schema("yi_directory")
      .from("people")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    const p = data as { full_name: string | null; email: string | null } | null;
    if (p) {
      name = p.full_name ?? null;
      email = email ?? p.email ?? null;
    }
  } catch {
    // Directory read failed — same reasoning.
  }
  return { name, email };
}

/** Both placement routes, the team's own pages, and the student's team page. */
function revalidateAfterOverride(chapterId: string, teamId: string): void {
  revalidatePath("/yi-future/chapter/placement");
  revalidatePath(`/yi-future/national/admin/delegates/unteamed/${chapterId}`);
  revalidatePath("/yi-future/national/admin/delegates/unteamed");
  revalidatePath("/yi-future/chapter/teams");
  revalidatePath(`/yi-future/chapter/teams/${teamId}`);
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/me/team/invites");
}
