"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireVolunteerSession } from "@/lib/yip/auth/yip-session";
import {
  matchesDesk,
  deskScope,
  type DeskAssignment,
} from "@/lib/yip/yuva-desk";
import { revalidatePath } from "next/cache";

/**
 * YUVA volunteer DESK actions (desk-scoped). A volunteer (yip_session
 * type="volunteer") may only see and act on students in a party or committee
 * they are assigned to in yip.yuva_assignments. Every export gates on
 * requireVolunteerSession(eventId); writes additionally re-verify the target is
 * in-desk server-side (the UI filter is NOT the only gate — yip.participants
 * write policies are permissive, so the action is the authorization layer).
 *
 * Reads are deliberately NON-PII (no phone/email/school) — mirrors
 * getMyPartyRoster in me-dashboard.ts.
 */

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// ── Untyped accessors: yuva_assignments + participants.speech_finished are not
//    in the generated DB types. Narrow, file-local — matches the established
//    pattern in me-dashboard.ts / vote-capture.ts. ──
type RawAssignment = {
  id: string;
  volunteer_id: string;
  party_id: string | null;
  committee_name: string | null;
};
type YuvaTable = {
  select: (cols?: string) => YuvaTable;
  eq: (col: string, val: unknown) => YuvaTable;
  then: Promise<{
    data: RawAssignment[] | null;
    error: { message: string } | null;
  }>["then"];
};
function yuvaTable(sb: ServiceClient): YuvaTable {
  return (sb as unknown as { from: (t: string) => YuvaTable }).from(
    "yuva_assignments"
  );
}

type RawDeskParticipant = {
  id: string;
  serial_no: number | null;
  constituency_number: number | null;
  full_name: string;
  constituency_name: string | null;
  party_id: string | null;
  committee_name: string | null;
  checked_in: boolean | null;
  checked_in_day1: boolean | null;
  checked_in_day2: boolean | null;
  speech_finished: boolean | null;
};
const DESK_ROSTER_COLS =
  "id, serial_no, constituency_number, full_name, constituency_name, party_id, committee_name, checked_in, checked_in_day1, checked_in_day2, speech_finished";
type PartTable = {
  select: (cols?: string) => PartTable;
  eq: (col: string, val: unknown) => PartTable;
  order: (
    col: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean }
  ) => PartTable;
  maybeSingle: () => Promise<{
    data: RawDeskParticipant | null;
    error: { message: string } | null;
  }>;
  then: Promise<{
    data: RawDeskParticipant[] | null;
    error: { message: string } | null;
  }>["then"];
};
function partsTable(sb: ServiceClient): PartTable {
  return (sb as unknown as { from: (t: string) => PartTable }).from(
    "participants"
  );
}
type PartWrite = {
  update: (row: Record<string, unknown>) => {
    eq: (c: string, v: unknown) => {
      eq: (
        c: string,
        v: unknown
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};
function partsWrite(sb: ServiceClient): PartWrite {
  return (sb as unknown as { from: (t: string) => PartWrite }).from(
    "participants"
  );
}

// ── Public types ──
export type MyDesk = {
  parties: { id: string; name: string }[];
  committees: string[];
  hasDesk: boolean;
};

export type DeskRosterMember = {
  id: string;
  serial_no: number | null;
  constituency_number: number | null;
  full_name: string;
  constituency_name: string | null;
  checked_in: boolean;
  checked_in_day1: boolean;
  checked_in_day2: boolean;
  speech_finished: boolean;
  /** which part of the desk this student matched (for grouping) */
  via: "party" | "committee";
};

export type AgendaNow = {
  eventStatus: string | null;
  item: {
    title: string;
    description: string | null;
    agendaType: string | null;
    status: string | null;
    day: number | null;
  } | null;
};

/** Read the caller volunteer's assignments for an event. */
async function myAssignments(
  sb: ServiceClient,
  eventId: string,
  volunteerId: string
): Promise<DeskAssignment[]> {
  const { data } = await yuvaTable(sb)
    .select("id, volunteer_id, party_id, committee_name")
    .eq("event_id", eventId)
    .eq("volunteer_id", volunteerId);
  return (data ?? []) as DeskAssignment[];
}

/** The logged-in volunteer's own desk: assigned parties (+names) and committees. */
export async function getMyYuvaAssignment(
  eventId: string
): Promise<ActionResult<MyDesk>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };
  const supabase = await createServiceClient();

  const assignments = await myAssignments(
    supabase,
    eventId,
    session.volunteerId
  );
  const { partyIds, committeeNames } = deskScope(assignments);

  let parties: { id: string; name: string }[] = [];
  if (partyIds.length > 0) {
    const { data: pr } = await supabase
      .from("parties")
      .select("id, name")
      .in("id", partyIds);
    parties = (pr ?? []).map((p) => ({ id: p.id, name: p.name }));
  }

  return {
    success: true,
    data: {
      parties,
      committees: committeeNames,
      hasDesk: partyIds.length > 0 || committeeNames.length > 0,
    },
  };
}

/** The desk-scoped student roster (NON-PII) for attendance + speech marking. */
export async function getMyDeskRoster(
  eventId: string
): Promise<ActionResult<DeskRosterMember[]>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };
  const supabase = await createServiceClient();

  const assignments = await myAssignments(
    supabase,
    eventId,
    session.volunteerId
  );
  const { partyIds, committeeNames } = deskScope(assignments);
  if (partyIds.length === 0 && committeeNames.length === 0) {
    return { success: true, data: [] }; // no desk -> empty (fail closed)
  }

  // NON-PII columns ONLY. Do NOT add phone / email / school / parent_phone.
  const { data: roster } = await partsTable(supabase)
    .select(DESK_ROSTER_COLS)
    .eq("event_id", eventId)
    .order("serial_no", { ascending: true, nullsFirst: false });

  const members = (roster ?? []) as RawDeskParticipant[];

  const inDesk = members
    .filter((m) =>
      matchesDesk(
        { party_id: m.party_id, committee_name: m.committee_name },
        assignments
      )
    )
    .map<DeskRosterMember>((m) => ({
      id: m.id,
      serial_no: m.serial_no,
      constituency_number: m.constituency_number,
      full_name: m.full_name,
      constituency_name: m.constituency_name,
      checked_in: !!m.checked_in,
      checked_in_day1: !!m.checked_in_day1,
      checked_in_day2: !!m.checked_in_day2,
      speech_finished: !!m.speech_finished,
      via:
        m.party_id && partyIds.includes(m.party_id) ? "party" : "committee",
    }));

  return { success: true, data: inDesk };
}

