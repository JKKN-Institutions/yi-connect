"use server";

/**
 * Server action for the YIP Chapter Round Report — Section 1 (Overview).
 *
 * REFERENCE action file for the report sections. Rules every section action
 * file follows:
 *   - This is a "use server" file: it may export ONLY async functions (no
 *     types/consts — those live in lib/yip/report/sections/<kebab>.ts).
 *   - Every write gates with getYipEventAccess(eventId).canManage and returns a
 *     structured { success, error } result (NEVER throws / redirects).
 *   - revalidatePath the report page so the freshly-filled value re-renders.
 *
 * Section 1's only fill-in gap is the parliamentary oath text (oath_text) — the
 * other Section-1 fields (chapter, dates, venue, leadership, team) are all
 * auto-derived and never editable here.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Save / update the parliamentary oath text shown in the report header.
 * Pass an empty string to clear it (stored as NULL).
 */
export async function saveReportOath(
  eventId: string,
  oathText: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const trimmed = (oathText ?? "").trim();
  const svc = await createServiceClient();
  const { error } = await svc
    .from("events")
    .update({ oath_text: trimmed.length > 0 ? trimmed : null })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}
