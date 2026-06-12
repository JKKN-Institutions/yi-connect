"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { validateVoteValue } from "@/lib/yip/vote-validate";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Untyped votes access (session_id not in generated types yet) ───
// yip.votes gained `session_id` in migration 20260612100000 but the generated
// DB types are not regenerated alongside (CLI banner corruption). File-local
// narrow accessor — the app/yip/actions/chat.ts pattern; everything else in
// this file stays typed.
type VotesPgError = { code?: string; message: string };
type VotesRaw = Record<string, unknown>;
type VotesTable = {
  select: (cols: string) => VotesTable;
  insert: (row: Record<string, unknown>) => Promise<{ error: VotesPgError | null }>;
  eq: (col: string, val: unknown) => VotesTable;
  maybeSingle: () => Promise<{ data: VotesRaw | null; error: VotesPgError | null }>;
  single: () => Promise<{ data: VotesRaw | null; error: VotesPgError | null }>;
  then: Promise<{ data: VotesRaw[] | null; error: VotesPgError | null }>["then"];
};
function votesTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): VotesTable {
  return (sb as unknown as { from: (t: string) => VotesTable }).from("votes");
}

// ─── Panel shapes ───────────────────────────────────────────────

export interface FloorVolunteerCount {
  volunteerId: string;
  name: string;
  count: number;
}

export interface FloorPendingParticipant {
  participantId: string;
  serialNo: number | null;
  fullName: string;
  constituencyName: string | null;
}

export interface FloorManualEntry {
  voteId: string;
  participantId: string;
  serialNo: number | null;
  fullName: string;
  voteValue: string;
  entryMethod: string;
  recordedBy: string | null;
}

export interface FloorPanel {
  status: string;
  turnout: { cast: number; eligible: number };
  channels: { self: number; kiosk: number; organizer: number };
  volunteers: FloorVolunteerCount[];
  pending: FloorPendingParticipant[];
  manualEntries: FloorManualEntry[];
}

// ─── Internal: load session + gate organiser-control ────────────

type SessionRow = {
  id: string;
  event_id: string;
  agenda_item_id: string;
  vote_type: string;
  status: string | null;
  config: unknown;
};

async function loadGatedSession(
  sessionId: string
): Promise<
  | { ok: true; session: SessionRow; uid: string }
  | { ok: false; error: string }
