"use server";

/**
 * Yi Youth Academy — national program-template actions (Phase 4).
 * Spec: docs/yi-youth-academy-spec.md → "National — program templates".
 *
 * Convention (repo-wide): gate-first (requireYuvaNational) → service-client
 * write → logYuvaAudit → revalidatePath. ActionResult shape from
 * lib/yuva/action-result.ts. Async-only exports ("use server" rule) — input
 * types are type-only exports (erased at runtime, donor precedent
 * app/yip/actions/admin-rubrics.ts).
 *
 * Template→run rule: program structure changes affect NEW runs only — runs
 * snapshot their session structure at creation, so editing/saving sessions
 * here never mutates live runs. Archive blocks NEW runs only.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import { logYuvaAudit } from "@/lib/yuva/audit";
import { uploadBase64, removeObject } from "@/lib/yuva/storage";
import { PROGRAM_CATEGORIES } from "@/lib/yuva/constants";
import type { ActionResult } from "@/lib/yuva/action-result";

const PROGRAMS_PATH = "/youth-academy/national/programs";

// ─── Input schemas (NOT exported — runtime values stay file-local) ─────────

const programInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.enum(PROGRAM_CATEGORIES),
  objective: z.string().trim().max(2000).optional().default(""),
  summary: z.string().trim().max(4000).optional().default(""),
  takeaways: z
    .array(z.string().trim().min(1).max(300))
    .max(20, "At most 20 takeaways")
    .optional()
    .default([]),
});

const sessionRowSchema = z.object({
  name: z.string().trim().min(1, "Session name is required").max(200),
  duration_minutes: z
    .number()
    .int("Duration must be whole minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(600, "Duration must be 600 minutes or less"),
  learning_objective: z.string().trim().max(1000).optional().default(""),
  description: z.string().trim().max(3000).optional().default(""),
  document_storage_path: z.string().max(500).nullable().optional(),
  expects_submission: z.boolean().optional().default(false),
});

const sessionsInputSchema = z
  .array(sessionRowSchema)
  .max(30, "At most 30 sessions per program");

const uuidSchema = z.string().uuid("Invalid id");

// Allowed session-document content types (course material).
const DOCUMENT_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/zip",
]);

// Allowed syllabus content types → file extension (one syllabus per program).
const SYLLABUS_CONTENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "image/png": "png",
  "image/jpeg": "jpg",
};

// ~6 MB raw file ≈ 8M base64 chars (server-action body limit is 10 MB).
const MAX_BASE64_CHARS = 8_000_000;

// ─── Type-only exports for component consumers ─────────────────────────────

export type ProgramInput = z.input<typeof programInputSchema>;
export type ProgramSessionInput = z.input<typeof sessionRowSchema>;

// ─── Actions ────────────────────────────────────────────────────────────────

/** Create a program template (status starts at `draft`). */
export async function createProgram(
  input: ProgramInput
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = programInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid program details",
    };
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("programs")
    .insert({
      title: parsed.data.title,
      category: parsed.data.category,
      objective: parsed.data.objective || null,
      summary: parsed.data.summary || null,
      takeaways: parsed.data.takeaways,
      created_by: gate.personId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Could not create the program",
    };
  }

  await logYuvaAudit({
    action: "create",
    entity: "programs",
    entity_id: data.id,
    meta: { title: parsed.data.title, category: parsed.data.category },
  });
  revalidatePath(PROGRAMS_PATH);

  return { success: true, data: { id: data.id } };
}

/**
 * Update a program's descriptive fields (title, category, objective,
 * summary, takeaways). Session structure is saved separately via
 * saveProgramSessions. Editing an approved template is allowed — structure
 * changes apply to NEW runs only (runs snapshot at creation).
 */
export async function updateProgram(
  programId: string,
  input: ProgramInput
): Promise<ActionResult<null>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  const parsed = programInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid program details",
    };
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("programs")
    .update({
      title: parsed.data.title,
      category: parsed.data.category,
      objective: parsed.data.objective || null,
      summary: parsed.data.summary || null,
      takeaways: parsed.data.takeaways,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Program not found" };

  await logYuvaAudit({
    action: "update",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { title: parsed.data.title, category: parsed.data.category },
  });
  revalidatePath(PROGRAMS_PATH);
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: null };
}

/**
 * Replace the program's session rows wholesale and recompute total_minutes.
 * Affects NEW runs only — existing runs keep their snapshotted run_sessions.
 */
