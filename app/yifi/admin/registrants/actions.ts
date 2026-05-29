"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";

export type ToggleCheckInResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle a registrant's check-in status via the admin RPC, then revalidate the
 * registrants page so the server-rendered table reflects the change.
 */
export async function toggleCheckIn(
  registrantId: string,
  checkedIn: boolean
): Promise<ToggleCheckInResult> {
  const svc = await createServiceClient();
  const { error } = await svc.rpc("yifi_admin_toggle_checkin", {
    p_registrant_id: registrantId,
    p_checked_in: checkedIn,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/yifi/admin/registrants");
  return { ok: true };
}
