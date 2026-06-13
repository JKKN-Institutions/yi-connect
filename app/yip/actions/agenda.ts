"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import type { Json } from "@/types/yip/database";
import {
  type SubTimer,
  SUB_TIMER_MAX_ENTRIES,
  SUB_TIMER_LABEL_MAX,
  SUB_TIMER_MIN_SECONDS,
  SUB_TIMER_MAX_SECONDS,
} from "@/lib/yip/sub-timers";

// Gated writes run on the service client AFTER getYipEventAccess() (yip.* tables
// have RLS read-only for `authenticated`; the capability check is the gate).
type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Advance Agenda ───────────────────────────────────────────────
// Marks the current item completed, sets the next item to in_progress,
// and updates events.current_agenda_item_id

export async function advanceAgenda(
  eventId: string
): Promise<ActionResult<{ nextItemId: string | null }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Get current event
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, current_agenda_item_id, status")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    return { success: false, error: "Event not found" };
  }

  // Get all agenda items ordered by day + sequence
  const { data: items, error: itemsErr } = await supabase
    .from("agenda")
    .select("*")
    .eq("event_id", eventId)
    .order("day")
    .order("sequence_order");

  if (itemsErr || !items || items.length === 0) {
    return { success: false, error: "No agenda items found" };
  }

  // Determine the current day from event status
  const currentDay = event.status === "day2_live" ? 2 : 1;
  const dayItems = items.filter((i) => i.day === currentDay);

  // Find current item index
  let currentIdx = -1;
  if (event.current_agenda_item_id) {
    currentIdx = dayItems.findIndex(
      (i) => i.id === event.current_agenda_item_id
    );
  }

  // Mark current item as completed
  if (currentIdx >= 0) {
    await supabase
      .from("agenda")
      .update({
        status: "completed",
        actual_end: new Date().toISOString(),
      })
      .eq("id", dayItems[currentIdx].id);
  }

  // Find next non-skipped, non-completed item
  let nextItem = null;
  for (let i = currentIdx + 1; i < dayItems.length; i++) {
    if (
      dayItems[i].status !== "completed" &&
      dayItems[i].status !== "skipped"
    ) {
      nextItem = dayItems[i];
      break;
    }
  }

  if (nextItem) {
    // Mark next item as in_progress
    await supabase
      .from("agenda")
      .update({
        status: "in_progress",
        actual_start: new Date().toISOString(),
      })
      .eq("id", nextItem.id);

    // Update event current_agenda_item_id
    await supabase
      .from("events")
      .update({ current_agenda_item_id: nextItem.id })
      .eq("id", eventId);
  } else {
    // No more items — clear current
    await supabase
      .from("events")
      .update({ current_agenda_item_id: null })
      .eq("id", eventId);
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { nextItemId: nextItem?.id ?? null } };
}

// ─── Go To Previous Agenda Item ───────────────────────────────────
// Reverses advanceAgenda by one step within the current day: un-advances
// the current item (status back to `upcoming`), re-activates the item
// immediately before it (status `in_progress`), and points
// events.current_agenda_item_id at the previous item.
//
// CHAIR / NATIONAL ONLY — moving the agenda BACKWARD is a stronger
// privilege than ordinary organising (it rewinds everyone's live screen),
// so an ordinary chapter_organizer is rejected even though they canManage.

const AGENDA_BACKWARD_DENIED =
  "Only the chapter chair or a national admin can move the agenda backward.";

export async function goToPreviousAgendaItem(
  eventId: string
): Promise<ActionResult<{ previousItemId: string }>> {
  const access = await getYipEventAccess(eventId);
  if (access.role !== "super_admin" && access.role !== "chapter_admin") {
    return { success: false, error: AGENDA_BACKWARD_DENIED };
  }
  const supabase = await createServiceClient();

  // Get current event
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, current_agenda_item_id, status")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    return { success: false, error: "Event not found" };
  }

  if (!event.current_agenda_item_id) {
    return { success: false, error: "Already at the first item." };
  }

  // Get all agenda items ordered by day + sequence (mirror advanceAgenda)
  const { data: items, error: itemsErr } = await supabase
    .from("agenda")
    .select("*")
    .eq("event_id", eventId)
    .order("day")
    .order("sequence_order");

  if (itemsErr || !items || items.length === 0) {
    return { success: false, error: "No agenda items found" };
  }

  // Determine the current day from event status (same rule as advanceAgenda)
  const currentDay = event.status === "day2_live" ? 2 : 1;
  const dayItems = items.filter((i) => i.day === currentDay);

  // Find current item index within the current day's ordered items
  const currentIdx = dayItems.findIndex(
    (i) => i.id === event.current_agenda_item_id
  );

  // No current item in this day, or it's the first item → nothing before it.
  if (currentIdx <= 0) {
    return { success: false, error: "Already at the first item." };
  }

  const currentItem = dayItems[currentIdx];
  const previousItem = dayItems[currentIdx - 1];

  // Un-advance the current item: status back to `upcoming`, clear its
  // start/end timestamps so it reads as "not started" again.
  await supabase
    .from("agenda")
    .update({
      status: "upcoming",
      actual_start: null,
      actual_end: null,
    })
    .eq("id", currentItem.id);

  // Re-activate the previous item: status `in_progress`, clear any end
  // timestamp set when it was previously completed, set a fresh start.
  await supabase
    .from("agenda")
    .update({
      status: "in_progress",
      actual_start: new Date().toISOString(),
      actual_end: null,
    })
    .eq("id", previousItem.id);

  // Point the event back at the previous item
  await supabase
    .from("events")
    .update({ current_agenda_item_id: previousItem.id })
    .eq("id", eventId);

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { previousItemId: previousItem.id } };
}

