"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — session materials actions (Phase 11).
//
// Spec: docs/yi-youth-academy-spec.md → Server Actions Inventory row
// `actions/materials.ts` (donor: app/yi-future/actions/resources.ts).
//
// Exports: uploadMaterial, deleteMaterial, getMaterialSignedUrl — every one
// gated mentor-of-session OR run manager via getMentorSessionAccess.
// The STUDENT signed-URL path is NOT here — enrolled students get their
// materials through Phase 10's actions/student.ts (live enrollment lookup).
//
// Contract: gate-first → service write/storage → logYuvaAudit →
// revalidatePath → ActionResult. Expected failures return
// { success:false, error } — NEVER a throw, NEVER a silent redirect.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { getMentorSessionAccess } from "@/lib/yuva/auth/mentor-access";
import {
  createSignedUrl,
  removeObject,
  uploadBase64,
} from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";

const uuid = z.string().uuid();

// Allowed material content types (same family as the national session
// documents in actions/programs.ts).
const MATERIAL_CONTENT_TYPES = new Map<string, string>([
  ["application/pdf", "pdf"],
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
  ["application/vnd.ms-excel", "xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["application/zip", "zip"],
]);

// ~6 MB raw file ≈ 8M base64 chars (server-action body limit is 10 MB).
const MAX_BASE64_CHARS = 8_000_000;

const uploadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the material a title.")
    .max(160, "Title is too long (160 characters max)."),
  base64: z.string().min(1, "Choose a file to upload."),
  contentType: z.string().min(1),
});

function revalidateMaterialPaths(runId: string, runSessionId: string) {
  revalidatePath(`/youth-academy/mentor/sessions/${runSessionId}`);
  revalidatePath(`/youth-academy/mentor/cohorts/${runId}`);
  revalidatePath(`/youth-academy/chapter/runs/${runId}/cohort`);
  // Students see visible materials on their program page (Phase 10).
  revalidatePath(`/youth-academy/me/program/${runId}`);
}

// ─── uploadMaterial ───────────────────────────────────────────────────────

/**
 * Upload a session material to the private `yuva-materials` bucket at
 * sessions/{runSessionId}/{slug} and insert the yuva.materials row.
 * Gate: assigned mentor OR run manager.
 */
export async function uploadMaterial(
  runSessionId: string,
  input: { title: string; base64: string; contentType: string }
): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(runSessionId).success) {
    return { success: false, error: "Invalid session id." };
  }
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid material.",
    };
  }
  if (parsed.data.base64.length > MAX_BASE64_CHARS) {
    return { success: false, error: "File is too large — 6 MB max." };
  }
  const extension = MATERIAL_CONTENT_TYPES.get(parsed.data.contentType);
  if (!extension) {
    return {
      success: false,
      error:
        "Unsupported file type — upload a PDF, Word, PowerPoint, Excel, image (PNG/JPG) or ZIP file.",
    };
  }

  const gate = await getMentorSessionAccess(runSessionId);
  if (!gate.ok) return { success: false, error: gate.reason };

  const svc = await createServiceClient();
  const { data: session } = await svc
    .from("run_sessions")
    .select("id, run_id, seq, runs ( id, chapter )")
    .eq("id", runSessionId)
    .maybeSingle();
  if (!session || !session.runs) {
    return { success: false, error: "Session not found." };
  }

  // Path-safe slug from the title (storage keys must stay path-safe).
  const slugBase =
    parsed.data.title
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^[-.]+/, "")
      .replace(/-+$/, "")
      .slice(0, 80) || "material";
  const path = `sessions/${runSessionId}/${Date.now()}-${slugBase}.${extension}`;

  const uploaded = await uploadBase64(
    "yuva-materials",
    path,
    parsed.data.base64,
    parsed.data.contentType
  );
  if (!uploaded.ok) return { success: false, error: uploaded.error };

  const { data: material, error } = await svc
    .from("materials")
    .insert({
      run_session_id: runSessionId,
      title: parsed.data.title,
      storage_path: path,
      uploaded_by: gate.personId,
      visible: true,
    })
    .select("id")
    .single();
  if (error || !material) {
    // Best-effort cleanup so a failed insert leaves no orphan object.
    await removeObject("yuva-materials", path);
    return {
      success: false,
      error: error?.message ?? "Could not save the material.",
    };
  }

  await logYuvaAudit({
    action: "upload_material",
    entity: "materials",
    entity_id: material.id,
    chapter: session.runs.chapter,
    actor_person_id: gate.personId,
    meta: {
      run_id: session.run_id,
      run_session_id: runSessionId,
      title: parsed.data.title,
      path,
      content_type: parsed.data.contentType,
      via: gate.via,
    },
  });
  revalidateMaterialPaths(session.run_id, runSessionId);
  return { success: true, data: { id: material.id } };
}

// ─── deleteMaterial ───────────────────────────────────────────────────────

/**
 * Delete a session material (row + storage object). Gate: assigned mentor
 * of the material's session OR run manager. Audit-logged.
 */
export async function deleteMaterial(
  materialId: string
): Promise<ActionResult<null>> {
  if (!uuid.safeParse(materialId).success) {
    return { success: false, error: "Invalid material id." };
  }

  const svc = await createServiceClient();
  const { data: material } = await svc
    .from("materials")
    .select(
      "id, title, storage_path, run_session_id, run_sessions ( id, run_id, runs ( id, chapter ) )"
    )
    .eq("id", materialId)
    .maybeSingle();
  if (!material || !material.run_sessions) {
    return { success: false, error: "Material not found." };
  }

  const gate = await getMentorSessionAccess(material.run_session_id);
  if (!gate.ok) return { success: false, error: gate.reason };

  const { error } = await svc
    .from("materials")
    .delete()
    .eq("id", material.id);
  if (error) return { success: false, error: error.message };

  // Storage removal is best-effort AFTER the row is gone (an orphan object
  // is harmless; a dangling row pointing nowhere is not).
  await removeObject("yuva-materials", material.storage_path);

  await logYuvaAudit({
    action: "delete_material",
    entity: "materials",
    entity_id: material.id,
    chapter: material.run_sessions.runs?.chapter ?? null,
    actor_person_id: gate.personId,
    meta: {
      run_id: material.run_sessions.run_id,
      run_session_id: material.run_session_id,
      title: material.title,
      path: material.storage_path,
      via: gate.via,
    },
  });
  revalidateMaterialPaths(
    material.run_sessions.run_id,
    material.run_session_id
  );
  return { success: true, data: null };
}

// ─── getMaterialSignedUrl (mentor / manager path) ─────────────────────────

/**
 * Short-lived signed URL for a material — MENTOR/MANAGER path only.
 * Students get theirs via Phase 10's actions/student.ts (enrollment-gated);
 * do not widen this gate.
 */
export async function getMaterialSignedUrl(
  materialId: string
): Promise<ActionResult<{ url: string }>> {
  if (!uuid.safeParse(materialId).success) {
    return { success: false, error: "Invalid material id." };
  }

  const svc = await createServiceClient();
  const { data: material } = await svc
    .from("materials")
    .select("id, storage_path, run_session_id")
    .eq("id", materialId)
    .maybeSingle();
  if (!material) return { success: false, error: "Material not found." };

  const gate = await getMentorSessionAccess(material.run_session_id);
  if (!gate.ok) return { success: false, error: gate.reason };

  const signed = await createSignedUrl("yuva-materials", material.storage_path);
  if (!signed.ok) return { success: false, error: signed.error };
  return { success: true, data: { url: signed.url } };
}
