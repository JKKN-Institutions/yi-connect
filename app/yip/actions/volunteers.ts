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
  access_code: string | null;
};

export async function listVolunteers(eventId: string): Promise<Volunteer[]> {
  // Event-scope this read: volunteer rows carry access_code (a credential),
  // so a logged-in organizer must not be able to call this raw server action
  // for an event they don't manage. Matches addVolunteer's gate.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return [];
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
  const access = await getYipEventAccess(input.event_id);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

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
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

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
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

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

// Kiosk access codes — volunteers carry these to /yip/join and become roving
// vote kiosks on event day. Ambiguous glyphs (0/O/1/I) excluded so codes are
// easy to read off a phone screen / printed sheet.
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return code;
}

export async function generateVolunteerCode(
  eventId: string,
  volunteerId: string
): Promise<ActionResult<{ code: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Retry on the per-event unique-index collision (Postgres 23505) — a fresh
  // random code is generated each attempt rather than failing the request.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    const { error } = await supabase
      .from("volunteers")
      .update({ access_code: code })
      .eq("id", volunteerId)
      .eq("event_id", eventId);

    if (!error) {
      revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
      return { success: true, data: { code } };
    }
    if (error.code !== "23505") return { success: false, error: error.message };
  }

  return { success: false, error: "Could not generate a unique code, please retry" };
}

export async function generateAllVolunteerCodes(
  eventId: string
): Promise<ActionResult<{ generated: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();

  // Only fill volunteers with NO code yet — existing codes are left untouched
  // so a re-run never invalidates kiosks already signed in on event day.
  const { data: pending, error: fetchError } = await supabase
    .from("volunteers")
    .select("id")
    .eq("event_id", eventId)
    .is("access_code", null);

  if (fetchError) return { success: false, error: fetchError.message };

  let generated = 0;
  for (const v of pending ?? []) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = randomCode();
      const { error } = await supabase
        .from("volunteers")
        .update({ access_code: code })
        .eq("id", v.id)
        .eq("event_id", eventId);

      if (!error) {
        generated++;
        break;
      }
      if (error.code !== "23505") return { success: false, error: error.message };
    }
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/volunteers`);
  return { success: true, data: { generated } };
}

export async function revokeVolunteerCode(
  eventId: string,
  volunteerId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };

  const supabase = await createServiceClient();
  // Clearing access_code immediately revokes the kiosk login (auth.ts matches
  // on access_code, so a null code can never sign in).
  const { error } = await supabase
    .from("volunteers")
    .update({ access_code: null })
    .eq("id", volunteerId)
    .eq("event_id", eventId);

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
