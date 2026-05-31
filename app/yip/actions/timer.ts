"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

// Live-session timer control. Gated on canManage (organiser + chair + national
// + regional may run the live event). Writes via the service client AFTER the
// capability check — yip.events is RLS read-only for `authenticated`, and the
// old `.eq("created_by", user.id)` gate silently no-op'd for any non-creator
// (returned 0-row success), locking out chairs/organisers who didn't create
// the event. (2026-05-30 chapter-roles migration.)
type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Start Timer ──────────────────────────────────────────────────
// Sets live_timer_end = now() + duration, live_timer_running = true

export async function startTimer(
  eventId: string,
  durationSeconds: number,
  label?: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const timerEnd = new Date(Date.now() + durationSeconds * 1000).toISOString();

  const { error } = await supabase
    .from("events")
    .update({
      live_timer_end: timerEnd,
      live_timer_running: true,
      live_timer_label: label ?? null,
    })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Stop Timer ───────────────────────────────────────────────────
// Pauses the timer — keeps live_timer_end but sets running to false

export async function stopTimer(
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ live_timer_running: false })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Reset Timer ──────────────────────────────────────────────────
// Clears the timer entirely

export async function resetTimer(
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({
      live_timer_end: null,
      live_timer_running: false,
      live_timer_label: null,
    })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}