// ─── Reset Agenda ─────────────────────────────────────────────────
// Sends the WHOLE agenda back to the start: every agenda item for this
// event returns to `upcoming` and events.current_agenda_item_id is cleared.
// Only moves the agenda pointer + item statuses — does NOT touch votes,
// scores, questions, motions, or bills.
//
// CHAIR / NATIONAL ONLY (same gate as goToPreviousAgendaItem).

export async function resetAgenda(eventId: string): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (access.role !== "super_admin" && access.role !== "chapter_admin") {
    return { success: false, error: AGENDA_BACKWARD_DENIED };
  }
  const supabase = await createServiceClient();

  // Every agenda item for this event → upcoming, clear start/end timestamps.
  const { error: agendaErr } = await supabase
    .from("agenda")
    .update({
      status: "upcoming",
      actual_start: null,
      actual_end: null,
    })
    .eq("event_id", eventId);

  if (agendaErr) return { success: false, error: agendaErr.message };

  // Clear the live pointer so no item is current.
  const { error: eventErr } = await supabase
    .from("events")
    .update({ current_agenda_item_id: null })
    .eq("id", eventId);

  if (eventErr) return { success: false, error: eventErr.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Start Specific Agenda Item ───────────────────────────────────

export async function startAgendaItem(
  eventId: string,
  agendaItemId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, current_agenda_item_id")
    .eq("id", eventId)
    .single();

  if (!event) return { success: false, error: "Event not found" };

  // If there's a current item, mark it completed first
  if (event.current_agenda_item_id && event.current_agenda_item_id !== agendaItemId) {
    await supabase
      .from("agenda")
      .update({
        status: "completed",
        actual_end: new Date().toISOString(),
      })
      .eq("id", event.current_agenda_item_id);
  }

  // Set the specified item to in_progress
  await supabase
    .from("agenda")
    .update({
      status: "in_progress",
      actual_start: new Date().toISOString(),
    })
    .eq("id", agendaItemId);

  // Update event
  await supabase
    .from("events")
    .update({ current_agenda_item_id: agendaItemId })
    .eq("id", eventId);

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Skip Agenda Item ─────────────────────────────────────────────

export async function skipAgendaItem(
  eventId: string,
  agendaItemId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Mark as skipped
  await supabase
    .from("agenda")
    .update({ status: "skipped" })
    .eq("id", agendaItemId);

  // If this was the current item, advance to next
  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .single();

  if (event?.current_agenda_item_id === agendaItemId) {
    // Advance automatically
    return advanceAgenda(eventId) as unknown as Promise<ActionResult>;
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Update Agenda Item Duration ──────────────────────────────────
// Lets the organiser edit an agenda item's planned duration (minutes)
// at any time. The control panel seeds the live timer from this value.

export async function updateAgendaItemDuration(
  agendaItemId: string,
  durationMinutes: number
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Look up the event this item belongs to so we can gate on it.
  const { data: item, error: itemErr } = await supabase
    .from("agenda")
    .select("event_id")
    .eq("id", agendaItemId)
    .single();

  if (itemErr || !item) return { success: false, error: "Agenda item not found" };

  const access = await getYipEventAccess(item.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  // Validate: positive integer minutes, sane upper bound (10 hours).
  const minutes = Math.round(durationMinutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
    return { success: false, error: "Duration must be between 1 and 600 minutes" };
  }

  const { error } = await supabase
    .from("agenda")
    .update({ duration_minutes: minutes })
    .eq("id", agendaItemId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${item.event_id}/control`);
  return { success: true, data: null };
}

// ─── Update Agenda Item Sub-Timers ────────────────────────────────
// Per-item sub-phase timer presets (e.g. Question Hour: Question 60s /
// Answer 90s / Follow-up 30s), stored in agenda.config.sub_timers. The
// Control panel renders them as one-tap timer buttons for the current
// item. Pass null to clear the override back to the agenda_type defaults.

export async function updateAgendaItemSubTimers(
  eventId: string,
  agendaItemId: string,
  subTimers: SubTimer[] | null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Verify the agenda item belongs to this event (no cross-event IDOR) and
  // read its existing config so we merge instead of clobbering other keys.
  const { data: item, error: itemErr } = await supabase
    .from("agenda")
    .select("id, event_id, config")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .single();

  if (itemErr || !item) {
    return { success: false, error: "Agenda item not found for this event" };
  }

  // Validate + normalize the payload (untrusted client input).
  let cleaned: SubTimer[] | null = null;
  if (subTimers !== null) {
    if (
      !Array.isArray(subTimers) ||
      subTimers.length < 1 ||
      subTimers.length > SUB_TIMER_MAX_ENTRIES
    ) {
      return {
        success: false,
        error: `Provide between 1 and ${SUB_TIMER_MAX_ENTRIES} sub-timers`,
      };
    }
    cleaned = [];
    for (const t of subTimers) {
      const label = typeof t?.label === "string" ? t.label.trim() : "";
      const seconds =
        typeof t?.seconds === "number" ? Math.round(t.seconds) : NaN;
      if (!label || label.length > SUB_TIMER_LABEL_MAX) {
        return {
          success: false,
          error: `Each label must be 1–${SUB_TIMER_LABEL_MAX} characters`,
        };
      }
      if (
        !Number.isInteger(seconds) ||
        seconds < SUB_TIMER_MIN_SECONDS ||
        seconds > SUB_TIMER_MAX_SECONDS
      ) {
        return {
          success: false,
          error: `Each duration must be ${SUB_TIMER_MIN_SECONDS}–${SUB_TIMER_MAX_SECONDS} seconds`,
        };
      }
      cleaned.push({ label, seconds });
    }
  }

  // Merge into existing config — preserve any other keys living in the JSONB.
  const existing =
    item.config && typeof item.config === "object" && !Array.isArray(item.config)
      ? (item.config as Record<string, unknown>)
      : {};
  const nextConfig: Record<string, unknown> = { ...existing };
  if (cleaned === null) {
    delete nextConfig.sub_timers;
  } else {
    nextConfig.sub_timers = cleaned;
  }

  const { error } = await supabase
    .from("agenda")
    .update({ config: nextConfig as Json })
    .eq("id", agendaItemId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Update Event Status ──────────────────────────────────────────

export async function updateEventStatus(
  eventId: string,
  newStatus: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Validate transition
  const validTransitions: Record<string, string[]> = {
    draft: ["day1_live"],
    registration_open: ["registration_closed", "day1_live"],
    registration_closed: ["day1_live"],
    day1_live: ["day1_complete"],
    day1_complete: ["day2_live"],
    day2_live: ["completed"],
    completed: ["results_published"],
  };

  const { data: event } = await supabase
    .from("events")
    .select("status")
    .eq("id", eventId)
    .single();

  if (!event) return { success: false, error: "Event not found" };

  const allowed = validTransitions[event.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${event.status} to ${newStatus}`,
    };
  }

  // If going to day1_live, set the first Day 1 agenda item as current
  const updatePayload: Record<string, unknown> = { status: newStatus };

  if (newStatus === "day1_live" || newStatus === "day2_live") {
    const targetDay = newStatus === "day1_live" ? 1 : 2;
    const { data: firstItem } = await supabase
      .from("agenda")
      .select("id")
      .eq("event_id", eventId)
      .eq("day", targetDay)
      .order("sequence_order")
      .limit(1)
      .single();

    if (firstItem) {
      updatePayload.current_agenda_item_id = firstItem.id;
      // Mark that item as in_progress
      await supabase
        .from("agenda")
        .update({
          status: "in_progress",
          actual_start: new Date().toISOString(),
        })
        .eq("id", firstItem.id);
    }
  }

  if (newStatus === "day1_complete") {
    // Clear current agenda item and timer
    updatePayload.current_agenda_item_id = null;
    updatePayload.live_timer_end = null;
    updatePayload.live_timer_running = false;
  }

  const { error } = await supabase
    .from("events")
    .update(updatePayload)
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}
