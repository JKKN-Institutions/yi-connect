"use server";

/**
 * Command-centre actions for Varnam Vizha — add / toggle / delete the
 * follow-up tasks and milestones that used to live in WhatsApp meeting minutes.
 *
 * Security: EVERY action re-checks getVarnamAccess().canManage server-side
 * (the admin client bypasses RLS, so the action layer IS the permission
 * layer). Denials return an explicit { ok:false, message } — never a silent
 * redirect.
 */
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { getCurrentEdition } from "@/lib/varnam/data/editions";

export type TaskActionState = { ok: boolean; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const TASKS_PATH = "/varnam-vizha/dashboard/tasks";
const OVERVIEW_PATH = "/varnam-vizha/dashboard";

function revalidateTaskViews() {
  revalidatePath(TASKS_PATH);
  revalidatePath(OVERVIEW_PATH);
}

/** Server-side gate: any manage-capable varnam role. Null when allowed. */
async function denyUnlessManager(): Promise<TaskActionState | null> {
  const access = await getVarnamAccess();
  if (!access.canView) return { ok: false, message: access.reason };
  if (!access.canManage) {
    return {
      ok: false,
      message: "Only committee organisers can change the task board.",
    };
  }
  return null;
}

/** Add a follow-up task to the live edition's board. */
export async function addTask(
  _prev: TaskActionState,
  formData: FormData
): Promise<TaskActionState> {
  const denied = await denyUnlessManager();
  if (denied) return denied;

  const title = String(formData.get("title") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const eventId = String(formData.get("event_id") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();

  if (title.length < 3 || title.length > 200) {
    return {
      ok: false,
      message: "Please describe the task in 3–200 characters.",
    };
  }
  if (ownerName.length > 120) {
    return { ok: false, message: "Owner name is too long (max 120 characters)." };
  }
  if (dueDate && !DATE_RE.test(dueDate)) {
    return { ok: false, message: "Please pick a valid due date." };
  }
  if (eventId && !UUID_RE.test(eventId)) {
    return { ok: false, message: "Please pick a valid event." };
  }
  if (details.length > 2000) {
    return { ok: false, message: "Details are too long (max 2000 characters)." };
  }

  const edition = await getCurrentEdition();
  if (!edition) {
    return {
      ok: false,
      message: "No live festival edition found — ask the festival admin.",
    };
  }

  const sb = createAdminSupabaseClient();

  // Only link events that belong to this edition (guards cross-linking).
  if (eventId) {
    const { data: ev, error: evErr } = await sb
      .schema("yi_connect")
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("festival_edition_id", edition.id)
      .maybeSingle();
    if (evErr || !ev) {
      return {
        ok: false,
        message: "That event isn't part of this edition — please pick again.",
      };
    }
  }

  const { data: inserted, error } = await sb
    .schema("yi_connect")
    .from("varnam_tasks")
    .insert({
      edition_id: edition.id,
      event_id: eventId || null,
      kind: "task",
      title,
      details: details || null,
      owner_name: ownerName || null,
      due_date: dueDate || null,
      status: "open",
    })
    .select("id");
  if (error || !inserted || inserted.length === 0) {
    return { ok: false, message: "Couldn't add the task — please try again." };
  }

  revalidateTaskViews();
  return { ok: true, message: "Task added to the board." };
}

/** Flip a task/milestone open ↔ done (stamps/clears completed_at). */
export async function toggleTask(taskId: string): Promise<TaskActionState> {
  const denied = await denyUnlessManager();
  if (denied) return denied;

  const id = (taskId ?? "").trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Missing task." };

  const sb = createAdminSupabaseClient();

  const { data: rowRaw, error: loadErr } = await sb
    .schema("yi_connect")
    .from("varnam_tasks")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    return { ok: false, message: "Couldn't load that task — please try again." };
  }
  const row = rowRaw as { id: string; status: string } | null;
  if (!row) return { ok: false, message: "Task not found." };

  const nowDone = row.status !== "done";
  const { data: updated, error: updErr } = await sb
    .schema("yi_connect")
    .from("varnam_tasks")
    .update({
      status: nowDone ? "done" : "open",
      completed_at: nowDone ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (updErr || !updated || updated.length === 0) {
    return { ok: false, message: "Couldn't update the task — please try again." };
  }

  revalidateTaskViews();
  return {
    ok: true,
    message: nowDone ? "Marked done." : "Reopened.",
  };
}

/** Remove a task/milestone from the board (hard delete — it's a checklist row). */
export async function deleteTask(taskId: string): Promise<TaskActionState> {
  const denied = await denyUnlessManager();
  if (denied) return denied;

  const id = (taskId ?? "").trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Missing task." };

  const sb = createAdminSupabaseClient();
  const { data: deleted, error } = await sb
    .schema("yi_connect")
    .from("varnam_tasks")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    return { ok: false, message: "Couldn't delete the task — please try again." };
  }
  if (!deleted || deleted.length === 0) {
    return { ok: false, message: "Task not found — it may already be deleted." };
  }

  revalidateTaskViews();
  return { ok: true, message: "Task deleted." };
}
