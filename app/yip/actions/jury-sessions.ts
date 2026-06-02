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
};

// ── Read helpers (used by jury UI + results) ──────────────────────

/** All scoreable sessions for an event (agenda rows flagged is_scoreable), ordered. */
export async function getScoreableSessions(
  eventId: string
): Promise<ScoreableSession[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("agenda")
    .select("id, day, sequence_order, title, agenda_type")
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
    .select("id, day, sequence_order, title, agenda_type")
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
