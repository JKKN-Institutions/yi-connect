"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { COMMITTEES } from "@/lib/yip/constants";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * A YUVA → party / committee assignment, joined with the volunteer's contact
 * info and (for party rows) the party name. Exactly one of `party_id` /
 * `committee_name` is set per row.
 *
 * The student dashboard consumes getYuvaAssignments() to show a participant
 * "your YUVA contact" — match by the student's party_id / committee_name.
 */
export type YuvaAssignment = {
  id: string;
  event_id: string;
  volunteer_id: string;
  volunteer_name: string;
  volunteer_phone: string | null;
  party_id: string | null;
  party_name: string | null;
  committee_name: string | null;
  created_at: string;
};

// The yip.yuva_assignments table is new; the generated DB type does not include
// it yet. A narrow local cast keeps tsc happy without a types regen — the
// table name resolves to `never` in the typed `.from()` overloads otherwise.
type RawAssignment = {
  id: string;
  event_id: string;
  volunteer_id: string;
  party_id: string | null;
  committee_name: string | null;
  created_at: string;
};

// Permissive query-builder surface for the not-yet-typed table. Scoped to this
// file; everything else on the client stays fully typed.
type AnyTable = {
  select: (cols?: string) => AnyTable;
  insert: (row: Record<string, unknown>) => AnyTable;
  delete: () => AnyTable;
  eq: (col: string, val: unknown) => AnyTable;
  in: (col: string, vals: unknown[]) => AnyTable;
  order: (col: string) => AnyTable;
  single: () => Promise<{ data: RawAssignment | null; error: { code?: string; message: string } | null }>;
  maybeSingle: () => Promise<{ data: RawAssignment | null; error: { code?: string; message: string } | null }>;
  then: Promise<{ data: RawAssignment[] | null; error: { code?: string; message: string } | null }>["then"];
};

type SupabaseLike = Awaited<ReturnType<typeof createServiceClient>>;

/** `.from("yuva_assignments")` cast to a permissive builder (table not yet typed). */
function yuvaTable(supabase: SupabaseLike): AnyTable {
  return (supabase as unknown as { from: (t: string) => AnyTable }).from(
    "yuva_assignments"
  );
}

function revalidate(eventId: string) {
  revalidatePath(`/yip/dashboard/events/${eventId}/yuva`);
}

/**
 * Every assignment for an event, joined with volunteer name/phone + party name.
 * View-gated. Returns [] when the caller cannot view the event.
 */
