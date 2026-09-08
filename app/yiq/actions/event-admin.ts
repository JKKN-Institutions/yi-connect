"use server";

/**
 * YIQ event-admin actions — the qualifying line and team discipline.
 *
 * TWO GATES, never mixed:
 *   requireYiqEventManage(eventId) — the ORGANISER gate. Everything here is
 *     scoped to one chapter event, so this gate is the floor for every action
 *     in this file. It also passes the national tier (super_admin gets full
 *     access to any event), so it is checked FIRST and always.
 *   requireYiqSuperAdmin()         — the NATIONAL gate. Used only to decide
 *     whether the round-is-open lock on the qualifying count is bypassed.
 *     Never used as the floor here: this is event data, not platform master
 *     data.
 *
 * FAIL CLOSED throughout: a missing event, a team from another chapter, an
 * unrecognised status, an unreadable identity → DENY with a sentence. No
 * action here redirects; a silent redirect on a permission failure creates an
 * undiagnosable bounce-loop.
 *
 * The rules themselves are pure and tested in lib/yiq/event-admin.ts:
 *   npx tsx lib/yiq/__tests__/event-admin.check.ts
 */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { requireYiqEventManage } from "@/lib/yiq/auth/event-access";
import {
  requireYiqSuperAdmin,
  isCurrentUserYiqSuperAdmin,
} from "@/lib/yiq/auth/require-super-admin";
import { getCurrentPersonRoles } from "@/lib/yi/auth/yi-directory-roles";
import { STATUS_LABELS, type ChapterEventStatus } from "@/lib/yiq/constants";
import {
  canEditQualifyingCount,
  isChapterEventStatus,
  reinstatementStatus,
  validateDisqualifyReason,
  validateQualifyingCount,
  type EventAdminState,
  type EventAdminTeam,
} from "@/lib/yiq/event-admin";

type Err = { success: false; error: string };

/** The columns this file adds in supabase/migrations/yiq_13_event_admin.sql. */
type TeamAdminRow = {
  id: string;
  name: string;
  team_code: string;
  category: string;
  status: string;
  school_id: string;
  online_rank: number | null;
  online_total_score: number | string | null;
  disqualified_reason: string | null;
  disqualified_at: string | null;
  status_before_disqualification: string | null;
};

function statusLabel(status: string): string {
  return isChapterEventStatus(status)
    ? STATUS_LABELS[status as ChapterEventStatus]
    : status;
}

/** Who is doing this, for the audit row. Never blocks — the gates already did. */
async function actor(): Promise<{ userId: string | null; label: string | null }> {
  const me = await getCurrentPersonRoles();
  return { userId: me?.user_id ?? null, label: me?.email ?? null };
}

/**
 * Everything the admin panel needs, in one round trip and behind the same
 * gate as the writes. The panel is a client component, so this is its only
 * read path.
 */
