// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — STAFF OVERRIDE placement: types + the pure "what may be
// overridden" calculation. No I/O, no `next/*` imports, so both the server
// action and the client panel can share it.
//
// WHAT THIS IS
// The locked rule (2026-06-20, Nashik) stands: the placement screen's approve
// button sends INVITATIONS and a student joins only by accepting one. This
// module is the narrow exception the Director added on 2026-08-11 — "keep
// consent, but add a staff override": a chapter admin may place ONE named
// student on ONE named team, deliberately, and the platform records that it
// happened and who did it.
//
// WHAT IT IS NOT
//   • not a bulk path — the action takes exactly one delegate and one team;
//   • not a default — the panel is collapsed and the consent flow sits above it;
//   • not silent — no override can be performed unless the log row is written
//     first (see app/yi-future/actions/placement-override.ts).
//
// Deliberately NOT a "use server" file: it exports types and sync functions,
// which a "use server" file may not do (that breaks the Vercel build).
// ═══════════════════════════════════════════════════════════════════════

import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import type { PlacementDelegate, PlacementTeam } from "@/lib/yi-future/placement";

/** Longest reason stored. Refused above this rather than silently truncated. */
export const OVERRIDE_REASON_MAX = 500;

/**
 * Exact sentence shown wherever the log table is unreachable.
 *
 * The migration (supabase/migrations/future_team_placement_overrides.sql) ships
 * UNAPPLIED, so on any database where it has not been run the log does not
 * exist. The override then refuses — an unrecorded override is precisely what
 * the Director's decision forbids — and both the panel and the action say this
 * same sentence so the admin is not told two different half-truths.
 */
export const OVERRIDE_LOG_UNAVAILABLE_REASON =
  "Direct placement is switched off because the override log cannot be written. Every direct placement has to be recorded before it happens, so nothing will be placed until a Yi-Future admin applies the pending database change (future_team_placement_overrides).";

/** One student who could be placed directly — i.e. is on no team today. */
export type OverrideStudent = {
  delegateId: string;
  name: string;
  collegeName: string | null;
  course: string | null;
  yearOfStudy: number | null;
  /**
   * Team this student is already holding an unanswered invitation to, if any.
   * Shown because overriding them is then a decision to STOP WAITING for an
   * answer, which is a different act from placing a student nobody asked.
   */
  pendingTeamName: string | null;
};

/** One team, and whether it will accept an override right now. */
export type OverrideTeam = {
  teamId: string;
  name: string;
  members: number;
  /** Physical free chairs: cap − members. Unanswered invitations do NOT hold a chair here. */
  seatsFree: number;
  /** Unanswered invitations outstanding for this team. */
  pendingInvites: number;
  problemTitle: string | null;
  hasLeader: boolean;
  isFrozen: boolean;
  /**
   * Null ⇒ selectable. Non-null ⇒ the exact reason this team refuses an
   * override, shown next to the team instead of hiding it. A team that quietly
   * vanishes from the list looks like a bug; a team that says why it is refusing
   * tells the admin what to do next.
   */
  refusal: string | null;
};

export type OverrideTargets = {
  students: OverrideStudent[];
  teams: OverrideTeam[];
  /** Cap the calculation used — TEAM_SIZE_MAX unless a caller overrides it. */
  teamSizeMax: number;
};

/**
 * A frozen team refuses an override. Kept as one string so the panel and the
 * server action say the same thing.
 *
 * RULING (and why): freezing is how a team says "we are final" — a captain
 * pressed Freeze, or the chapter's own lock deadline swept it
 * (future.team_lock_schedule). `respondInvite` already refuses a frozen team, so
 * a student cannot join one even WITH consent. An override already sets aside
 * one consent (the student's); letting the same click also set aside the team's
 * would mean one button quietly overriding two separate decisions, and the log
 * row would not show that it had.
 *
 * So the extra explicit step is not a second checkbox on this panel — it is the
 * unlock step that already exists on this same screen
 * (`unlockTeamsForPlacement`), which names every team it touches, resolves the
 * team's own unlock request, and leaves the team visibly unlocked so its members
 * can see what happened and freeze it again. Unlock first, then place. Two
 * decisions, two records, both visible.
 */
export const OVERRIDE_FROZEN_REFUSAL =
  "Locked by the team — an override does not unlock it. Choose “Unlock locked teams” above, unlock this team by name, then place the student.";

/** Full team refusal, with the numbers spelled out. */
export function overrideFullRefusal(members: number, cap: number): string {
  return `Full — ${members} of ${cap} chairs taken. An override cannot make a team bigger than ${cap}.`;
}

