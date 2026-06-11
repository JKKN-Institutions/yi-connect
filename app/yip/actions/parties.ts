"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import type { PartySide } from "@/lib/yip/constants";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Map raw Postgres unique-violations to messages an organizer can act on. */
function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("party_number")) {
      return "That party number is already taken in this event (numbers are shared across both benches). Pick a different number.";
    }
    if (error.message.includes("name")) {
      return "A party with that name already exists in this event.";
    }
  }
  return error.message;
}

export type Party = {
  id: string;
  event_id: string;
  side: PartySide;
  party_number: number;
  name: string;
  symbol_url: string | null;
  manifesto: string[]; // 4-point array per handbook
  tagline: string | null;
  party_leader_id: string | null;
  created_at: string;
};

export async function listParties(eventId: string): Promise<Party[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .eq("event_id", eventId)
    .order("side")
    .order("party_number");

  if (error || !data) return [];
  return data.map((p) => ({
    ...p,
    manifesto: Array.isArray(p.manifesto) ? p.manifesto : [],
  })) as Party[];
}

export async function createParty(input: {
  event_id: string;
  side: PartySide;
  party_number: number;
  name: string;
  symbol_url?: string | null;
  manifesto?: string[];
  tagline?: string | null;
}): Promise<ActionResult<Party>> {
  const access = await getYipEventAccess(input.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("parties")
    .insert({
      event_id: input.event_id,
      side: input.side,
      party_number: input.party_number,
      name: input.name,
      symbol_url: input.symbol_url ?? null,
      manifesto: input.manifesto ?? [],
      tagline: input.tagline ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: friendlyDbError(error) };
  revalidatePath(`/yip/dashboard/events/${input.event_id}/parties`);
  return { success: true, data: data as Party };
}

export async function updateParty(
  id: string,
  input: Partial<Omit<Party, "id" | "created_at" | "event_id">>
): Promise<ActionResult<Party>> {
  const supabase = await createServiceClient();

  // Resolve the party's event to authorize, then gate on canManage.
  const { data: existing } = await supabase
    .from("parties")
    .select("event_id")
    .eq("id", id)
    .single();
  if (!existing) return { success: false, error: "Party not found" };

  const access = await getYipEventAccess(existing.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { data, error } = await supabase
    .from("parties")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: friendlyDbError(error) };

  // Keep the denormalized party_side / party_number on assigned participants
  // in sync when the party moves bench or is renumbered (BUG-401).
  if (data && (input.side !== undefined || input.party_number !== undefined)) {
    const { error: syncError } = await supabase
      .from("participants")
      .update({ party_side: data.side, party_number: data.party_number })
      .eq("party_id", id)
      .eq("event_id", data.event_id);
    if (syncError) {
      return {
        success: false,
        error: `Party was updated but its members could not be moved with it (${syncError.message}). Please retry.`,
      };
    }
    revalidatePath(`/yip/dashboard/events/${data.event_id}/participants`);
  }

  if (data) revalidatePath(`/yip/dashboard/events/${data.event_id}/parties`);
  return { success: true, data: data as Party };
}

export async function deleteParty(id: string, eventId: string): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete) {
    return { success: false, error: "Only the chapter chair can delete parties" };
  }
  const supabase = await createServiceClient();

  const { error } = await supabase.from("parties").delete().eq("id", id).eq("event_id", eventId);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "parties",
    target_id: id,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/parties`);
  return { success: true, data: null };
}

/**
 * Assign participants to a party. Writes party_id + party_number denormalized
 * on each participant row so display/allocation reads don't need a join.
 */
export async function assignParticipantsToParty(
  partyId: string,
  participantIds: string[]
): Promise<ActionResult<{ assigned: number }>> {
  const supabase = await createServiceClient();

  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("id, event_id, party_number, side")
    .eq("id", partyId)
    .single();

  if (partyError || !party) {
    return { success: false, error: partyError?.message ?? "Party not found" };
  }

  const access = await getYipEventAccess(party.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const { error } = await supabase
    .from("participants")
    .update({
      party_id: party.id,
      party_number: party.party_number,
      party_side: party.side,
    })
    .in("id", participantIds)
    // Scope to the gated event so foreign participant ids from another event
    // can't be re-parented into this party (cross-event write).
    .eq("event_id", party.event_id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${party.event_id}/parties`);
  revalidatePath(`/yip/dashboard/events/${party.event_id}/participants`);
  return { success: true, data: { assigned: participantIds.length } };
}

export async function electPartyLeader(
  partyId: string,
  participantId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Resolve event to authorize before mutating.
  const { data: party } = await supabase
    .from("parties")
    .select("event_id")
    .eq("id", partyId)
    .single();
  if (!party) return { success: false, error: "Party not found" };

  const access = await getYipEventAccess(party.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  // Set leader on party
  const { data: updated, error } = await supabase
    .from("parties")
    .update({ party_leader_id: participantId })
    .eq("id", partyId)
    .select("event_id")
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Failed" };
  }

  // Mark the participant's role as party_leader (scope to the gated event so
  // a participant from another event can't be mutated via a foreign id).
  await supabase
    .from("participants")
    .update({ parliament_role: "party_leader" })
    .eq("id", participantId)
    .eq("event_id", updated.event_id);

  revalidatePath(`/yip/dashboard/events/${updated.event_id}/parties`);
  revalidatePath(`/yip/dashboard/events/${updated.event_id}/participants`);
  return { success: true, data: null };
}
