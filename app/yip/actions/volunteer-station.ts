"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getScoreableSessions } from "@/app/yip/actions/jury-sessions";
import { revalidatePath } from "next/cache";
import { requireVolunteerStation } from "@/lib/yip/auth/volunteer-station";

/**
 * Per-STATION volunteer tools ("Tool B").
 *
 * The volunteer session (yip_session type="volunteer") carries NO station — only
 * { id, name, eventId }. Each tool therefore DB-looks-up volunteers.station by
 * the session's volunteer id and gates FAIL-CLOSED: a null station, or a station
 * not in the tool's `allowed` list, is DENIED (mirrors resolveRoomAuth in
 * committee-room.ts). yip.volunteers / yip.participants / yip.volunteer_tasks
 * have no permissive write policies for these callers — the action IS the gate.
 *
 * Organiser-side task CRUD (createVolunteerTask, …) uses the event-scoped
 * getYipEventAccess(canManage) gate instead — never mix the two.
 */

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// The fail-closed per-station gate (requireVolunteerStation) now lives in
// lib/yip/auth/volunteer-station.ts so the "Now Speaking" console can reuse the
// exact same helper. Imported above.

// ── (a) Registration desk: check in ANY student (whole event) ─────
export type RegRosterMember = {
  id: string;
  serial_no: number | null;
  full_name: string;
  constituency_name: string | null;
  party_number: number | null;
  committee_name: string | null;
  checked_in_day1: boolean;
  checked_in_day2: boolean;
};

export async function getRegistrationRoster(
  eventId: string
): Promise<ActionResult<RegRosterMember[]>> {
  const gate = await requireVolunteerStation(eventId, ["registration"]);
  if (!gate.ok) return { success: false, error: gate.error };

  // NON-PII columns only (no phone / email / school) — registration only needs
  // to identify the student to mark arrival.
  const { data } = await gate.supabase
    .from("participants")
    .select(
      "id, serial_no, full_name, constituency_name, party_number, committee_name, checked_in_day1, checked_in_day2"
    )
    .eq("event_id", eventId)
    .order("serial_no", { ascending: true, nullsFirst: false });

  const members: RegRosterMember[] = (data ?? []).map((m) => ({
    id: m.id,
    serial_no: m.serial_no,
    full_name: m.full_name,
    constituency_name: m.constituency_name,
    party_number: m.party_number,
    committee_name: m.committee_name,
    checked_in_day1: !!m.checked_in_day1,
    checked_in_day2: !!m.checked_in_day2,
  }));
  return { success: true, data: members };
}

