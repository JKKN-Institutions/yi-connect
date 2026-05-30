"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { generateAccessCode } from "@/lib/yip/access-code";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

// Gated writes run on the service client AFTER getYipEventAccess() (yip.* tables
// have RLS read-only for `authenticated`; the capability check is the gate).

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Add Jury ──────────────────────────────────────────────────────

export async function addJury(
  eventId: string,
  name: string,
  email?: string | null
): Promise<ActionResult<{ id: string; access_code: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Jury name is required" };
  }

  // Optional email for frictionless login (Phase 19 / D)
  const normalisedEmail = email ? email.trim().toLowerCase() : null;
  if (
    normalisedEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)
  ) {
    return { success: false, error: "Invalid email address" };
  }

  // Reject duplicate email within the same event
  if (normalisedEmail) {
    const { data: dup } = await supabase
      .from("jury_assignments")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", normalisedEmail)
      .maybeSingle();
    if (dup) {
      return {
        success: false,
        error: "A jury member with this email is already added to this event",
      };
    }
  }

  // Generate unique code
  let accessCode = generateAccessCode();
  let attempts = 0;

  while (attempts < 20) {
    const { data: existing } = await supabase
      .from("jury_assignments")
      .select("id")
      .eq("event_id", eventId)
      .eq("access_code", accessCode)
      .maybeSingle();

    const { data: pExisting } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", eventId)
      .eq("access_code", accessCode)
      .maybeSingle();

    if (!existing && !pExisting) break;

    accessCode = generateAccessCode();
    attempts++;
  }

  if (attempts >= 20) {
    return { success: false, error: "Failed to generate unique code" };
  }

  const { data: jury, error } = await supabase
    .from("jury_assignments")
    .insert({
      event_id: eventId,
      jury_name: name.trim(),
      access_code: accessCode,
      is_active: true,
      email: normalisedEmail,
    })
    .select("id, access_code")
    .single();

  if (error || !jury) {
    return { success: false, error: error?.message ?? "Failed to add jury" };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: { id: jury.id, access_code: jury.access_code } };
}

// ─── Remove Jury ───────────────────────────────────────────────────

export async function removeJury(
  juryId: string,
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can remove jury members" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("jury_assignments")
    .delete()
    .eq("id", juryId)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditAction({
    action_type: "delete",
    target_table: "jury_assignments",
    target_id: juryId,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/jury`);
  return { success: true, data: null };
}

// ─── Get Jury ──────────────────────────────────────────────────────

export async function getJury(eventId: string) {
  // Read gated by canView (the jury page is itself behind getYipEventAccess);
  // service client avoids the RLS read-policy edge for chapter roles.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("jury_assignments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");

  return data ?? [];
}