export async function getEventAdminState(input: {
  chapterEventId: string;
}): Promise<{ success: true; state: EventAdminState } | Err> {
  const gate = await requireYiqEventManage(input.chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("chapter_events")
    .select("id, chapter_name, status, qualifying_team_count")
    .eq("id", input.chapterEventId)
    .maybeSingle();
  if (!event) return { success: false, error: "This event no longer exists." };

  const isNational = await isCurrentUserYiqSuperAdmin();

  const { data: teamRows } = await svc
    .from("teams")
    .select("*")
    .eq("chapter_event_id", input.chapterEventId)
    .order("category")
    .order("name");

  const teams = (teamRows ?? []) as unknown as TeamAdminRow[];

  // Schools are fetched separately rather than embedded: the embed shape is
  // regenerated with the DB types, and this screen must not break when they
  // are next regenerated.
  const schoolIds = [...new Set(teams.map((t) => t.school_id))];
  const schoolNames = new Map<string, string>();
  if (schoolIds.length > 0) {
    const { data: schools } = await svc
      .from("schools")
      .select("id, name")
      .in("id", schoolIds);
    for (const s of schools ?? []) schoolNames.set(s.id, s.name);
  }

  const state: EventAdminState = {
    eventId: event.id,
    chapterName: event.chapter_name ?? null,
    status: event.status,
    statusLabel: statusLabel(event.status),
    qualifyingCount: event.qualifying_team_count,
    isNational,
    canManage: true,
    lock: canEditQualifyingCount(event.status, isNational),
    teams: teams.map(
      (t): EventAdminTeam => ({
        id: t.id,
        name: t.name,
        teamCode: t.team_code,
        category: t.category === "senior" ? "senior" : "junior",
        status: t.status,
        schoolName: schoolNames.get(t.school_id) ?? null,
        onlineRank: t.online_rank,
        onlineTotalScore:
          t.online_total_score === null ? null : Number(t.online_total_score),
        // `?? null` rather than a bare read: before
        // yiq_13_event_admin.sql is applied these columns simply are not
        // there, and the panel must render rather than throw.
        disqualifiedReason: t.disqualified_reason ?? null,
        disqualifiedAt: t.disqualified_at ?? null,
      })
    ),
  };

  return { success: true, state };
}

/**
 * Set how many teams per category qualify for the chapter finals.
 *
 * Organiser: only while the online round has not opened.
 * YIQ national: at any status, including after scores exist — the person who
 * moves the line is never the person whose chapter it decides.
 */
export async function setQualifyingCount(input: {
  chapterEventId: string;
  count: number;
}): Promise<{ success: true; count: number } | Err> {
  // 1. Authorization first, always.
  const gate = await requireYiqEventManage(input.chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();

  // 2. The event must exist, and its CURRENT status decides the lock.
  const { data: event } = await svc
    .from("chapter_events")
    .select("id, status, qualifying_team_count")
    .eq("id", input.chapterEventId)
    .maybeSingle();
  if (!event) return { success: false, error: "This event no longer exists." };

  // 3. The national override, resolved through the national gate itself.
  const national = await requireYiqSuperAdmin();
  const lock = canEditQualifyingCount(event.status, national.ok);
  if (!lock.allowed) return { success: false, error: lock.message };

  // 4. Validate in code so the user gets a sentence, not a CHECK violation.
  const valid = validateQualifyingCount(input.count);
  if (!valid.ok) return { success: false, error: valid.error };

  if (valid.value === event.qualifying_team_count) {
    return { success: true, count: valid.value };
  }

  const { error } = await svc
    .from("chapter_events")
    .update({ qualifying_team_count: valid.value })
    .eq("id", input.chapterEventId);

  if (error) {
    console.error("[yiq] qualifying_team_count update failed", error);
    return { success: false, error: "Could not save the qualifying count." };
  }

  const who = await actor();
  await svc.from("audit_log").insert({
    actor_user_id: who.userId,
    actor_label: who.label,
    action: "qualifying_count_changed",
    entity_type: "chapter_event",
    entity_id: input.chapterEventId,
    chapter_event_id: input.chapterEventId,
    detail: {
      from: event.qualifying_team_count,
      to: valid.value,
      event_status: event.status,
      by_role: gate.access.role,
      lock_reason: lock.reason,
      national_override: lock.reason === "national_override",
    },
  });

  revalidatePath(`/yiq/dashboard/${input.chapterEventId}`);
  return { success: true, count: valid.value };
}

/**
 * Disqualify a team. The reason is required and is kept on the team row AND
 * in the audit log with who and when.
 *
 * Nothing the team wrote is deleted: attempts and answers stay exactly as
 * they are. The standings query excludes the team by status
 * (`.not("status","in","(withdrawn,disqualified)")` in
 * app/yiq/actions/admin.ts), so it simply leaves the table.
 */
export async function disqualifyTeam(input: {
  chapterEventId: string;
  teamId: string;
  reason: string;
}): Promise<{ success: true } | Err> {
  const gate = await requireYiqEventManage(input.chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const reason = validateDisqualifyReason(input.reason);
  if (!reason.ok) return { success: false, error: reason.error };

  const svc = await createServiceClient();

  // The team must belong to THIS event — a team id from another chapter must
  // never be actionable through this event's panel.
  const { data: teamRow } = await svc
    .from("teams")
    .select("*")
    .eq("id", input.teamId)
    .eq("chapter_event_id", input.chapterEventId)
    .maybeSingle();

  const team = teamRow as unknown as TeamAdminRow | null;
  if (!team) {
    return {
      success: false,
      error: "That team is not part of this chapter's event.",
    };
  }
  if (team.status === "disqualified") {
    return { success: false, error: `${team.name} is already disqualified.` };
  }

  const who = await actor();
  const patch = {
    status: "disqualified",
    disqualified_reason: reason.value,
    disqualified_at: new Date().toISOString(),
    disqualified_by: who.userId,
    status_before_disqualification: team.status,
  };

  const { error } = await svc
    .from("teams")
    // The four disqualification columns land in yiq_13_event_admin.sql, which
    // is newer than the generated types; the cast is the seam.
    .update(patch as never)
    .eq("id", input.teamId)
    .eq("chapter_event_id", input.chapterEventId);

  if (error) {
    console.error("[yiq] disqualifyTeam update failed", error);
    return { success: false, error: "Could not disqualify that team." };
  }

  await svc.from("audit_log").insert({
    actor_user_id: who.userId,
    actor_label: who.label,
    action: "team_disqualified",
    entity_type: "team",
    entity_id: input.teamId,
    chapter_event_id: input.chapterEventId,
    detail: {
      team_name: team.name,
      team_code: team.team_code,
      category: team.category,
      reason: reason.value,
      previous_status: team.status,
      by_role: gate.access.role,
    },
  });

  revalidatePath(`/yiq/dashboard/${input.chapterEventId}`);
  return { success: true };
}

/**
 * Undo a disqualification. Also audited, and also needs a reason — putting a
 * team back into a competition is exactly as consequential as taking it out.
 * The team returns to the status it held before, never to "qualified" by
 * assumption: re-ranking is the standings computation's job.
 */
export async function reinstateTeam(input: {
  chapterEventId: string;
  teamId: string;
  reason: string;
}): Promise<{ success: true; restoredStatus: string } | Err> {
  const gate = await requireYiqEventManage(input.chapterEventId);
  if (!gate.ok) return { success: false, error: gate.error };

  const reason = validateDisqualifyReason(input.reason);
  if (!reason.ok) return { success: false, error: reason.error };

  const svc = await createServiceClient();

  const { data: teamRow } = await svc
    .from("teams")
    .select("*")
    .eq("id", input.teamId)
    .eq("chapter_event_id", input.chapterEventId)
    .maybeSingle();

  const team = teamRow as unknown as TeamAdminRow | null;
  if (!team) {
    return {
      success: false,
      error: "That team is not part of this chapter's event.",
    };
  }
  if (team.status !== "disqualified") {
    return { success: false, error: `${team.name} is not disqualified.` };
  }

  const restored = reinstatementStatus(team.status_before_disqualification);
  const who = await actor();

  const patch = {
    status: restored,
    disqualified_reason: null,
    disqualified_at: null,
    disqualified_by: null,
    status_before_disqualification: null,
  };

  const { error } = await svc
    .from("teams")
    .update(patch as never)
    .eq("id", input.teamId)
    .eq("chapter_event_id", input.chapterEventId);

  if (error) {
    console.error("[yiq] reinstateTeam update failed", error);
    return { success: false, error: "Could not reinstate that team." };
  }

  await svc.from("audit_log").insert({
    actor_user_id: who.userId,
    actor_label: who.label,
    action: "team_reinstated",
    entity_type: "team",
    entity_id: input.teamId,
    chapter_event_id: input.chapterEventId,
    detail: {
      team_name: team.name,
      team_code: team.team_code,
      category: team.category,
      reason: reason.value,
      restored_status: restored,
      // Kept so the disqualification reason survives the undo.
      cleared_disqualification_reason: team.disqualified_reason,
      by_role: gate.access.role,
    },
  });

  revalidatePath(`/yiq/dashboard/${input.chapterEventId}`);
  return { success: true, restoredStatus: restored };
}
