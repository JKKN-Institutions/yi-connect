"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { DEFAULT_AGENDA_TEMPLATE } from "@/lib/yip/constants";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getRegionalAdminZones } from "@/lib/yi/auth/yi-directory-roles";
import { revalidatePath } from "next/cache";
import { attachCentralTopicsToEvent } from "./admin-topics";
import { getComplianceScore } from "./branding";
import type { Database } from "@/types/yip/database";

// ─── Types ─────────────────────────────────────────────────────────

interface CreateEventData {
  name: string;
  level: "chapter" | "regional" | "national";
  chapter_name: string;
  city: string;
  state: string;
  day1_date: string;
  day2_date: string;
  venue_name: string;
  venue_address: string;
  central_agenda: string;
  committee_topics: Record<string, string>;
  // Optional: when provided, server derives yi_zone_code + zone from
  // yi.chapters.region so the 3-tier regional-admin gate works correctly.
  // The DB trigger in 20260528160000_yip_events_autoderive_zone_and_topics
  // is the defense-in-depth backstop for any caller that omits this.
  yi_chapter_id?: string;
}

interface UpdateEventData {
  name?: string;
  level?: "chapter" | "regional" | "national";
  chapter_name?: string;
  city?: string;
  state?: string;
  day1_date?: string;
  day2_date?: string;
  venue_name?: string;
  venue_address?: string;
  central_agenda?: string;
  committee_topics?: Record<string, string>;
  status?: "draft" | "registration_open" | "registration_closed" | "day1_live" | "day1_complete" | "day2_live" | "completed" | "results_published";
  // When provided, yi.chapters becomes the source of truth: the link is set
  // and chapter_name/city/state/yi_zone_code/zone are re-derived from it,
  // overriding any free text in this same payload (mirrors createEvent).
  yi_chapter_id?: string;
}

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Committee topic catalog (the 15 official YIP 2026 committees) ───
// The single all-chapters catalog, stored in yip.topics (category =
// 'committee'). title = committee/ministry name, description = the debate/bill
// topic, linked_scheme = the linked scheme/policy. Replaces the old
// COMMITTEE_TOPICS code constant — the create-event picker and bill drafting
// read from here so admins manage the list from /yip/dashboard/admin/topics.

export type CommitteeTopicOption = {
  id: string;
  committee: string;
  topic: string;
  scheme: string;
  topic_number: number | null;
};

export async function listCommitteeTopics(): Promise<CommitteeTopicOption[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, description, linked_scheme, topic_number")
    .eq("category", "committee")
    .eq("is_active", true)
    .order("topic_number", { nullsFirst: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    committee: r.title,
    topic: r.description ?? "",
    scheme: r.linked_scheme ?? "",
    topic_number: r.topic_number,
  }));
}

/**
 * Push the full committee-topic catalogue (the official 15) onto EVERY real
 * chapter-level event, overwriting each event's committee_topics with the
 * { committee → topic } map. Lets a super-admin re-sync all chapters from the
 * admin Topics page after editing the catalogue. Each chapter can then trim to
 * its 8–10. Mock events are left untouched.
 */
/**
 * Push the committee catalogue onto chapter events, overwriting their
 * committee_topics. With no argument it targets EVERY real chapter event
 * ("push to all"); pass a list of event IDs to push to only those ("push to
 * selected"). Selected events are scoped further to level=chapter + non-mock so
 * a stray ID can never hit a regional/national/mock event. Super-admin only.
 */
export async function pushCommitteeTopicsToAllChapterEvents(
  eventIds?: string[]
): Promise<ActionResult<{ events_updated: number; committees: number }>> {
  if (!(await isCurrentUserSuperAdmin())) {
    return {
      success: false,
      error: "Only super-admins can push committee topics to events.",
    };
  }
  const catalog = await listCommitteeTopics();
  if (catalog.length === 0) {
    return { success: false, error: "No committee topics in the catalogue to push." };
  }
  const obj = Object.fromEntries(catalog.map((c) => [c.committee, c.topic]));

  const supabase = await createServiceClient();
  let q = supabase
    .from("events")
    .update({ committee_topics: obj, updated_at: new Date().toISOString() })
    .eq("level", "chapter")
    .eq("is_mock", false);
  // Selective push: scope to the chosen events (still bounded to real chapter
  // events above, so an out-of-scope ID is simply ignored).
  if (eventIds && eventIds.length > 0) q = q.in("id", eventIds);

  const { data, error } = await q.select("id");

  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/dashboard/admin/topics");
  return {
    success: true,
    data: { events_updated: data?.length ?? 0, committees: catalog.length },
  };
}

