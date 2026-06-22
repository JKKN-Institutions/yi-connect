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

/** One festival event by its public slug, with its edition. */
export async function getEventBySlug(
  slug: string
): Promise<{ event: FestivalEvent; edition: Edition | null } | null> {
  const sb = await createServerSupabaseClient();
  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select(EVENT_COLS + ",festival_edition_id")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!eventRaw) return null;
  const event = eventRaw as unknown as FestivalEvent & {
    festival_edition_id?: string | null;
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
  return { event, edition };
}
