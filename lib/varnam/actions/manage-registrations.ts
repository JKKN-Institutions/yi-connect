"use server";

/**
 * Registration OPERATIONS for the Varnam Vizha committee dashboard —
 * event-day check-in (idempotent), undo, and waitlist promotion.
 *
 * Authorization: the sign-up list holds people's contact details, so every
 * action here re-checks the SAME gate as the registrations page (chair,
 * co-chair or admins) — never trust a hidden button. Writes go via the admin
 * client (RLS bypassed), which is exactly why the re-check is mandatory.
 */
import { revalidatePath } from "next/cache";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { getVarnamAccess } from "@/lib/varnam/auth/access";

export type RegOpsState = { ok: boolean; message: string };

const REGISTRATIONS_PATH = "/varnam-vizha/dashboard/registrations";

/** Same PII rule as the registrations page: chair, co-chair or admins only. */
async function denyUnlessRegOps(): Promise<string | null> {
  const access = await getVarnamAccess();
  const allowed =
    access.canAdmin || access.role === "chair" || access.role === "co_chair";
  return allowed
    ? null
    : "Managing registrations is limited to the chair, co-chair and admins.";
}

/**
 * Mark a guest as arrived. IDEMPOTENT: if they're already checked in we
 * return ok WITHOUT re-stamping — never double-count an arrival.
 */
export async function checkIn(rsvpId: string): Promise<RegOpsState> {
  const denied = await denyUnlessRegOps();
  if (denied) return { ok: false, message: denied };
  if (!rsvpId) return { ok: false, message: "Missing registration." };

  const sb = createAdminSupabaseClient();
  const { data: rsvpRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id, checked_in_at")
    .eq("id", rsvpId)
    .maybeSingle();
  const rsvp = rsvpRaw as { id: string; checked_in_at: string | null } | null;
  if (!rsvp) return { ok: false, message: "Registration not found." };
  if (rsvp.checked_in_at) return { ok: true, message: "Already checked in" };

  // Stamp who performed the check-in (the signed-in committee member).
  const userSb = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .update({
      checked_in_at: new Date().toISOString(),
      checked_in_by: user?.id ?? null,
    })
    .eq("id", rsvpId)
    .select("id, checked_in_at")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, message: "Couldn't check in — please try again." };
  }

  revalidatePath(REGISTRATIONS_PATH);
  return { ok: true, message: "Checked in." };
}

/** Reverse a mistaken check-in (clears both the timestamp and the stamper). */
export async function undoCheckIn(rsvpId: string): Promise<RegOpsState> {
  const denied = await denyUnlessRegOps();
  if (denied) return { ok: false, message: denied };
  if (!rsvpId) return { ok: false, message: "Missing registration." };

  const sb = createAdminSupabaseClient();
  const { data: rsvpRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id, checked_in_at")
    .eq("id", rsvpId)
    .maybeSingle();
  const rsvp = rsvpRaw as { id: string; checked_in_at: string | null } | null;
  if (!rsvp) return { ok: false, message: "Registration not found." };
  if (!rsvp.checked_in_at) return { ok: true, message: "Not checked in." };

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .update({ checked_in_at: null, checked_in_by: null })
    .eq("id", rsvpId)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, message: "Couldn't undo the check-in — please try again." };
  }

  revalidatePath(REGISTRATIONS_PATH);
  return { ok: true, message: "Check-in undone." };
}

/**
 * Move a waitlisted guest to confirmed — but ONLY if the event still has a
 * free spot (re-counted server-side at click time, not trusted from the UI).
 */
export async function promoteFromWaitlist(rsvpId: string): Promise<RegOpsState> {
  const denied = await denyUnlessRegOps();
  if (denied) return { ok: false, message: denied };
  if (!rsvpId) return { ok: false, message: "Missing registration." };

  const sb = createAdminSupabaseClient();
  const { data: rsvpRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id, event_id, status")
    .eq("id", rsvpId)
    .maybeSingle();
  const rsvp = rsvpRaw as {
    id: string;
    event_id: string;
    status: string | null;
  } | null;
  if (!rsvp) return { ok: false, message: "Registration not found." };
  if (rsvp.status !== "waitlist") {
    // Idempotent: a second click (or a stale row) must not error or re-write.
    return { ok: true, message: "Already confirmed." };
  }

  const { data: evRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, max_capacity")
    .eq("id", rsvp.event_id)
    .maybeSingle();
  const event = evRaw as { id: string; max_capacity: number | null } | null;
  if (!event) return { ok: false, message: "Event not found." };

  const { count } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", rsvp.event_id)
    .eq("status", "confirmed");
  if (event.max_capacity != null && (count ?? 0) >= event.max_capacity) {
    return { ok: false, message: "Event is still full." };
  }

  const { data: updated, error } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .update({ status: "confirmed" })
    .eq("id", rsvpId)
    .select("id, status")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, message: "Couldn't promote — please try again." };
  }

  revalidatePath(REGISTRATIONS_PATH);
  return { ok: true, message: "Promoted to confirmed." };
}
