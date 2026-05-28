"use server";

import { createClient } from "@/lib/yip/supabase/server";
import { DEFAULT_AGENDA_TEMPLATE } from "@/lib/yip/constants";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import { attachCentralTopicsToEvent } from "./admin-topics";

// ─── Types ─────────────────────────────────────────────────────────

interface CreateEventData {
  name: string;
  level: "chapter" | "regional" | "national";
  chapter_name: string;
  city: string;
  state: string;
  day1_date: string;
  day2_date: string;
  venue_name: string;
  venue_address: string;
  central_agenda: string;
  committee_topics: Record<string, string>;
}

interface UpdateEventData {
  name?: string;
  level?: "chapter" | "regional" | "national";
  chapter_name?: string;
  city?: string;
  state?: string;
  day1_date?: string;
  day2_date?: string;
  venue_name?: string;
  venue_address?: string;
  central_agenda?: string;
  committee_topics?: Record<string, string>;
  status?: "draft" | "registration_open" | "registration_closed" | "day1_live" | "day1_complete" | "day2_live" | "completed" | "results_published";
}

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Create Event ──────────────────────────────────────────────────

export async function createEvent(
  data: CreateEventData
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Insert the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      name: data.name,
      level: data.level,
      chapter_name: data.chapter_name,
      city: data.city,
      state: data.state,
      day1_date: data.day1_date,
      day2_date: data.day2_date,
      venue_name: data.venue_name,
      venue_address: data.venue_address,
      central_agenda: data.central_agenda,
      committee_topics: data.committee_topics,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    return {
      success: false,
      error: eventError?.message ?? "Failed to create event",
    };
  }

  // Auto-generate agenda items from DEFAULT_AGENDA_TEMPLATE
  const agendaItems: Array<{
    event_id: string;
    day: number;
    sequence_order: number;
    title: string;
    duration_minutes: number;
    agenda_type: string;
    mode: "party" | "committee" | "mixed";
  }> = [];

  for (const item of DEFAULT_AGENDA_TEMPLATE.day1) {
    agendaItems.push({
      event_id: event.id,
      day: 1,
      sequence_order: item.sequence,
      title: item.title,
      duration_minutes: item.duration,
      agenda_type: item.type,
      mode: item.mode,
    });
  }

  for (const item of DEFAULT_AGENDA_TEMPLATE.day2) {
    agendaItems.push({
      event_id: event.id,
      day: 2,
      sequence_order: item.sequence,
      title: item.title,
      duration_minutes: item.duration,
      agenda_type: item.type,
      mode: item.mode,
    });
  }

  const { error: agendaError } = await supabase
    .from("agenda")
    .insert(agendaItems);

  if (agendaError) {
    // Event was created but agenda failed - log but don't fail
    console.error("Failed to create agenda items:", agendaError.message);
  }

  // Seed organizer_checklist from default template (handbook p.45-46)
  const { data: defaultItems } = await supabase
    .from("checklist_template")
    .select("category, sequence_order, title, description")
    .order("category")
    .order("sequence_order");

  if (defaultItems && defaultItems.length > 0) {
    const checklistRows = defaultItems.map((item) => ({
      event_id: event.id,
      title: item.title,
      description: item.description,
      category: item.category,
      sequence_order: item.sequence_order,
      is_completed: false,
    }));
    const { error: checklistError } = await supabase
      .from("checklist")
      .insert(checklistRows);
    if (checklistError) {
      console.error("Failed to seed checklist:", checklistError.message);
    }
  }

  // Auto-inherit active central topics for chapter-level events. Chapter
  // organizers can then remove ones they don't want and pick their 5.
  // Failure here MUST NOT roll back the event — the event should exist
  // even if no central topics are active or the upsert fails.
  if (data.level === "chapter") {
    const attachResult = await attachCentralTopicsToEvent(event.id);
    if (!attachResult.success) {
      console.error(
        "Failed to auto-attach central topics to chapter event:",
        attachResult.error
      );
    }
  }

  await logAuditAction({
    action_type: "create",
    target_table: "events",
    target_id: event.id,
    target_event_id: event.id,
    metadata: {
      name: data.name,
      level: data.level,
      chapter_name: data.chapter_name,
    },
  });
  revalidatePath("/yip/dashboard");
  return { success: true, data: { id: event.id } };
}

// ─── Update Event ──────────────────────────────────────────────────

export async function updateEvent(
  eventId: string,
  data: UpdateEventData
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate ownership
  const { data: existing } = await supabase
    .from("events")
    .select("created_by")
    .eq("id", eventId)
    .single();

  if (!existing) {
    return { success: false, error: "Event not found" };
  }
  if (existing.created_by !== user.id && !(await isCurrentUserSuperAdmin())) {
    return { success: false, error: "Event not authorized" };
  }

  const { error } = await supabase
    .from("events")
    .update(data)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, data: null };
}

// ─── Get Event ─────────────────────────────────────────────────────

