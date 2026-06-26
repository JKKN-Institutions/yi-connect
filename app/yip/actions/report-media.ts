"use server";

/**
 * Server action for the YIP Chapter Round Report — Section 7 (Media & Coverage).
 *
 * Mirrors the reference action (app/yip/actions/report-overview.ts):
 *   - "use server" file → exports ONLY async functions (no types/consts; the
 *     section's types + the recommended-shots list live in
 *     lib/yip/report/sections/media.ts).
 *   - every write gates with getYipEventAccess(eventId).canManage and returns a
 *     structured { success, error } result (NEVER throws / redirects).
 *   - revalidatePath the report page so the freshly-added photo re-renders.
 *
 * The report's Photo Gallery is normally assembled on the live Media tab (file
 * upload to Storage → yip.media). For the report's inline gap-fill we let an
 * organiser add a single photo by URL + caption without leaving the report — it
 * inserts the same kind of yip.media row the Media tab creates (kind='photo',
 * visibility='public'), with the external image URL stored directly in
 * public_url. This intentionally reuses the existing media table so the photo
 * also appears on the Media tab.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult =
  | { success: true }
  | { success: false; error: string };

/** Cheap URL sanity check — must be an absolute http(s) URL. */
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Add one gallery photo to the report (and the Media tab) from an external image
 * URL. `caption` and `photographerName` are optional. When `makeCover` is true
 * and the event has no cover yet, the new photo becomes the cover (single-cover
 * invariant preserved by clearing any existing cover first).
 */
export async function addReportPhotoByUrl(
  eventId: string,
  input: {
    imageUrl: string;
    caption?: string | null;
    photographerName?: string | null;
    makeCover?: boolean;
  }
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const imageUrl = (input.imageUrl ?? "").trim();
  if (!imageUrl) {
    return { success: false, error: "Paste an image URL first." };
  }
  if (!isHttpUrl(imageUrl)) {
    return {
      success: false,
      error: "That doesn't look like a valid image link (must start with http:// or https://).",
    };
  }

  const caption = (input.caption ?? "").trim() || null;
  const photographerName = (input.photographerName ?? "").trim() || null;

  const svc = await createServiceClient();
  const {
    data: { user },
  } = await svc.auth.getUser();

  // A derived file name from the URL's last path segment (best-effort).
  let fileName = "report-photo";
  try {
    const last = new URL(imageUrl).pathname.split("/").filter(Boolean).pop();
    if (last) fileName = decodeURIComponent(last).slice(0, 120);
  } catch {
    // keep default
  }

  // If asked to set as cover, only do so when the event has no cover today —
  // never silently override an existing cover chosen on the Media tab.
  let makeCover = false;
  if (input.makeCover) {
    const { data: existingCover } = await svc
      .from("media")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_cover", true)
      .limit(1)
      .maybeSingle();
    makeCover = !existingCover;
  }

  // storage_path is NOT NULL on yip.media; for an external URL there is no
  // Storage object, so we record a logical marker path under an `external/`
  // prefix. public_url carries the real, renderable image link.
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const storagePath = `external/${eventId}/${uuid}_${fileName}`;

  const { error } = await svc.from("media").insert({
    event_id: eventId,
    kind: "photo",
    storage_path: storagePath,
    public_url: imageUrl,
    file_name: fileName,
    mime_type: "image/*",
    caption,
    photographer_name: photographerName,
    visibility: "public",
    is_cover: makeCover,
    uploaded_by: user?.id ?? null,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  revalidatePath(`/yip/dashboard/events/${eventId}/media`);
  return { success: true };
}
