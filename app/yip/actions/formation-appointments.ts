"use server";

// Online House Formation — the appointments step (organiser picks, no ballots).
//
// Cabinet & Shadow Ministers delegate to the existing setCabinetPortfolio
// (bench-enforced, multi-ministry aware). Deputy Ministers and the two duty
// officials (Parliamentary Administrator / Journalist) are RUNTIME-string role
// writes: those enum values are added to the live DB by a separate user-run
// RR-catalogue script and are NOT members of the generated ParliamentRole type
// on master — writes cast with `as never`, and a Postgres invalid-enum error is
// surfaced as FORMATION_ENUM_NOT_ENABLED_ERROR, never silently.
//
// Every mutation gates on getYipEventAccess(eventId).canManage; deny =
// structured { success:false, error } — NEVER a redirect.

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  setCabinetPortfolio,
  removeCabinetPortfolio,
} from "@/app/yip/actions/positions";
import {
  FORMATION_APPOINTED_ROLES,
  FORMATION_ENUM_NOT_ENABLED_ERROR,
  isEnumNotEnabledPgError,
} from "@/lib/yip/formation";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const formationPath = (eventId: string) =>
  `/yip/dashboard/events/${eventId}/formation`;

/**
 * Appoint a participant to one of the formation-appointable roles (step 6).
 * cabinet_minister / shadow_minister require a ministry label and delegate to
 * setCabinetPortfolio; the rest write participants.parliament_role directly
 * (bench-checked where the role demands a side).
 */
export async function appointFormationRole(
  eventId: string,
  participantId: string,
  roleKey: string,
  ministryLabel?: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const roleDef = FORMATION_APPOINTED_ROLES.find((r) => r.key === roleKey);
  if (!roleDef) {
    return { success: false, error: "That role is not appointable here." };
  }

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, event_id, party_side, parliament_role")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "Participant not found in this event." };
  }

  // Bench check, fail closed: a side-bound role demands the participant is
  // benched AND on that bench (null/unknown side must DENY).
  if (roleDef.side !== null && participant.party_side !== roleDef.side) {
    return {
      success: false,
      error: `${roleDef.label} must sit on the ${roleDef.side} bench — this participant is ${
        participant.party_side ?? "not benched yet"
      }.`,
    };
  }

  // Cabinet & Shadow go through the existing portfolio machinery (it sets the
  // role AND records the ministry, multi-ministry aware).
  if (roleDef.key === "cabinet_minister" || roleDef.key === "shadow_minister") {
    const ministry = (ministryLabel ?? "").trim();
    if (!ministry) {
      return { success: false, error: `Pick a ministry for the ${roleDef.label}.` };
    }
    const res = await setCabinetPortfolio({
      eventId,
      participantId,
      ministry,
      seat: roleDef.key === "cabinet_minister" ? "cabinet" : "shadow",
    });
    if (!res.success) {
      return { success: false, error: res.error ?? "Failed to set the ministry." };
    }
    revalidatePath(formationPath(eventId));
    return { success: true, data: null };
  }

  // Deputy Minister / officials: direct role write with a RUNTIME string —
  // see the header note on the enum cast.
  const { error } = await supabase
    .from("participants")
    .update({ parliament_role: roleKey } as never)
    .eq("id", participantId)
    .eq("event_id", eventId);
  if (error) {
    if (isEnumNotEnabledPgError(error)) {
      return { success: false, error: FORMATION_ENUM_NOT_ENABLED_ERROR };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(formationPath(eventId));
  return { success: true, data: null };
}

/**
 * Reset a formation appointment back to an ordinary Member: clears every held
 * ministry (cabinet_portfolios), then sets parliament_role to 'mp'.
 */
export async function clearFormationRole(
  eventId: string,
  participantId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, event_id, parliament_role, cabinet_portfolios")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "Participant not found in this event." };
  }

  const held = (
    (participant as { cabinet_portfolios?: string[] | null }).cabinet_portfolios ??
    []
  ).filter((m): m is string => typeof m === "string" && m.length > 0);
  for (const ministry of held) {
    const res = await removeCabinetPortfolio({ eventId, participantId, ministry });
    if (!res.success) {
      return { success: false, error: res.error ?? "Failed to clear a ministry." };
    }
  }

  const { error } = await supabase
    .from("participants")
    .update({ parliament_role: "mp" } as never)
    .eq("id", participantId)
    .eq("event_id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: null };
}