export async function getEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Super-admin (role='national') can read any event; others scoped to their own.
  const isSuper = await isCurrentUserSuperAdmin();
  let query = supabase.from("events").select("*").eq("id", eventId);
  if (!isSuper) query = query.eq("created_by", user.id);
  const { data: event } = await query.single();

  if (!event) return null;

  // Get participant count
  const { count: participantCount } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  // Get jury count
  const { count: juryCount } = await supabase
    .from("jury_assignments")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  return {
    ...event,
    participantCount: participantCount ?? 0,
    juryCount: juryCount ?? 0,
  };
}

// ─── Lock Toggles ──────────────────────────────────────────────────
// Three boolean flags on the events row that gate writes from other roles.

async function setEventLock(
  eventId: string,
  field: "allocation_locked" | "scores_locked" | "registrations_frozen",
  value: boolean
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: existing } = await supabase
    .from("events")
    .select("created_by")
    .eq("id", eventId)
    .single();

  if (!existing) {
    return { success: false, error: "Event not found" };
  }
  if (existing.created_by !== user.id && !(await isCurrentUserSuperAdmin())) {
    return { success: false, error: "Event not authorized" };
  }

  const patch = { [field]: value };
  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/jury`);
  return { success: true, data: null };
}

export async function setAllocationLocked(
  eventId: string,
  value: boolean
): Promise<ActionResult<null>> {
  return setEventLock(eventId, "allocation_locked", value);
}

export async function setScoresLocked(
  eventId: string,
  value: boolean
): Promise<ActionResult<null>> {
  return setEventLock(eventId, "scores_locked", value);
}

export async function setRegistrationsFrozen(
  eventId: string,
  value: boolean
): Promise<ActionResult<null>> {
  return setEventLock(eventId, "registrations_frozen", value);
}

// ─── Get Event With Details ────────────────────────────────────────

export async function getEventWithDetails(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const isSuper = await isCurrentUserSuperAdmin();
  let query = supabase.from("events").select("*").eq("id", eventId);
  if (!isSuper) query = query.eq("created_by", user.id);
  const { data: event } = await query.single();

  if (!event) return null;

  // Fetch related data in parallel
  const [participantsRes, agendaRes, juryRes] = await Promise.all([
    supabase
      .from("participants")
      .select("*")
      .eq("event_id", eventId)
      .order("full_name"),
    supabase
      .from("agenda")
      .select("*")
      .eq("event_id", eventId)
      .order("day")
      .order("sequence_order"),
    supabase
      .from("jury_assignments")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at"),
  ]);

  return {
    ...event,
    participants: participantsRes.data ?? [],
    agendaItems: agendaRes.data ?? [],
    juryAssignments: juryRes.data ?? [],
    participantCount: participantsRes.data?.length ?? 0,
    juryCount: juryRes.data?.length ?? 0,
  };
}
// ─── Live Banner (F5) ──────────────────────────────────────────────
// Push / clear a breaking-news banner that appears on the projector
// display. Persisted on the events row AND broadcast over Realtime so
// connected projector clients update without a postgres_changes round-trip.

const LIVE_BANNER_MAX_LEN = 280;

export async function pushLiveBanner(
  eventId: string,
  text: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) {
    return { success: false, error: "Banner text is required" };
  }
  if (trimmed.length > LIVE_BANNER_MAX_LEN) {
    return {
      success: false,
      error: `Banner text must be ${LIVE_BANNER_MAX_LEN} characters or fewer (got ${trimmed.length})`,
    };
  }

  const { data: existing } = await supabase
    .from("events")
    .select("created_by")
    .eq("id", eventId)
    .single();

  if (!existing) {
    return { success: false, error: "Event not found" };
  }
  if (existing.created_by !== user.id && !(await isCurrentUserSuperAdmin())) {
    return { success: false, error: "Event not authorized" };
  }

  // live_banner_* columns exist in DB (migration adding live_banner_text
  // + live_banner_active) but may not be in generated types yet.
  const patch = {
    live_banner_text: trimmed,
    live_banner_active: true,
  } ;

  const { error } = await supabase
    .from("events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Broadcast to connected projector clients on a dedicated channel.
  const channel = supabase.channel(`yip:live-banner:${eventId}`);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
    // Safety timeout so we never hang the server action.
    setTimeout(resolve, 1500);
  });
  await channel.send({
    type: "broadcast",
    event: "update",
    payload: { active: true, text: trimmed },
  });
  await supabase.removeChannel(channel);

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

export async function clearLiveBanner(
  eventId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: existing } = await supabase
    .from("events")
    .select("created_by")
    .eq("id", eventId)
    .single();

  if (!existing) {
    return { success: false, error: "Event not found" };
  }
  if (existing.created_by !== user.id && !(await isCurrentUserSuperAdmin())) {
    return { success: false, error: "Event not authorized" };
  }

  const patch = {
    live_banner_active: false,
  } ;

  const { error } = await supabase
    .from("events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  const channel = supabase.channel(`yip:live-banner:${eventId}`);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
    setTimeout(resolve, 1500);
  });
  await channel.send({
    type: "broadcast",
    event: "update",
    payload: { active: false, text: null },
  });
  await supabase.removeChannel(channel);

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

