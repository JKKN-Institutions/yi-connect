"use server";

// ═══════════════════════════════════════════════════════════════════════
// YIP Committee Bill Repository (national-call ask, 2026-06-12).
//
// Committee members upload supporting documents / drawings (+ a short
// description) for their committee's bill; organisers see everything.
// Participants are MINORS → fail-closed everywhere:
//   * yip.bill_documents: RLS enabled, NO policies, zero anon/authenticated
//     grants — these gated server actions (service role) are the ONLY path.
//   * Storage bucket `yip-bill-documents` is PRIVATE — reads happen via
//     short-lived signed URLs minted here, never public URLs.
//   * Student actions verify the httpOnly yip_session cookie owns the
//     supplied participantId (requireParticipantSession); committee_name is
//     ALWAYS read from the participant row, never trusted from the client.
//   * Organiser actions resolve the doc's event server-side, then gate on
//     getYipEventAccess: canView to list/download, canDelete (CHAIR-ONLY)
//     to remove rows.
//
// Donor patterns: app/youth-academy/actions/submissions.ts (base64 upload,
// mime allowlist, slug paths, upload-then-insert with cleanup) and
// app/yip/actions/questions.ts (ActionResult + session gating).
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const BUCKET = "yip-bill-documents";

// 4 MB raw cap. Vercel's serverless request-body limit is ~4.5 MB — the file
// travels base64-encoded inside a server-action POST, so this cap MUST stay
// under that ceiling (next.config's serverActions bodySizeLimit is 10mb, but
// Vercel's platform limit cuts first). The bucket enforces the same 4 MB.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
// base64 of n bytes is 4 * ceil(n / 3) chars; + 4 chars padding slack.
const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4;

// EXACTLY the bucket's allowed_mime_types — server-side allowlist, the
// client-reported contentType is validated against this Map, never trusted.
const BILL_DOC_CONTENT_TYPES = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["application/vnd.ms-powerpoint", "ppt"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pptx",
  ],
]);

const MAX_DOCS_PER_COMMITTEE = 15;
const MAX_DESCRIPTION_CHARS = 500;
const SIGNED_URL_SECONDS = 600;

// ─── Local storage helpers (service client; callers gate) ──────────────────
// yip-local equivalents of lib/yuva/storage.ts — NOT imported from there
// (different app domain). No upsert: paths embed a fresh UUID, a collision
// means something is wrong and must fail.

async function uploadBase64(
  path: string,
  base64: string,
  contentType: string
): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  const supabase = await createServiceClient();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Could not read the file data." };
  }
  if (buffer.byteLength === 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: "File is too large — 4 MB max." };
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, bytes: buffer.byteLength };
}

async function createSignedUrl(
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Could not sign URL" };
  }
  return { ok: true, url: data.signedUrl };
}

/** Best-effort delete; callers decide whether failure matters. */
async function removeObject(path: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("[yip-bill-documents] storage remove failed:", error.message);
  }
}

// Path-safe slug (donor: youth-academy submissions). Strips anything that
// could traverse or break a storage path; never returns an empty string.
function slugify(value: string, fallback: string, maxLen = 80): string {
  const slug = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/-+$/, "")
    .slice(0, maxLen);
  return slug || fallback;
}

// ─── Shared row shape ───────────────────────────────────────────────────────

export type BillDocumentRow = {
  id: string;
  file_name: string;
  description: string;
  content_type: string;
  file_size_bytes: number;
  created_at: string;
  uploaded_by: string;
  committee_name: string;
  uploader_name: string;
};

type JoinedDocRow = {
  id: string;
  file_name: string;
  description: string;
  content_type: string;
  file_size_bytes: number;
  created_at: string;
  uploaded_by: string;
  committee_name: string;
  uploader: { full_name: string } | null;
};

const DOC_SELECT = `
  id,
  file_name,
  description,
  content_type,
  file_size_bytes,
  created_at,
  uploaded_by,
  committee_name,
  uploader:participants!bill_documents_uploaded_by_fkey(full_name)
`;

