"use server";

import { createClient } from "@/lib/yip/supabase/server";
import { DEFAULT_AGENDA_TEMPLATE } from "@/lib/yip/constants";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/dashboard");
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

  if (!existing || existing.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

  const { error } = await supabase
    .from("events")
    .update(data)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/events/${eventId}`);
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

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("created_by", user.id)
    .single();

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

  if (!existing || existing.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

  const patch = { [field]: value };
  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/events/${eventId}/control`);
  revalidatePath(`/dashboard/events/${eventId}/scoring`);
  revalidatePath(`/dashboard/events/${eventId}/participants`);
  revalidatePath(`/dashboard/events/${eventId}/allocation`);
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

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("created_by", user.id)
    .single();

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