export async function registrationSetDayCheckIn(
  eventId: string,
  participantId: string,
  day: 1 | 2,
  value: boolean
): Promise<ActionResult<null>> {
  if (day !== 1 && day !== 2) {
    return { success: false, error: "Day must be 1 or 2." };
  }
  const gate = await requireVolunteerStation(eventId, ["registration"]);
  if (!gate.ok) return { success: false, error: gate.error };

  // Re-read the current day flags to recompute the derived checked_in.
  const { data: row } = await gate.supabase
    .from("participants")
    .select("checked_in_day1, checked_in_day2")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!row) return { success: false, error: "Student not found for this event" };

  const day1 = day === 1 ? value : !!row.checked_in_day1;
  const day2 = day === 2 ? value : !!row.checked_in_day2;
  const present = day1 || day2;
  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    checked_in: present,
    checked_in_at: present ? nowIso : null,
  };
  if (day === 1) {
    patch.checked_in_day1 = value;
    patch.checked_in_day1_at = value ? nowIso : null;
  } else {
    patch.checked_in_day2 = value;
    patch.checked_in_day2_at = value ? nowIso : null;
  }

  const { error } = await gate.supabase
    .from("participants")
    .update(patch)
    .eq("id", participantId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ── (b) Jury support: read-only scoreable schedule + progress ─────
export type JurySessionProgress = {
  id: string;
  day: number;
  title: string;
  description: string | null;
  scoredJurors: number; // distinct jurors who submitted ≥1 score for this session
};
export type JurySupportData = {
  totalJurors: number;
  sessions: JurySessionProgress[];
};

export async function getJurySupportData(
  eventId: string
): Promise<ActionResult<JurySupportData>> {
  const gate = await requireVolunteerStation(eventId, ["jury_support"]);
  if (!gate.ok) return { success: false, error: gate.error };

  const sessions = await getScoreableSessions(eventId);

  const { count: totalJurors } = await gate.supabase
    .from("jury_assignments")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  // Per-session progress: distinct jurors who have entered ≥1 score for the
  // session's agenda item. One light read of (jury_assignment_id, agenda_item_id).
  // Explicit high limit so the distinct count isn't silently truncated at the
  // ~1000-row PostgREST default (the documented row-cap gotcha).
  const { data: scoreRows } = await gate.supabase
    .from("scores")
    .select("jury_assignment_id, agenda_item_id")
    .eq("event_id", eventId)
    .limit(50000);

  const scoredBySession = new Map<string, Set<string>>();
  for (const r of scoreRows ?? []) {
    const aid = (r as { agenda_item_id: string | null }).agenda_item_id;
    const jid = (r as { jury_assignment_id: string | null }).jury_assignment_id;
    if (!aid || !jid) continue;
    if (!scoredBySession.has(aid)) scoredBySession.set(aid, new Set());
    scoredBySession.get(aid)!.add(jid);
  }

  return {
    success: true,
    data: {
      totalJurors: totalJurors ?? 0,
      sessions: sessions.map((s) => ({
        id: s.id,
        day: s.day,
        title: s.title,
        description: s.description,
        scoredJurors: scoredBySession.get(s.id)?.size ?? 0,
      })),
    },
  };
}

// ── (c) Help desk: live agenda + host-chapter chair contact ───────
export type HelpDeskInfo = {
  eventName: string | null;
  eventStatus: string | null;
  now: { title: string; day: number | null; agendaType: string | null } | null;
  chapter: {
    name: string | null;
    chairName: string | null;
    chairEmail: string | null;
    chairMobile: string | null;
  } | null;
};

export async function getHelpDeskInfo(
  eventId: string
): Promise<ActionResult<HelpDeskInfo>> {
  const gate = await requireVolunteerStation(eventId, ["help_desk"]);
  if (!gate.ok) return { success: false, error: gate.error };

  const { data: event } = await gate.supabase
    .from("events")
    .select("name, status, current_agenda_item_id, yi_chapter_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  let now: HelpDeskInfo["now"] = null;
  if (event.current_agenda_item_id) {
    const { data: item } = await gate.supabase
      .from("agenda")
      .select("title, day, agenda_type")
      .eq("id", event.current_agenda_item_id)
      .eq("event_id", eventId)
      .maybeSingle();
    if (item) {
      now = { title: item.title, day: item.day, agendaType: item.agenda_type };
    }
  }

  // Host-chapter chair contact (yi.chapters), so help desk can escalate.
  let chapter: HelpDeskInfo["chapter"] = null;
  if (event.yi_chapter_id) {
    const { data: ch } = await gate.supabase
      .schema("yi")
      .from("chapters")
      .select("name, chair_name, chair_email, chair_mobile")
      .eq("id", event.yi_chapter_id)
      .maybeSingle();
    if (ch) {
      chapter = {
        name: ch.name,
        chairName: ch.chair_name,
        chairEmail: ch.chair_email,
        chairMobile: ch.chair_mobile,
      };
    }
  }

  return {
    success: true,
    data: {
      eventName: event.name,
      eventStatus: event.status ?? null,
      now,
      chapter,
    },
  };
}

// ── (d) Runner / organiser_helper: task feed ──────────────────────
// volunteer_tasks is not in the generated DB types — narrow file-local accessor
// (same pattern as yuva_assignments in volunteer-desk.ts).
type RawTask = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  created_by_name: string | null;
  completed_at: string | null;
  created_at: string;
};
interface TaskQuery {
  select: (cols?: string, opts?: { count?: "exact"; head?: boolean }) => TaskQuery;
  insert: (row: Record<string, unknown>) => TaskQuery;
  update: (row: Record<string, unknown>) => TaskQuery;
  delete: () => TaskQuery;
  eq: (col: string, val: unknown) => TaskQuery;
  order: (col: string, opts?: { ascending?: boolean }) => TaskQuery;
  limit: (n: number) => TaskQuery;
  maybeSingle: () => Promise<{ data: RawTask | null; error: { message: string } | null }>;
  then: Promise<{ data: RawTask[] | null; error: { message: string } | null }>["then"];
}
function taskTable(sb: ServiceClient): TaskQuery {
  return (sb as unknown as { from: (t: string) => TaskQuery }).from(
    "volunteer_tasks"
  );
}

export type VolunteerTask = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  createdByName: string | null;
  completedAt: string | null;
  createdAt: string;
};