export async function saveProgramSessions(
  programId: string,
  sessions: ProgramSessionInput[]
): Promise<ActionResult<{ totalMinutes: number }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  const parsed = sessionsInputSchema.safeParse(sessions);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const rowIndex =
      typeof issue?.path?.[0] === "number" ? issue.path[0] + 1 : null;
    return {
      success: false,
      error: rowIndex
        ? `Session ${rowIndex}: ${issue.message}`
        : (issue?.message ?? "Invalid session structure"),
    };
  }

  // A session document must live under THIS program's storage prefix —
  // rejects paths pointed at another program's (or any other) object.
  for (let i = 0; i < parsed.data.length; i++) {
    const docPath = parsed.data[i].document_storage_path;
    if (docPath && !docPath.startsWith(`program/${idParsed.data}/`)) {
      return {
        success: false,
        error: `Session ${i + 1}: document path does not belong to this program`,
      };
    }
  }

  const svc = await createServiceClient();

  const { data: program, error: programError } = await svc
    .from("programs")
    .select("id")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (programError) return { success: false, error: programError.message };
  if (!program) return { success: false, error: "Program not found" };

  // Replace rows: delete-then-insert (template rule — runs already
  // snapshotted their structure, so this never touches a live run).
  const { error: deleteError } = await svc
    .from("program_sessions")
    .delete()
    .eq("program_id", idParsed.data);
  if (deleteError) return { success: false, error: deleteError.message };

  if (parsed.data.length > 0) {
    const { error: insertError } = await svc.from("program_sessions").insert(
      parsed.data.map((s, index) => ({
        program_id: idParsed.data,
        seq: index + 1,
        name: s.name,
        duration_minutes: s.duration_minutes,
        learning_objective: s.learning_objective || null,
        description: s.description || null,
        document_storage_path: s.document_storage_path || null,
        expects_submission: s.expects_submission,
      }))
    );
    if (insertError) return { success: false, error: insertError.message };
  }

  const totalMinutes = parsed.data.reduce(
    (sum, s) => sum + s.duration_minutes,
    0
  );
  const { error: totalError } = await svc
    .from("programs")
    .update({ total_minutes: totalMinutes, updated_at: new Date().toISOString() })
    .eq("id", idParsed.data);
  if (totalError) return { success: false, error: totalError.message };

  await logYuvaAudit({
    action: "save_sessions",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { session_count: parsed.data.length, total_minutes: totalMinutes },
  });
  revalidatePath(PROGRAMS_PATH);
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: { totalMinutes } };
}

/**
 * Upload a per-session course document (base64) to the private
 * `yuva-materials` bucket under the program's `program/{programId}/` prefix.
 * The returned path is persisted on the session row by saveProgramSessions.
 */
export async function uploadSessionDocument(input: {
  programId: string;
  fileName: string;
  contentType: string;
  base64: string;
}): Promise<ActionResult<{ path: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(input.programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  if (!input.base64 || input.base64.length > MAX_BASE64_CHARS) {
    return {
      success: false,
      error: "Document must be a non-empty file of at most 6 MB",
    };
  }
  if (!DOCUMENT_CONTENT_TYPES.has(input.contentType)) {
    return {
      success: false,
      error:
        "Unsupported file type — upload a PDF, Word, PowerPoint, Excel, image (PNG/JPG) or ZIP file",
    };
  }

  const svc = await createServiceClient();
  const { data: program, error: programError } = await svc
    .from("programs")
    .select("id")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (programError) return { success: false, error: programError.message };
  if (!program) return { success: false, error: "Program not found" };

  // Sanitise the file name — storage keys must stay path-safe.
  const safeName =
    (input.fileName ?? "document")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(0, 80) || "document";
  const path = `program/${idParsed.data}/${Date.now()}-${safeName}`;

  const uploaded = await uploadBase64(
    "yuva-materials",
    path,
    input.base64,
    input.contentType
  );
  if (!uploaded.ok) return { success: false, error: uploaded.error };

  await logYuvaAudit({
    action: "upload_session_document",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { path, file_name: safeName, content_type: input.contentType },
  });
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: { path } };
}

/**
 * Attach (or replace) the program's single syllabus document. Uploads the
 * base64 file to the private `yuva-materials` bucket at a STABLE key —
 * `program/{programId}/syllabus.{ext}` — and stores the path on the program.
 * Replacing simply overwrites (upsert + column update); a prior syllabus with
 * a different extension is best-effort removed so a stale object never lingers.
 */
