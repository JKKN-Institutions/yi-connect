"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

// Per-session scoring (BUG-385): a "session" is a scoreable yip.agenda row.
// yip.jury_session_assignments maps which juror may score which session.
// Writes here run on the service client AFTER getYipEventAccess() — yip.* tables
// are RLS read-only for `authenticated`, so the capability check IS the gate.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ScoreableSession = {
  id: string;
  day: number;
  sequence_order: number;
  title: string;
  agenda_type: string | null;
  // BUG-393 (current-session matching) + BUG-395 (session blurb on the jury
  // screen). session_key links the agenda row to its session config; description
  // is the "what you're scoring" text surfaced to jurors.
  session_key: string | null;
  description: string | null;
};

// ── Read helpers (used by jury UI + results) ──────────────────────

/** All scoreable sessions for an event (agenda rows flagged is_scoreable), ordered. */
export async function getScoreableSessions(
  eventId: string
): Promise<ScoreableSession[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("agenda")
    .select("id, day, sequence_order, title, agenda_type, session_key, description")
    .eq("event_id", eventId)
    .eq("is_scoreable", true)
    .order("day")
    .order("sequence_order");
  if (error || !data) return [];
  return data as ScoreableSession[];
}

/** The scoreable sessions a given juror is assigned to (the restriction source). */
export async function getSessionsForJury(
  juryAssignmentId: string,
  eventId: string
): Promise<ScoreableSession[]> {
  const supabase = await createServiceClient();
  const { data: rows } = await supabase
    .from("jury_session_assignments")
    .select("agenda_item_id")
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("event_id", eventId);

  const ids = (rows ?? []).map((r) => r.agenda_item_id);
  if (ids.length === 0) return [];

  const { data: sessions } = await supabase
    .from("agenda")
    .select("id, day, sequence_order, title, agenda_type, session_key, description")
    .eq("event_id", eventId)
    .eq("is_scoreable", true)
    .in("id", ids)
    .order("day")
    .order("sequence_order");

  return (sessions ?? []) as ScoreableSession[];
}

/** Restriction check used by submitScore — is this juror assigned to this session? */
export async function isJurorAssignedToSession(
  juryAssignmentId: string,
  agendaItemId: string
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { count } = await supabase
    .from("jury_session_assignments")
    .select("id", { count: "exact", head: true })
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("agenda_item_id", agendaItemId);
  return (count ?? 0) > 0;
}

// ── Organizer roster (gated) ──────────────────────────────────────

export type SessionRoster = {
  jurors: { id: string; jury_name: string; is_active: boolean | null }[];
  sessions: ScoreableSession[];
  assignments: { jury_assignment_id: string; agenda_item_id: string }[];
};

/** Full roster for the organizer assignment screen. */
export async function getSessionRoster(
  eventId: string
): Promise<ActionResult<SessionRoster>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();
  const [jurorsRes, sessions, assignmentsRes] = await Promise.all([
    supabase
      .from("jury_assignments")
      .select("id, jury_name, is_active")
      .eq("event_id", eventId)
      .order("created_at"),
    getScoreableSessions(eventId),
    supabase
      .from("jury_session_assignments")
      .select("jury_assignment_id, agenda_item_id")
      .eq("event_id", eventId),
  ]);

  return {
    success: true,
    data: {
      jurors: jurorsRes.data ?? [],
      sessions,
      assignments: assignmentsRes.data ?? [],
    },
  };
}

