"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";

/**
 * Attendance hangs off a phase_event → resolve THAT session's chapter so a
 * chair of chapter A cannot mark attendance on chapter B's session. Fails
 * closed: an unresolvable chapter denies every non-national caller.
 */
async function requirePhaseEventChapterAdmin(
  phaseEventId: string
): Promise<string> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("chapter_id")
    .eq("id", phaseEventId)
    .maybeSingle();
  const access = await requireChapterAdmin(
    (data as { chapter_id: string | null } | null)?.chapter_id ?? null
  );
  return access.userId;
}

// ─── BULK UPDATE ATTENDANCE ─────────────────────────────────────────
export async function saveAttendance(
  eventId: string,
  attended: Record<string, boolean>
): Promise<ActionResult> {
  const userId = await requirePhaseEventChapterAdmin(eventId);
  const svc = await createServiceClient();

  const markedAt = new Date().toISOString();
  const rows = Object.entries(attended).map(([delegate_id, isAttended]) => ({
    phase_event_id: eventId,
    delegate_id,
    attended: isAttended,
    marked_at: markedAt,
    marked_by: userId,
  }));

  if (rows.length === 0) return { ok: true };

  // Upsert: existing rows update, new rows insert
  const { error } = await svc
    .schema("future")
    .from("phase_event_attendance")
    .upsert(rows, { onConflict: "phase_event_id,delegate_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/chapter/journey/${eventId}`);
  return { ok: true, message: "Attendance saved." };
}
