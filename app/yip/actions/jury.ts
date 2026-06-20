"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireJurySession } from "@/lib/yip/auth/yip-session";
import { revalidatePath } from "next/cache";
import { getSessionsForJury, type ScoreableSession } from "./jury-sessions";
import {
  getScoreableParticipants,
  getRubricForRole,
  getSessionScoringParams,
  getCurrentSpeaker,
  type CurrentSpeakerInfo,
  type ScoringRubricData,
  type SessionScoringParams,
  type ScoreableParticipant,
} from "./scoring";
import {
  getScoringFlagsConfig,
  type FlagDeltas,
} from "./scoring-flags";

// Gated writes run on the service client AFTER getYipEventAccess() (yip.* tables
// have RLS read-only for `authenticated`; the capability check is the gate).

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Organiser: allow jurors to score earlier sessions (BUG-393) ───
// Per-event switch. When on, jurors get a "Score an earlier session" option
// that unlocks all their assigned sessions; when off they stay locked to the
// current + immediately-previous set.

export async function setJuryAllowEarlierSessions(
  eventId: string,
  allow: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ jury_allow_earlier_sessions: allow })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: null };
}

// ─── Add Jury ──────────────────────────────────────────────────────

export async function addJury(
  eventId: string,
  name: string,
  email?: string | null
): Promise<ActionResult<{ id: string; access_code: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Jury name is required" };
  }

  // Optional email for frictionless login (Phase 19 / D)
  const normalisedEmail = email ? email.trim().toLowerCase() : null;
  if (
    normalisedEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)
  ) {
    return { success: false, error: "Invalid email address" };
  }

  // Reject duplicate email within the same event
  if (normalisedEmail) {
    const { data: dup } = await supabase
      .from("jury_assignments")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", normalisedEmail)
      .maybeSingle();
    if (dup) {
      return {
        success: false,
        error: "A jury member with this email is already added to this event",
      };
    }
  }

  // Generate unique code
  let accessCode = generateAccessCode();
  let attempts = 0;

  while (attempts < 20) {
    const { data: existing } = await supabase
      .from("jury_assignments")
      .select("id")
      .eq("event_id", eventId)
      .eq("access_code", accessCode)
      .maybeSingle();

    const { data: pExisting } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", eventId)
      .eq("access_code", accessCode)
      .maybeSingle();

    if (!existing && !pExisting) break;

    accessCode = generateAccessCode();
    attempts++;
  }

  if (attempts >= 20) {
    return { success: false, error: "Failed to generate unique code" };
  }

  const { data: jury, error } = await supabase
    .from("jury_assignments")
    .insert({
      event_id: eventId,
      jury_name: name.trim(),
      access_code: accessCode,
      is_active: true,
      email: normalisedEmail,
    })
    .select("id, access_code")
    .single();

  if (error || !jury) {
    return { success: false, error: error?.message ?? "Failed to add jury" };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: { id: jury.id, access_code: jury.access_code } };
}

// ─── Remove Jury ───────────────────────────────────────────────────

