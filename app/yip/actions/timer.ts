"use server";

import { createClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const timerEnd = new Date(Date.now() + durationSeconds * 1000).toISOString();

  const { error } = await supabase
    .from("events")
    .update({
      live_timer_end: timerEnd,
      live_timer_running: true,
      live_timer_label: label ?? null,
    })
    .eq("id", eventId)
    .eq("created_by", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Stop Timer ───────────────────────────────────────────────────
// Pauses the timer — keeps live_timer_end but sets running to false

export async function stopTimer(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("events")
    .update({ live_timer_running: false })
    .eq("id", eventId)
    .eq("created_by", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Reset Timer ──────────────────────────────────────────────────
// Clears the timer entirely

export async function resetTimer(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("events")
    .update({
      live_timer_end: null,
      live_timer_running: false,
      live_timer_label: null,
    })
    .eq("id", eventId)
    .eq("created_by", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}
