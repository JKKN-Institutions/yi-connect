"use server";

/**
 * Server action for the YIP Chapter Round Report — Section 4
 * (Parties & Government).
 *
 * Mirrors app/yip/actions/report-overview.ts:
 *   - "use server" file → exports ONLY async functions (no types/consts; those
 *     live in lib/yip/report/sections/parties-government.ts).
 *   - every write gates with getYipEventAccess(eventId).canManage and returns a
 *     structured { success, error } result (NEVER throws / redirects).
 *   - revalidatePath the report page so the freshly-set value re-renders.
 *
 * Section 4's only fill-in gap is a party SYMBOL. To keep this lightweight (no
 * storage upload), the organiser stores an emoji / short text OR an image URL
 * straight into parties.symbol_url. Pass an empty string to clear it (NULL).
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Save / update a party's symbol (parties.symbol_url) for the report.
 * `symbol` may be an emoji, a short text mark, or an image URL.
 */
export async function saveReportPartySymbol(
  eventId: string,
  partyId: string,
  symbol: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  if (!partyId) {
    return { success: false, error: "Missing party." };
  }

  const trimmed = (symbol ?? "").trim();
  // Guard against an accidental novel; a symbol is an emoji / short mark / URL.
  if (trimmed.length > 512) {
    return { success: false, error: "Symbol is too long." };
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .from("parties")
    .update({ symbol_url: trimmed.length > 0 ? trimmed : null })
    .eq("id", partyId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true };
}
