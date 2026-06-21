"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import {
  runAllocation,
  type AllocationResult,
  type AllocationParticipant,
} from "@/lib/yip/allocation-engine";
import { planCommitteeAssignment } from "@/lib/yip/committee-assignment";
import { planPartyFill, planFlatPartyFill } from "@/lib/yip/party-formation";

// Gated writes run on the service client AFTER getYipEventAccess() (yip.* tables
// have RLS read-only for `authenticated`; the capability check is the gate).

// ─── Types ─────────────────────────────────────────────────────────

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Run Allocation ────────────────────────────────────────────────

export async function runAllocationAction(
  eventId: string,
  opts?: { assignSides?: boolean; assignRoles?: boolean }
): Promise<ActionResult<AllocationResult>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  // assignSides (default true): when false, party benches are left blank and
  // every participant is a plain MP — students form parties live on the day.
  // assignRoles (default FALSE, interview 2026-06-15): Parliament roles +
  // Ministries (PM, Deputy PM, LoP, Cabinet & Shadow Ministers, Speaker
  // candidates) are OPTIONAL. By default the allocation assigns party benches +
  // constituencies only (committees come from the separate assignCommittees
  // step); the chapter opts IN to auto-assigning the parliamentary roles. The
  // engine still computes a full allocation internally; we strip the
  // role/ministry fields here when assignRoles is off, leaving the engine
  // untouched. Party leaders are assigned separately at Form Parties.
  const assignSides = opts?.assignSides !== false;
  const assignRoles = opts?.assignRoles === true;
  const supabase = await createServiceClient();

  // Fetch event — check lock
  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked, committee_topics, state")
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

  // The event's selected committees drive allocation. committee_topics is the
  // map { committee → topic } the organiser picks on the Committees tab, so its
  // KEYS are the committees to assign students to. (Legacy array form is still
  // accepted.)
  let customCommittees: string[] | undefined;
  if (event.committee_topics) {
    const t = event.committee_topics as unknown;
    if (Array.isArray(t) && t.length > 0) {
      customCommittees = t.map(String);
    } else if (t && typeof t === "object") {
      const keys = Object.keys(t as Record<string, unknown>);
      if (keys.length > 0) customCommittees = keys;
    }
  }

  // Refuse to allocate until committees are picked (2026-06-19). New events
  // start with none selected; previously this silently fell back to all 15,
  // leaving the Committees tab showing none while allocation used the full
  // catalogue. Now the organiser must pick on the Committees tab first.
  if (!customCommittees || customCommittees.length === 0) {
    return {
      success: false,
      error:
        "Pick your committees on the Committees tab before running allocation.",
    };
  }

  // Run pure allocation
  const result = runAllocation({
    participants: allocationInput,
    committees: customCommittees,
    // Exclude the host chapter's own state from the constituency pool
    // (e.g. an Erode/Tamil Nadu event won't hand out TN seats).
    excludeState: (event as { state?: string | null }).state ?? undefined,
  });

  // Named-party fill. Two models:
  //  • Benchless (the default now): the chapter created N parties (Party A..N)
  //    with NO bench on the Parties tab. Split every student EVENLY across them
  //    (school-spread) and leave party_side null — ruling vs opposition is
  //    decided on event day, off-app (the parties negotiate a coalition).
  //  • Benched (legacy): the event's parties already carry ruling/opposition;
  //    keep the old bench-aware fill so existing events are untouched. Only when
  //    assignSides is on (the legacy autoFormParties path).
  const { data: parties, error: partiesError } = await supabase
    .from("parties")
    .select("id, party_number, side")
    .eq("event_id", eventId)
    .order("party_number");
  if (partiesError) {
    return { success: false, error: partiesError.message };
  }
  const partyList = parties ?? [];
  const benched = partyList.some((p) => p.side != null);
  const benchless = partyList.length > 0 && !benched;

  const schoolById = new Map(participants.map((p) => [p.id, p.school_name]));
  const partyByParticipant = new Map<
    string,
    { party_id: string; party_number: number }
  >();

  if (benchless) {
    // Flat, even, school-spread distribution across all benchless parties.
    const fill = planFlatPartyFill(
      participants.map((p) => ({ id: p.id, schoolName: p.school_name })),
      partyList.length
    );
    for (const f of fill) {
      const row = partyList[f.partyIndex];
      if (row) {
        partyByParticipant.set(f.participantId, {
          party_id: row.id,
          party_number: row.party_number,
        });
      }
    }
  } else if (benched && assignSides) {
    const rulingParties = partyList.filter((p) => p.side === "ruling");
    const oppositionParties = partyList.filter((p) => p.side === "opposition");

    // A bench with members but no party can't be allotted — fail BEFORE any
    // write, so the event is never left half-assigned. The organiser adds a
    // party on that bench (Parties tab) and re-runs.
    const hasRuling = result.assignments.some((a) => a.party_side === "ruling");
    const hasOpposition = result.assignments.some(
      (a) => a.party_side === "opposition"
    );
    if (hasRuling && rulingParties.length === 0) {
      return {
        success: false,
        error:
          "Students were assigned to the Ruling bench but there is no Ruling party. Add at least one Ruling party on the Parties tab, then re-run allocation.",
      };
    }
    if (hasOpposition && oppositionParties.length === 0) {
      return {
        success: false,
        error:
          "Students were assigned to the Opposition bench but there is no Opposition party. Add at least one Opposition party on the Parties tab, then re-run allocation.",
      };
    }

    const fill = planPartyFill(
      result.assignments.map((a) => ({
        id: a.participantId,
        partySide: a.party_side as "ruling" | "opposition",
        schoolName: schoolById.get(a.participantId) ?? null,
      })),
      rulingParties.length,
      oppositionParties.length
    );
    for (const f of fill) {
      const row =
        f.side === "ruling"
          ? rulingParties[f.benchIndex]
          : oppositionParties[f.benchIndex];
      if (row) {
        partyByParticipant.set(f.participantId, {
          party_id: row.id,
          party_number: row.party_number,
        });
      }
    }
  }

  // Write results back to database — batch update each participant
  const errors: string[] = [];
  // Platform constituency (seat) number — standardised to start at 101 and run
  // 101, 102, 103… in allocation order. Not an official Lok Sabha number; just a
  // unique per-event seat id, matching the manual-upload "Constituency Number".
  let seatNumber = 101;
  for (const assignment of result.assignments) {
    const { error: updateError } = await supabase
      .from("participants")
      .update({
        // Bench (ruling/opposition) is written ONLY for legacy benched events.
        // Benchless events (the default) and no-party events leave it null —
        // ruling/opposition is decided on event day, off-app.
        party_side: (benched && assignSides ? assignment.party_side : null) as
          | "ruling"
          | "opposition"
          | null,
        parliament_role: (benched && assignSides && assignRoles
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
        ministry: (benched && assignSides && assignRoles
          ? assignment.ministry
          : null) as
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
        constituency_number: seatNumber++,
        committee_name: assignment.committee_name,
        // Named party: set it when this student was distributed into a party
        // (benchless flat-fill, or legacy bench fill); otherwise clear it so a
        // stale party link can't survive a re-run.
        ...(partyByParticipant.has(assignment.participantId)
          ? {
              party_id: partyByParticipant.get(assignment.participantId)!
                .party_id,
              party_number: partyByParticipant.get(assignment.participantId)!
                .party_number,
            }
          : { party_id: null, party_number: null }),
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

  // Benchless flow: now that every student sits in a party, balance committees
  // across parties (mixed committees, handbook model) — this also sets
  // committee_number. Best-effort: a committee hiccup must not undo a good
  // allocation (matches Form Parties' behaviour).
  if (benchless) {
    await assignCommittees(eventId);
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  return { success: true, data: result };
}

// ─── Assign Committees (mixed cross-party, party-balanced) ─────────
// Handbook model (p.19): all students are grouped across parties into mixed
// committees for bill drafting, EXCEPT the Speaker Panel (Speaker + Deputy
// Speakers) who preside. Buckets the eligible students so each committee draws
// evenly from every party. Runs on the CURRENT party membership and does NOT
// touch parties, so it is safe to re-run without reshuffling (2026-06-15).
export type CommitteeAssignmentSummary = {
  committees: Array<{
    name: string;
    members: number;
    partySpread: Record<string, number>;
  }>;
  excluded: number;
};

export async function assignCommittees(
  eventId: string
): Promise<ActionResult<CommitteeAssignmentSummary>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, allocation_locked, committee_topics")
    .eq("id", eventId)
    .single();
  if (!event) return { success: false, error: "Event not found" };
  if (event.allocation_locked) {
    return {
      success: false,
      error: "Allocation is locked. Unlock first to re-assign committees.",
    };
  }

  const { data: participants, error: fetchError } = await supabase
    .from("participants")
    .select("id, party_id, parliament_role, school_name")
    .eq("event_id", eventId);
  if (fetchError) return { success: false, error: fetchError.message };
  if (!participants || participants.length === 0) {
    return { success: false, error: "No participants registered for this event" };
  }

  // Committee names: the event's selected committees (object keys or legacy
  // array form). Refuse when none are picked (2026-06-19) — previously this
  // fell back to the full COMMITTEES catalogue, which silently assigned students
  // to all 15 even though the organiser had selected none. Callers that auto-run
  // this best-effort (formParties) ignore the error, so no committees get
  // assigned until the organiser picks them on the Committees tab.
  let committeeNames: string[] = [];
  const ct = event.committee_topics as unknown;
  if (Array.isArray(ct) && ct.length > 0) {
    committeeNames = ct.map(String);
  } else if (ct && typeof ct === "object") {
    const keys = Object.keys(ct as Record<string, unknown>);
    if (keys.length > 0) committeeNames = keys;
  }
  if (committeeNames.length === 0) {
    return {
      success: false,
      error:
        "Pick your committees on the Committees tab before assigning students to committees.",
    };
  }

  const plan = planCommitteeAssignment(
    participants.map((p) => ({
      id: p.id,
      partyId: p.party_id,
      parliamentRole: p.parliament_role,
      schoolName: p.school_name,
    })),
    committeeNames
  );

  // Batch: one UPDATE per committee, plus one UPDATE clearing every office-holder.
  const byCommittee = new Map<string, { name: string; number: number; ids: string[] }>();
  const cleared: string[] = [];
  for (const a of plan) {
    if (!a.committeeName || a.committeeNumber == null) {
      cleared.push(a.participantId);
      continue;
    }
    const key = `${a.committeeNumber}::${a.committeeName}`;
    if (!byCommittee.has(key)) {
      byCommittee.set(key, { name: a.committeeName, number: a.committeeNumber, ids: [] });
    }
    byCommittee.get(key)!.ids.push(a.participantId);
  }

  const errors: string[] = [];
  for (const { name, number, ids } of byCommittee.values()) {
    if (ids.length === 0) continue;
    const { error } = await supabase
      .from("participants")
      .update({ committee_name: name, committee_number: number })
      .in("id", ids)
      .eq("event_id", eventId);
    if (error) errors.push(error.message);
  }
  if (cleared.length > 0) {
    const { error } = await supabase
      .from("participants")
      .update({ committee_name: null, committee_number: null })
      .in("id", cleared)
      .eq("event_id", eventId);
    if (error) errors.push(error.message);
  }
  if (errors.length > 0) {
    return { success: false, error: `Committee assignment partly failed: ${errors[0]}` };
  }

  // Summary: party spread per committee so the organiser can eyeball balance.
  const partyById = new Map(participants.map((p) => [p.id, p.party_id ?? "—"]));
  const summary = [...byCommittee.values()]
    .sort((a, b) => a.number - b.number)
    .map(({ name, ids }) => {
      const spread: Record<string, number> = {};
      for (const id of ids) {
        const pk = partyById.get(id) ?? "—";
        spread[pk] = (spread[pk] ?? 0) + 1;
      }
      return { name, members: ids.length, partySpread: spread };
    });

  revalidatePath(`/yip/dashboard/events/${eventId}/allocation`);
  revalidatePath(`/yip/dashboard/events/${eventId}/participants`);
  revalidatePath(`/yip/dashboard/events/${eventId}/parties`);
  return { success: true, data: { committees: summary, excluded: cleared.length } };
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

  // Changing the participant's party must also move them to that party's side
  // (ruling/opposition) so the benches and side badges stay consistent.
  if (field === "party_number") {
    const pn = updateData.party_number;
    if (typeof pn === "number") {
      const { data: party } = await supabase
        .from("parties")
        .select("side")
        .eq("event_id", eventId)
        .eq("party_number", pn)
        .maybeSingle();
      updateData.party_side = party?.side ?? null;
    } else {
      updateData.party_side = null;
    }
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
