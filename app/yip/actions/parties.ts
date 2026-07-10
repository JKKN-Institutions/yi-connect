"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import { planPartyFormation } from "@/lib/yip/party-formation";
import { assignCommittees } from "@/app/yip/actions/allocation";
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
  // null = benchless (ruling/opposition decided on event day, off-app).
  side: PartySide | null;
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

/**
 * Lightweight read for the day-of Government Formation panel (Control panel).
 * Returns each party with its current side and a live member headcount.
 * canView-gated; the actual side change goes through updateParty (canManage).
 */
export async function getGovtFormationParties(eventId: string): Promise<
  {
    id: string;
    party_number: number;
    name: string;
    side: PartySide | null;
    members: number;
  }[]
> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("parties")
    .select("id, party_number, name, side")
    .eq("event_id", eventId)
    .order("party_number");

  if (error || !data) return [];

  return Promise.all(
    data.map(async (p) => {
      const { count } = await supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("party_id", p.id);
      return {
        id: p.id as string,
        party_number: p.party_number as number,
        name: p.name as string,
        side: (p.side ?? null) as PartySide | null,
        members: count ?? 0,
      };
    })
  );
}

export async function createParty(input: {
  event_id: string;
  // Optional: benchless parties (the default now) carry no side; ruling vs
  // opposition is decided on event day, off-app.
  side?: PartySide | null;
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
      side: input.side ?? null,
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

/**
 * Create N benchless parties in one click — "Party A".."Party N", numbered
 * 1..N, no ruling/opposition. The chapter picks the count (default 5) on the
 * Parties tab; allocation then splits students evenly across them and assigns
 * constituencies. Parties can be renamed + given a symbol/manifesto afterward.
 *
 * Refuses (fail closed) when the event already has parties — the chair deletes
 * them first (so an organiser-entered manifesto/symbol is never silently lost,
 * and party numbers can't collide). 2..8 parties, matching the handbook range.
 */
export async function createBenchlessParties(
  eventId: string,
  count: number
): Promise<ActionResult<Party[]>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!Number.isInteger(count) || count < 2 || count > 8) {
    return { success: false, error: "Number of parties must be a whole number between 2 and 8." };
  }
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked")
    .eq("id", eventId)
    .single();
  if (!event) return { success: false, error: "Event not found" };
  if (event.allocation_locked) {
    return { success: false, error: "Unlock allocation first — party changes are locked." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("parties")
    .select("id")
    .eq("event_id", eventId);
  if (existingError) return { success: false, error: existingError.message };
  if (existing && existing.length > 0) {
    return {
      success: false,
      error: `This event already has ${existing.length} part${
        existing.length === 1 ? "y" : "ies"
      } — delete them first to recreate.`,
    };
  }

  const rows = Array.from({ length: count }, (_, i) => ({
    event_id: eventId,
    side: null,
    party_number: i + 1,
    name: `Party ${String.fromCharCode(65 + i)}`, // Party A, B, C…
    manifesto: [],
  }));

  const { data: created, error } = await supabase
    .from("parties")
    .insert(rows)
    .select();
  if (error || !created) {
    return { success: false, error: friendlyDbError(error ?? { message: "Failed to create parties" }) };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/parties`);
  return {
    success: true,
    data: created.map((p) => ({
      ...p,
      manifesto: Array.isArray(p.manifesto) ? p.manifesto : [],
    })) as Party[],
  };
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

// ── Party symbol upload ────────────────────────────────────────────────────
// Organisers may paste a URL OR upload an image file for the party symbol.
// Uploads land in the PUBLIC `event-media` bucket (symbols are shown to every
// student + on the projector — not sensitive), under party-symbols/<eventId>/.
// 2 MB cap (base64 travels inside the server-action POST, well under Vercel's
// ~4.5 MB body limit). canManage-gated. Returns the public URL for the form to
// store in parties.symbol_url.
const PARTY_SYMBOL_BUCKET = "event-media";
const PARTY_SYMBOL_MAX_BYTES = 2 * 1024 * 1024;
const PARTY_SYMBOL_CONTENT_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

export async function uploadPartySymbol(input: {
  eventId: string;
  base64: string;
  contentType: string;
}): Promise<ActionResult<{ url: string }>> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const ext = PARTY_SYMBOL_CONTENT_TYPES.get(input.contentType);
  if (!ext) {
    return { success: false, error: "Use a PNG, JPG, WEBP or SVG image." };
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.base64, "base64");
  } catch {
    return { success: false, error: "Could not read the image." };
  }
  if (buffer.byteLength === 0) {
    return { success: false, error: "The image is empty." };
  }
  if (buffer.byteLength > PARTY_SYMBOL_MAX_BYTES) {
    return { success: false, error: "Image is too large — 2 MB max." };
  }
  const supabase = await createServiceClient();
  const path = `party-symbols/${input.eventId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(PARTY_SYMBOL_BUCKET)
    .upload(path, buffer, { contentType: input.contentType, upsert: false });
  if (upErr) return { success: false, error: upErr.message };
  const { data } = supabase.storage
    .from(PARTY_SYMBOL_BUCKET)
    .getPublicUrl(path);
  if (!data?.publicUrl) {
    return { success: false, error: "Upload saved but no URL came back." };
  }
  return { success: true, data: { url: data.publicUrl } };
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

export type FormPartiesSummary = {
  /** Full created rows (for client state refresh). */
  parties: Party[];
  /** Per-party member counts, in creation order (ruling first). */
  counts: Array<{ name: string; side: PartySide; members: number }>;
  benchSplit: { ruling: number; opposition: number };
  maxSameSchoolPerParty: number;
};

/**
 * Auto-form N parties for an event and distribute every participant across
 * them (school-spread, sizes balanced — see lib/yip/party-formation.ts).
 *
 * Refusals (fail closed):
 *  - caller cannot manage the event;
 *  - partyCount is not an integer in 2..8;
 *  - allocation is locked (lock = no role/party changes);
 *  - the event already has parties — INCLUDING empty ones. We deliberately do
 *    NOT auto-delete empty parties here: deleting records is a chair-only
 *    capability (canDelete) and an "empty" party may already carry an
 *    organiser-entered manifesto/symbol. The organiser is told to delete
 *    existing parties first (chair can, via the Parties tab).
 *  - any participant has no bench (party_side) yet — allocation must run first.
 */
export async function formParties(
  eventId: string,
  partyCount: number,
  // Optional (interview 2026-06-15): also auto-assign a leader for each party
  // (the senior-most member). Off by default — the chapter/students pick leaders.
  assignLeaders = false
): Promise<ActionResult<FormPartiesSummary>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  if (!Number.isInteger(partyCount) || partyCount < 2 || partyCount > 8) {
    return { success: false, error: "Party count must be a whole number between 2 and 8." };
  }

  const supabase = await createServiceClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, allocation_locked")
    .eq("id", eventId)
    .single();
  if (eventError || !event) {
    return { success: false, error: "Event not found" };
  }
  if (event.allocation_locked) {
    return {
      success: false,
      error: "Unlock allocation first — party changes are locked.",
    };
  }

  const { data: existingParties, error: partiesError } = await supabase
    .from("parties")
    .select("id")
    .eq("event_id", eventId);
  if (partiesError) {
    return { success: false, error: partiesError.message };
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, party_side, school_name, class, parliament_role")
    .eq("event_id", eventId)
    .order("full_name");
  if (participantsError) {
    return { success: false, error: participantsError.message };
  }
  if (!participants || participants.length === 0) {
    return { success: false, error: "No participants registered for this event" };
  }

  if (existingParties && existingParties.length > 0) {
    const { count: memberCount } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("party_id", "is", null);
    if ((memberCount ?? 0) > 0) {
      return {
        success: false,
        error: "Parties already formed — delete existing parties first.",
      };
    }
    return {
      success: false,
      error: `This event already has ${existingParties.length} part${
        existingParties.length === 1 ? "y" : "ies"
      } with no members — delete them first, then run Form Parties.`,
    };
  }

  const missingSide = participants.filter((p) => p.party_side == null).length;
  if (missingSide > 0) {
    return {
      success: false,
      error: `${missingSide} participant${missingSide === 1 ? " has" : "s have"} no bench (ruling/opposition) yet — run Allocation first.`,
    };
  }

  const plan = planPartyFormation({
    partyCount,
    participants: participants.map((p) => ({
      id: p.id,
      partySide: p.party_side as "ruling" | "opposition",
      schoolName: p.school_name,
    })),
  });

  // Create the parties: ruling bench numbered first, then opposition.
  // Names follow the existing "Party A".."Party H" convention by number.
  const partyRows: Array<{
    event_id: string;
    side: PartySide;
    party_number: number;
    name: string;
    manifesto: string[];
  }> = [];
  let nextNumber = 1;
  for (let i = 0; i < plan.benchSplit.ruling; i++) {
    partyRows.push({
      event_id: eventId,
      side: "ruling",
      party_number: nextNumber,
      name: `Party ${String.fromCharCode(64 + nextNumber)}`,
      manifesto: [],
    });
    nextNumber += 1;
  }
  for (let i = 0; i < plan.benchSplit.opposition; i++) {
    partyRows.push({
      event_id: eventId,
      side: "opposition",
      party_number: nextNumber,
      name: `Party ${String.fromCharCode(64 + nextNumber)}`,
      manifesto: [],
    });
    nextNumber += 1;
  }

  const { data: created, error: insertError } = await supabase
    .from("parties")
    .insert(partyRows)
    .select();
  if (insertError || !created) {
    return {
      success: false,
      error: friendlyDbError(insertError ?? { message: "Failed to create parties" }),
    };
  }

  // Map (side, benchIndex) → created party. party_number encodes the order:
  // ruling benchIndex i → number i+1; opposition benchIndex j → ruling+j+1.
  const byNumber = new Map(created.map((p) => [p.party_number, p]));
  const partyFor = (side: "ruling" | "opposition", benchIndex: number) =>
    byNumber.get(side === "ruling" ? benchIndex + 1 : plan.benchSplit.ruling + benchIndex + 1);

  // Batch the participant writes: one UPDATE per party (not per student).
  const idsByPartyId = new Map<string, string[]>();
  for (const a of plan.assignments) {
    const party = partyFor(a.side, a.benchIndex);
    if (!party) continue; // unreachable: every planned party was just created
    if (!idsByPartyId.has(party.id)) idsByPartyId.set(party.id, []);
    idsByPartyId.get(party.id)!.push(a.participantId);
  }

  const updateErrors: string[] = [];
  for (const party of created) {
    const ids = idsByPartyId.get(party.id) ?? [];
    if (ids.length === 0) continue; // an empty party (bench smaller than its party count)
    const { error: updateError } = await supabase
      .from("participants")
      .update({
        party_id: party.id,
        party_number: party.party_number,
        party_side: party.side,
      })
      .in("id", ids)
      .eq("event_id", eventId);
    if (updateError) {
      updateErrors.push(`${party.name}: ${updateError.message}`);
    }
  }
  if (updateErrors.length > 0) {
    return {
      success: false,
      error: `Parties were created but some members could not be assigned (${updateErrors.join(
        "; "
      )}). Delete the parties and run Form Parties again.`,
    };
  }

  // Optional: auto-assign a leader for each party = the senior-most (highest
  // class) member. Sets the party's leader pointer; only promotes a plain MP to
  // the party_leader role (never overwrites an existing PM/LoP/minister/speaker).
  if (assignLeaders) {
    const classById = new Map(participants.map((p) => [p.id, p.class ?? 0]));
    const roleById = new Map(participants.map((p) => [p.id, p.parliament_role]));
    for (const party of created) {
      const memberIds = idsByPartyId.get(party.id) ?? [];
      if (memberIds.length === 0) continue;
      const leaderId = memberIds.reduce((best, id) =>
        (classById.get(id) ?? 0) > (classById.get(best) ?? 0) ? id : best
      );
      await supabase
        .from("parties")
        .update({ party_leader_id: leaderId })
        .eq("id", party.id);
      if (roleById.get(leaderId) === "mp") {
        await supabase
          .from("participants")
          .update({ parliament_role: "party_leader" })
          .eq("id", leaderId)
          .eq("event_id", eventId);
      }
    }
  }

  // Parties now exist → assign party-balanced committees (MPs only). Best-effort:
  // a committee-assignment hiccup must not undo a successful party formation.
  await assignCommittees(eventId);

  revalidatePath(`/yip/dashboard/events/${eventId}/parties`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);

  return {
    success: true,
    data: {
      parties: created.map((p) => ({
        ...p,
        manifesto: Array.isArray(p.manifesto) ? p.manifesto : [],
      })) as Party[],
      counts: created.map((p) => ({
        name: p.name,
        side: p.side as PartySide,
        members: (idsByPartyId.get(p.id) ?? []).length,
      })),
      benchSplit: plan.benchSplit,
      maxSameSchoolPerParty: plan.maxSameSchoolPerParty,
    },
  };
}

export async function electPartyLeader(
  partyId: string,
  participantId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();

  // Resolve event + current leader to authorize and to demote cleanly on a swap.
  const { data: party } = await supabase
    .from("parties")
    .select("event_id, party_leader_id")
    .eq("id", partyId)
    .single();
  if (!party) return { success: false, error: "Party not found" };

  const access = await getYipEventAccess(party.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const previousLeaderId = party.party_leader_id as string | null;
  // Re-selecting the same person is a no-op — nothing to change or demote.
  if (previousLeaderId === participantId) {
    return { success: true, data: null };
  }

  // The parties-table write below is keyed only on party id, so validate that
  // the new leader actually belongs to THIS event before mutating — otherwise a
  // foreign participant id would set party_leader_id while the event-scoped role
  // write matches nothing, leaving the two fields divergent.
  const { data: member } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", party.event_id)
    .maybeSingle();
  if (!member) {
    return { success: false, error: "That participant isn't in this event" };
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

  // Promote the new leader (scope to the gated event so a participant from
  // another event can't be mutated via a foreign id).
  await supabase
    .from("participants")
    .update({ parliament_role: "party_leader" })
    .eq("id", participantId)
    .eq("event_id", updated.event_id);

  // Demote the OUTGOING leader back to a plain MP. party_leader carries a
  // position bonus (6 pts in the live config) auto-awarded per role at results
  // time — leaving the old leader flagged party_leader would double-award that
  // role across two people. Guarded to only reset a row still flagged
  // party_leader, so a former leader meanwhile given another role isn't clobbered.
  if (previousLeaderId) {
    await supabase
      .from("participants")
      .update({ parliament_role: "mp" })
      .eq("id", previousLeaderId)
      .eq("event_id", updated.event_id)
      .eq("parliament_role", "party_leader");
  }

  revalidatePath(`/yip/dashboard/events/${updated.event_id}/parties`);
  revalidatePath(`/yip/dashboard/events/${updated.event_id}/participants`);
  return { success: true, data: null };
}
