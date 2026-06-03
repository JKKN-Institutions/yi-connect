"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import {
  runAllocation,
  type AllocationResult,
  type AllocationParticipant,
} from "@/lib/yip/allocation-engine";

// Gated writes run on the service client AFTER getYipEventAccess() (yip.* tables
// have RLS read-only for `authenticated`; the capability check is the gate).

// ─── Types ─────────────────────────────────────────────────────────

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Run Allocation ────────────────────────────────────────────────

export async function runAllocationAction(
  eventId: string,
  opts?: { assignSides?: boolean }
): Promise<ActionResult<AllocationResult>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  // When false, the allocation leaves the political structure blank for the
  // students to form on event day: party_side is cleared and every participant
  // is a plain MP (no PM/LoP/Ministers/Speakers). Only the side-neutral
  // constituency + committee assignments are written. The engine still computes
  // a full allocation internally; we strip the side-dependent fields here so the
  // engine stays untouched. Defaults to true (preserves auto-allocation).
  const assignSides = opts?.assignSides !== false;
  const supabase = await createServiceClient();

  // Fetch event — check lock
  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked, committee_topics")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  if (event.allocation_locked) {
    return { success: false, error: "Allocation is locked. Unlock first to re-run." };
  }

  // Fetch all participants
  const { data: participants, error: fetchError } = await supabase
    .from("participants")
    .select("id, full_name, school_name, class, home_state")
    .eq("event_id", eventId)
    .order("full_name");

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (!participants || participants.length === 0) {
    return { success: false, error: "No participants registered for this event" };
  }

  // Map to AllocationParticipant
  const allocationInput: AllocationParticipant[] = participants.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    school_name: p.school_name,
    class: p.class,
    home_state: p.home_state,
  }));

  // Parse custom committees from event if present
  let customCommittees: string[] | undefined;
  if (event.committee_topics) {
    try {
      const topics = event.committee_topics as unknown;
      if (Array.isArray(topics) && topics.length > 0) {
        customCommittees = topics.map(String);
      }
    } catch {
      // Ignore — fall back to defaults
    }
  }

  // Run pure allocation
  const result = runAllocation({
    participants: allocationInput,
    committees: customCommittees,
  });

  // Write results back to database — batch update each participant
  const errors: string[] = [];
  for (const assignment of result.assignments) {
    const { error: updateError } = await supabase
      .from("participants")
      .update({
        party_side: (assignSides ? assignment.party_side : null) as
          | "ruling"
          | "opposition"
          | null,
        parliament_role: (assignSides
          ? assignment.parliament_role
          : "mp") as
          | "speaker"
          | "deputy_speaker"
          | "prime_minister"
          | "leader_of_opposition"
          | "cabinet_minister"
          | "shadow_minister"
          | "bill_committee"
          | "mp",
        ministry: (assignSides ? assignment.ministry : null) as
          | "home"
          | "finance"
          | "education"
          | "health"
          | "women_child"
          | "disaster_management"
          | "youth_sports"
          | "it_digital"
          | null,
        constituency_name: assignment.constituency_name,
        constituency_state: assignment.constituency_state,
        committee_name: assignment.committee_name,
      })
      .eq("id", assignment.participantId)
      .eq("event_id", eventId);

    if (updateError) {
      errors.push(`Failed to update ${assignment.participantId}: ${updateError.message}`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: `Allocation computed but ${errors.length} updates failed: ${errors[0]}`,
    };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: result };
}

// ─── Lock Allocation ───────────────────────────────────────────────

export async function lockAllocation(
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ allocation_locked: true })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}

// ─── Unlock Allocation ─────────────────────────────────────────────

export async function unlockAllocation(
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("events")
    .update({ allocation_locked: false })
    .eq("id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}

// ─── Update Single Participant Assignment (Manual Override) ────────

export async function updateParticipantAssignment(
  participantId: string,
  eventId: string,
  field:
    | "party_side"
    | "parliament_role"
    | "ministry"
    | "committee_name"
    | "serial_no"
    | "party_number"
    | "committee_number"
    | "constituency_name",
  value: string | null
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  // Check that allocation is NOT locked
  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  if (event.allocation_locked) {
    return { success: false, error: "Allocation is locked. Unlock to make changes." };
  }

  // Build the update object with only the targeted field.
  // Numeric fields are parsed; null allowed to clear.
  const updateData: Record<string, string | number | null> = {};
  if (
    field === "serial_no" ||
    field === "party_number" ||
    field === "committee_number"
  ) {
    if (value === null || value === "") {
      updateData[field] = null;
    } else {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < 1) {
        return { success: false, error: `${field} must be a positive integer` };
      }
      updateData[field] = n;
    }
  } else {
    updateData[field] = value;
  }

  // If changing role away from minister roles, clear ministry
  if (
    field === "parliament_role" &&
    value !== "cabinet_minister" &&
    value !== "shadow_minister"
  ) {
    updateData.ministry = null;
  }

  const { error } = await supabase
    .from("participants")
    .update(updateData)
    .eq("id", participantId)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: null };
}
