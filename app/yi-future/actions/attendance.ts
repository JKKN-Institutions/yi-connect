"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

// ─── BULK UPDATE ATTENDANCE ─────────────────────────────────────────
export async function saveAttendance(
  eventId: string,
  attended: Record<string, boolean>
): Promise<ActionResult> {
  const userId = await requireAuth();
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