export async function getYuvaAssignments(
  eventId: string
): Promise<YuvaAssignment[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();

  const { data: rows } = await yuvaTable(supabase)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");

  const assignments = (rows ?? []) as RawAssignment[];
  if (assignments.length === 0) return [];

  // Resolve volunteer + party names in two batched lookups (no N+1).
  const volunteerIds = [...new Set(assignments.map((a) => a.volunteer_id))];
  const partyIds = [
    ...new Set(assignments.map((a) => a.party_id).filter((p): p is string => !!p)),
  ];

  const [{ data: vols }, partyRes] = await Promise.all([
    supabase
      .from("volunteers")
      .select("id, full_name, phone")
      .in("id", volunteerIds),
    partyIds.length
      ? supabase.from("parties").select("id, name").in("id", partyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const volById = new Map(
    (vols ?? []).map((v) => [v.id, v as { id: string; full_name: string; phone: string | null }])
  );
  const partyById = new Map(
    (partyRes.data ?? []).map((p) => [p.id, p as { id: string; name: string }])
  );

  return assignments.map((a) => ({
    id: a.id,
    event_id: a.event_id,
    volunteer_id: a.volunteer_id,
    volunteer_name: volById.get(a.volunteer_id)?.full_name ?? "(unknown)",
    volunteer_phone: volById.get(a.volunteer_id)?.phone ?? null,
    party_id: a.party_id,
    party_name: a.party_id ? partyById.get(a.party_id)?.name ?? "(deleted party)" : null,
    committee_name: a.committee_name,
    created_at: a.created_at,
  }));
}

/**
 * The set of committee names for an event, sourced (in priority order) from:
 *   1. event.committee_topics (custom committees, if any),
 *   2. committee names actually present on this event's participants,
 *   3. the default COMMITTEES constant.
 * Used to populate the committee dropdown in the assignment UI.
 */
export async function listEventCommittees(eventId: string): Promise<string[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();
  const names = new Set<string>();

  // 1. Custom committees on the event. committee_topics is either an array of
  //    committee names, or a { committeeName → topic } map whose KEYS are the
  //    committee names (the values are the debate topics).
  const { data: event } = await supabase
    .from("events")
    .select("committee_topics")
    .eq("id", eventId)
    .maybeSingle();

  const topics = (event as { committee_topics?: unknown } | null)?.committee_topics;
  if (Array.isArray(topics)) {
    for (const t of topics) {
      const s = String(t).trim();
      if (s) names.add(s);
    }
  } else if (topics && typeof topics === "object") {
    for (const k of Object.keys(topics as Record<string, unknown>)) {
      const s = k.trim();
      if (s) names.add(s);
    }
  }

  // 2. Committees actually assigned to participants.
  const { data: parts } = await supabase
    .from("participants")
    .select("committee_name")
    .eq("event_id", eventId)
    .not("committee_name", "is", null);
  for (const p of parts ?? []) {
    const s = (p.committee_name ?? "").trim();
    if (s) names.add(s);
  }

  // 3. Default committees as a fallback so the dropdown is never empty.
  for (const c of COMMITTEES) names.add(c);

  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function assignYuvaToParty(
  eventId: string,
  volunteerId: string,
  partyId: string
): Promise<ActionResult<YuvaAssignment>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { data, error } = await yuvaTable(supabase)
    .insert({
      event_id: eventId,
      volunteer_id: volunteerId,
      party_id: partyId,
      committee_name: null,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { success: false, error: "That YUVA is already assigned to this party." };
    }
    return { success: false, error: error?.message ?? "Could not create assignment" };
  }

  await logAuditAction({
    action_type: "create",
    target_table: "yuva_assignments",
    target_id: data.id,
    target_event_id: eventId,
    metadata: { volunteer_id: volunteerId, party_id: partyId },
  });

  revalidate(eventId);

  const raw = data;
  // Resolve the two display names for the returned row.
  const [{ data: vol }, { data: party }] = await Promise.all([
    supabase.from("volunteers").select("full_name, phone").eq("id", volunteerId).maybeSingle(),
    supabase.from("parties").select("name").eq("id", partyId).maybeSingle(),
  ]);

  return {
    success: true,
    data: {
      id: raw.id,
      event_id: raw.event_id,
      volunteer_id: raw.volunteer_id,
      volunteer_name: vol?.full_name ?? "(unknown)",
      volunteer_phone: vol?.phone ?? null,
      party_id: raw.party_id,
      party_name: party?.name ?? "(deleted party)",
      committee_name: null,
      created_at: raw.created_at,
    },
  };
}

export async function assignYuvaToCommittee(
  eventId: string,
  volunteerId: string,
  committeeName: string
): Promise<ActionResult<YuvaAssignment>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const name = committeeName.trim();
  if (!name) return { success: false, error: "Committee name required" };

  const supabase = await createServiceClient();
  const { data, error } = await yuvaTable(supabase)
    .insert({
      event_id: eventId,
      volunteer_id: volunteerId,
      party_id: null,
      committee_name: name,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { success: false, error: "That YUVA is already assigned to this committee." };
    }
    return { success: false, error: error?.message ?? "Could not create assignment" };
  }

  await logAuditAction({
    action_type: "create",
    target_table: "yuva_assignments",
    target_id: data.id,
    target_event_id: eventId,
    metadata: { volunteer_id: volunteerId, committee_name: name },
  });

  revalidate(eventId);

  const raw = data;
  const { data: vol } = await supabase
    .from("volunteers")
    .select("full_name, phone")
    .eq("id", volunteerId)
    .maybeSingle();

  return {
    success: true,
    data: {
      id: raw.id,
      event_id: raw.event_id,
      volunteer_id: raw.volunteer_id,
      volunteer_name: vol?.full_name ?? "(unknown)",
      volunteer_phone: vol?.phone ?? null,
      party_id: null,
      party_name: null,
      committee_name: raw.committee_name,
      created_at: raw.created_at,
    },
  };
}

export async function removeYuvaAssignment(
  assignmentId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Resolve the row's event first so the manage-gate is event-scoped (a logged
  // in organizer must not delete assignments on an event they don't manage).
  const { data: row } = await yuvaTable(supabase)
    .select("id, event_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!row) return { success: false, error: "Assignment not found" };

  const eventId = row.event_id;
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await yuvaTable(supabase).delete().eq("id", assignmentId);

  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "delete",
    target_table: "yuva_assignments",
    target_id: assignmentId,
    target_event_id: eventId,
  });

  revalidate(eventId);
  return { success: true, data: null };
}
