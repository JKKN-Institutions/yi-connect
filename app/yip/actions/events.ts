"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { DEFAULT_AGENDA_TEMPLATE } from "@/lib/yip/constants";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getRegionalAdminZones } from "@/lib/yi/auth/yi-directory-roles";
import { revalidatePath } from "next/cache";
import {
  attachCentralTopicsToEvent,
  attachCommitteeTopicsToEvent,
} from "./admin-topics";
import { fetchEventRoundLevel, type RoundLevel } from "@/lib/yip/round-level";
import { committeeCatalogueForLevel } from "@/lib/yip/committee-topics";
import { getComplianceScore } from "./branding";
import { writeEventAiEnabled } from "@/lib/yip/ai/drafts";
import { getCommitteeNumbering } from "@/lib/yip/committee-number";
import {
  orderEventCommittees,
  unnamedCommitteeName,
} from "@/lib/yip/event-committees";
import {
  isValidWhatsappInvite,
  normalizeWhatsappInvite,
  withCommitteeWhatsapp,
  withBenchWhatsapp,
  type BenchSide,
} from "@/lib/yip/whatsapp-links";
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

export async function listCommitteeTopics(
  // Which round's committee list to return. Omitted / null = the shared
  // catalogue only, which is byte-for-byte what this returned before topics
  // gained a level scope — so every existing caller keeps its exact behaviour.
  // Pass a level to get that round's own committees where it has them.
  level: RoundLevel | null = null
): Promise<CommitteeTopicOption[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, description, linked_scheme, topic_number, levels")
    .eq("category", "committee")
    .eq("is_active", true)
    .order("topic_number", { nullsFirst: false });
  if (error || !data) return [];
  const resolved = committeeCatalogueForLevel(
    (data as unknown as Array<{
      id: string;
      title: string | null;
      description: string | null;
      linked_scheme: string | null;
      topic_number: number | null;
      levels?: string[] | null;
    }>).map((r) => ({ ...r, title: r.title ?? "" })),
    level
  );
  return resolved.map((r) => ({
    id: r.id,
    committee: r.title,
    topic: r.description ?? "",
    scheme: r.linked_scheme ?? "",
    topic_number: r.topic_number,
  }));
}