const TASK_COLS =
  "id, title, detail, status, created_by_name, completed_at, created_at";

function toTask(r: RawTask): VolunteerTask {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    status: r.status,
    createdByName: r.created_by_name,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

/** The runner / organiser-helper task feed (open first, then recently done). */
export async function getVolunteerTasks(
  eventId: string
): Promise<ActionResult<VolunteerTask[]>> {
  const gate = await requireVolunteerStation(eventId, [
    "runner",
    "organiser_helper",
  ]);
  if (!gate.ok) return { success: false, error: gate.error };

  const { data } = await taskTable(gate.supabase)
    .select(TASK_COLS)
    .eq("event_id", eventId)
    .order("status", { ascending: true }) // 'done' < 'open' alphabetically → flip below
    .order("created_at", { ascending: false });

  const tasks = (data ?? []).map(toTask);
  // Open tasks first (status sort above is alphabetical), then done.
  tasks.sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === "open" ? -1 : 1;
  });
  return { success: true, data: tasks };
}

/** A runner / organiser-helper marks a task done (or re-opens it). */
export async function setVolunteerTaskDone(
  eventId: string,
  taskId: string,
  done: boolean
): Promise<ActionResult<null>> {
  const gate = await requireVolunteerStation(eventId, [
    "runner",
    "organiser_helper",
  ]);
  if (!gate.ok) return { success: false, error: gate.error };

  // Verify the task belongs to this event before mutating (no cross-event write).
  const { data: task } = await taskTable(gate.supabase)
    .select("id")
    .eq("id", taskId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!task) return { success: false, error: "Task not found for this event" };

  const { error } = await taskTable(gate.supabase)
    .update({
      status: done ? "done" : "open",
      completed_by_volunteer_id: done ? gate.volunteerId : null,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: null };
}

// ── Organiser-side task management (event-scoped canManage gate) ──
export async function createVolunteerTask(
  eventId: string,
  title: string,
  detail: string
): Promise<ActionResult<{ id: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const t = title.trim();
  if (t.length < 3) {
    return { success: false, error: "Task title must be at least 3 characters" };
  }
  const supabase = await createServiceClient();
  const { data, error } = await taskTable(supabase)
    .insert({
      event_id: eventId,
      title: t,
      detail: detail.trim() || null,
      status: "open",
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create task" };
  }
  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: { id: data.id } };
}

/** Organiser view of the task feed (all tasks, newest first). */
export async function listVolunteerTasks(
  eventId: string
): Promise<ActionResult<VolunteerTask[]>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { data } = await taskTable(supabase)
    .select(TASK_COLS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return { success: true, data: (data ?? []).map(toTask) };
}

export async function deleteVolunteerTask(
  eventId: string,
  taskId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { error } = await taskTable(supabase)
    .delete()
    .eq("id", taskId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: null };
}
