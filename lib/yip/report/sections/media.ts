import "server-only";

/**
 * Data helper for the YIP Chapter Round Report — Section 7 (Media & Coverage).
 *
 * Mirrors the reference helper (lib/yip/report/sections/overview.ts) EXACTLY:
 *   1. `import "server-only"` — data module, never a "use server" file; may
 *      export types + an async getter.
 *   2. gate with getYipEventAccess(eventId); if !canView return null so the
 *      section renders nothing rather than throwing inside the page's Suspense.
 *   3. read yip.* via createServiceClient() (already schema-pinned to "yip").
 *
 * Section 7 is the Photo Gallery: every yip.media row with kind='photo' for the
 * event, cover photo first, then by sort_order, then most-recent. public_url is
 * resolved from Storage when the cached column is empty (older rows), exactly as
 * the live Media tab does (app/yip/actions/media.ts → resolvePublicUrl).
 *
 * The recommended-shots checklist (from the official Chapter Round Report
 * template) is exported as a const so the section can show it as guidance for
 * organisers assembling the gallery.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { STORAGE_BUCKET } from "@/lib/yip/media";

/** A single gallery photo rendered in the report. */
export type ReportPhoto = {
  id: string;
  publicUrl: string | null;
  caption: string | null;
  photographerName: string | null;
  isCover: boolean;
};

export type MediaSectionData = {
  /** Photos for the gallery — cover first, then sort_order, then newest. */
  photos: ReportPhoto[];
  /** Total photo count (same as photos.length; kept explicit for the heading). */
  photoCount: number;
  /** Event's recorded social reach number, if captured (events.social_reach_count). */
  socialReach: number | null;
  /** Public social links recorded for the event (events.social_links[]). */
  socialLinks: string[];
};

/**
 * Official "recommended shots" checklist from the Chapter Round Report template.
 * Shown to organisers (canManage) as a reminder of which photos the report
 * gallery should ideally contain. Pure guidance — not stored.
 */
export const RECOMMENDED_SHOTS: string[] = [
  "Wide shot of the full house / assembly in session",
  "Chief guest(s) addressing the delegates",
  "The Speaker presiding over the session",
  "Prime Minister / Cabinet on the treasury benches",
  "Leader of Opposition / opposition benches",
  "A committee in discussion",
  "Delegates taking the parliamentary oath",
  "Award winners receiving recognition",
  "The Yi moderator team / volunteers",
  "Group photo of all delegates + organisers",
];

type AnySupabase = Awaited<ReturnType<typeof createServiceClient>>;

/** Resolve a public URL for a storage_path via Supabase Storage (Media-tab parity). */
function resolvePublicUrl(
  supabase: AnySupabase,
  storagePath: string | null
): string | null {
  if (!storagePath) return null;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}

/**
 * Fetch everything Section 7 renders. Returns `null` when the caller lacks view
 * access (the section component then renders nothing).
 */
export async function getMediaSectionData(
  eventId: string
): Promise<MediaSectionData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  // Photos only (kind='photo'). Order: cover first, then explicit sort_order,
  // then most-recently taken/uploaded. nullsFirst:false keeps un-ordered rows
  // after the sorted ones.
  const { data: rows } = await svc
    .from("media")
    .select(
      "id, kind, storage_path, public_url, caption, photographer_name, is_cover, sort_order, taken_at, uploaded_at"
    )
    .eq("event_id", eventId)
    .eq("kind", "photo")
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("uploaded_at", { ascending: false });

  type Row = {
    id: string;
    storage_path: string | null;
    public_url: string | null;
    caption: string | null;
    photographer_name: string | null;
    is_cover: boolean | null;
  };

  const photos: ReportPhoto[] = ((rows ?? []) as unknown as Row[]).map((r) => ({
    id: String(r.id),
    publicUrl: r.public_url ?? resolvePublicUrl(svc, r.storage_path),
    caption: r.caption,
    photographerName: r.photographer_name,
    isCover: r.is_cover === true,
  }));

  // Social reach + links (auto-derived; the report just surfaces them).
  // Select "*" (always valid) and read the two columns through a narrow cast —
  // the generated types may lag the live schema for these newer columns, and a
  // typed column-list select would otherwise poison the whole row type.
  const { data: eventRow } = await svc
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  const event = (eventRow ?? null) as {
    social_reach_count?: number | null;
    social_links?: unknown;
  } | null;

  const socialReach =
    event && typeof event.social_reach_count === "number"
      ? event.social_reach_count
      : null;
  const socialLinks = Array.isArray(event?.social_links)
    ? (event.social_links as unknown[]).map((l) => String(l)).filter(Boolean)
    : [];

  return {
    photos,
    photoCount: photos.length,
    socialReach,
    socialLinks,
  };
}
