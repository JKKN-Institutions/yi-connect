"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";

export type UpdateMatchResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Persist a curated slot time and table number for a single match.
 *
 * `slotTime` is an ISO-ish "YYYY-MM-DDTHH:mm" string straight from the
 * <input type="datetime-local"> control (or null to clear). Postgres parses
 * it fine when handed to the timestamptz parameter.
 */
export async function updateMatch(
  matchId: string,
  slotTime: string | null,
  tableNumber: number | null
): Promise<UpdateMatchResult> {
  const svc = await createServiceClient();

  const { error } = await svc.rpc("yifi_admin_update_match", {
    p_match_id: matchId,
    p_slot_time: slotTime || null,
    p_table_number: tableNumber,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/yifi/admin/matches");
  return { ok: true };
}