export async function removeJury(
  juryId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can remove jury members" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("jury_assignments")
    .delete()
    .eq("id", juryId)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditAction({
    action_type: "delete",
    target_table: "jury_assignments",
    target_id: juryId,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: null };
}

// ─── Get Jury ──────────────────────────────────────────────────────

export async function getJury(eventId: string) {
  // Read gated by canView (the jury page is itself behind getYipEventAccess);
  // service client avoids the RLS read-policy edge for chapter roles.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("jury_assignments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");

  return data ?? [];
}

// ─── Jury Screen Bootstrap (BUG-392 / BUG-393 / BUG-395) ───────────
//
// ONE round-trip that returns everything the jury scoring screen needs on
// load/refresh. Previously the screen fired ~7 server actions plus two
// fan-out loops (getRubricForRole per distinct role ~8-10, and
// getSessionScoringParams per assigned session ~11) — and because Next.js
// serializes server actions, that was ~25-30 sequential client round-trips.
// Here the fan-outs run in parallel ON THE SERVER and return in a single call.
//
// Also resolves the live agenda position so the screen can DEFAULT the juror's
// session to the event's current agenda item's session and restrict the
// selectable set to {current, immediately-previous} (BUG-393).

export type JuryScreenBootstrap = {
  scoresLocked: boolean;
  currentAgendaItemId: string | null;
  // The assigned scoreable session the live agenda item maps to (BUG-393).
  // Null when the live item is not one of this juror's scoreable sessions
  // (e.g. a break, or a session they don't judge).
  currentSessionId: string | null;
  // Sessions the juror may score RIGHT NOW: the current session + the
  // immediately-previous assigned session (catch-up). Subset of `sessions`.
  selectableSessionIds: string[];
  // BUG-393 follow-up: when the organiser has enabled it for this event, the
  // juror may unlock ALL assigned sessions ("score an earlier session"). When
  // false, jurors stay locked to `selectableSessionIds`.
  allowEarlierSessions: boolean;
  // All sessions this juror is assigned to, ordered (full picker context).
  sessions: ScoreableSession[];
  // Roster for the manual picker + offline prefetch.
  roster: ScoreableParticipant[];
  // Compact role rubrics keyed by parliament_role (the role-rubric fallback).
  rubricsByRole: Record<string, ScoringRubricData>;
  // Session scoring parameters keyed by agenda_item_id (the per-session sheet).
  sessionParams: Record<string, SessionScoringParams | null>;
  // Special-Remarks point deltas.
  flagDeltas: FlagDeltas;
  // Whoever is currently speaking under the live agenda item (may be null).
  currentSpeaker: CurrentSpeakerInfo | null;
};

export async function getJuryScreenBootstrap(
  juryAssignmentId: string,
  eventId: string
): Promise<ActionResult<JuryScreenBootstrap>> {
  // Same authorization gate as submitScore — the jury cookie must own this
  // assignment for this event. The reads use the service client (yip.* is
  // RLS read-only for `authenticated`), so this check is the access boundary.
  const sess = await requireJurySession(juryAssignmentId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const supabase = await createServiceClient();

  // Round of independent fetches — all concurrent on the server.
  const [eventRes, sessions, roster, flagsRes, speakerRes] = await Promise.all([
    supabase
      .from("events")
      .select("scores_locked, current_agenda_item_id, jury_allow_earlier_sessions")
      .eq("id", eventId)
      .single(),
    getSessionsForJury(juryAssignmentId, eventId),
    getScoreableParticipants(eventId),
    getScoringFlagsConfig(),
    getCurrentSpeaker(eventId),
  ]);

  const scoresLocked = Boolean(eventRes.data?.scores_locked);
  const currentAgendaItemId = eventRes.data?.current_agenda_item_id ?? null;
  const allowEarlierSessions = Boolean(
    eventRes.data?.jury_allow_earlier_sessions
  );

  // Fan-out the per-role rubrics + per-session params concurrently (server-side
  // — these were the ~20 serialized client round-trips before).
  const roles = Array.from(
    new Set(roster.map((p) => p.parliament_role ?? "mp"))
  );
  const [rubricPairs, paramPairs] = await Promise.all([
    Promise.all(
      roles.map(async (role) => {
        const r = await getRubricForRole(role);
        return r.success
          ? ([
              role,
              {
                id: r.data.id,
                criteria: r.data.criteria,
                total_max: r.data.total_max,
              } as ScoringRubricData,
            ] as const)
          : null;
      })
    ),
    Promise.all(
      sessions.map(
        async (s) => [s.id, await getSessionScoringParams(s.id)] as const
      )
    ),
  ]);

  const rubricsByRole = Object.fromEntries(
    rubricPairs.filter((x): x is NonNullable<typeof x> => x !== null)
  );
  const sessionParams = Object.fromEntries(paramPairs);

  // BUG-393 — resolve the live agenda item to the juror's current session and
  // the selectable {current, immediately-previous} set. The current session is
  // the assigned session at or before the live agenda position; ordering uses
  // (day, sequence_order), which is how `sessions` is already sorted.
  let currentSessionId: string | null = null;
  let selectableSessionIds: string[] = [];

  if (sessions.length > 0) {
    // Direct hit: the live item is itself one of the juror's sessions.
    const directIdx = currentAgendaItemId
      ? sessions.findIndex((s) => s.id === currentAgendaItemId)
      : -1;

    let currentIdx = directIdx;
    if (currentIdx === -1 && currentAgendaItemId) {
      // The live item is not a session this juror scores (break, election,
      // another panel's session). Anchor on the latest assigned session at or
      // before the live agenda position so catch-up still works.
      const { data: liveItem } = await supabase
        .from("agenda")
        .select("day, sequence_order")
        .eq("id", currentAgendaItemId)
        .maybeSingle();
      if (liveItem) {
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          const atOrBefore =
            s.day < liveItem.day ||
            (s.day === liveItem.day &&
              s.sequence_order <= liveItem.sequence_order);
          if (atOrBefore) currentIdx = i;
          else break;
        }
      }
    }

    if (currentIdx >= 0) {
      currentSessionId = sessions[currentIdx].id;
      // Current + immediately-previous assigned session (catch-up). Older
      // sessions are locked for this juror.
      selectableSessionIds = sessions
        .slice(Math.max(0, currentIdx - 1), currentIdx + 1)
        .map((s) => s.id);
    } else {
      // No live position yet (event not started / no current agenda item).
      // Fall back to the first assigned session so the screen is usable.
      currentSessionId = sessions[0].id;
      selectableSessionIds = [sessions[0].id];
    }
  }

  return {
    success: true,
    data: {
      scoresLocked,
      currentAgendaItemId,
      currentSessionId,
      selectableSessionIds,
      allowEarlierSessions,
      sessions,
      roster,
      rubricsByRole,
      sessionParams,
      flagDeltas: flagsRes.success ? flagsRes.data.deltas : {
        no_confidence_brought: 3,
        walkout: -5,
        ruckus: -3,
        suspension: -10,
      },
      currentSpeaker: speakerRes.success ? speakerRes.data : null,
    },
  };
}
