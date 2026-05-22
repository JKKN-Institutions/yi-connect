"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
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
    .from("organizer_checklist")
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
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("organizer_checklist")
    .update({
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}/checklist`);
  return { success: true, data: null };
}

export async function seedChecklistForEvent(
  eventId: string
): Promise<ActionResult<{ inserted: number }>> {
  // Safety net: for events that existed before the auto-seed in createEvent.
  const supabase = await createServiceClient();

  const { count } = await supabase
    .from("organizer_checklist")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if ((count ?? 0) > 0) {
    return { success: false, error: "Checklist already seeded" };
  }

  const { data: defaults } = await supabase
    .from("default_checklist_items")
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

  const { error } = await supabase.from("organizer_checklist").insert(rows);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/events/${eventId}/checklist`);
  return { success: true, data: { inserted: rows.length } };
}