/** The committee catalogue as ONE event sees it, resolved from its round level. */
export async function listCommitteeTopicsForEvent(
  eventId: string
): Promise<CommitteeTopicOption[]> {
  const supabase = await createServiceClient();
  const level = await fetchEventRoundLevel(supabase as never, eventId);
  return listCommitteeTopics(level);
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
  // Explicitly the CHAPTER catalogue: this writes to chapter events only, and
  // must never push the regional round's committees onto them.
  const catalog = await listCommitteeTopics("chapter");
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
  const catalog = await listCommitteeTopicsForEvent(eventId);
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

// ─── Numbered committees (Director, 2026-08-14) ────────────────────
//
// A chapter runs "Committee 1..N" and attributes a ministry to each number
// LATER, once. These two actions are that flow: set the count now, name them
// when you know. See lib/yip/event-committees.ts for why renumbering is safe.

/**
 * Set how many committees this event runs, WITHOUT naming them. Slots that
 * already have a ministry attributed keep it; the rest become "Committee n".
 *
 * Shrinking (say 6 → 4) keeps the first 4 exactly as they are and leaves the
 * students from the dropped committees UNASSIGNED for the organiser to move by
 * hand (Director's choice — nobody who was already told their committee gets
 * silently reshuffled). The count of those students is returned so the UI can
 * say so plainly.
 */
export async function setEventCommitteeCount(
  eventId: string,
  count: number
): Promise<ActionResult<{ count: number; unassigned: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!Number.isInteger(count) || count < 1 || count > 40) {
    return {
      success: false,
      error: "Enter how many committees this chapter will run (1–40).",
    };
  }

  const supabase = await createServiceClient();
  const { data: event, error: readErr } = await supabase
    .from("events")
    .select("committee_topics, allocation_locked")
    .eq("id", eventId)
    .single();
  if (readErr || !event) return { success: false, error: "Event not found" };
  if ((event as { allocation_locked?: boolean }).allocation_locked) {
    return {
      success: false,
      error:
        "Allocation is locked for this event. Unlock it before changing how many committees you run.",
    };
  }

  const existing = (event.committee_topics ?? {}) as unknown as
    | Record<string, string>
    | string[];
  const existingNames = Array.isArray(existing)
    ? existing.map(String)
    : Object.keys(existing);
  const topicOf = (name: string): string =>
    Array.isArray(existing) ? "" : (existing[name] ?? "");
  const catalogue = await getCommitteeNumbering(supabase);
  const current = orderEventCommittees(existingNames, catalogue.numberByName);
  const nameBySlot = new Map(current.map((c) => [c.number, c.name]));

  const obj: Record<string, string> = {};
  for (let n = 1; n <= count; n++) {
    const kept = nameBySlot.get(n);
    const name = kept ?? unnamedCommitteeName(n);
    obj[name] = kept ? topicOf(kept) : "";
  }

  // Students sitting in a committee that no longer exists are released rather
  // than reshuffled. They show as unassigned so the organiser can place them.
  const droppedNumbers = current
    .filter((c) => c.number > count)
    .map((c) => c.number);
  let unassigned = 0;
  if (droppedNumbers.length > 0) {
    const { data: released, error: relErr } = await supabase
      .from("participants")
      .update({ committee_name: null, committee_number: null })
      .eq("event_id", eventId)
      .in("committee_number", droppedNumbers)
      .select("id");
    if (relErr) return { success: false, error: relErr.message };
    unassigned = released?.length ?? 0;
  }

  const { error } = await supabase
    .from("events")
    .update({ committee_topics: obj, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/topics`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: { count, unassigned } };
}

/**
 * Attribute a ministry (and its topic) to one committee NUMBER. This is the
 * "name it later" step: Committee 3 becomes Ministry of Health, and every
 * student already sitting in committee 3 keeps their number and gains the name.
 *
 * Pass `null` to clear a ministry and go back to "Committee 3".
 */
export async function attributeCommitteeMinistry(
  eventId: string,
  committeeNumber: number,
  ministry: string | null
): Promise<ActionResult<{ number: number; name: string; moved: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!Number.isInteger(committeeNumber) || committeeNumber < 1) {
    return { success: false, error: "Pick a committee number." };
  }

  const supabase = await createServiceClient();
  const { data: event, error: readErr } = await supabase
    .from("events")
    .select("committee_topics")
    .eq("id", eventId)
    .single();
  if (readErr || !event) return { success: false, error: "Event not found" };

  const existing = (event.committee_topics ?? {}) as unknown as
    | Record<string, string>
    | string[];
  const existingNames = Array.isArray(existing)
    ? existing.map(String)
    : Object.keys(existing);
  const topicOf = (name: string): string =>
    Array.isArray(existing) ? "" : (existing[name] ?? "");
  const catalogue = await getCommitteeNumbering(supabase);
  const current = orderEventCommittees(existingNames, catalogue.numberByName);
  const slot = current.find((c) => c.number === committeeNumber);
  if (!slot) {
    return {
      success: false,
      error: `This event does not run a Committee ${committeeNumber}.`,
    };
  }

  let nextName: string;
  let nextTopic = "";
  if (ministry === null || ministry.trim() === "") {
    nextName = unnamedCommitteeName(committeeNumber);
  } else {
    const wanted = ministry.trim();
    const catalog = await listCommitteeTopicsForEvent(eventId);
    const match = catalog.find((c) => c.committee === wanted);
    if (!match) {
      return {
        success: false,
        error: `"${wanted}" is not in the committee catalogue.`,
      };
    }
    // One ministry per event — otherwise two committees share a name and the
    // bills table (unique on event + committee_name) would collide.
    const clash = current.find(
      (c) =>
        c.number !== committeeNumber &&
        c.name.toLowerCase() === wanted.toLowerCase()
    );
    if (clash) {
      return {
        success: false,
        error: `${wanted} is already Committee ${clash.number} in this event.`,
      };
    }
    nextName = match.committee;
    nextTopic = match.topic ?? "";
  }

  if (nextName === slot.name) {
    return {
      success: true,
      data: { number: committeeNumber, name: nextName, moved: 0 },
    };
  }

  // Rebuild the map with this slot renamed, every other slot untouched.
  const obj: Record<string, string> = {};
  for (const c of current) {
    if (c.number === committeeNumber) obj[nextName] = nextTopic;
    else obj[c.name] = topicOf(c.name);
  }

  const { error: evErr } = await supabase
    .from("events")
    .update({ committee_topics: obj, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (evErr) return { success: false, error: evErr.message };

  // Carry the students across. They keep their NUMBER — only the label moves.
  const { data: movedRows, error: pErr } = await supabase
    .from("participants")
    .update({ committee_name: nextName })
    .eq("event_id", eventId)
    .eq("committee_number", committeeNumber)
    .select("id");
  if (pErr) return { success: false, error: pErr.message };

  // A bill is filed under the committee NAME (bills_event_committee_key is
  // unique on event + committee_name), so a rename has to take any existing
  // bill with it or it would be orphaned from its own committee. Naming is
  // meant to happen before drafting starts, so this normally moves nothing.
  await supabase
    .from("bills")
    .update({ committee_name: nextName } as never)
    .eq("event_id", eventId)
    .eq("committee_name" as never, slot.name as never);

  revalidatePath(`/yip/dashboard/events/${eventId}/topics`);
  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath("/yip/me");
  return {
    success: true,
    data: {
      number: committeeNumber,
      name: nextName,
      moved: movedRows?.length ?? 0,
    },
  };
}

// ─── WhatsApp group invite links (Director, 2026-08-14) ────────────
//
// Every student belongs to one party and one committee, each with its own
// WhatsApp group. The access-code email carries whichever links exist, so a
// student gets their code and both groups in one message.

/** Save (or clear, with null/blank) a PARTY's WhatsApp group invite link. */
export async function setPartyWhatsappLink(
  eventId: string,
  partyId: string,
  url: string | null
): Promise<ActionResult<{ saved: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const value = normalizeWhatsappInvite(url);
  if (value !== null && !isValidWhatsappInvite(value)) {
    return {
      success: false,
      error:
        "That is not a WhatsApp group invite link. It should start with https://chat.whatsapp.com/ — use Group info → Invite via link → Copy link.",
    };
  }

  const supabase = await createServiceClient();
  // Scope the write to this event so a party id from another event cannot be
  // edited by someone who only manages this one.
  const { data, error } = await supabase
    .from("parties")
    .update({ whatsapp_invite_url: value } as never)
    .eq("id", partyId)
    .eq("event_id", eventId)
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: "That party is not part of this event." };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/parties`);
  revalidatePath("/yip/me");
  return { success: true, data: { saved: value !== null } };
}

/**
 * Set (or clear) the WhatsApp group invite for one BENCH of an event.
 *
 * A regional round splits the House into a ruling and an opposition bench, each
 * with its own group. Unlike a party (a real row) or a committee (a numbered
 * key), there are exactly two benches per event, so both links live in one
 * jsonb column keyed by the side.
 *
 * A student is shown the link for THEIR side only, resolved from
 * yip.participants.party_side. A student with no bench set sees no bench group
 * rather than a guessed one — the same refusal-to-guess the jury screen makes.
 *
 * events.bench_whatsapp is newer than types/yip/database.ts (which is not
 * regenerated — the CLI corrupts it), so the read and write are cast once, the
 * same narrow-accessor pattern committee_whatsapp already uses in
 * app/yip/dashboard/events/[id]/topics/page.tsx.
 */
export async function setBenchWhatsappLink(
  eventId: string,
  side: BenchSide,
  url: string | null
): Promise<ActionResult<{ saved: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (side !== "ruling" && side !== "opposition") {
    return { success: false, error: "Unknown bench." };
  }
  const value = normalizeWhatsappInvite(url);
  if (value !== null && !isValidWhatsappInvite(value)) {
    return {
      success: false,
      error:
        "That is not a WhatsApp group invite link. It should start with https://chat.whatsapp.com/ — use Group info → Invite via link → Copy link.",
    };
  }

  const supabase = await createServiceClient();
  // Read-modify-write the map: the two sides are independent, and writing the
  // whole column from one input would silently wipe the other bench's link.
  const { data: row, error: readErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { bench_whatsapp: unknown } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("events")
    .select("bench_whatsapp")
    .eq("id", eventId)
    .maybeSingle();
  if (readErr) return { success: false, error: readErr.message };
  if (!row) return { success: false, error: "Event not found" };

  const next = withBenchWhatsapp(row.bench_whatsapp, side, value);

  const { error } = await supabase
    .from("events")
    .update({ bench_whatsapp: next } as never)
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/parties`);
  revalidatePath("/yip/me");
  return { success: true, data: { saved: value !== null } };
}

/** Save (or clear) a COMMITTEE's WhatsApp link, keyed by its number. */
export async function setCommitteeWhatsappLink(
  eventId: string,
  committeeNumber: number,
  url: string | null
): Promise<ActionResult<{ saved: boolean }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!Number.isInteger(committeeNumber) || committeeNumber < 1) {
    return { success: false, error: "Pick a committee number." };
  }
  const value = normalizeWhatsappInvite(url);
  if (value !== null && !isValidWhatsappInvite(value)) {
    return {
      success: false,
      error:
        "That is not a WhatsApp group invite link. It should start with https://chat.whatsapp.com/ — use Group info → Invite via link → Copy link.",
    };
  }

  const supabase = await createServiceClient();
  const { data: event, error: readErr } = await supabase
    .from("events")
    .select("committee_whatsapp")
    .eq("id", eventId)
    .single();
  if (readErr || !event) return { success: false, error: "Event not found" };

  const next = withCommitteeWhatsapp(
    (event as { committee_whatsapp?: unknown }).committee_whatsapp,
    committeeNumber,
    value
  );
  const { error } = await supabase
    .from("events")
    .update({
      committee_whatsapp: next,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/topics`);
  revalidatePath("/yip/me");
  return { success: true, data: { saved: value !== null } };
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

  // A HOST CHAPTER is REQUIRED for regional / national rounds (2026-08-11).
  // `events.chapter_name` is the host chapter for those levels, and it is now
  // load-bearing on two paths: getYipEventAccess grants the host chapter's
  // chair + organisers their usual chapter authority on a regional event
  // (Director decision 5, Online House Formation), and the dashboard lists a
  // regional event to a chapter by the same chapter_name match. A regional
  // round saved with a blank chapter_name is therefore administrable by NOBODY
  // at chapter level and invisible on their dashboard. Server-side check is
  // the real gate — the wizard's is only a courtesy.
  if (data.level === "regional" || data.level === "national") {
    const hostChapter = (derivedChapterName ?? data.chapter_name ?? "").trim();
    if (!hostChapter) {
      return {
        success: false,
        error:
          "Choose the host chapter for a Regional or National round — its chair and organisers manage the round.",
      };
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

  // Real chapter rounds default AI coaching ON so participants get their
  // "Your Day in the House" / "Your Growth" cards without an extra step.
  // events.ai_enabled lags the generated types, so it is written through the
  // loose writer (same mechanism setEventAiEnabled uses) rather than the strict
  // typed insert above. Best-effort: a failure here must not fail event creation.
  if (data.level === "chapter") {
    await writeEventAiEnabled(event.id, true);
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
    use_for_voting: boolean;
  }> = [];

  const { data: templateRows } = await supabase
    .from("agenda_template")
    .select(
      "day, sequence_order, title, description, agenda_type, duration_minutes, mode, is_scoreable, session_key, use_for_voting"
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
        use_for_voting: item.use_for_voting,
      });
    }
  } else {
    // Fallback: hard-coded DEFAULT_AGENDA_TEMPLATE constant.
    // Canonical voting moments stay vote-enabled even on the fallback path.
    const VOTING_TYPES = [
      "speaker_election",
      "party_formation",
      "cabinet_intro",
      "bill_presentation",
    ];
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
        use_for_voting: VOTING_TYPES.includes(item.type),
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
        use_for_voting: VOTING_TYPES.includes(item.type),
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

  // Regional events inherit the regional committee set the same way — all
  // fifteen are attached and the host trims to the ten they will run. Before
  // this, createEvent inherited nothing for a regional event, which is why
  // every regional round created so far carries zero topics. Failure here MUST
  // NOT roll back the event, exactly as above.
  if (data.level === "regional") {
    const attachResult = await attachCommitteeTopicsToEvent(event.id, "regional");
    if (!attachResult.success) {
      console.error(
        "Failed to auto-attach committee topics to regional event:",
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

  // This is the ordinary EDIT path (name, dates, venue, committees). It must not
  // be a second way to START a round: UpdateEventData.status admits "day1_live",
  // and this function applies no transition validation and no readiness check,
  // so writing it here would route around goLiveBlockReason() in
  // app/yip/actions/agenda.ts. The YIP edit page never sends `status`, so
  // refusing it changes no existing screen - it closes a server-side hole.
  // Every other status stays writable: only going LIVE is gated.
  if (data.status === "day1_live" || data.status === "day2_live") {
    return {
      success: false,
      error:
        "A round cannot be put live from the event edit form. Use the Control panel for this event, which checks the round is ready first.",
    };
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

  // Host chapter stays REQUIRED for regional / national rounds (same reason as
  // createEvent: chapter_name is what getYipEventAccess and the dashboard match
  // on for a host chapter). Editing is also the REPAIR path for a regional
  // event created before this rule, so resolve the effective level + host
  // chapter from this payload falling back to the stored row.
  const { data: current } = await supabase
    .from("events")
    .select("level, chapter_name")
    .eq("id", eventId)
    .maybeSingle();
  const nextLevel = data.level ?? current?.level;
  if (nextLevel === "regional" || nextLevel === "national") {
    const nextHostChapter = (
      derivedFields.chapter_name ??
      data.chapter_name ??
      current?.chapter_name ??
      ""
    ).trim();
    if (!nextHostChapter) {
      return {
        success: false,
        error:
          "Choose the host chapter for a Regional or National round — its chair and organisers manage the round.",
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
  text: string,
  /**
   * Whether the projector banner flashes (Director, 2026-08-28). Defaults to
   * true — how the banner always behaved — so a caller that omits it sees no
   * change. A flashing banner earns attention but wears the room down over a
   * long stretch, so the Chair now chooses per broadcast.
   *
   * STORED on the event (`live_banner_pulse`) as well as carried on the
   * broadcast, in the same update as the text and the active flag. The broadcast
   * is what moves connected projectors immediately; the column is what a
   * projector reads when it paints fresh, so one RELOADED mid-banner comes back
   * exactly as the Chair set it instead of flashing on its own. Both sides are
   * written from this one argument, so they cannot disagree. The column defaults
   * to true, which is the old behaviour, so nothing already on screen changes.
   */
  pulse: boolean = true
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

  // live_banner_* columns exist in DB (live_banner_text + live_banner_active,
  // and live_banner_pulse) but may not be in generated types yet. All three go
  // in ONE update so a projector can never read a banner whose flash setting
  // belongs to the previous push.
  const patch = {
    live_banner_text: trimmed,
    live_banner_active: true,
    live_banner_pulse: pulse,
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
    payload: { active: true, text: trimmed, pulse },
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

