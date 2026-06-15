"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// Lightweight display gate: true only for the chapter chair / super-admin, so
// the danger zone is hidden from ordinary organisers (the reset action itself
// re-checks this — this is UX, not the security boundary).
export async function canResetEvent(eventId: string): Promise<boolean> {
  const access = await getYipEventAccess(eventId);
  return access.canDelete;
}

// ─── Reset event for "Go Live" ─────────────────────────────────────
//
// Destructive: wipes all practice/activity data AND the allocation for an
// event, keeping only the imported students + the agenda. Used by a chapter
// chair after rehearsing on the real event, to start day 1 clean.
//
// Defense in depth:
//   1. canDelete gate — chapter chair (chapter_admin) or super-admin ONLY.
//      An ordinary organiser cannot run this.
//   2. Type-the-event-name confirmation (confirmName must match exactly).
//   3. The heavy lifting is an ATOMIC SECURITY DEFINER function
//      (yip.reset_event_for_go_live) so it's all-or-nothing.
//   4. Audit-logged (action_type "wipe") with the per-table delete counts.

export async function resetEventForGoLive(
  eventId: string,
  confirmName: string
): Promise<ActionResult<{ summary: Record<string, number> }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return {
      success: false,
      error:
        "Only the chapter chair or a super-admin can clear an event's practice data.",
    };
  }

  const supabase = await createServiceClient();

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("name")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr || !ev) {
    return { success: false, error: "Event not found." };
  }

  if ((confirmName ?? "").trim() !== (ev.name ?? "").trim()) {
    return {
      success: false,
      error: "The event name didn't match — nothing was deleted.",
    };
  }

  // Call the atomic reset function in the yip schema. The function isn't in the
  // generated public-schema types, so narrow the rpc surface explicitly.
  const { data, error } = await (
    supabase as unknown as {
      schema: (s: string) => {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    }
  )
    .schema("yip")
    .rpc("reset_event_for_go_live", { p_event_id: eventId });

  if (error) {
    return { success: false, error: error.message };
  }

  const summary = (data ?? {}) as Record<string, number>;

  await logAuditAction({
    action_type: "wipe",
    target_table: "events",
    target_id: eventId,
    target_event_id: eventId,
    metadata: { reset: "go_live", summary },
  });

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);

  return { success: true, data: { summary } };
}
