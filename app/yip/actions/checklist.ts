"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ChecklistItem = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  category: string | null;
  sequence_order: number | null;
  is_completed: boolean;
  completed_at: string | null;
};

export async function getEventChecklist(eventId: string): Promise<ChecklistItem[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("checklist")
    .select("*")
    .eq("event_id", eventId)
    .order("category")
    .order("sequence_order");
  return (data ?? []).map((r) => ({
    ...r,
    is_completed: r.is_completed ?? false,
  })) as ChecklistItem[];
}

export async function toggleChecklistItem(
  itemId: string,
  eventId: string,
  done: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("checklist")
    .update({
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId)
    // Scope to THIS event — without it a manager of event A could flip a
    // checklist item belonging to event B by passing a foreign itemId (IDOR).
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}`);
  revalidatePath(`/yip/dashboard/events/${eventId}/checklist`);
  return { success: true, data: null };
}

export async function seedChecklistForEvent(
  eventId: string
): Promise<ActionResult<{ inserted: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  // Safety net: for events that existed before the auto-seed in createEvent.
  const supabase = await createServiceClient();

  const { count } = await supabase
    .from("checklist")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if ((count ?? 0) > 0) {
    return { success: false, error: "Checklist already seeded" };
  }

  const { data: defaults } = await supabase
    .from("checklist_template")
    .select("category, sequence_order, title, description")
    .order("category")
    .order("sequence_order");

  if (!defaults || defaults.length === 0) {
    return { success: false, error: "No template found" };
  }

  const rows = defaults.map((d) => ({
    event_id: eventId,
    title: d.title,
    description: d.description,
    category: d.category,
    sequence_order: d.sequence_order,
    is_completed: false,
  }));

  const { error } = await supabase.from("checklist").insert(rows);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/checklist`);
  return { success: true, data: { inserted: rows.length } };
}