function toRow(d: JoinedDocRow): BillDocumentRow {
  return {
    id: d.id,
    file_name: d.file_name,
    description: d.description,
    content_type: d.content_type,
    file_size_bytes: d.file_size_bytes,
    created_at: d.created_at,
    uploaded_by: d.uploaded_by,
    committee_name: d.committee_name,
    uploader_name: d.uploader?.full_name ?? "—",
  };
}

function revalidateDocPaths(eventId: string) {
  revalidatePath("/yip/me/bill");
  revalidatePath(`/yip/dashboard/events/${eventId}/bills`);
}

// ─── Upload (committee member) ──────────────────────────────────────────────

export async function uploadBillDocument(
  eventId: string,
  participantId: string,
  input: {
    fileBase64: string;
    fileName: string;
    contentType: string;
    description: string;
  }
): Promise<ActionResult<{ id: string }>> {
  // Gate: the caller's httpOnly session must own participantId for eventId.
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const supabase = await createServiceClient();

  // The participant row is the source of truth for committee membership —
  // committee_name is NEVER taken from client input.
  const { data: participant } = await supabase
    .from("participants")
    .select("id, committee_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "Participant not found for this event." };
  }
  if (!participant.committee_name) {
    return {
      success: false,
      error:
        "You're not assigned to a committee yet — documents can be uploaded once your committee is assigned.",
    };
  }

  // Validate the payload (server-side; the client pre-check is advisory only).
  if (!input.fileBase64) {
    return { success: false, error: "Choose a file to upload." };
  }
  if (input.fileBase64.length > MAX_BASE64_CHARS) {
    return { success: false, error: "File is too large — 4 MB max." };
  }
  const ext = BILL_DOC_CONTENT_TYPES.get(input.contentType ?? "");
  if (!ext) {
    return {
      success: false,
      error:
        "Unsupported file type — upload a PDF, image (PNG/JPG/WebP/HEIC), Word or PowerPoint file.",
    };
  }
  const description = (input.description ?? "").trim();
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return {
      success: false,
      error: `Description is too long — ${MAX_DESCRIPTION_CHARS} characters max.`,
    };
  }

  // Cap per committee so one committee cannot fill the bucket.
  const { count, error: countError } = await supabase
    .from("bill_documents")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("committee_name", participant.committee_name);
  if (countError) {
    return { success: false, error: "Could not check the document limit. Try again." };
  }
  if ((count ?? 0) >= MAX_DOCS_PER_COMMITTEE) {
    return {
      success: false,
      error: `Your committee already has ${MAX_DOCS_PER_COMMITTEE} documents — delete one before uploading more.`,
    };
  }

  // Slug-sanitise BOTH path segments that derive from user-controlled text
  // (committee name + file name) — no traversal characters can survive.
  const committeeSlug = slugify(participant.committee_name, "committee", 60);
  const baseName = (input.fileName ?? "document").replace(/\.[^.]+$/, "");
  const fileSlug = slugify(baseName, "document");
  const path = `events/${eventId}/${committeeSlug}/${crypto.randomUUID()}-${fileSlug}.${ext}`;

  const uploaded = await uploadBase64(path, input.fileBase64, input.contentType);
  if (!uploaded.ok) return { success: false, error: uploaded.error };

  const fileName = (input.fileName ?? "").trim().slice(0, 255) || `${fileSlug}.${ext}`;
  const { data: inserted, error } = await supabase
    .from("bill_documents")
    .insert({
      event_id: eventId,
      committee_name: participant.committee_name,
      uploaded_by: participantId,
      description,
      file_path: path,
      file_name: fileName,
      content_type: input.contentType,
      file_size_bytes: uploaded.bytes,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Don't strand the uploaded object if the row failed.
    await removeObject(path);
    return {
      success: false,
      error: error?.message ?? "Failed to save the document.",
    };
  }

  revalidateDocPaths(eventId);
  return { success: true, data: { id: inserted.id } };
}

// ─── List own committee's documents (committee member) ──────────────────────

/**
 * Docs for the CALLER'S committee only — never another committee's.
 * Also returns the caller's committee_name so the client can render the
 * "not assigned yet" state without reading participants from the browser
 * (yip.participants is column-revoked for anon/authenticated).
 */
export async function listMyCommitteeBillDocuments(
  eventId: string,
  participantId: string
): Promise<
  ActionResult<{ committeeName: string | null; docs: BillDocumentRow[] }>