/** What's live right now — volunteer-gated, read-only. Poll this ~5s. */
export async function getVolunteerAgendaNow(
  eventId: string
): Promise<ActionResult<AgendaNow>> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { success: false, error: session.error };
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("status, current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false, error: "Event not found" };

  if (!event.current_agenda_item_id) {
    return {
      success: true,
      data: { eventStatus: event.status ?? null, item: null },
    };
  }

  const { data: item } = await supabase
    .from("agenda")
    .select("title, description, agenda_type, status, day")
    .eq("id", event.current_agenda_item_id)
    .eq("event_id", eventId) // no cross-event leak
    .maybeSingle();

  return {
    success: true,
    data: {
      eventStatus: event.status ?? null,
      item: item
        ? {
            title: item.title,
            description: item.description,
            agendaType: item.agenda_type,
            status: item.status,
            day: item.day,
          }
        : null,
    },
  };
}

/**
 * Verify a target participant is inside the caller volunteer's desk. Returns the
 * service client on success so the write can run on the same connection.
 */
async function assertTargetInMyDesk(
  eventId: string,
  participantId: string
): Promise<
  | { ok: true; supabase: ServiceClient; target: RawDeskParticipant }
  | { ok: false; error: string }
> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { ok: false, error: session.error };
  const supabase = await createServiceClient();

  const assignments = await myAssignments(
    supabase,
    eventId,
    session.volunteerId
  );

  const { data: targetRow } = await partsTable(supabase)
    .select(DESK_ROSTER_COLS)
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!targetRow)
    return { ok: false, error: "Student not found for this event" };

  if (
    !matchesDesk(
      { party_id: targetRow.party_id, committee_name: targetRow.committee_name },
      assignments
    )
  ) {
    return { ok: false, error: "That student is not at your desk." };
  }
  return { ok: true, supabase, target: targetRow };
}

/** Desk-scoped check-in: flips the SAME checked_in column the organiser uses. */
export async function volunteerCheckInParticipant(
  eventId: string,
  participantId: string,
  checkedIn: boolean
): Promise<ActionResult<null>> {
  const guard = await assertTargetInMyDesk(eventId, participantId);
  if (!guard.ok) return { success: false, error: guard.error };

  const { error } = await partsWrite(guard.supabase)
    .update({
      checked_in: checkedIn,
      checked_in_at: checkedIn ? new Date().toISOString() : null,
    })
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/**
 * Desk-scoped two-day check-in (YA2): set Day 1 / Day 2 for a student at this
 * volunteer's desk and recompute the derived `checked_in` (= day1 OR day2).
 */
export async function volunteerSetDayCheckIn(
  eventId: string,
  participantId: string,
  day: 1 | 2,
  value: boolean
): Promise<ActionResult<null>> {
  if (day !== 1 && day !== 2) {
    return { success: false, error: "Day must be 1 or 2." };
  }
  const guard = await assertTargetInMyDesk(eventId, participantId);
  if (!guard.ok) return { success: false, error: guard.error };

  const day1 = day === 1 ? value : !!guard.target.checked_in_day1;
  const day2 = day === 2 ? value : !!guard.target.checked_in_day2;
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

  const { error } = await partsWrite(guard.supabase)
    .update(patch)
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Desk-scoped speech marker (reversible). */
export async function volunteerSetSpeechFinished(
  eventId: string,
  participantId: string,
  finished: boolean
): Promise<ActionResult<null>> {
  const guard = await assertTargetInMyDesk(eventId, participantId);
  if (!guard.ok) return { success: false, error: guard.error };

  const { error } = await partsWrite(guard.supabase)
    .update({ speech_finished: finished })
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}