/**
 * Real chapter events (level=chapter, non-mock) for the admin "push to selected
 * events" picker. Returns lightweight rows incl. status so the picker can flag
 * already-started events. Super-admin only (returns [] otherwise) — matches the
 * push actions' gate.
 */
export async function listChapterEventsForPush(): Promise<
  {
    id: string;
    name: string | null;
    status: string | null;
    chapter_name: string | null;
    day1_date: string | null;
    pii_purged_at: string | null;
  }[]
> {
  if (!(await isCurrentUserSuperAdmin())) return [];
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, status, chapter_name, day1_date, pii_purged_at")
    .eq("level", "chapter")
    .eq("is_mock", false)
    .order("day1_date", { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return data;
}

/**
 * Per-event committee selection. Each chapter chooses WHICH of the official 15
 * committees (and how many) it will run; this writes the event's
 * committee_topics = { committee → topic } from the chosen names, resolving each
 * topic from the live catalogue. Drives allocation's committee assignment.
 * Organiser-or-above on the event (server re-checks via getYipEventAccess).
 */
export async function setEventCommittees(
  eventId: string,
  committeeNames: string[]
): Promise<ActionResult<{ count: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!Array.isArray(committeeNames) || committeeNames.length === 0) {
    return { success: false, error: "Pick at least one committee for this chapter." };
  }

  // Resolve each chosen committee to its topic from the live catalogue, so the
  // event always carries an authoritative { committee → topic } map (ignores
  // any name not in the catalogue rather than persisting a stale committee).
  const catalog = await listCommitteeTopics();
  const topicByCommittee = new Map(catalog.map((c) => [c.committee, c.topic]));
  const obj: Record<string, string> = {};
  for (const name of committeeNames) {
    if (topicByCommittee.has(name)) obj[name] = topicByCommittee.get(name) ?? "";
  }
  if (Object.keys(obj).length === 0) {
    return {
      success: false,
      error: "None of the selected committees are in the catalogue.",
    };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ committee_topics: obj, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/topics`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  return { success: true, data: { count: Object.keys(obj).length } };
}

// ─── Setup progress (sidebar checklist) ────────────────────────────

/**
 * Per-event setup completion for the "Before the Event" sidebar checklist.
 * Returns a { tabHref → done } map covering every Before-the-Event setup tab
 * with an objective "done" signal. Tabs absent from the map show no indicator
 * (Fees is intentionally omitted — its amount always defaults, so there is no
 * meaningful setup-done state, and many chapter events are free).
 * Fail-safe: any DB error returns {} (no indicators) rather than breaking the
 * event layout that renders on every event page. Cheap: parallel count queries.
 */
export async function getEventSetupProgress(
  eventId: string
): Promise<Record<string, boolean>> {
  try {
    const supabase = await createServiceClient();
    const [pAll, pAllotted, parties, jury, volunteers, checklistRows, branding, ev] =
      await Promise.all([
        supabase
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId),
        supabase
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .not("party_id", "is", null),
        supabase
          .from("parties")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId),
        supabase
          .from("jury_assignments")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId),
        supabase
          .from("volunteers")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId),
        supabase
          .from("checklist")
          .select("is_completed")
          .eq("event_id", eventId),
        // Reuse the canonical compliance scorer rather than re-deriving the
        // verified/waived math here (keeps the tick in lockstep with the page).
        // It reads yi.brand_rules cross-schema, so isolate its failure with a
        // local catch — a branding hiccup must not wipe the whole checklist.
        getComplianceScore(eventId).catch(() => null),
        supabase
          .from("events")
          .select("committee_topics, chapter_name")
          .eq("id", eventId)
          .single(),
      ]);

    const total = pAll.count ?? 0;
    const allotted = pAllotted.count ?? 0;
    const ct = ev.data?.committee_topics as
      | Record<string, unknown>
      | unknown[]
      | null;
    const committeesPicked = Array.isArray(ct)
      ? ct.length > 0
      : !!ct && typeof ct === "object" && Object.keys(ct).length > 0;

    // Checklist "done" = at least one item AND every item ticked off.
    const clItems = checklistRows.data ?? [];
    const checklistDone =
      clItems.length > 0 && clItems.every((r) => r.is_completed === true);

    // Team "done" = ≥1 chapter organiser/chair assigned for this event's
    // chapter. Mirrors listChapterRoles' source so the tick matches the Team
    // page. Chapter-scoped (role_assignments is keyed by chapter, not event),
    // so it needs the event's chapter_name first.
    let teamDone = false;
    const chapterName = (ev.data?.chapter_name as string | null) ?? null;
    if (chapterName) {
      const { count: teamCount } = await supabase
        .schema("yi_directory")
        .from("role_assignments")
        .select("id", { count: "exact", head: true })
        .eq("app", "yip")
        .eq("yi_chapter", chapterName)
        .in("role", ["chapter_admin", "chapter_organizer"])
        .eq("is_active", true);
      teamDone = (teamCount ?? 0) > 0;
    }

    return {
      "/team": teamDone,
      // Checklist tab — green only when every seeded checklist item is done.
      "/checklist": checklistDone,
      // Branding compliance is fully verified/waived (100%). total_rules is
      // never 0 (a fallback rule set exists), so a fresh event reads as not-done.
      "/branding": !!branding && branding.total_rules > 0 && branding.score_pct === 100,
      "/participants": total > 0,
      "/topics": committeesPicked, // the Committees picker tab
      "/parties": (parties.count ?? 0) > 0,
      // Allocation "done" = every student is allotted into a party (one-step
      // flow assigns party_id + committee + constituency together).
      "/allocation": total > 0 && allotted === total,
      "/jury": (jury.count ?? 0) > 0,
      "/volunteers": (volunteers.count ?? 0) > 0,
    };
  } catch {
    return {};
  }
}

// ─── Create Event ──────────────────────────────────────────────────

export async function createEvent(
  data: CreateEventData
): Promise<ActionResult<{ id: string }>> {
  // Identify the caller (need user.id for created_by audit) via the cookie
  // client; all WRITES below run on the service client because yip.events /
  // agenda / checklist are RLS read-only for `authenticated` (session-client
  // INSERTs are rejected — this was a latent createEvent runtime failure).
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createServiceClient();

  // When a yi_chapter_id is supplied, derive zone fields up-front so the
  // 3-tier regional-admin visibility gate (yi_zone_code) is correct from
  // first INSERT. The DB trigger added in
  // 20260528160000_yip_events_autoderive_zone_and_topics provides the
  // same guarantee for any caller that bypasses this code path (direct
  // SQL, Management API inserts, seed scripts).
  // When a chapter is linked, yi.chapters is the SOURCE OF TRUTH for
  // chapter_name/city/state/zone — we OVERRIDE whatever free text the form
  // sent so a linked event can never drift from the canonical chapter record.
  let derivedZoneCode: string | null = null;
  let derivedChapterName: string | null = null;
  let derivedCity: string | null = null;
  let derivedState: string | null = null;
  if (data.yi_chapter_id) {
    const { data: chapter } = await supabase
      .schema("yi")
      .from("chapters")
      .select("name, city, state, region")
      .eq("id", data.yi_chapter_id)
      .maybeSingle();
    if (chapter) {
      derivedChapterName = chapter.name;
      derivedCity = chapter.city;
      derivedState = chapter.state;
      if (chapter.region) {
        derivedZoneCode = chapter.region;
      }
    }
  }

  // Create-permission gate (no event exists yet, so getYipEventAccess can't
  // apply). Event creation is a super-admin action, or a regional admin
  // creating an event in a zone they administer. Chapter chairs/organisers run
  // events that national/regional provision for them.
  const isSuper = await isCurrentUserSuperAdmin();
  if (!isSuper) {
    const zones = await getRegionalAdminZones("yip");
    const allowed = derivedZoneCode
      ? zones.includes(derivedZoneCode)
      : zones.length > 0;
    if (!allowed) {
      return {
        success: false,
        error: "Only national admins, or regional admins for this zone, can create events",
      };
    }
  }

  // Committees start UNSELECTED (2026-06-19). We no longer backfill the full
  // 15-catalogue, so committee_topics is whatever the caller sent — typically
  // {} from the create wizard, where the organiser then picks their committees
  // on the Committees tab. Allocation refuses to run until at least one is
  // picked (see runAllocationAction / assignCommittees), so an empty event is
  // safe, not silently allocated against all 15.
  const committeeTopics = data.committee_topics ?? {};

  // DPDP privacy-by-default: new events are created in privacy mode (masked
  // names + minimal registration, auto-anonymize after results) UNLESS the
  // chapter has explicitly opted out (admin → Data Privacy toggled off, which
  // stores a `false` row). No preference row → ON.
  const chapterForPrivacy = derivedChapterName ?? data.chapter_name;
  let privacyMode = true;
  if (chapterForPrivacy) {
    const { data: cp } = await supabase
      .from("chapter_privacy")
      .select("privacy_default")
      .eq("yi_chapter", chapterForPrivacy)
      .maybeSingle();
    privacyMode = cp?.privacy_default ?? true;
  }

  // Insert the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      name: data.name,
      level: data.level,
      privacy_mode: privacyMode,
      // When a chapter is linked, the canonical yi.chapters values win over
      // the form's free text (derived* fall back to form text when unlinked).
      chapter_name: derivedChapterName ?? data.chapter_name,
      city: derivedCity ?? data.city,
      state: derivedState ?? data.state,
      day1_date: data.day1_date,
      day2_date: data.day2_date,
      venue_name: data.venue_name,
      venue_address: data.venue_address,
      central_agenda: data.central_agenda,
      committee_topics: committeeTopics,
      status: "draft",
      created_by: user.id,
      ...(data.yi_chapter_id ? { yi_chapter_id: data.yi_chapter_id } : {}),
      ...(derivedZoneCode
        ? {
            yi_zone_code: derivedZoneCode,
            zone: derivedZoneCode as Database["public"]["Enums"]["yi_zone"],
          }
        : {}),
    })
    .select("id")
    .single();

  if (eventError || !event) {
    return {
      success: false,
      error: eventError?.message ?? "Failed to create event",
    };
  }

  // Auto-generate agenda items. Source of truth is the central
  // yip.agenda_template table (managed at /yip/dashboard/admin/agenda); when
  // that table is empty we fall back to the DEFAULT_AGENDA_TEMPLATE constant so
  // event creation always seeds a complete 2-day agenda.
  const agendaItems: Array<{
    event_id: string;
    day: number;
    sequence_order: number;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    agenda_type: string | null;
    mode: "party" | "committee" | "mixed";
    is_scoreable: boolean;
    session_key: string | null;
  }> = [];

  const { data: templateRows } = await supabase
    .from("agenda_template")
    .select(
      "day, sequence_order, title, description, agenda_type, duration_minutes, mode, is_scoreable, session_key"
    )
    .order("day")
    .order("sequence_order");

  if (templateRows && templateRows.length > 0) {
    // DB-driven template.
    for (const item of templateRows) {
      agendaItems.push({
        event_id: event.id,
        day: item.day,
        sequence_order: item.sequence_order,
        title: item.title,
        description: item.description,
        duration_minutes: item.duration_minutes,
        agenda_type: item.agenda_type,
        mode: item.mode,
        is_scoreable: item.is_scoreable,
        session_key: item.session_key,
      });
    }
  } else {
    // Fallback: hard-coded DEFAULT_AGENDA_TEMPLATE constant.
    for (const item of DEFAULT_AGENDA_TEMPLATE.day1) {
      agendaItems.push({
        event_id: event.id,
        day: 1,
        sequence_order: item.sequence,
        title: item.title,
        description: null,
        duration_minutes: item.duration,
        agenda_type: item.type,
        mode: item.mode,
        is_scoreable: false,
        session_key: null,
      });
    }
    for (const item of DEFAULT_AGENDA_TEMPLATE.day2) {
      agendaItems.push({
        event_id: event.id,
        day: 2,
        sequence_order: item.sequence,
        title: item.title,
        description: null,
        duration_minutes: item.duration,
        agenda_type: item.type,
        mode: item.mode,
        is_scoreable: false,
        session_key: null,
      });
    }
  }

  const { error: agendaError } = await supabase
    .from("agenda")
    .insert(agendaItems);

  if (agendaError) {
    // Event was created but agenda failed - log but don't fail
    console.error("Failed to create agenda items:", agendaError.message);
  }

  // Seed organizer_checklist from default template (handbook p.45-46)
  const { data: defaultItems } = await supabase
    .from("checklist_template")
    .select("category, sequence_order, title, description")
    .order("category")
    .order("sequence_order");

  if (defaultItems && defaultItems.length > 0) {
    const checklistRows = defaultItems.map((item) => ({
      event_id: event.id,
      title: item.title,
      description: item.description,
      category: item.category,
      sequence_order: item.sequence_order,
      is_completed: false,
    }));
    const { error: checklistError } = await supabase
      .from("checklist")
      .insert(checklistRows);
    if (checklistError) {
      console.error("Failed to seed checklist:", checklistError.message);
    }
  }

  // Auto-inherit active central topics for chapter-level events. Chapter
  // organizers can then remove ones they don't want and pick their 5.
  // Failure here MUST NOT roll back the event — the event should exist
  // even if no central topics are active or the upsert fails.
  if (data.level === "chapter") {
    const attachResult = await attachCentralTopicsToEvent(event.id);
    if (!attachResult.success) {
      console.error(
        "Failed to auto-attach central topics to chapter event:",
        attachResult.error
      );
    }
  }

  await logAuditAction({
    action_type: "create",
    target_table: "events",
    target_id: event.id,
    target_event_id: event.id,
    metadata: {
      name: data.name,
      level: data.level,
      chapter_name: data.chapter_name,
    },
  });
  revalidatePath("/yip/dashboard");
  return { success: true, data: { id: event.id } };
}

// ─── Update Event ──────────────────────────────────────────────────

export async function updateEvent(
  eventId: string,
  data: UpdateEventData
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  // When the caller (re)links a chapter, re-derive the canonical fields from
  // yi.chapters and fold them into the update payload — the same source-of-truth
  // override createEvent applies. derivedFields is empty when unlinked so the
  // spread is a no-op for ordinary edits.
  let derivedFields: {
    chapter_name?: string;
    city?: string;
    state?: string | null;
    yi_zone_code?: string;
    zone?: Database["public"]["Enums"]["yi_zone"];
  } = {};
  if (data.yi_chapter_id) {
    const { data: chapter } = await supabase
      .schema("yi")
      .from("chapters")
      .select("name, city, state, region")
      .eq("id", data.yi_chapter_id)
      .maybeSingle();
    if (chapter) {
      derivedFields = {
        chapter_name: chapter.name,
        city: chapter.city,
        state: chapter.state,
        ...(chapter.region
          ? {
              yi_zone_code: chapter.region,
              zone: chapter.region as Database["public"]["Enums"]["yi_zone"],
            }
          : {}),
      };
    }
  }

  const { error } = await supabase
    .from("events")
    .update({ ...data, ...derivedFields })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  return { success: true, data: null };
}

// ─── List Chapters (picker) ────────────────────────────────────────
// Full catalog of active Yi chapters, grouped by region, for the
// create/edit event chapter picker. Reads from yi.chapters (the source of
// truth) so the dropdown always reflects the canonical chapter list.

interface ChapterOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  programmeDurationDays: number | null;
}

interface ChapterRegionGroup {
  region: string;
  chapters: ChapterOption[];
}

export async function listEventChapters(): Promise<ChapterRegionGroup[]> {
  // Any signed-in organizer/admin may read the chapter catalog for the picker;
  // it is non-sensitive reference data, so a plain auth check is sufficient.
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return [];

  const supabase = await createServiceClient();
  const { data: chapters } = await supabase
    .schema("yi")
    .from("chapters")
    .select("id, name, city, state, region, programme_duration_days")
    .eq("is_active", true)
    .order("name");

  if (!chapters) return [];

  // Group by region (NULL region collapses to "Unassigned" so no row is lost),
  // then sort regions alphabetically. Within a region, order("name") already
  // sorted the rows, so insertion order preserves alphabetical chapters.
  const groups = new Map<string, ChapterOption[]>();
  for (const chapter of chapters) {
    const region = chapter.region ?? "Unassigned";
    const option: ChapterOption = {
      id: chapter.id,
      name: chapter.name,
      city: chapter.city,
      state: chapter.state,
      programmeDurationDays: chapter.programme_duration_days,
    };
    const existing = groups.get(region);
    if (existing) {
      existing.push(option);
    } else {
      groups.set(region, [option]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, regionChapters]) => ({ region, chapters: regionChapters }));
}

// ─── Get Event ─────────────────────────────────────────────────────

export async function getEvent(eventId: string) {
  // Visibility gate: super_admin / regional_admin / chapter_admin / organiser.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) return null;

  // Get participant count
  const { count: participantCount } = await supabase
    .from("participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  // Get jury count
  const { count: juryCount } = await supabase
    .from("jury_assignments")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  return {
    ...event,
    participantCount: participantCount ?? 0,
    juryCount: juryCount ?? 0,
  };
}

// ─── Lock Toggles ──────────────────────────────────────────────────
// Three boolean flags on the events row that gate writes from other roles.

async function setEventLock(
  eventId: string,
  field: "allocation_locked" | "scores_locked" | "registrations_frozen",
  value: boolean
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const patch = { [field]: value };
  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  revalidatePath(`/yip/dashboard/events/${eventId}/scoring`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/jury`);
  return { success: true, data: null };
}

export async function setAllocationLocked(
  eventId: string,
  value: boolean
): Promise<ActionResult<null>> {
  return setEventLock(eventId, "allocation_locked", value);
}

export async function setScoresLocked(
  eventId: string,
  value: boolean
): Promise<ActionResult<null>> {
  return setEventLock(eventId, "scores_locked", value);
}

export async function setRegistrationsFrozen(
  eventId: string,
  value: boolean
): Promise<ActionResult<null>> {
  return setEventLock(eventId, "registrations_frozen", value);
}

// ─── Get Event With Details ────────────────────────────────────────

export async function getEventWithDetails(eventId: string) {
  // Visibility gate: super_admin / regional_admin / chapter_admin / organiser.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) return null;

  // Fetch related data in parallel
  const [participantsRes, agendaRes, juryRes] = await Promise.all([
    supabase
      .from("participants")
      .select("*")
      .eq("event_id", eventId)
      .order("full_name"),
    supabase
      .from("agenda")
      .select("*")
      .eq("event_id", eventId)
      .order("day")
      .order("sequence_order"),
    supabase
      .from("jury_assignments")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at"),
  ]);

  return {
    ...event,
    participants: participantsRes.data ?? [],
    agendaItems: agendaRes.data ?? [],
    juryAssignments: juryRes.data ?? [],
    participantCount: participantsRes.data?.length ?? 0,
    juryCount: juryRes.data?.length ?? 0,
  };
}
// ─── Live Banner (F5) ──────────────────────────────────────────────
// Push / clear a breaking-news banner that appears on the projector
// display. Persisted on the events row AND broadcast over Realtime so
// connected projector clients update without a postgres_changes round-trip.

const LIVE_BANNER_MAX_LEN = 280;

export async function pushLiveBanner(
  eventId: string,
  text: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) {
    return { success: false, error: "Banner text is required" };
  }
  if (trimmed.length > LIVE_BANNER_MAX_LEN) {
    return {
      success: false,
      error: `Banner text must be ${LIVE_BANNER_MAX_LEN} characters or fewer (got ${trimmed.length})`,
    };
  }

  // live_banner_* columns exist in DB (migration adding live_banner_text
  // + live_banner_active) but may not be in generated types yet.
  const patch = {
    live_banner_text: trimmed,
    live_banner_active: true,
  } ;

  const { error } = await supabase
    .from("events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Broadcast to connected projector clients on a dedicated channel.
  const channel = supabase.channel(`yip:live-banner:${eventId}`);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
    // Safety timeout so we never hang the server action.
    setTimeout(resolve, 1500);
  });
  await channel.send({
    type: "broadcast",
    event: "update",
    payload: { active: true, text: trimmed },
  });
  await supabase.removeChannel(channel);

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

export async function clearLiveBanner(
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const patch = {
    live_banner_active: false,
  } ;

  const { error } = await supabase
    .from("events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch)
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  const channel = supabase.channel(`yip:live-banner:${eventId}`);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
    setTimeout(resolve, 1500);
  });
  await channel.send({
    type: "broadcast",
    event: "update",
    payload: { active: false, text: null },
  });
  await supabase.removeChannel(channel);

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

