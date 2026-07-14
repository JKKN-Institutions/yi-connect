"use server";

/**
 * Organiser event management for Varnam Vizha — create / edit / cancel edition
 * events from the committee dashboard.
 *
 * Security: EVERY action re-checks getVarnamAccess().canManage server-side
 * (the admin client bypasses RLS, so the action layer IS the permission layer).
 * Denials return an explicit { ok:false, message } — never a silent redirect.
 */
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";

export type ManageEventState = { ok: boolean; message: string };

const ERODE_CHAPTER_ID = "fe71c429-2647-4262-b35b-e356c960903d";
const FESTIVAL_KEY = "varnam-vizha";

// Festival-relevant subset of the yi_connect.event_category ENUM
// ('networking','social','professional_development','community_service',
//  'sports','cultural','fundraising','workshop','seminar','conference',
//  'webinar','other' — migration 20260522000007). Keep in sync with the
// <select> options in EventForm.tsx.
const ALLOWED_CATEGORIES = ["cultural", "sports", "workshop", "other"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DT_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const HTTPS_RE = /^https:\/\/\S+\.\S+/;

/** `datetime-local` value ("2026-09-12T18:30") → timestamptz in IST. */
function toIstTimestamp(dtLocal: string): string {
  return `${dtLocal}:00+05:30`;
}

type ParsedFields = {
  title: string;
  description: string | null;
  category: string;
  startsAt: string; // timestamptz string (+05:30)
  endsAt: string | null;
  venueAddress: string | null;
  maxCapacity: number | null;
  waitlistEnabled: boolean;
  isFeatured: boolean;
  isPaid: boolean;
  ticketUrl: string | null;
};

/** Validate + normalise the shared create/edit fields (single source of rules). */
function parseEventFields(
  formData: FormData
): { ok: true; fields: ParsedFields } | { ok: false; message: string } {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 120) {
    return { ok: false, message: "Title must be between 3 and 120 characters." };
  }

  const category = String(formData.get("category") ?? "").trim();
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return { ok: false, message: "Please pick a valid category." };
  }

  const startsAtLocal = String(formData.get("starts_at") ?? "").trim();
  if (!DT_LOCAL_RE.test(startsAtLocal)) {
    return { ok: false, message: "Please set a valid start date & time." };
  }
  const startsAt = toIstTimestamp(startsAtLocal);

  // end_date is NOT NULL in yi_connect.events — when the organiser leaves the
  // end time blank, default to 2 hours after the start.
  const endsAtLocal = String(formData.get("ends_at") ?? "").trim();
  let endsAt: string;
  if (endsAtLocal) {
    if (!DT_LOCAL_RE.test(endsAtLocal)) {
      return { ok: false, message: "The end date & time isn't valid." };
    }
    endsAt = toIstTimestamp(endsAtLocal);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) {
      return { ok: false, message: "The end time must be after the start time." };
    }
  } else {
    endsAt = new Date(
      Date.parse(startsAt) + 2 * 60 * 60 * 1000
    ).toISOString();
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const venueAddress = String(formData.get("venue_address") ?? "").trim() || null;

  const capRaw = String(formData.get("max_capacity") ?? "").trim();
  let maxCapacity: number | null = null;
  if (capRaw) {
    const n = Number(capRaw);
    if (!Number.isInteger(n) || n < 1) {
      return {
        ok: false,
        message: "Capacity must be a whole number of 1 or more (or left blank).",
      };
    }
    maxCapacity = n;
  }

  const waitlistEnabled = formData.get("waitlist_enabled") === "on";
  const isFeatured = formData.get("is_featured") === "on";
  const isPaid = formData.get("is_paid") === "on";

  let ticketUrl: string | null = null;
  if (isPaid) {
    const raw = String(formData.get("ticket_url") ?? "").trim();
    if (raw) {
      if (!HTTPS_RE.test(raw)) {
        return {
          ok: false,
          message: "The ticket link must be a full https:// URL (or left blank).",
        };
      }
      ticketUrl = raw;
    }
  }
  // isPaid=false → ticketUrl stays null so computeRegistrationMode never
  // treats the event as paid.

  return {
    ok: true,
    fields: {
      title,
      description,
      category,
      startsAt,
      endsAt,
      venueAddress,
      maxCapacity,
      waitlistEnabled,
      isFeatured,
      isPaid,
      ticketUrl,
    },
  };
}

function slugBaseFromTitle(title: string): string {
  const core = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `varnam-2026-${core || "event"}`;
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/** First free slug among base, base-2 … base-5 (null if all taken). */
async function ensureUniqueSlug(
  sb: AdminClient,
  base: string
): Promise<string | null> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await sb
      .schema("yi_connect")
      .from("events")
      .select("id")
      .eq("public_slug", candidate)
      .maybeSingle();
    if (error) return null;
    if (!data) return candidate;
  }
  return null;
}

function revalidateEventPaths(slug?: string | null) {
  revalidatePath("/varnam-vizha");
  revalidatePath("/varnam-vizha/events");
  if (slug) revalidatePath(`/varnam-vizha/events/${slug}`);
  revalidatePath("/varnam-vizha/dashboard/events");
}

async function requireManage(): Promise<ManageEventState | null> {
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return {
      ok: false,
      message:
        "You don't have permission to manage events. Ask the festival chair for organiser access.",
    };
  }
  return null;
}

