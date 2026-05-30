"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import type { VolunteerStation } from "@/lib/yip/volunteers";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type Volunteer = {
  id: string;
  event_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  station: VolunteerStation;
  shift: string | null;
  tshirt_size: string | null;
  is_yuva: boolean;
  arrived: boolean;
  arrived_at: string | null;
  notes: string | null;
};

export async function listVolunteers(eventId: string): Promise<Volunteer[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("volunteers")
    .select("*")
    .eq("event_id", eventId)
    .order("station")
    .order("full_name");
  return (data ?? []).map((v) => ({
    ...v,
    is_yuva: v.is_yuva ?? true,
    arrived: v.arrived ?? false,
  })) as Volunteer[];
}

export async function addVolunteer(input: {
  event_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  station?: VolunteerStation;
  shift?: string | null;
  tshirt_size?: string | null;
  is_yuva?: boolean;
}): Promise<ActionResult<Volunteer>> {
  if (!input.full_name.trim()) return { success: false, error: "Name required" };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("volunteers")
    .insert({
      event_id: input.event_id,
      full_name: input.full_name.trim(),
      phone: input.phone ?? null,
      email: input.email ?? null,
      station: input.station ?? "floating",
      shift: input.shift ?? null,
      tshirt_size: input.tshirt_size ?? null,
      is_yuva: input.is_yuva ?? true,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${input.event_id}/volunteers`);
  return { success: true, data: data as Volunteer };
}

export async function updateVolunteer(
  id: string,
  eventId: string,
  updates: Partial<Omit<Volunteer, "id" | "event_id">>
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("volunteers").update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: null };
}

export async function markVolunteerArrived(
  id: string,
  eventId: string,
  arrived: boolean
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("volunteers")
    .update({
      arrived,
      arrived_at: arrived ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: null };
}

export async function deleteVolunteer(
  id: string,
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can delete volunteers" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase.from("volunteers").delete().eq("id", id).eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "volunteers",
    target_id: id,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: null };
}
