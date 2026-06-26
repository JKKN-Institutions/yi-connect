"use server";

/**
 * Server action for the YIP Chapter Round Report — Section 5/6
 * (Awards & Zero Hour).
 *
 * Mirrors app/yip/actions/report-overview.ts:
 *   - "use server" file → exports ONLY async functions (types/consts live in
 *     lib/yip/report/sections/awards-zero-hour.ts).
 *   - every write gates with getYipEventAccess(eventId).canManage and returns a
 *     structured { success, error } result (NEVER throws / redirects).
 *   - revalidatePath the report page so the saved value re-renders.
 *
 * Section 5/6's only fill-in gap is the Zero Hour summary
 * (events.zero_hour_summary — added by this section's additive migration). The
 * awardees rollup is fully auto-derived from yip.results and is never editable
 * here.
 *
 * NOTE on typing: events.zero_hour_summary is added by the migration but the
 * generated types/yip/database.ts is NOT regenerated in this change, so the
 * update payload is written through a loose-cast client (same loose-shape
 * approach used by app/yip/actions/admin-team.ts) to avoid a typed-column error.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Save / update the Zero Hour summary shown in the report. Pass an empty string
 * to clear it (stored as NULL).
 */
export async function saveZeroHourSummary(
  eventId: string,
  summary: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const trimmed = (summary ?? "").trim();
  const svc = await createServiceClient();

  // Loose-cast for the not-yet-typed column (see file header).
  const svcLoose = svc as unknown as {
    from: (t: string) => {
      update: (v: Record<string, unknown>) => {
        eq: (
          k: string,
          val: unknown
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error } = await svcLoose
    .from("events")
    .update({ zero_hour_summary: trimmed.length > 0 ? trimmed : null })
    .eq("id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}