/**
 * Work out who may be placed directly, and into which teams, from the SAME
 * roster read the suggestion plan uses. Pure and deterministic.
 *
 * Differences from the consent path, each one deliberate:
 *   • students holding an unanswered invitation are INCLUDED (with the team
 *     named). The suggestion engine skips them because re-inviting is just a
 *     second notification; an override is exactly the tool for "we cannot wait
 *     any longer".
 *   • a team with no captain is SELECTABLE. The leaderless rule exists only
 *     because `team_invitations.invited_by` is NOT NULL, and an override sends
 *     no invitation, so the rule does not apply to it.
 *   • unanswered invitations do NOT reserve a chair. An override takes a
 *     physical chair; the panel warns when doing so leaves fewer chairs than
 *     invitations outstanding, because someone else's Accept will then be
 *     refused. That is over-invitation the chapter already has, surfaced rather
 *     than hidden.
 */
export function buildOverrideTargets(input: {
  unteamed: PlacementDelegate[];
  teams: PlacementTeam[];
  teamSizeMax?: number;
}): OverrideTargets {
  const cap = input.teamSizeMax ?? TEAM_SIZE_MAX;

  const pendingTeamByDelegate = new Map<string, string>();
  for (const t of input.teams) {
    for (const id of t.pending_invite_delegate_ids) {
      if (!pendingTeamByDelegate.has(id)) {
        pendingTeamByDelegate.set(id, t.team_name);
      }
    }
  }

  const students: OverrideStudent[] = input.unteamed
    .map((d) => ({
      delegateId: d.id,
      name: d.full_name,
      collegeName: d.college_name,
      course: d.course,
      yearOfStudy: d.year_of_study,
      pendingTeamName: pendingTeamByDelegate.get(d.id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.delegateId.localeCompare(b.delegateId));

  const teams: OverrideTeam[] = input.teams
    .map((t) => {
      const seatsFree = Math.max(0, cap - t.member_count);
      // Frozen is reported first: a locked full team is refused for the lock,
      // because unlocking is the step the admin has to take either way.
      const refusal = t.is_frozen
        ? OVERRIDE_FROZEN_REFUSAL
        : seatsFree === 0
          ? overrideFullRefusal(t.member_count, cap)
          : null;
      return {
        teamId: t.id,
        name: t.team_name,
        members: t.member_count,
        seatsFree,
        pendingInvites: t.pending_invite_delegate_ids.length,
        problemTitle: t.problem_title,
        hasLeader: t.has_leader,
        isFrozen: t.is_frozen,
        refusal,
      };
    })
    .sort(
      (a, b) =>
        // Selectable teams first, then by name, so the admin is not hunting
        // through locked teams to find one that works.
        Number(a.refusal !== null) - Number(b.refusal !== null) ||
        a.name.localeCompare(b.name) ||
        a.teamId.localeCompare(b.teamId)
    );

  return { students, teams, teamSizeMax: cap };
}

// ─── The record ─────────────────────────────────────────────────────────

/** One row of future.team_placement_overrides, as the UI reads it. */
export type PlacementOverrideRecord = {
  id: string;
  delegateId: string;
  delegateName: string;
  teamId: string;
  teamName: string;
  placedByName: string | null;
  placedByEmail: string | null;
  placedByScope: "national" | "chapter";
  hadPendingInvite: boolean;
  reason: string | null;
  outcome: "pending" | "applied" | "failed";
  errorDetail: string | null;
  createdAt: string;
  appliedAt: string | null;
};

/**
 * What the screen knows about the log.
 *
 * `available: false` is a first-class state, not an empty list: the migration
 * ships unapplied, and a missing table or a missing service_role grant would
 * otherwise read as "no overrides have ever happened" — the worst possible lie
 * for an audit log (see feedback_mgmt_api_tables_no_service_role_grant).
 */
export type PlacementOverrideLog =
  | { available: true; rows: PlacementOverrideRecord[] }
  | { available: false; reason: string; detail: string | null };

/** Outcome of one override attempt, as the panel renders it. */
export type PlacementOverrideResult =
  | {
      ok: true;
      delegateName: string;
      teamName: string;
      /** Extra sentence when the placement worked but a follow-up write did not. */
      caveat: string | null;
    }
  | {
      ok: false;
      /**
       * Says what happened AND whether the student ended up on the team. Every
       * refusal below is written to be read by a chapter chair, and each one
       * ends by stating whether anything was placed — "it failed" without that
       * is the message this codebase keeps having to fix.
       */
      error: string;
      /** True ⇒ the attempt IS in the log (as `pending` or `failed`). */
      attemptRecorded: boolean;
    };
