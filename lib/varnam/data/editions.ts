/**
 * Varnam Vizha public data layer. Reads festival_editions + their sub-events
 * (yi_connect.events linked via festival_edition_id). Uses the anon server
 * client — RLS exposes live/completed editions and published events publicly,
 * so this is safe for the public site (least privilege).
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const FESTIVAL_KEY = "varnam-vizha";

export type Edition = {
  id: string;
  year: number;
  name: string;
  slug: string;
  status: string;
  theme: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
};

export type FestivalEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  venue_address: string | null;
  public_slug: string | null;
  is_featured: boolean | null;
  tags: string[] | null;
};

const EDITION_COLS =
  "id,year,name,slug,status,theme,start_date,end_date,summary";
const EVENT_COLS =
  "id,title,description,category,status,start_date,end_date,venue_address,public_slug,is_featured,tags";

/** The current public edition (status='live'); falls back to the latest year. */
export async function getCurrentEdition(): Promise<Edition | null> {
  const sb = await createServerSupabaseClient();
  const live = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select(EDITION_COLS)
    .eq("festival_key", FESTIVAL_KEY)
    .eq("status", "live")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (live.data) return live.data as Edition;

  const latest = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select(EDITION_COLS)
    .eq("festival_key", FESTIVAL_KEY)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest.data as Edition) ?? null;
}

/** All editions, newest first (for the history / playbook strip). */
export async function getAllEditions(): Promise<Edition[]> {
  const sb = await createServerSupabaseClient();
  const { data } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select(EDITION_COLS)
    .eq("festival_key", FESTIVAL_KEY)
    .order("year", { ascending: false });
  return (data as Edition[]) ?? [];
}

/** Sub-events for an edition, in chronological order. */
export async function getEditionEvents(
  editionId: string
): Promise<FestivalEvent[]> {
  const sb = await createServerSupabaseClient();
  const { data } = await sb
    .schema("yi_connect")
    .from("events")
    .select(EVENT_COLS)
    .eq("festival_edition_id", editionId)
    .order("start_date", { ascending: true });
  return (data as FestivalEvent[]) ?? [];
}

export type RegMode = "open" | "waitlist" | "full" | "paid" | "closed" | "cancelled";
export type RegistrationState = {
  mode: RegMode;
  ticketUrl: string | null;
  spotsLeft: number | null;
};

/**
 * Pure decision: how registration behaves for an event right now. Used by both
 * the public detail page (to render the right control) and the register server
 * action (to enforce it). Order matters: cancelled → paid → closed → full.
 */
export function computeRegistrationMode(args: {
  status: string | null;
  customFields: Record<string, unknown> | null;
  startDate: string | null;
  maxCapacity: number | null;
  waitlistEnabled: boolean | null;
  confirmedCount: number;
}): RegMode {
  const {
    status,
    customFields,
    startDate,
    maxCapacity,
    waitlistEnabled,
    confirmedCount,
  } = args;
  if (status === "cancelled") return "cancelled";
  if (customFields && (customFields.paid === true || customFields.ticket_url))
    return "paid";
  if (startDate && new Date(startDate).getTime() < Date.now()) return "closed";
  if (
    typeof maxCapacity === "number" &&
    maxCapacity > 0 &&
    confirmedCount >= maxCapacity
  ) {
    return waitlistEnabled ? "waitlist" : "full";
  }
  return "open";
}

/** One festival event by its public slug, with its edition + registration state. */
export async function getEventBySlug(slug: string): Promise<{
  event: FestivalEvent;
  edition: Edition | null;
  registration: RegistrationState;
} | null> {
  const sb = await createServerSupabaseClient();
  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select(
      EVENT_COLS +
        ",festival_edition_id,max_capacity,waitlist_enabled,custom_fields"
    )
    .eq("public_slug", slug)
    .maybeSingle();
  if (!eventRaw) return null;
  const event = eventRaw as unknown as FestivalEvent & {
    festival_edition_id?: string | null;
    max_capacity?: number | null;
    waitlist_enabled?: boolean | null;
    custom_fields?: Record<string, unknown> | null;
  };

  let edition: Edition | null = null;
  if (event.festival_edition_id) {
    const { data: ed } = await sb
      .schema("yi_connect")
      .from("festival_editions")
      .select(EDITION_COLS)
      .eq("id", event.festival_edition_id)
      .maybeSingle();
    edition = (ed as Edition) ?? null;
  }

  // Live confirmed count drives capacity / waitlist.
  const { count } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "confirmed");
  const confirmedCount = count ?? 0;
  const cf = event.custom_fields ?? null;
  const mode = computeRegistrationMode({
    status: event.status,
    customFields: cf,
    startDate: event.start_date,
    maxCapacity: event.max_capacity ?? null,
    waitlistEnabled: event.waitlist_enabled ?? null,
    confirmedCount,
  });
  const ticketUrl =
    cf && typeof cf.ticket_url === "string" ? cf.ticket_url : null;
  const spotsLeft =
    typeof event.max_capacity === "number" && event.max_capacity > 0
      ? Math.max(0, event.max_capacity - confirmedCount)
      : null;

  return { event, edition, registration: { mode, ticketUrl, spotsLeft } };
}