> {
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, committee_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "Participant not found for this event." };
  }
  if (!participant.committee_name) {
    return { success: true, data: { committeeName: null, docs: [] } };
  }

  const { data, error } = await supabase
    .from("bill_documents")
    .select(DOC_SELECT)
    .eq("event_id", eventId)
    .eq("committee_name", participant.committee_name)
    .order("created_at", { ascending: false });
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      committeeName: participant.committee_name,
      docs: ((data ?? []) as unknown as JoinedDocRow[]).map(toRow),
    },
  };
}

// ─── Signed download URL (committee member) ─────────────────────────────────

export async function participantBillDocumentUrl(
  docId: string,
  participantId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createServiceClient();
  const { data: doc } = await supabase
    .from("bill_documents")
    .select("id, event_id, committee_name, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { success: false, error: "Document not found." };

  // Gate: session must own participantId AND be scoped to the doc's event.
  const sess = await requireParticipantSession(participantId, doc.event_id);
  if (!sess.ok) return { success: false, error: sess.error };

  // Own committee only — a participant can never sign another committee's file.
  const { data: participant } = await supabase
    .from("participants")
    .select("id, committee_name")
    .eq("id", participantId)
    .eq("event_id", doc.event_id)
    .maybeSingle();
  if (!participant?.committee_name || participant.committee_name !== doc.committee_name) {
    return { success: false, error: "Document not found." };
  }

  const signed = await createSignedUrl(doc.file_path);
  if (!signed.ok) {
    return { success: false, error: "Could not prepare the download. Try again." };
  }
  return { success: true, data: { url: signed.url } };
}

// ─── Self-delete (uploader only) ────────────────────────────────────────────

export async function deleteMyBillDocument(
  docId: string,
  participantId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { data: doc } = await supabase
    .from("bill_documents")
    .select("id, event_id, uploaded_by, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { success: false, error: "Document not found." };

  const sess = await requireParticipantSession(participantId, doc.event_id);
  if (!sess.ok) return { success: false, error: sess.error };

  // Uploader self-delete ONLY — committee mates cannot delete each other's docs.
  if (doc.uploaded_by !== participantId) {
    return { success: false, error: "Only the uploader can delete this document." };
  }

  await removeObject(doc.file_path); // best-effort

  const { error } = await supabase
    .from("bill_documents")
    .delete()
    .eq("id", docId)
    .eq("uploaded_by", participantId); // race guard: ownership re-checked at delete
  if (error) return { success: false, error: error.message };

  revalidateDocPaths(doc.event_id);
  return { success: true, data: null };
}

// ─── List all documents (organiser) ─────────────────────────────────────────

export async function listBillDocuments(
  eventId: string
): Promise<ActionResult<BillDocumentRow[]>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bill_documents")
    .select(DOC_SELECT)
    .eq("event_id", eventId)
    .order("committee_name", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: ((data ?? []) as unknown as JoinedDocRow[]).map(toRow),
  };
}

// ─── Signed download URL (organiser) ────────────────────────────────────────

export async function organiserBillDocumentUrl(
  docId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createServiceClient();
  const { data: doc } = await supabase
    .from("bill_documents")
    .select("id, event_id, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { success: false, error: "Document not found." };

  const access = await getYipEventAccess(doc.event_id);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }

  const signed = await createSignedUrl(doc.file_path);
  if (!signed.ok) {
    return { success: false, error: "Could not prepare the download. Try again." };
  }
  return { success: true, data: { url: signed.url } };
}

// ─── Delete (CHAIR-ONLY) ────────────────────────────────────────────────────

export async function organiserDeleteBillDocument(
  docId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { data: doc } = await supabase
    .from("bill_documents")
    .select("id, event_id, file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { success: false, error: "Document not found." };

  // canDelete is CHAIR-ONLY under the capability model — organisers
  // (canManage) intentionally cannot delete rows.
  const access = await getYipEventAccess(doc.event_id);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can delete documents" };
  }

  await removeObject(doc.file_path); // best-effort

  const { error } = await supabase.from("bill_documents").delete().eq("id", docId);
  if (error) return { success: false, error: error.message };

  revalidateDocPaths(doc.event_id);
  return { success: true, data: null };
}
