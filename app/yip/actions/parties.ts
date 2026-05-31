"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
import type { PartySide } from "@/lib/yip/constants";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

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

  if (error) return { success: false, error: error.message };
  revalidatePath(`/yip/dashboard/events/${input.event_id}/parties`);
  return { success: true, data: data as Party };
}

export async function updateParty(
  id: string,
  input: Partial<Omit<Party, "id" | "created_at" | "event_id">>
): Promise<ActionResult<Party>> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("parties")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  if (data) revalidatePath(`/yip/dashboard/events/${data.event_id}/parties`);
  return { success: true, data: data as Party };
}

export async function deleteParty(id: string, eventId: string): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Gate: caller must be authenticated and own the event. Auth goes through the
  // cookie-bound client — the service client carries no session, so
  // createServiceClient().auth.getUser() always returns null (would deny owner).
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: event } = await auth
    .from("events")
    .select("created_by")
    .eq("id", eventId)
    .single();
  if (!event || event.created_by !== user.id) {
    return { success: false, error: "Event not found or not authorized" };
  }

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

  const { error } = await supabase
    .from("participants")
    .update({
      party_id: party.id,
      party_number: party.party_number,
      party_side: party.side,
    })
    .in("id", participantIds);

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

  // Mark the participant's role as party_leader
  await supabase
    .from("participants")
    .update({ parliament_role: "party_leader" })
    .eq("id", participantId);

  revalidatePath(`/yip/dashboard/events/${updated.event_id}/parties`);
  revalidatePath(`/yip/dashboard/events/${updated.event_id}/participants`);
  return { success: true, data: null };
}
