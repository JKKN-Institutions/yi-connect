"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { YI_ZONES, type YiZone, type YiRole } from "@/lib/yip/hierarchy";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type OrganizerProfile = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  role: YiRole;
  zone: YiZone | null;
  chapter_name: string | null;
  title: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export async function listOrganizerProfiles(filters?: {
  role?: YiRole;
  zone?: YiZone;
}): Promise<OrganizerProfile[]> {
  const supabase = await createServiceClient();
  let q = supabase.from("organizer_profiles").select("*").eq("is_active", true).order("role").order("full_name");
  if (filters?.role) q = q.eq("role", filters.role);
  if (filters?.zone) q = q.eq("zone", filters.zone);

  const { data } = await q;
  return (data ?? []) as OrganizerProfile[];
}

export async function getMyProfile(): Promise<OrganizerProfile | null> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organizer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as OrganizerProfile) ?? null;
}

export async function linkCurrentUserToProfile(
  profileId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const { error } = await supabase
    .from("organizer_profiles")
    .update({ user_id: user.id, email: user.email })
    .eq("id", profileId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard");
  return { success: true, data: null };
}

export async function setEventZone(
  eventId: string,
  zone: YiZone | null,
  chapterEmId?: string | null
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const update: { zone: YiZone | null; chapter_em_id?: string | null } = { zone };
  if (chapterEmId !== undefined) update.chapter_em_id = chapterEmId;

  const { error } = await supabase.from("events").update(update).eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard");
  return { success: true, data: null };
}

/**
 * Summary stats per zone for the national dashboard.
 */
export async function getZoneSummary(): Promise<
  Array<{
    zone: YiZone;
    label: string;
    rm_name: string | null;
    events_count: number;
    chapters_count: number;
    participants_count: number;
    results_published_count: number;
  }>
> {
  const supabase = await createServiceClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, zone, chapter_name, level, results_published_at");
  const { data: participants } = await supabase
    .from("participants")
    .select("event_id");
  const { data: rms } = await supabase
    .from("organizer_profiles")
    .select("zone, full_name")
    .eq("role", "rm")
    .eq("is_active", true);

  const eventList = events ?? [];
  const participantList = participants ?? [];
  const rmByZone = new Map<string, string>();
  for (const r of rms ?? []) {
    if (r.zone) rmByZone.set(r.zone, r.full_name);
  }

  return YI_ZONES.map((z) => {
    const zEvents = eventList.filter((e) => e.zone === z.code);
    const eventIds = new Set(zEvents.map((e) => e.id));
    const chapters = new Set(zEvents.map((e) => e.chapter_name).filter(Boolean));
    const zParticipants = participantList.filter((p) => eventIds.has(p.event_id));
    const published = zEvents.filter((e) => e.results_published_at !== null);

    return {
      zone: z.code,
      label: z.label,
      rm_name: rmByZone.get(z.code) ?? null,
      events_count: zEvents.length,
      chapters_count: chapters.size,
      participants_count: zParticipants.length,
      results_published_count: published.length,
    };
  });
}
