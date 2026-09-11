"use server";

/**
 * Asset library management for Varnam Vizha — the committee's link-based
 * content pipeline (posters, reels, videos, scripts, photos) with approval
 * statuses, replacing Drive links lost in WhatsApp scrollback.
 *
 * Security: EVERY action re-checks getVarnamAccess().canManage server-side
 * (the admin client bypasses RLS, so the action layer IS the permission
 * layer). Denials return an explicit { ok:false, message } — never a silent
 * redirect.
 *
 * Table: yi_connect.varnam_assets (migration 20260714000004). It has no
 * generated types yet, so rows are cast to local shapes and errors are
 * surfaced as friendly messages.
 */
import { revalidatePath } from "next/cache";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";

export type AssetActionState = { ok: boolean; message: string };

// NOTE: "use server" modules may only export async functions, so these value
// lists stay module-private (the UI keeps its own copy in AssetsBoard/AddAssetForm).
const ASSET_KINDS = [
  "poster",
  "reel",
  "video",
  "script",
  "photo",
  "other",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

const ASSET_STATUSES = [
  "draft",
  "review",
  "approved",
  "published",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

const FESTIVAL_KEY = "varnam-vizha";
const ASSETS_PATH = "/varnam-vizha/dashboard/assets";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTPS_RE = /^https:\/\/\S+\.\S+/;

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/** Server-side gate shared by every write. Null = allowed. */
async function requireManage(): Promise<AssetActionState | null> {
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return {
      ok: false,
      message:
        "You don't have permission to manage assets. Ask the festival chair for organiser access.",
    };
  }
  return null;
}

/** The current live edition id (assets always attach to it). */
async function getLiveEditionId(sb: AdminClient): Promise<string | null> {
  const { data, error } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id")
    .eq("festival_key", FESTIVAL_KEY)
    .eq("status", "live")
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Validate an optional event link: must be a UUID belonging to the given
 * edition. Returns { ok, eventId } — eventId null when the field was blank.
 */
async function resolveEventId(
  sb: AdminClient,
  raw: string,
  editionId: string
): Promise<{ ok: true; eventId: string | null } | { ok: false; message: string }> {
  if (!raw) return { ok: true, eventId: null };
  if (!UUID_RE.test(raw)) {
    return { ok: false, message: "Please pick a valid event (or leave it blank)." };
  }
  const { data, error } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, festival_edition_id")
    .eq("id", raw)
    .maybeSingle();
  const row = data as { id: string; festival_edition_id: string | null } | null;
  if (error || !row || row.festival_edition_id !== editionId) {
    return {
      ok: false,
      message: "That event isn't part of the current edition — pick another or leave it blank.",
    };
  }
  return { ok: true, eventId: row.id };
}

// ── Add ─────────────────────────────────────────────────────────────────────
export async function addAsset(
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const denied = await requireManage();
  if (denied) return denied;

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2 || title.length > 160) {
    return { ok: false, message: "Title must be between 2 and 160 characters." };
  }

  const kindRaw = String(formData.get("kind") ?? "poster").trim();
  if (!(ASSET_KINDS as readonly string[]).includes(kindRaw)) {
    return { ok: false, message: "Please pick a valid asset type." };
  }

  const urlRaw = String(formData.get("url") ?? "").trim();
  if (urlRaw && !HTTPS_RE.test(urlRaw)) {
    return {
      ok: false,
      message: "The link must be a full https:// URL (or left blank for now).",
    };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const sb = createAdminSupabaseClient();

  const editionId = await getLiveEditionId(sb);
  if (!editionId) {
    return {
      ok: false,
      message:
        "No live Varnam Vizha edition found — set an edition live before adding assets.",
    };
  }

  const eventRes = await resolveEventId(
    sb,
    String(formData.get("event_id") ?? "").trim(),
    editionId
  );
  if (!eventRes.ok) return eventRes;

  // Who added it (for the created_by trail); best-effort, never blocks.
  const session = await createServerSupabaseClient();
  const createdBy = (await session.auth.getUser()).data.user?.id ?? null;

  const { data: created, error } = await sb
    .schema("yi_connect")
    .from("varnam_assets")
    .insert({
      edition_id: editionId,
      event_id: eventRes.eventId,
      title,
      kind: kindRaw,
      url: urlRaw || null,
      status: "draft",
      notes,
      created_by: createdBy,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return {
      ok: false,
      message: "Couldn't add the asset right now — please try again.",
    };
  }

  revalidatePath(ASSETS_PATH);
  return { ok: true, message: `"${title}" added to the library.` };
}

// ── Status ──────────────────────────────────────────────────────────────────
export async function setAssetStatus(
  id: string,
  status: string
): Promise<AssetActionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test((id ?? "").trim())) {
    return { ok: false, message: "Something went wrong — missing asset." };
  }
  if (!(ASSET_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Please pick a valid status." };
  }

  const sb = createAdminSupabaseClient();
  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("varnam_assets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status");

  if (error || !updated || updated.length === 0) {
    return {
      ok: false,
      message: "Couldn't update the status — please try again.",
    };
  }

  revalidatePath(ASSETS_PATH);
  return { ok: true, message: "Status updated." };
}

// ── Edit ────────────────────────────────────────────────────────────────────
export type AssetUpdateFields = {
  title?: string;
  kind?: string;
  url?: string; // "" clears the link
  eventId?: string; // "" detaches from the event
  notes?: string; // "" clears the notes
};

export async function updateAsset(
  id: string,
  fields: AssetUpdateFields
): Promise<AssetActionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test((id ?? "").trim())) {
    return { ok: false, message: "Something went wrong — missing asset." };
  }

  const patch: Record<string, unknown> = {};

  if (fields.title !== undefined) {
    const title = fields.title.trim();
    if (title.length < 2 || title.length > 160) {
      return { ok: false, message: "Title must be between 2 and 160 characters." };
    }
    patch.title = title;
  }

  if (fields.kind !== undefined) {
    if (!(ASSET_KINDS as readonly string[]).includes(fields.kind)) {
      return { ok: false, message: "Please pick a valid asset type." };
    }
    patch.kind = fields.kind;
  }

  if (fields.url !== undefined) {
    const url = fields.url.trim();
    if (url && !HTTPS_RE.test(url)) {
      return {
        ok: false,
        message: "The link must be a full https:// URL (or left blank).",
      };
    }
    patch.url = url || null;
  }

  if (fields.notes !== undefined) {
    patch.notes = fields.notes.trim() || null;
  }

  const sb = createAdminSupabaseClient();

  if (fields.eventId !== undefined) {
    const editionId = await getLiveEditionId(sb);
    if (!editionId) {
      return { ok: false, message: "No live edition found — please try again." };
    }
    const eventRes = await resolveEventId(sb, fields.eventId.trim(), editionId);
    if (!eventRes.ok) return eventRes;
    patch.event_id = eventRes.eventId;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, message: "Nothing to change." };
  }
  patch.updated_at = new Date().toISOString();

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("varnam_assets")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error || !updated || updated.length === 0) {
    return {
      ok: false,
      message: "Couldn't save the changes — please try again.",
    };
  }

  revalidatePath(ASSETS_PATH);
  return { ok: true, message: "Changes saved." };
}

// ── Remove ──────────────────────────────────────────────────────────────────
/** Hard delete — the UI confirms before calling this. */
export async function removeAsset(id: string): Promise<AssetActionState> {
  const denied = await requireManage();
  if (denied) return denied;

  if (!UUID_RE.test((id ?? "").trim())) {
    return { ok: false, message: "Something went wrong — missing asset." };
  }

  const sb = createAdminSupabaseClient();
  const { data: deleted, error } = await sb
    .schema("yi_connect")
    .from("varnam_assets")
    .delete()
    .eq("id", id)
    .select("id");

  if (error || !deleted || deleted.length === 0) {
    return {
      ok: false,
      message: "Couldn't remove the asset — it may already be gone.",
    };
  }

  revalidatePath(ASSETS_PATH);
  return { ok: true, message: "Asset removed." };
}