/** Replace the full set of sessions a single juror is assigned to (gated). */
export async function setJurorSessions(
  eventId: string,
  juryAssignmentId: string,
  agendaItemIds: string[]
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Juror must belong to this event.
  const { data: juror } = await supabase
    .from("jury_assignments")
    .select("id")
    .eq("id", juryAssignmentId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!juror) return { success: false, error: "Juror not found for this event" };

  // Target sessions must be scoreable agenda rows of this event.
  if (agendaItemIds.length > 0) {
    const { data: valid } = await supabase
      .from("agenda")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_scoreable", true)
      .in("id", agendaItemIds);
    const validIds = new Set((valid ?? []).map((r) => r.id));
    const bad = agendaItemIds.filter((id) => !validIds.has(id));
    if (bad.length > 0)
      return {
        success: false,
        error: "One or more sessions are not scoreable for this event",
      };
  }

  // Replace-set semantics: clear this juror's rows, then insert the new set.
  const { error: delErr } = await supabase
    .from("jury_session_assignments")
    .delete()
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("event_id", eventId);
  if (delErr) return { success: false, error: delErr.message };

  if (agendaItemIds.length > 0) {
    const rows = agendaItemIds.map((aid) => ({
      event_id: eventId,
      jury_assignment_id: juryAssignmentId,
      agenda_item_id: aid,
    }));
    const { error: insErr } = await supabase
      .from("jury_session_assignments")
      .insert(rows);
    if (insErr) return { success: false, error: insErr.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: null };
}

// ── Per-event scoring on/off (chapter override of the global default) ──
//
// The master Session Parameters page (requireSuperAdmin) defines WHICH session
// types CAN be scored and with what criteria — the global default. This lets a
// chapter turn scoring on/off for a session in THEIR OWN event (event-scoped
// gate), without touching the master. A session can only be turned ON if its
// type resolves to an ACTIVE master config — mirrors getSessionScoringParams so
// we never create a "scored but no criteria" trap. Turning OFF leaves any juror
// assignments + recorded scores untouched (turning back ON restores them).

export type ScoringToggleSession = {
  id: string;
  day: number;
  sequence_order: number;
  title: string;
  agenda_type: string | null;
  session_key: string | null;
  is_scoreable: boolean;
  /** A matching ACTIVE master config exists, so this session can be scored. */
  has_criteria: boolean;
  /** Scores already recorded against this session (warn before turning off). */
  score_count: number;
};

/**
 * Does an agenda item resolve to an ACTIVE master scoring config?
 * Mirrors getSessionScoringParams: session_key wins (exact, no type fallback);
 * otherwise match by agenda_type.
 */
function itemHasActiveCriteria(
  item: { session_key: string | null; agenda_type: string | null },
  activeKeys: Set<string>,
  activeTypes: Set<string>
): boolean {
  if (item.session_key) return activeKeys.has(item.session_key);
  if (item.agenda_type) return activeTypes.has(item.agenda_type);
  return false;
}

/** All sessions a chapter can toggle scoring for in this event (gated). */
export async function getScoringToggleSessions(
  eventId: string
): Promise<ActionResult<ScoringToggleSession[]>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();
  const [agendaRes, paramsRes] = await Promise.all([
    supabase
      .from("agenda")
      .select("id, day, sequence_order, title, agenda_type, session_key, is_scoreable")
      .eq("event_id", eventId)
      .order("day")
      .order("sequence_order"),
    supabase
      .from("session_parameters")
      .select("session_key, agenda_type")
      .eq("is_active", true),
  ]);

  const agenda = agendaRes.data ?? [];
  const activeKeys = new Set(
    (paramsRes.data ?? []).map((p) => p.session_key).filter(Boolean) as string[]
  );
  const activeTypes = new Set(
    (paramsRes.data ?? []).map((p) => p.agenda_type).filter(Boolean) as string[]
  );

  // Show sessions that CAN be scored (active criteria) or are currently scored
  // (so an already-on session can always be turned off).
  const candidates = agenda.filter((a) => {
    const eligible = itemHasActiveCriteria(a, activeKeys, activeTypes);
    return eligible || a.is_scoreable === true;
  });

  // Tally existing scores per candidate session in one query.
  const ids = candidates.map((a) => a.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: scoreRows } = await supabase
      .from("scores")
      .select("agenda_item_id")
      .in("agenda_item_id", ids);
    for (const r of scoreRows ?? []) {
      const k = (r as { agenda_item_id: string }).agenda_item_id;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  const sessions: ScoringToggleSession[] = candidates.map((a) => ({
    id: a.id,
    day: a.day,
    sequence_order: a.sequence_order,
    title: a.title,
    agenda_type: a.agenda_type,
    session_key: a.session_key,
    is_scoreable: a.is_scoreable === true,
    has_criteria: itemHasActiveCriteria(a, activeKeys, activeTypes),
    score_count: counts.get(a.id) ?? 0,
  }));

  return { success: true, data: sessions };
}

/** Turn scoring on/off for one session in this event (gated). */
export async function setSessionScoreable(
  eventId: string,
  agendaItemId: string,
  isScoreable: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Session must belong to this event.
  const { data: item } = await supabase
    .from("agenda")
    .select("id, session_key, agenda_type")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!item) return { success: false, error: "Session not found for this event" };

  // Turning ON requires a matching ACTIVE master config — never create a
  // "scored but no criteria" trap.
  if (isScoreable) {
    const { data: params } = await supabase
      .from("session_parameters")
      .select("session_key, agenda_type")
      .eq("is_active", true);
    const activeKeys = new Set(
      (params ?? []).map((p) => p.session_key).filter(Boolean) as string[]
    );
    const activeTypes = new Set(
      (params ?? []).map((p) => p.agenda_type).filter(Boolean) as string[]
    );
    if (!itemHasActiveCriteria(item, activeKeys, activeTypes)) {
      return {
        success: false,
        error:
          "No active scoring criteria for this session type. Set them on the master Session Parameters page first.",
      };
    }
  }

  const { error } = await supabase
    .from("agenda")
    .update({ is_scoreable: isScoreable })
    .eq("id", agendaItemId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/jury/sessions`);
  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: null };
}