export async function uploadProgramSyllabus(
  programId: string,
  fileBase64: string,
  contentType: string
): Promise<ActionResult<{ path: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  if (!fileBase64 || fileBase64.length > MAX_BASE64_CHARS) {
    return {
      success: false,
      error: "Syllabus must be a non-empty file of at most 6 MB",
    };
  }
  const ext = SYLLABUS_CONTENT_TYPES[contentType];
  if (!ext) {
    return {
      success: false,
      error:
        "Unsupported file type — upload a PDF, Word, PowerPoint or image (PNG/JPG) file",
    };
  }

  const svc = await createServiceClient();
  const { data: program, error: programError } = await svc
    .from("programs")
    .select("id, syllabus_storage_path")
    .eq("id", idParsed.data)
    .maybeSingle<{ id: string; syllabus_storage_path: string | null }>();
  if (programError) return { success: false, error: programError.message };
  if (!program) return { success: false, error: "Program not found" };

  const path = `program/${idParsed.data}/syllabus.${ext}`;

  const uploaded = await uploadBase64(
    "yuva-materials",
    path,
    fileBase64,
    contentType
  );
  if (!uploaded.ok) return { success: false, error: uploaded.error };

  // Column not yet in the generated types (migration 20260611160000) — cast
  // the update payload until the conductor regenerates types.
  const { error: updateError } = await svc
    .from("programs")
    .update({
      syllabus_storage_path: path,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", idParsed.data);
  if (updateError) return { success: false, error: updateError.message };

  // Drop a prior syllabus that used a different extension (stale object).
  const prior = program.syllabus_storage_path;
  if (prior && prior !== path) {
    await removeObject("yuva-materials", prior);
  }

  await logYuvaAudit({
    action: "upload_syllabus",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { path, content_type: contentType },
  });
  revalidatePath(PROGRAMS_PATH);
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: { path } };
}

/**
 * Remove the program's syllabus — clears the column and best-effort deletes
 * the stored object. Idempotent (no-op when none is attached).
 */
export async function removeProgramSyllabus(
  programId: string
): Promise<ActionResult<null>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  const svc = await createServiceClient();
  const { data: program, error: programError } = await svc
    .from("programs")
    .select("id, syllabus_storage_path")
    .eq("id", idParsed.data)
    .maybeSingle<{ id: string; syllabus_storage_path: string | null }>();
  if (programError) return { success: false, error: programError.message };
  if (!program) return { success: false, error: "Program not found" };

  const prior = program.syllabus_storage_path;

  const { error: updateError } = await svc
    .from("programs")
    .update({
      syllabus_storage_path: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", idParsed.data);
  if (updateError) return { success: false, error: updateError.message };

  if (prior) {
    await removeObject("yuva-materials", prior);
  }

  await logYuvaAudit({
    action: "remove_syllabus",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { path: prior },
  });
  revalidatePath(PROGRAMS_PATH);
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: null };
}

/**
 * Approve a program template — makes it instantiable by chapters.
 * BLOCKS approval when the program has zero sessions (spec edge case).
 */
export async function approveProgram(
  programId: string
): Promise<ActionResult<null>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  const svc = await createServiceClient();

  const { data: program, error: programError } = await svc
    .from("programs")
    .select("id, status, title")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (programError) return { success: false, error: programError.message };
  if (!program) return { success: false, error: "Program not found" };
  if (program.status === "approved") {
    return { success: false, error: "Program is already approved" };
  }

  const { count, error: countError } = await svc
    .from("program_sessions")
    .select("id", { count: "exact", head: true })
    .eq("program_id", idParsed.data);
  if (countError) return { success: false, error: countError.message };
  if (!count || count === 0) {
    return {
      success: false,
      error:
        "Cannot approve a program with zero sessions — add the session structure first.",
    };
  }

  const { error } = await svc
    .from("programs")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", idParsed.data);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "approve",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { title: program.title, session_count: count },
  });
  revalidatePath(PROGRAMS_PATH);
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: null };
}

/**
 * Archive a program template — blocks NEW runs; existing runs are
 * unaffected (they already snapshotted their session structure).
 */
export async function archiveProgram(
  programId: string
): Promise<ActionResult<null>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const idParsed = uuidSchema.safeParse(programId);
  if (!idParsed.success) return { success: false, error: "Invalid program id" };

  const svc = await createServiceClient();

  const { data: program, error: programError } = await svc
    .from("programs")
    .select("id, status, title")
    .eq("id", idParsed.data)
    .maybeSingle();
  if (programError) return { success: false, error: programError.message };
  if (!program) return { success: false, error: "Program not found" };
  if (program.status === "archived") {
    return { success: false, error: "Program is already archived" };
  }

  const { error } = await svc
    .from("programs")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", idParsed.data);
  if (error) return { success: false, error: error.message };

  await logYuvaAudit({
    action: "archive",
    entity: "programs",
    entity_id: idParsed.data,
    meta: { title: program.title },
  });
  revalidatePath(PROGRAMS_PATH);
  revalidatePath(`${PROGRAMS_PATH}/${idParsed.data}`);

  return { success: true, data: null };
}
