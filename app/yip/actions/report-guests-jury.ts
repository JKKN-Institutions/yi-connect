"use server";

/**
 * Server action for the YIP Chapter Round Report — Section 2 (Chief Guests &
 * Jury). Mirrors app/yip/actions/report-overview.ts:
 *   - "use server" file: exports ONLY async functions (types live in
 *     lib/yip/report/sections/guests-jury.ts).
 *   - every write gates with getYipEventAccess(eventId).canManage and returns a
 *     structured { success, error } result (NEVER throws / redirects).
 *   - revalidatePath the report page so the freshly-saved value re-renders.
 *
 * Section 2's editable gaps are the Chief Guests list (add / update / remove)
 * and which guest is the Valedictory-session guest (a per-row boolean flag).
 * The jury-per-session roster is auto-derived and never edited here (it is owned
 * by the Jury Sessions screen).
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * yip.event_chief_guests + its new `is_valedictory` column are not in the
 * generated Database types yet (additive migration shipped by this section).
 * Read/write the table through a per-call loose cast — the same escape-hatch
 * idiom the report data getters use for off-types tables. All inputs are
 * validated above the call; the cast only bypasses the missing table type.
 */
function chiefGuestsTable(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): any {
  return (svc as any).from("event_chief_guests");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Add a chief guest to this event. Returns the new guest id. `isValedictory`
 * marks the guest as the valedictory-session guest; `displayOrder` (optional)
 * controls print order — when omitted, the guest is appended last.
 */
export async function addReportChiefGuest(
  eventId: string,
  input: {
    name: string;
    designation?: string | null;
    organization?: string | null;
    isValedictory?: boolean;
    displayOrder?: number | null;
  }
): Promise<ActionResult<{ id: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const name = (input.name ?? "").trim();
  if (name.length < 2) {
    return { success: false, error: "Guest name is required (min 2 characters)." };
  }

  const svc = await createServiceClient();

  // Determine display order: caller-supplied, else append after the current max.
  let displayOrder = input.displayOrder ?? null;
  if (displayOrder == null) {
    const { data: rows } = await chiefGuestsTable(svc)
      .select("display_order")
      .eq("event_id", eventId)
      .order("display_order", { ascending: false })
      .limit(1);
    const maxOrder =
      rows && rows.length > 0 && typeof rows[0].display_order === "number"
        ? (rows[0].display_order as number)
        : -1;
    displayOrder = maxOrder + 1;
  }

  const { data, error } = await chiefGuestsTable(svc)
    .insert({
      event_id: eventId,
      name,
      designation: (input.designation ?? "").trim() || null,
      organization: (input.organization ?? "").trim() || null,
      is_valedictory: input.isValedictory === true,
      display_order: displayOrder,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true, data: { id: String(data.id) } };
}

/**
 * Update an existing chief guest. Only the provided fields are changed; pass a
 * field to overwrite it (empty string clears designation/organization to NULL).
 */
export async function updateReportChiefGuest(
  eventId: string,
  guestId: string,
  input: {
    name?: string;
    designation?: string | null;
    organization?: string | null;
    isValedictory?: boolean;
  }
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) {
      return {
        success: false,
        error: "Guest name is required (min 2 characters).",
      };
    }
    patch.name = name;
  }
  if (input.designation !== undefined) {
    patch.designation = (input.designation ?? "").trim() || null;
  }
  if (input.organization !== undefined) {
    patch.organization = (input.organization ?? "").trim() || null;
  }
  if (input.isValedictory !== undefined) {
    patch.is_valedictory = input.isValedictory === true;
  }

  if (Object.keys(patch).length === 0) {
    return { success: true, data: null };
  }
  patch.updated_at = new Date().toISOString();

  const svc = await createServiceClient();
  const { error } = await chiefGuestsTable(svc)
    .update(patch)
    .eq("id", guestId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true, data: null };
}

/** Toggle whether a guest is the valedictory-session guest. */
export async function setReportGuestValedictory(
  eventId: string,
  guestId: string,
  isValedictory: boolean
): Promise<ActionResult> {
  return updateReportChiefGuest(eventId, guestId, { isValedictory });
}

/** Remove a chief guest from this event. */
export async function removeReportChiefGuest(
  eventId: string,
  guestId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event." };
  }

  const svc = await createServiceClient();
  const { error } = await chiefGuestsTable(svc)
    .delete()
    .eq("id", guestId)
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/report`);
  return { success: true, data: null };
}
