"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
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
  let q = supabase.from("organizers").select("*").eq("is_active", true).order("role").order("full_name");
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
    .from("organizers")
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
    .from("organizers")
    .update({ user_id: user.id, email: user.email })
    .eq("id", profileId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/dashboard");
  return { success: true, data: null };
}

export async function setEventZone(
  eventId: string,
  zone: YiZone | null,
  chapterEmId?: string | null
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: access.reason || "Forbidden: you cannot manage this event." };
  const supabase = await createServiceClient();
  const update: { zone: YiZone | null; chapter_em_id?: string | null } = { zone };
  if (chapterEmId !== undefined) update.chapter_em_id = chapterEmId;

  const { error } = await supabase.from("events").update(update).eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  revalidatePath("/yip/dashboard");
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
    .from("organizers")
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

/**
 * National Overview: one structured snapshot for the /yip/dashboard/zones page.
 * Two reads (events + their participants), everything else derived in memory.
 * "awaitingDates" is computed by detecting a placeholder day1_date — the single
 * date shared by an outsized cluster of events (how bulk-seeded chapter rounds
 * land before a real date is set) — so the scheduling insight stays honest.
 */
export async function getNationalOverview(): Promise<{
  totals: {
    zones: number;
    chapters: number;
    events: number;
    participants: number;
    schools: number;
    published: number;
    live: number;
    scheduled: number;
    awaitingDates: number;
    startedZones: number;
  };
  liveEvent: { id: string; name: string } | null;
  zones: Array<{
    code: YiZone;
    label: string;
    events: number;
    chapters: number;
    participants: number;
    published: number;
    sharePct: number;
    started: boolean;
  }>;
  upcoming: Array<{
    id: string;
    name: string;
    label: string;
    day1_date: string;
    rosterLoaded: boolean;
    juryAssigned: boolean;
    ready: boolean;
  }>;
  thisWeek: {
    newStudents: number;
    newEvents: number;
    daysToNext: number | null;
    nextName: string | null;
  };
  needsAttention: Array<{ id: string; title: string; detail: string; severity: "high" | "med" }>;
}> {
  const supabase = await createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const { data: eventsRaw } = await supabase
    .from("events")
    .select("id, name, zone, chapter_name, status, day1_date, results_published_at, created_at")
    .eq("is_mock", false);
  const events = eventsRaw ?? [];

  const eventIds = events.map((e) => e.id);
  const safeIds = eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: partsRaw }, { data: juryRaw }] = await Promise.all([
    supabase.from("participants").select("event_id, school_name, created_at").in("event_id", safeIds),
    supabase.from("jury_assignments").select("event_id").eq("is_active", true).in("event_id", safeIds),
  ]);
  const parts = partsRaw ?? [];

  const rosterCount = new Map<string, number>();
  for (const p of parts) rosterCount.set(p.event_id, (rosterCount.get(p.event_id) ?? 0) + 1);
  const juryCount = new Map<string, number>();
  for (const j of juryRaw ?? []) juryCount.set(j.event_id, (juryCount.get(j.event_id) ?? 0) + 1);

  // Detect a "dates TBD" placeholder: one day1_date shared by an outsized cluster.
  const dateCount = new Map<string, number>();
  for (const e of events) {
    if (e.day1_date) dateCount.set(e.day1_date, (dateCount.get(e.day1_date) ?? 0) + 1);
  }
  let tbdDate: string | null = null;
  let maxOnDate = 0;
  for (const [d, c] of dateCount) {
    if (c > maxOnDate) {
      maxOnDate = c;
      tbdDate = d;
    }
  }
  if (maxOnDate < 10) tbdDate = null; // only a real cluster counts as a placeholder

  const totalParticipants = parts.length;
  const schools = new Set(parts.map((p) => p.school_name).filter((s) => s && s !== "")).size;
  const isLive = (s: string | null) => s === "day1_live" || s === "day2_live";
  const evName = (e: { name: string | null }) => e.name ?? "Untitled event";
  const evDate = (d: string) => {
    const [, m, day] = d.split("-").map(Number);
    return `${MON[(m ?? 1) - 1]} ${day}`;
  };
  const nameList = (arr: typeof events, withDate: boolean) => {
    const shown = arr
      .slice(0, 3)
      .map((e) => (withDate && e.day1_date ? `${evName(e)} (${evDate(e.day1_date)})` : evName(e)));
    return shown.join(" · ") + (arr.length > 3 ? ` +${arr.length - 3} more` : "");
  };

  const zones = YI_ZONES.map((z) => {
    const zEvents = events.filter((e) => e.zone === z.code);
    const ids = new Set(zEvents.map((e) => e.id));
    const chapters = new Set(zEvents.map((e) => e.chapter_name).filter(Boolean));
    const zParts = parts.filter((p) => ids.has(p.event_id)).length;
    return {
      code: z.code,
      label: z.label,
      events: zEvents.length,
      chapters: chapters.size,
      participants: zParts,
      published: zEvents.filter((e) => e.results_published_at !== null).length,
      sharePct: totalParticipants ? Math.round((zParts / totalParticipants) * 100) : 0,
      started: zParts > 0,
    };
  }).sort((a, b) => b.events - a.events || b.participants - a.participants);

  const liveEv = events.find((e) => isLive(e.status));
  const scheduled = events.filter((e) => e.day1_date && e.day1_date !== tbdDate).length;
  const awaitingDates = events.length - scheduled;

  const upcomingDated = events
    .filter((e) => e.day1_date && e.day1_date >= today && e.day1_date !== tbdDate)
    .sort((a, b) => (a.day1_date as string).localeCompare(b.day1_date as string));

  const upcoming = upcomingDated.slice(0, 4).map((e) => {
    const rosterLoaded = (rosterCount.get(e.id) ?? 0) > 0;
    const juryAssigned = (juryCount.get(e.id) ?? 0) > 0;
    return {
      id: e.id,
      name: evName(e),
      label: YI_ZONES.find((z) => z.code === e.zone)?.label ?? "—",
      day1_date: e.day1_date as string,
      rosterLoaded,
      juryAssigned,
      ready: rosterLoaded && juryAssigned,
    };
  });

  // This week
  const newStudents = parts.filter((p) => p.created_at && p.created_at >= weekAgo).length;
  const newEvents = events.filter((e) => e.created_at && e.created_at >= weekAgo).length;
  const next = upcomingDated[0];
  const daysToNext = next?.day1_date
    ? Math.round((Date.parse(next.day1_date) - Date.parse(today)) / 86400000)
    : null;

  // Needs attention — only items with a non-zero count, highest urgency first.
  const needsAttention: Array<{ id: string; title: string; detail: string; severity: "high" | "med" }> = [];
  const pastUnpublished = events.filter(
    (e) => e.day1_date && e.day1_date < today && e.day1_date !== tbdDate && e.results_published_at === null
  );
  const noJury = upcomingDated.filter((e) => (juryCount.get(e.id) ?? 0) === 0);
  const noRoster = upcomingDated.filter((e) => (rosterCount.get(e.id) ?? 0) === 0);
  const notStartedZones = zones.filter((z) => !z.started);
  if (pastUnpublished.length)
    needsAttention.push({
      id: "past",
      title: `${pastUnpublished.length} ${pastUnpublished.length === 1 ? "event is" : "events are"} past their date with no results`,
      detail: nameList(pastUnpublished, false),
      severity: "high",
    });
  if (noJury.length)
    needsAttention.push({
      id: "jury",
      title: `${noJury.length} upcoming ${noJury.length === 1 ? "event has" : "events have"} no jury assigned`,
      detail: nameList(noJury, true),
      severity: "high",
    });
  if (noRoster.length)
    needsAttention.push({
      id: "roster",
      title: `${noRoster.length} upcoming ${noRoster.length === 1 ? "event has" : "events have"} no students loaded`,
      detail: nameList(noRoster, true),
      severity: "med",
    });
  if (notStartedZones.length)
    needsAttention.push({
      id: "zones",
      title: `${notStartedZones.length} ${notStartedZones.length === 1 ? "zone hasn't" : "zones haven't"} started enrolling`,
      detail: notStartedZones.map((z) => z.label).join(" · "),
      severity: "med",
    });
  if (awaitingDates)
    needsAttention.push({
      id: "dates",
      title: `${awaitingDates} events still need a confirmed date`,
      detail: "across all six zones",
      severity: "med",
    });

  return {
    totals: {
      zones: YI_ZONES.length,
      chapters: new Set(events.map((e) => e.chapter_name).filter(Boolean)).size,
      events: events.length,
      participants: totalParticipants,
      schools,
      published: events.filter((e) => e.results_published_at !== null).length,
      live: events.filter((e) => isLive(e.status)).length,
      scheduled,
      awaitingDates,
      startedZones: zones.filter((z) => z.started).length,
    },
    liveEvent: liveEv ? { id: liveEv.id, name: liveEv.name ?? "Live event" } : null,
    zones,
    upcoming,
    thisWeek: { newStudents, newEvents, daysToNext, nextName: next ? evName(next) : null },
    needsAttention,
  };
}