> {
  const service = await createServiceClient();

  const { data: session } = await service
    .from("vote_sessions")
    .select("id, event_id, agenda_item_id, vote_type, status, config")
    .eq("id", sessionId)
    .single();

  if (!session) return { ok: false, error: "Vote session not found" };

  const access = await getYipEventAccess(session.event_id);
  if (!access.canManage) {
    return { ok: false, error: "Not authorized to manage this event" };
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  return { ok: true, session, uid: user.id };
}

// ─── 1. Floor panel snapshot ────────────────────────────────────

export async function getFloorPanel(
  sessionId: string
): Promise<ActionResult<FloorPanel>> {
  const gated = await loadGatedSession(sessionId);
  if (!gated.ok) return { success: false, error: gated.error };

  const { session } = gated;
  const service = await createServiceClient();

  // Event participants (the eligible roll). Ordered by serial for the roll call.
  const { data: participants } = await service
    .from("participants")
    .select("id, serial_no, full_name, constituency_name")
    .eq("event_id", session.event_id)
    .order("serial_no", { ascending: true, nullsFirst: false });

  const roster = participants ?? [];

  // Votes already cast in THIS session (one row per participant). Session-
  // scoped — never agenda-item-scoped — so a runoff's roll call starts from a
  // clean slate instead of treating every round-1 voter as already done.
  // No legacy NULL-session fallback here: this is a live capture console, not
  // a historical results reader.
  const { data: votes } = await votesTable(service)
    .select(
      "id, participant_id, vote_value, entry_method, recorded_by_volunteer_id, recorded_by_user"
    )
    .eq("session_id", session.id);

  const voteRows = (votes ?? []) as Array<{
    id: string;
    participant_id: string;
    vote_value: string;
    entry_method: string;
    recorded_by_volunteer_id: string | null;
    recorded_by_user: string | null;
  }>;
  const votedIds = new Set(voteRows.map((v) => v.participant_id));

  // Channels: counts grouped by entry_method.
  const channels = { self: 0, kiosk: 0, organizer: 0 };
  for (const v of voteRows) {
    if (v.entry_method === "self") channels.self += 1;
    else if (v.entry_method === "volunteer_kiosk") channels.kiosk += 1;
    else if (v.entry_method === "organizer") channels.organizer += 1;
  }

  // Volunteer names (for kiosk attribution + manual-entry "via").
  const { data: volunteers } = await service
    .from("volunteers")
    .select("id, full_name")
    .eq("event_id", session.event_id);

  const volunteerName = new Map<string, string>(
    (volunteers ?? []).map((vol) => [vol.id, vol.full_name])
  );

  // Volunteer kiosk-capture counts.
  const volunteerCounts = new Map<string, number>();
  for (const v of voteRows) {
    if (v.entry_method === "volunteer_kiosk" && v.recorded_by_volunteer_id) {
      volunteerCounts.set(
        v.recorded_by_volunteer_id,
        (volunteerCounts.get(v.recorded_by_volunteer_id) ?? 0) + 1
      );
    }
  }
  const volunteerSummary: FloorVolunteerCount[] = [...volunteerCounts.entries()]
    .map(([volunteerId, count]) => ({
      volunteerId,
      name: volunteerName.get(volunteerId) ?? "Volunteer",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Pending = roster rows with no vote yet (already serial-ordered).
  const pending: FloorPendingParticipant[] = roster
    .filter((p) => !votedIds.has(p.id))
    .map((p) => ({
      participantId: p.id,
      serialNo: p.serial_no,
      fullName: p.full_name,
      constituencyName: p.constituency_name,
    }));

  // Manual entries = anything not self-cast, joined to roster for serial/name.
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const manualEntries: FloorManualEntry[] = voteRows
    .filter((v) => v.entry_method !== "self")
    .map((v) => {
      const p = rosterById.get(v.participant_id);
      const recordedBy =
        v.entry_method === "volunteer_kiosk" && v.recorded_by_volunteer_id
          ? volunteerName.get(v.recorded_by_volunteer_id) ?? "Volunteer"
          : "Organizer";
      return {
        voteId: v.id,
        participantId: v.participant_id,
        serialNo: p?.serial_no ?? null,
        fullName: p?.full_name ?? "Unknown",
        voteValue: v.vote_value,
        entryMethod: v.entry_method,
        recordedBy,
      };
    })
    .sort((a, b) => (a.serialNo ?? Infinity) - (b.serialNo ?? Infinity));

  return {
    success: true,
    data: {
      status: session.status ?? "unknown",
      turnout: { cast: voteRows.length, eligible: roster.length },
      channels,
      volunteers: volunteerSummary,
      pending,
      manualEntries,
    },
  };
}

// ─── 2. Organizer roll-call entry ───────────────────────────────

export async function castFloorVote(
  sessionId: string,
  participantId: string,
  voteValue: string
): Promise<ActionResult<{ status: "success" | "already_voted" | "closed" }>> {
  const gated = await loadGatedSession(sessionId);
  if (!gated.ok) return { success: false, error: gated.error };

  const { session, uid } = gated;

  if (session.status !== "open") {
    return { success: true, data: { status: "closed" } };
  }

  // Reject junk / non-candidate values before they pollute the tally.
  const valid = validateVoteValue(session, voteValue);
  if (!valid.ok) return { success: false, error: valid.error };

  const service = await createServiceClient();

  // Participant must belong to this event.
  const { data: participant } = await service
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", session.event_id)
    .maybeSingle();

  if (!participant) {
    return { success: false, error: "Participant not found for this event" };
  }

  // Insert-only finality (mirror castVote): a pre-existing row IN THIS SESSION
  // → already_voted. Round-1 votes never block a runoff entry.
  const { data: existingVote } = await votesTable(service)
    .select("id")
    .eq("session_id", session.id)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingVote) {
    return { success: true, data: { status: "already_voted" } };
  }

  const { error } = await votesTable(service).insert({
    event_id: session.event_id,
    agenda_item_id: session.agenda_item_id,
    session_id: session.id,
    participant_id: participantId,
    vote_type: session.vote_type,
    vote_value: voteValue,
    entry_method: "organizer",
    recorded_by_user: uid,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: true, data: { status: "already_voted" } };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: { status: "success" } };
}

// ─── 3. Correct a manual entry (audited) ────────────────────────

export async function correctFloorVote(
  voteId: string,
  newValue: string,
  reason: string
): Promise<ActionResult> {
  const service = await createServiceClient();

  // Load the vote → resolve its session → gate.
  const { data: voteRaw } = await votesTable(service)
    .select("id, vote_value, entry_method, agenda_item_id, event_id, session_id")
    .eq("id", voteId)
    .single();

  if (!voteRaw) return { success: false, error: "Vote not found" };
  const vote = voteRaw as {
    id: string;
    vote_value: string;
    entry_method: string;
    agenda_item_id: string;
    event_id: string;
    session_id: string | null;
  };

  // A student's own cast is inviolable — corrections only for manual entries.
  if (vote.entry_method === "self") {
    return {
      success: false,
      error: "A participant's own vote cannot be corrected",
    };
  }

  // Resolve the session this vote belongs to; correction needs THAT session
  // OPEN (a runoff being open must not unlock corrections of round-1 entries).
  // Legacy NULL-session rows fall back to the latest session on the agenda item.
  const { data: session } = vote.session_id
    ? await service
        .from("vote_sessions")
        .select("id, event_id, status")
        .eq("id", vote.session_id)
        .maybeSingle()
    : await service
        .from("vote_sessions")
        .select("id, event_id, status")
        .eq("agenda_item_id", vote.agenda_item_id)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (!session) return { success: false, error: "Vote session not found" };

  const access = await getYipEventAccess(session.event_id);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  if (session.status !== "open") {
    return {
      success: false,
      error: "Corrections are only allowed while voting is open",
    };
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  // Audit row FIRST, then the value update.
  const { error: auditError } = await service.from("vote_audit").insert({
    vote_id: voteId,
    changed_by: user.id,
    old_value: vote.vote_value,
    new_value: newValue,
    reason: reason.trim() || null,
  });

  if (auditError) return { success: false, error: auditError.message };

  const { error: updateError } = await service
    .from("votes")
    .update({ vote_value: newValue })
    .eq("id", voteId);

  if (updateError) return { success: false, error: updateError.message };

  return { success: true, data: null };
}
