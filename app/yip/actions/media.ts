"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
import {
  mimeToKind,
  STORAGE_BUCKET,
  type EventMedia,
  type MediaKind,
  type MediaVisibility,
} from "@/lib/yip/media";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

type AnySupabase = Awaited<ReturnType<typeof createServiceClient>>;

// Resolve a public URL for a storage_path via Supabase Storage.
async function resolvePublicUrl(
  supabase: AnySupabase,
  storagePath: string
): Promise<string | null> {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}

// ── List ────────────────────────────────────────────────────────────────
export async function listMedia(
  eventId: string,
  filter?: { kind?: MediaKind; visibility?: MediaVisibility }
): Promise<EventMedia[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("uploaded_at", { ascending: false });

  if (filter?.kind) q = q.eq("kind", filter.kind);
  if (filter?.visibility) q = q.eq("visibility", filter.visibility);

  const { data } = await q;
  const rows = (data ?? []) as EventMedia[];

  // Ensure public_url is populated (cached column may be null for older rows).
  const resolved = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      public_url: r.public_url ?? (await resolvePublicUrl(supabase, r.storage_path)),
    }))
  );
  return resolved;
}

// ── Register a freshly-uploaded file into the DB ───────────────────────
// Called by the client component right after uploading to Storage.
export async function registerUploadedMedia(input: {
  event_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  width?: number | null;
  height?: number | null;
}): Promise<ActionResult<EventMedia>> {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const kind = mimeToKind(input.mime_type);
  const public_url = await resolvePublicUrl(supabase, input.storage_path);

  const { data, error } = await supabase
    .from("media")
    .insert({
      event_id: input.event_id,
      kind,
      storage_path: input.storage_path,
      public_url,
      file_name: input.file_name,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes,
      width: input.width ?? null,
      height: input.height ?? null,
      visibility: "yi_internal",
      is_cover: false,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${input.event_id}/media`);
  return { success: true, data: data as EventMedia };
}

// ── Update caption / photographer / taken_at / tags ─────────────────────
export async function updateMediaCaption(
  id: string,
  updates: {
    caption?: string | null;
    photographer_name?: string | null;
    taken_at?: string | null;
    tags?: string[] | null;
  }
): Promise<ActionResult<EventMedia>> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("media")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  const row = data as EventMedia;
  revalidatePath(`/yip/dashboard/events/${row.event_id}/media`);
  return { success: true, data: row };
}

// ── Set cover (enforces single cover per event) ─────────────────────────
export async function setCoverImage(
  mediaId: string,
  eventId: string
): Promise<ActionResult<EventMedia>> {
  const supabase = await createServiceClient();

  // Clear any existing cover first
  const { error: clearErr } = await supabase
    .from("media")
    .update({ is_cover: false })
    .eq("event_id", eventId)
    .eq("is_cover", true);

  if (clearErr) return { success: false, error: clearErr.message };

  const { data, error } = await supabase
    .from("media")
    .update({ is_cover: true })
    .eq("id", mediaId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/media`);
  return { success: true, data: data as EventMedia };
}

// ── Clear cover (no cover for this event) ───────────────────────────────
export async function clearCoverImage(
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("media")
    .update({ is_cover: false })
    .eq("event_id", eventId)
    .eq("is_cover", true);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/media`);
  return { success: true, data: null };
}

// ── Visibility (single) ─────────────────────────────────────────────────
export async function setVisibility(
  id: string,
  visibility: MediaVisibility
): Promise<ActionResult<EventMedia>> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("media")
    .update({ visibility })
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  const row = data as EventMedia;
  revalidatePath(`/yip/dashboard/events/${row.event_id}/media`);
  return { success: true, data: row };
}

// ── Bulk visibility ─────────────────────────────────────────────────────
export async function bulkSetVisibility(
  ids: string[],
  visibility: MediaVisibility,
  eventId: string
): Promise<ActionResult<number>> {
  if (ids.length === 0) return { success: true, data: 0 };
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("media")
    .update({ visibility })
    .in("id", ids)
    .select("id");

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/media`);
  return { success: true, data: (data ?? []).length };
}

// ── Delete (storage + DB) ───────────────────────────────────────────────
export async function deleteMedia(id: string): Promise<ActionResult> {
  const supabase = await createServiceClient();

  const { data: row, error: fetchErr } = await supabase
    .from("media")
    .select("id, event_id, storage_path")
    .eq("id", id)
    .single();

  if (fetchErr || !row) {
    return { success: false, error: fetchErr?.message ?? "Media not found" };
  }

  // Delete from Storage first (best effort — even if it fails we still remove DB row)
  await supabase.storage.from(STORAGE_BUCKET).remove([row.storage_path]);

  const { error: delErr } = await supabase
    .from("media")
    .delete()
    .eq("id", id);

  if (delErr) return { success: false, error: delErr.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "media",
    target_id: id,
    target_event_id: row.event_id,
    metadata: { storage_path: row.storage_path },
  });
  revalidatePath(`/yip/dashboard/events/${row.event_id}/media`);
  return { success: true, data: null };
}

// ── Bulk delete ─────────────────────────────────────────────────────────
export async function bulkDeleteMedia(
  ids: string[],
  eventId: string
): Promise<ActionResult<number>> {
  if (ids.length === 0) return { success: true, data: 0 };
  const supabase = await createServiceClient();

  const { data: rows } = await supabase
    .from("media")
    .select("id, storage_path")
    .in("id", ids);

  const paths = ((rows ?? []) as { storage_path: string }[]).map((r) => r.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  }

  const { data, error } = await supabase
    .from("media")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/media`);
  return { success: true, data: (data ?? []).length };
}

// ── Reorder ─────────────────────────────────────────────────────────────
export async function reorderMedia(
  ids: string[],
  eventId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  // Update sort_order for each id in the given sequence.
  const updates = ids.map((id, idx) =>
    supabase.from("media").update({ sort_order: idx }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r.error);
  if (firstErr?.error) return { success: false, error: firstErr.error.message };
  revalidatePath(`/yip/dashboard/events/${eventId}/media`);
  return { success: true, data: null };
}

// ── Stats (used by page header) ─────────────────────────────────────────
export async function getMediaStats(eventId: string): Promise<{
  total: number;
  total_size_bytes: number;
  photos: number;
  videos: number;
  documents: number;
  public: number;
  yi_internal: number;
  organizer_only: number;
}> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("media")
    .select("kind, visibility, size_bytes")
    .eq("event_id", eventId);

  const rows = (data ?? []) as {
    kind: MediaKind;
    visibility: MediaVisibility;
    size_bytes: number | null;
  }[];

  return {
    total: rows.length,
    total_size_bytes: rows.reduce((s, r) => s + (r.size_bytes ?? 0), 0),
    photos: rows.filter((r) => r.kind === "photo").length,
    videos: rows.filter((r) => r.kind === "video").length,
    documents: rows.filter((r) => r.kind === "document").length,
    public: rows.filter((r) => r.visibility === "public").length,
    yi_internal: rows.filter((r) => r.visibility === "yi_internal").length,
    organizer_only: rows.filter((r) => r.visibility === "organizer_only").length,
  };
}
