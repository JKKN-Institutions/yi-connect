"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import { modeForAgendaType } from "@/lib/yip/constants";
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

// ─── Re-open a Completed Agenda Item (BUG-409) ────────────────────
// Undo an accidental "complete": revert a COMPLETED item back to `upcoming`
// (resumable) WITHOUT touching any scores already entered for it. Blocked once
// scoring is locked or results are published (re-opening a finalised result
// would corrupt the standings). CHAIR / NATIONAL ONLY — same elevated privilege
// as moving the agenda backward.
export async function reopenAgendaItem(
  eventId: string,
  agendaItemId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (access.role !== "super_admin" && access.role !== "chapter_admin") {
    return {
      success: false,
      error: "Only the chapter chair or a national admin can re-open a session.",
    };
  }
  const supabase = await createServiceClient();

  // Guardrails — never re-open once results are out or scores are frozen.
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, scores_locked, results_published_at")
    .eq("id", eventId)
    .single();
  if (eventErr || !event) return { success: false, error: "Event not found" };
  if (event.results_published_at) {
    return {
      success: false,
      error: "Results are published — re-opening a session is disabled.",
    };
  }
  if (event.scores_locked) {
    return {
      success: false,
      error: "Scores are locked. Unlock scores before re-opening a session.",
    };
  }

  // Target must be a COMPLETED item belonging to THIS event.
  const { data: item, error: itemErr } = await supabase
    .from("agenda")
    .select("id, status")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (itemErr || !item) {
    return { success: false, error: "Agenda item not found for this event." };
  }
  if (item.status !== "completed") {
    return { success: false, error: "Only a completed session can be re-opened." };
  }

  // Revert to upcoming (resumable). Scores are intentionally NOT touched —
  // they persist and become editable again when the session next goes live
  // (subject to the scores-lock guard above).
  const { error: updErr } = await supabase
    .from("agenda")
    .update({ status: "upcoming", actual_end: null })
    .eq("id", agendaItemId)
    .eq("event_id", eventId);
  if (updErr) return { success: false, error: updErr.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
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

  // Walk backward past excluded (skipped) items — they must never become the
  // live item (mirror advanceAgenda's forward skip). Completed items stay valid
  // rewind targets, so only `skipped` is jumped over.
  let prevIdx = currentIdx - 1;
  while (prevIdx >= 0 && dayItems[prevIdx].status === "skipped") {
    prevIdx--;
  }
  if (prevIdx < 0) {
    return { success: false, error: "Already at the first item." };
  }

  const currentItem = dayItems[currentIdx];
  const previousItem = dayItems[prevIdx];

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

  // Mark as skipped, tagged as an on-the-day skip (vs a pre-event exclusion set
  // on the Agenda screen) so the post-event report can tell them apart.
  await supabase
    .from("agenda")
    .update({ status: "skipped", skip_reason: "skipped_live" })
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

// ─── Agenda Setup (pre-event) ─────────────────────────────────────
// Per-event control over which agenda items run live on the day, their order,
// timing, and details — set BEFORE the event so the Control panel + projector
// show the correct day-of agenda. "Won't run live" is stored as status
// `skipped`: advanceAgenda already jumps over skipped items, and
// goToPreviousAgendaItem does too (see above), so an excluded item can never
// become the live/current item. Re-including = status back to `upcoming`.

/** All agenda rows for an event, ordered (day, sequence). Read-gated by canView. */
export async function getAgendaForSetup(eventId: string) {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("agenda")
    .select("*")
    .eq("event_id", eventId)
    .order("day")
    .order("sequence_order");
  return data ?? [];
}

/** Recorded-score count per agenda_item_id (so the Agenda screen can warn before
 * excluding a session that already has marks). Read-gated by canView. */
export async function getAgendaScoreCounts(
  eventId: string
): Promise<Record<string, number>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return {};
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("scores")
    .select("agenda_item_id")
    .eq("event_id", eventId);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = (r as { agenda_item_id: string | null }).agenda_item_id;
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

/**
 * Include / exclude an agenda item from the live run (pre-event).
 * includeInRun=false → status 'skipped' (jumped over on the day); true →
 * 'upcoming'. Refuses to touch the item that is live right now, or one already
 * completed — those belong to the Control panel's Skip / Re-open.
 */
export async function setAgendaItemInRun(
  eventId: string,
  agendaItemId: string,
  includeInRun: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const { data: item } = await supabase
    .from("agenda")
    .select("id, status")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!item)
    return { success: false, error: "Agenda item not found for this event." };

  if (item.status === "in_progress") {
    return {
      success: false,
      error:
        "This item is live right now. Use Skip on the Control panel to move past it.",
    };
  }
  if (item.status === "completed") {
    return {
      success: false,
      error:
        "This item is already completed. Use Re-open on the Control panel to run it again.",
    };
  }

  const { error } = await supabase
    .from("agenda")
    .update({
      status: includeInRun ? "upcoming" : "skipped",
      // Tag WHY it's not running so reports can tell a planned exclusion apart
      // from an on-the-day Skip (set in skipAgendaItem). Re-including clears it.
      skip_reason: includeInRun ? null : "excluded_preevent",
    })
    .eq("id", agendaItemId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/**
 * Persist a new order for one day's agenda. `orderedItemIds` must list exactly
 * that day's items in the desired order; sequence_order is reassigned 1..N.
 * There is a UNIQUE (event_id, day, sequence_order) index, so we write in two
 * phases (park at high offsets, then final positions) to avoid collisions.
 */
export async function reorderAgenda(
  eventId: string,
  day: number,
  orderedItemIds: string[]
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // The id set must match the day's items exactly (no extras, no missing, no
  // duplicates) — otherwise a partial reorder could orphan sequence numbers.
  const { data: items } = await supabase
    .from("agenda")
    .select("id, status, sequence_order")
    .eq("event_id", eventId)
    .eq("day", day);
  const dayRows = items ?? [];
  const existing = new Set(dayRows.map((i) => i.id));
  if (
    orderedItemIds.length !== existing.size ||
    new Set(orderedItemIds).size !== orderedItemIds.length ||
    orderedItemIds.some((id) => !existing.has(id))
  ) {
    return {
      success: false,
      error:
        "The reorder list must contain each of the day's items exactly once.",
    };
  }

  // Live-state guard: reordering mid-run is a strong action (chair / national).
  const { data: ev } = await supabase
    .from("events")
    .select("status")
    .eq("id", eventId)
    .single();
  const isLive = ev?.status === "day1_live" || ev?.status === "day2_live";
  if (isLive) {
    if (access.role !== "super_admin" && access.role !== "chapter_admin") {
      return {
        success: false,
        error:
          "The event is live. Only the chapter chair or a national admin can reorder the agenda now.",
      };
    }
    // Future-items-only: an item already running or finished must keep its exact
    // position while live — you may only shuffle items that haven't started yet
    // (upcoming/excluded). Moving a done/live item, or pushing an item ahead of
    // it, would jumble the live running order.
    const oldOrder = [...dayRows].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
    const newIndex = new Map(orderedItemIds.map((id, idx) => [id, idx]));
    for (let i = 0; i < oldOrder.length; i++) {
      const row = oldOrder[i];
      if (
        (row.status === "completed" || row.status === "in_progress") &&
        newIndex.get(row.id) !== i
      ) {
        return {
          success: false,
          error:
            "The event is live — you can only reorder items that haven't started yet.",
        };
      }
    }
  }

  // Phase 1: park every row at a non-colliding high offset.
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await supabase
      .from("agenda")
      .update({ sequence_order: 1000 + i })
      .eq("id", orderedItemIds[i])
      .eq("event_id", eventId);
    if (error) return { success: false, error: error.message };
  }
  // Phase 2: write the final 1..N order.
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await supabase
      .from("agenda")
      .update({ sequence_order: i + 1 })
      .eq("id", orderedItemIds[i])
      .eq("event_id", eventId);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Edit an agenda item's display details (title / description / duration / type). */
export async function updateAgendaItem(
  eventId: string,
  agendaItemId: string,
  patch: {
    title?: string;
    description?: string | null;
    duration_minutes?: number;
    agenda_type?: string;
  }
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { success: false, error: "Title can't be empty." };
    update.title = t;
  }
  if (patch.description !== undefined)
    update.description = patch.description?.trim() || null;
  if (patch.duration_minutes !== undefined) {
    const d = Math.round(patch.duration_minutes);
    if (!Number.isFinite(d) || d < 0 || d > 600)
      return {
        success: false,
        error: "Duration must be between 0 and 600 minutes.",
      };
    update.duration_minutes = d;
  }
  if (patch.agenda_type !== undefined && patch.agenda_type.trim()) {
    const at = patch.agenda_type.trim();
    update.agenda_type = at;
    update.mode = modeForAgendaType(at);
  }
  if (Object.keys(update).length === 0)
    return { success: false, error: "Nothing to update." };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("agenda")
    .update(update)
    .eq("id", agendaItemId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Add a custom agenda item to a day (appended; reorder afterwards). */
export async function addAgendaItem(
  eventId: string,
  input: {
    day: number;
    title: string;
    description?: string;
    duration_minutes?: number;
    agenda_type?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };

  const title = input.title?.trim();
  if (!title) return { success: false, error: "Title is required." };
  if (![0, 1, 2].includes(input.day))
    return { success: false, error: "Day must be 0, 1 or 2." };
  const duration =
    input.duration_minutes !== undefined
      ? Math.round(input.duration_minutes)
      : 15;
  if (!Number.isFinite(duration) || duration < 0 || duration > 600)
    return {
      success: false,
      error: "Duration must be between 0 and 600 minutes.",
    };
  const agendaType = input.agenda_type?.trim() || "general";

  const supabase = await createServiceClient();
  // Append after the day's current max sequence (the unique index makes any
  // lower number risky; max+1 never collides).
  const { data: maxRow } = await supabase
    .from("agenda")
    .select("sequence_order")
    .eq("event_id", eventId)
    .eq("day", input.day)
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (maxRow?.sequence_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("agenda")
    .insert({
      event_id: eventId,
      day: input.day,
      sequence_order: nextSeq,
      title,
      description: input.description?.trim() || null,
      duration_minutes: duration,
      agenda_type: agendaType,
      mode: modeForAgendaType(agendaType),
      status: "upcoming",
      is_scoreable: false,
    })
    .select("id")
    .single();
  if (error || !data)
    return { success: false, error: error?.message ?? "Failed to add item." };

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { id: data.id } };
}

/**
 * Delete an agenda item. Chair / national only. Blocked when the item is live
 * or has dependent data (scores, a vote session, jury session assignments) —
 * the caller should exclude it from the run instead.
 */
export async function deleteAgendaItem(
  eventId: string,
  agendaItemId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (access.role !== "super_admin" && access.role !== "chapter_admin")
    return {
      success: false,
      error: "Only the chapter chair or a national admin can delete an agenda item.",
    };
  const supabase = await createServiceClient();

  const { data: item } = await supabase
    .from("agenda")
    .select("id")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!item)
    return { success: false, error: "Agenda item not found for this event." };

  // Never delete the live item.
  const { data: ev } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .single();
  if (ev?.current_agenda_item_id === agendaItemId)
    return {
      success: false,
      error:
        "This item is live. Move the agenda on first, or exclude it from the run instead.",
    };

  // Dependency guards — refuse if anything references this item.
  const [scoresRes, votesRes, jsaRes] = await Promise.all([
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("agenda_item_id", agendaItemId),
    supabase
      .from("vote_sessions")
      .select("id", { count: "exact", head: true })
      .eq("agenda_item_id", agendaItemId),
    supabase
      .from("jury_session_assignments")
      .select("id", { count: "exact", head: true })
      .eq("agenda_item_id", agendaItemId),
  ]);
  if ((scoresRes.count ?? 0) > 0)
    return {
      success: false,
      error: `Can't delete — ${scoresRes.count} score(s) recorded for it. Exclude it from the run instead.`,
    };
  if ((votesRes.count ?? 0) > 0)
    return {
      success: false,
      error:
        "Can't delete — a vote session is linked to it. Exclude it from the run instead.",
    };
  if ((jsaRes.count ?? 0) > 0)
    return {
      success: false,
      error:
        "Can't delete — jurors are assigned to it. Remove the assignments first, or exclude it from the run.",
    };

  const { error } = await supabase
    .from("agenda")
    .delete()
    .eq("id", agendaItemId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/**
 * Move an agenda item to the other day (Day 1 ↔ Day 2). Appends to the end of
 * the target day (max+1 — never collides with the unique
 * (event_id,day,sequence_order) index); reorder afterwards to position it.
 * While the event is live, only future (not-yet-started) items may move, and
 * never the live item itself — mirrors the reorder "future items only" rule.
 */
export async function moveAgendaItemToDay(
  eventId: string,
  agendaItemId: string,
  targetDay: number
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };
  // Days 0 (prep), 1, 2 — matches the agenda.day CHECK.
  if (![0, 1, 2].includes(targetDay))
    return { success: false, error: "Day must be 0, 1 or 2." };
  const supabase = await createServiceClient();

  const { data: item } = await supabase
    .from("agenda")
    .select("id, day, status")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!item)
    return { success: false, error: "Agenda item not found for this event." };
  if (item.day === targetDay)
    return { success: false, error: `Item is already on Day ${targetDay}.` };

  const { data: ev } = await supabase
    .from("events")
    .select("status, current_agenda_item_id")
    .eq("id", eventId)
    .single();
  if (ev?.current_agenda_item_id === agendaItemId)
    return {
      success: false,
      error: "This item is live. Move the agenda on first.",
    };
  const isLive = ev?.status === "day1_live" || ev?.status === "day2_live";
  if (isLive && (item.status === "completed" || item.status === "in_progress"))
    return {
      success: false,
      error:
        "The event is live — you can only move items that haven't started yet.",
    };

  // Append to the end of the target day.
  const { data: maxRow } = await supabase
    .from("agenda")
    .select("sequence_order")
    .eq("event_id", eventId)
    .eq("day", targetDay)
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (maxRow?.sequence_order ?? 0) + 1;

  const { error } = await supabase
    .from("agenda")
    .update({ day: targetDay, sequence_order: nextSeq })
    .eq("id", agendaItemId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}