// ── Create ──────────────────────────────────────────────────────────────────
export async function createEvent(
  _prev: ManageEventState,
  formData: FormData
): Promise<ManageEventState> {
  const denied = await requireManage();
  if (denied) return denied;

  const parsed = parseEventFields(formData);
  if (!parsed.ok) return parsed;
  const f = parsed.fields;

  const sb = createAdminSupabaseClient();

  // Attach to the current live edition — never create orphan events.
  const { data: edition, error: edErr } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id")
    .eq("festival_key", FESTIVAL_KEY)
    .eq("status", "live")
    .maybeSingle();
  if (edErr || !edition) {
    return {
      ok: false,
      message:
        "No live Varnam Vizha edition found — set an edition live before adding events.",
    };
  }

  const slug = await ensureUniqueSlug(sb, slugBaseFromTitle(f.title));
  if (!slug) {
    return {
      ok: false,
      message:
        "Couldn't generate a unique web address for this title — try a slightly different title.",
    };
  }

  const { data: created, error } = await sb
    .schema("yi_connect")
    .from("events")
    .insert({
      chapter_id: ERODE_CHAPTER_ID,
      festival_edition_id: (edition as { id: string }).id,
      title: f.title,
      description: f.description,
      category: f.category,
      status: "published",
      start_date: f.startsAt,
      end_date: f.endsAt,
      venue_address: f.venueAddress,
      max_capacity: f.maxCapacity,
      waitlist_enabled: f.waitlistEnabled,
      is_featured: f.isFeatured,
      is_active: true,
      event_scope: "chapter",
      tags: ["varnam-vizha", "2026", f.category],
      custom_fields: { paid: f.isPaid, ticket_url: f.ticketUrl },
      public_slug: slug,
      rsvp_token: randomBytes(16).toString("hex"),
    })
    .select("id, public_slug")
    .maybeSingle();

  if (error || !created) {
    return {
      ok: false,
      message: "Couldn't create the event right now — please try again.",
    };
  }

  revalidateEventPaths(slug);
  return { ok: true, message: `"${f.title}" is now on the programme.` };
}

// ── Update ──────────────────────────────────────────────────────────────────
export async function updateEvent(
  _prev: ManageEventState,
  formData: FormData
): Promise<ManageEventState> {
  const denied = await requireManage();
  if (denied) return denied;

  const eventId = String(formData.get("event_id") ?? "").trim();
  if (!UUID_RE.test(eventId)) {
    return { ok: false, message: "Something went wrong — missing event." };
  }

  const parsed = parseEventFields(formData);
  if (!parsed.ok) return parsed;
  const f = parsed.fields;

  const sb = createAdminSupabaseClient();

  // Only edition events are manageable here.
  const { data: existing } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, festival_edition_id, public_slug, custom_fields")
    .eq("id", eventId)
    .maybeSingle();
  const row = existing as {
    festival_edition_id: string | null;
    public_slug: string | null;
    custom_fields: Record<string, unknown> | null;
  } | null;
  if (!row || !row.festival_edition_id) {
    return { ok: false, message: "This event isn't part of the festival edition." };
  }

  const mergedCustomFields = {
    ...(row.custom_fields ?? {}),
    paid: f.isPaid,
    ticket_url: f.ticketUrl,
  };

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("events")
    .update({
      title: f.title,
      description: f.description,
      category: f.category,
      start_date: f.startsAt,
      end_date: f.endsAt,
      venue_address: f.venueAddress,
      max_capacity: f.maxCapacity,
      waitlist_enabled: f.waitlistEnabled,
      is_featured: f.isFeatured,
      tags: ["varnam-vizha", "2026", f.category],
      custom_fields: mergedCustomFields,
    })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return {
      ok: false,
      message: "Couldn't save the changes — please try again.",
    };
  }

  revalidateEventPaths(row.public_slug);
  return { ok: true, message: "Changes saved." };
}

// ── Cancel / restore ────────────────────────────────────────────────────────
async function setEventStatus(
  eventId: string,
  to: "published" | "cancelled"
): Promise<ManageEventState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test(eventId)) {
    return { ok: false, message: "Something went wrong — missing event." };
  }

  const sb = createAdminSupabaseClient();
  const { data: existing } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, status, public_slug, festival_edition_id")
    .eq("id", eventId)
    .maybeSingle();
  const row = existing as {
    status: string | null;
    public_slug: string | null;
    festival_edition_id: string | null;
  } | null;
  if (!row || !row.festival_edition_id) {
    return { ok: false, message: "This event isn't part of the festival edition." };
  }
  if (to === "cancelled" && row.status === "cancelled") {
    return { ok: true, message: "This event is already cancelled." };
  }
  if (to === "published" && row.status !== "cancelled") {
    return {
      ok: false,
      message: "Only cancelled events can be restored.",
    };
  }

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("events")
    .update({ status: to }) // 'cancelled' & 'published' are real event_status ENUM values
    .eq("id", eventId)
    .select("id, status")
    .maybeSingle();
  if (error || !updated || (updated as { status: string }).status !== to) {
    return {
      ok: false,
      message: "Couldn't update the event status — please try again.",
    };
  }

  revalidateEventPaths(row.public_slug);
  return {
    ok: true,
    message:
      to === "cancelled"
        ? "Event cancelled. It stays visible on the site with a Cancelled badge."
        : "Event restored and published again.",
  };
}

/** Mark an event cancelled (kept on the public list with a badge). */
export async function cancelEvent(eventId: string): Promise<ManageEventState> {
  return setEventStatus(eventId, "cancelled");
}

/** Restore a cancelled event to published. */
export async function uncancelEvent(eventId: string): Promise<ManageEventState> {
  return setEventStatus(eventId, "published");
}
