"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";

// Batch-3 reporting extras: #11 chief guests + #12 social links & reach.
// Both render on the event Overview and feed the post-session National report.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ChiefGuest = {
  id: string;
  name: string;
  designation: string | null;
  organization: string | null;
  display_order: number;
};

// ─── Chief guests (#11) ──────────────────────────────────────────────

export async function getChiefGuests(eventId: string): Promise<ChiefGuest[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("event_chief_guests")
    .select("id, name, designation, organization, display_order")
    .eq("event_id", eventId)
    .order("display_order")
    .order("created_at");

  if (error || !data) return [];
  return data;
}

export async function addChiefGuest(
  eventId: string,
  input: { name: string; designation?: string; organization?: string }
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const name = input.name?.trim();
  if (!name) return { success: false, error: "A guest name is required." };

  const supabase = await createServiceClient();

  // Append at the end of the current order.
  const { data: last } = await supabase
    .from("event_chief_guests")
    .select("display_order")
    .eq("event_id", eventId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.display_order ?? -1) + 1;

  const { error } = await supabase.from("event_chief_guests").insert({
    event_id: eventId,
    name,
    designation: input.designation?.trim() || null,
    organization: input.organization?.trim() || null,
    display_order: nextOrder,
  });
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "create",
    target_table: "event_chief_guests",
    target_event_id: eventId,
  });

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, data: null };
}

export async function deleteChiefGuest(
  eventId: string,
  guestId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  // Scope the delete to the event so a guest id from another event can't be hit.
  const { error } = await supabase
    .from("event_chief_guests")
    .delete()
    .eq("id", guestId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "delete",
    target_table: "event_chief_guests",
    target_id: guestId,
    target_event_id: eventId,
  });

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, data: null };
}

// ─── Social links + reach (#12) ──────────────────────────────────────

export async function updateEventSocial(
  eventId: string,
  input: { social_links: string[]; social_reach_count: number | null }
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  // Keep only non-empty, trimmed links (the form sends one textarea line each).
  const links = (input.social_links ?? [])
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const reach =
    input.social_reach_count == null || Number.isNaN(input.social_reach_count)
      ? null
      : Math.max(0, Math.floor(input.social_reach_count));

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ social_links: links, social_reach_count: reach })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  await logAuditAction({
    action_type: "update",
    target_table: "events",
    target_id: eventId,
    target_event_id: eventId,
  });

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, data: null };
}
