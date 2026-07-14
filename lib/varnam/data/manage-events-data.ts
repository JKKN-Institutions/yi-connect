/**
 * Organiser event-management data layer. Reads a single edition event with the
 * full editable field set for the dashboard edit form. Uses the admin client
 * because the dashboard is role-gated server-side (getVarnamAccess) and needs
 * to see drafts/cancelled rows RLS hides from the public.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManagedEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  venue_address: string | null;
  max_capacity: number | null;
  waitlist_enabled: boolean | null;
  is_featured: boolean | null;
  custom_fields: Record<string, unknown> | null;
  public_slug: string | null;
  festival_edition_id: string | null;
};

/** One event by id with every organiser-editable column (null if not found). */
export async function getManagedEvent(id: string): Promise<ManagedEvent | null> {
  if (!UUID_RE.test(id)) return null;
  const sb = createAdminSupabaseClient();
  const { data } = await sb
    .schema("yi_connect")
    .from("events")
    .select(
      "id, title, description, category, status, start_date, end_date, venue_address, max_capacity, waitlist_enabled, is_featured, custom_fields, public_slug, festival_edition_id"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as ManagedEvent) ?? null;
}

/**
 * timestamptz ISO string → `datetime-local` value in Asia/Kolkata
 * (e.g. "2026-09-12T18:30"). Pure function — used to pre-fill the edit form.
 */
export function toISTDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
