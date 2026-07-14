"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { revalidatePath } from "next/cache";

/**
 * SPEAKING FLOOR — the raise-to-speak queue (speaking equity).
 *
 * Erode 2026's #1 feedback theme was "I didn't get an equal chance to speak."
 * A student taps "I wish to speak" on their phone → a live queue the Chair works
 * through, AUTO-SORTED so members who have spoken least come first. The projector
 * shows a public fairness meter ("N of M have spoken"). See migration
 * 20260704090000_yip_speaking_floor.sql.
 *
 * AUTH — two gates, never mixed (CLAUDE.md YIP model):
 *   • Student self-service (requestToSpeak / withdraw / getMySpeakingStatus) trusts
 *     the signed `yip_session` participant cookie — the same layer castVote uses,
 *     because yip.* writes go through the service client (RLS-bypassing) so the
 *     server action IS the authorization boundary.
 *   • Chair actions (call / markSpoken / skip / getSpeakingFloor) gate on
 *     getYipEventAccess(eventId).canManage (canView for the read). Fail CLOSED.
 *
 * The fairness signal (turns spoken per member) is DERIVED at read time —
 * completed agenda_speakers (the formal roster / Now-Speaking console) PLUS
 * spoken speaking_requests — never denormalised, so it cannot drift.
 */

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Public shapes (consumed by the three surfaces) ─────────────────

export interface SpeakingFloorEntry {
  requestId: string;
  participantId: string;
  name: string;
  constituencyNumber: number | null;
  partySide: string | null;
  parliamentRole: string | null;
  status: "waiting" | "called";
  requestedAt: string;
  /** Cumulative turns this member has already spoken this event (fairness key). */
  turns: number;
  /** Asking for a 3rd+ turn while some members still have zero — Chair advisory. */
  thirdTurnFlag: boolean;
}

/** One member on the phone-free fairness board (derived from Now-Speaking data). */
export interface SpeakingFloorBoardEntry {
  participantId: string;
  name: string;
  constituencyNumber: number | null;
  partySide: string | null;
  turns: number;
}

export interface SpeakingFloorState {
  hasLiveItem: boolean;
  liveItemTitle: string | null;
  /** Is the optional phone "raise hand" placard turned on for this event? */
  placardEnabled: boolean;
  /** The whole speaking-eligible House, fewest-turns-first — the phone-free
   *  board the Chair scans to call on members who haven't spoken. */
  board: SpeakingFloorBoardEntry[];
  /** Waiting members (phone placard only), fewest-turns then earliest-request. */
  queue: SpeakingFloorEntry[];
  /** The member currently called to the mic, if any (phone placard only). */
  calledEntry: SpeakingFloorEntry | null;
  /** Distinct speaking-eligible members with ≥1 turn. */
  spokenCount: number;
  /** M — speaking-eligible members (the House minus presiding officers). */
  totalParticipants: number;
  waitingCount: number;
}

export interface SpeakingFloorStats {
  hasLiveItem: boolean;
  spokenCount: number;
  totalParticipants: number;
  waitingCount: number;
}

export interface MySpeakingStatus {
  hasLiveItem: boolean;
  liveItemTitle: string | null;
  myStatus: "none" | "waiting" | "called";
  /** 1-based position among waiting members (null unless I'm waiting). */
  position: number | null;
  waitingCount: number;
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Presiding officers preside; they are not part of the "who got to speak from
// the floor" denominator, so they're excluded from the fairness math.
const PRESIDING_ROLES = new Set(["speaker", "deputy_speaker"]);

interface EligibleMember {
  id: string;
  full_name: string;
  constituency_number: number | null;
  party_side: string | null;
  turns: number;
}

// ─── Turn-count derivation (shared) ─────────────────────────────────
// Event-wide turns per member = completed agenda_speakers (formal roster + the
// Now-Speaking console) + spoken speaking_requests (raise-to-speak). This is the
// phone-free fairness signal: even with the placard off, turns come straight
// from the Now-Speaking data already captured for jury scoring. Returns the
// speaking-eligible roster (House minus presiding officers) with each member's
// turn count, plus how many of them have spoken at least once.
async function computeTurnData(
  supabase: ServiceClient,
  eventId: string
): Promise<{
  eligible: EligibleMember[];
  totalEligible: number;
  spokenCount: number;
}> {
  const { data: items } = await supabase
    .from("agenda")
    .select("id")
    .eq("event_id", eventId);
  const itemIds = (items ?? []).map((i) => i.id);

  let formal: { participant_id: string | null }[] = [];
  if (itemIds.length > 0) {
    const { data } = await supabase
      .from("agenda_speakers")
      .select("participant_id")
      .in("agenda_item_id", itemIds)
      .eq("status", "completed");
    formal = data ?? [];
  }

  const { data: spoken } = await supabase
    .from("speaking_requests")
    .select("participant_id")
    .eq("event_id", eventId)
    .eq("status", "spoken");

  const turnCounts = new Map<string, number>();
  for (const r of [...formal, ...(spoken ?? [])]) {
    const pid = r.participant_id;
    if (pid) turnCounts.set(pid, (turnCounts.get(pid) ?? 0) + 1);
  }

  const { data: parts } = await supabase
    .from("participants")
    .select("id, full_name, constituency_number, party_side, parliament_role")
    .eq("event_id", eventId);
  const eligible: EligibleMember[] = (parts ?? [])
    .filter((p) => !p.parliament_role || !PRESIDING_ROLES.has(p.parliament_role))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      constituency_number: p.constituency_number,
      party_side: p.party_side,
      turns: turnCounts.get(p.id) ?? 0,
    }));

  const spokenCount = eligible.filter((p) => p.turns >= 1).length;

  return { eligible, totalEligible: eligible.length, spokenCount };
}

// ═══════════════════════════════════════════════════════════════════
// STUDENT (participant cookie)
// ═══════════════════════════════════════════════════════════════════

/** Raise your hand for the live session. Idempotent — a second tap while already
 *  queued returns the current state, never a duplicate row. */
export async function requestToSpeak(): Promise<
  ActionResult<{ status: "queued" | "already_waiting" | "called" }>
> {
  const sess = await getYipSession();
  if (!sess || sess.type !== "participant") {
    return { success: false, error: "Not signed in as a participant" };
  }
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id, status, speaking_placard_enabled")
    .eq("id", sess.eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  // Phone placard is opt-in per event (off by default). Refuse when off, even
  // though the card is also hidden — the action must not be a bypass.
  if (!event.speaking_placard_enabled) {
    return {
      success: false,
      error: "Phone hand-raise isn't turned on for this event.",
    };
  }

  // The floor is only open during a live session with a current item.
  if (!event.current_agenda_item_id || !(event.status ?? "").includes("live")) {
    return {
      success: false,
      error:
        "The floor isn't open right now — you can raise your hand once a live session is on.",
    };
  }

  // Already have an active placard? Report it (idempotent), don't stack rows.
  const { data: existing } = await supabase
    .from("speaking_requests")
    .select("id, status")
    .eq("event_id", sess.eventId)
    .eq("participant_id", sess.id)
    .in("status", ["waiting", "called"])
    .maybeSingle();
  if (existing) {
    return {
      success: true,
      data: { status: existing.status === "called" ? "called" : "already_waiting" },
    };
  }

  const { error } = await supabase.from("speaking_requests").insert({
    event_id: sess.eventId,
    agenda_item_id: event.current_agenda_item_id,
    participant_id: sess.id,
    status: "waiting",
  });
  if (error) {
    // Partial unique index (event_id, participant_id WHERE status in
    // waiting/called) closes the read-then-insert race on a double tap.
    if (error.code === "23505") {
      return { success: true, data: { status: "already_waiting" } };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: { status: "queued" } };
}

/** Lower your own hand (only your own active request; can't touch anyone else's). */
export async function withdrawSpeakingRequest(): Promise<ActionResult> {
  const sess = await getYipSession();
  if (!sess || sess.type !== "participant") {
    return { success: false, error: "Not signed in as a participant" };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("speaking_requests")
    .update({ status: "withdrawn", resolved_at: new Date().toISOString() })
    .eq("event_id", sess.eventId)
    .eq("participant_id", sess.id)
    .in("status", ["waiting", "called"]);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

/** My own place in the queue — for the phone card. Reads the cookie; never
 *  trusts a client-supplied id. */
export async function getMySpeakingStatus(): Promise<
  ActionResult<MySpeakingStatus>
> {
  const sess = await getYipSession();
  if (!sess || sess.type !== "participant") {
    return { success: false, error: "Not signed in as a participant" };
  }
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", sess.eventId)
    .maybeSingle();
  const currentItemId = event?.current_agenda_item_id ?? null;

  let liveItemTitle: string | null = null;
  if (currentItemId) {
    const { data: item } = await supabase
      .from("agenda")
      .select("title")
      .eq("id", currentItemId)
      .maybeSingle();
    liveItemTitle = item?.title ?? null;
  }

  const { data: active } = await supabase
    .from("speaking_requests")
    .select("id, participant_id, status, requested_at")
    .eq("event_id", sess.eventId)
    .in("status", ["waiting", "called"])
    .order("requested_at", { ascending: true });
  const rows = active ?? [];

  const mine = rows.find((r) => r.participant_id === sess.id) ?? null;
  const waitingRows = rows.filter((r) => r.status === "waiting");
  const myStatus: MySpeakingStatus["myStatus"] = mine
    ? mine.status === "called"
      ? "called"
      : "waiting"
    : "none";
  const position =
    mine && mine.status === "waiting"
      ? waitingRows.findIndex((r) => r.id === mine.id) + 1
      : null;

  return {
    success: true,
    data: {
      hasLiveItem: !!currentItemId,
      liveItemTitle,
      myStatus,
      position,
      waitingCount: waitingRows.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// PROJECTOR (public — aggregate only, no PII)
// ═══════════════════════════════════════════════════════════════════

/** Aggregate fairness numbers for the public big screen. Deliberately ungated
 *  and PII-free (counts only) — the projector runs without a login. */
export async function getSpeakingFloorStats(
  eventId: string
): Promise<ActionResult<SpeakingFloorStats>> {
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();

  const { totalEligible, spokenCount } = await computeTurnData(supabase, eventId);

  const { count: waitingCount } = await supabase
    .from("speaking_requests")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "waiting");

  return {
    success: true,
    data: {
      hasLiveItem: !!event?.current_agenda_item_id,
      spokenCount,
      totalParticipants: totalEligible,
      waitingCount: waitingCount ?? 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// CHAIR (control panel — canView to read, canManage to act)
// ═══════════════════════════════════════════════════════════════════

/** The full live floor for the Chair: the fairness-sorted queue with names +
 *  per-member turn counts + the 3rd-turn flag, plus the House-wide stats. */
export async function getSpeakingFloor(
  eventId: string
): Promise<ActionResult<SpeakingFloorState>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id, speaking_placard_enabled")
    .eq("id", eventId)
    .maybeSingle();
  const currentItemId = event?.current_agenda_item_id ?? null;
  const placardEnabled = event?.speaking_placard_enabled ?? false;

  let liveItemTitle: string | null = null;
  if (currentItemId) {
    const { data: item } = await supabase
      .from("agenda")
      .select("title")
      .eq("id", currentItemId)
      .maybeSingle();
    liveItemTitle = item?.title ?? null;
  }

  // Fairness roster (phone-free) — every eligible member with their turn count.
  const { eligible, totalEligible, spokenCount } = await computeTurnData(
    supabase,
    eventId
  );
  const turnsById = new Map(eligible.map((e) => [e.id, e.turns]));
  const memberById = new Map(eligible.map((e) => [e.id, e]));
  const unspokenExists = spokenCount < totalEligible;

  const board: SpeakingFloorBoardEntry[] = [...eligible]
    .sort(
      (a, b) =>
        a.turns - b.turns ||
        (a.constituency_number ?? Number.MAX_SAFE_INTEGER) -
          (b.constituency_number ?? Number.MAX_SAFE_INTEGER) ||
        a.full_name.localeCompare(b.full_name)
    )
    .map((e) => ({
      participantId: e.id,
      name: e.full_name,
      constituencyNumber: e.constituency_number,
      partySide: e.party_side,
      turns: e.turns,
    }));

  // Phone-placard queue (only meaningful when the placard is on, but always read
  // so a queue left over from a just-disabled placard still resolves cleanly).
  const { data: reqs } = await supabase
    .from("speaking_requests")
    .select("id, participant_id, status, requested_at")
    .eq("event_id", eventId)
    .in("status", ["waiting", "called"])
    .order("requested_at", { ascending: true });
  const requests = reqs ?? [];

  const build = (r: (typeof requests)[number]): SpeakingFloorEntry => {
    const p = memberById.get(r.participant_id);
    const turns = turnsById.get(r.participant_id) ?? 0;
    return {
      requestId: r.id,
      participantId: r.participant_id,
      name: p?.full_name ?? "Member",
      constituencyNumber: p?.constituency_number ?? null,
      partySide: p?.party_side ?? null,
      parliamentRole: null,
      status: r.status === "called" ? "called" : "waiting",
      requestedAt: r.requested_at,
      turns,
      thirdTurnFlag: turns >= 2 && unspokenExists,
    };
  };

  const calledEntry =
    requests.filter((r) => r.status === "called").map(build)[0] ?? null;
  const queue = requests
    .filter((r) => r.status === "waiting")
    .map(build)
    .sort(
      (a, b) => a.turns - b.turns || a.requestedAt.localeCompare(b.requestedAt)
    );

  return {
    success: true,
    data: {
      hasLiveItem: !!currentItemId,
      liveItemTitle,
      placardEnabled,
      board,
      queue,
      calledEntry,
      spokenCount,
      totalParticipants: totalEligible,
      waitingCount: queue.length,
    },
  };
}

// Resolve the event for a request id and gate the caller on canManage.
async function gateRequest(
  requestId: string
): Promise<
  | { ok: true; supabase: ServiceClient; eventId: string }
  | { ok: false; error: string }
> {
  const supabase = await createServiceClient();
  const { data: req } = await supabase
    .from("speaking_requests")
    .select("event_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { ok: false, error: "Request not found" };
  const access = await getYipEventAccess(req.event_id);
  if (!access.canManage) {
    return { ok: false, error: "Not authorized to manage this event" };
  }
  return { ok: true, supabase, eventId: req.event_id };
}

/** Call a member to the mic. Only one member is 'called' at a time — any other
 *  member currently at the mic is returned to the queue (no turn awarded; the
 *  Chair counts a turn explicitly with markSpoken). */
export async function callSpeaker(requestId: string): Promise<ActionResult> {
  const g = await gateRequest(requestId);
  if (!g.ok) return { success: false, error: g.error };
  const { supabase, eventId } = g;

  await supabase
    .from("speaking_requests")
    .update({ status: "waiting", called_at: null })
    .eq("event_id", eventId)
    .eq("status", "called")
    .neq("id", requestId);

  const { error } = await supabase
    .from("speaking_requests")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["waiting", "called"]);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Record that a member finished speaking — counts as one turn. */
export async function markSpoken(requestId: string): Promise<ActionResult> {
  const g = await gateRequest(requestId);
  if (!g.ok) return { success: false, error: g.error };
  const { supabase, eventId } = g;

  const { error } = await supabase
    .from("speaking_requests")
    .update({ status: "spoken", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["waiting", "called"]);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Dismiss a request without giving a turn (Chair declines the hand). */
export async function skipSpeakingRequest(
  requestId: string
): Promise<ActionResult> {
  const g = await gateRequest(requestId);
  if (!g.ok) return { success: false, error: g.error };
  const { supabase, eventId } = g;

  const { error } = await supabase
    .from("speaking_requests")
    .update({ status: "skipped", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["waiting", "called"]);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Turn the optional phone "raise hand" placard on/off for this event. Off by
 *  default — the fairness board + projector meter work phone-free either way. */
export async function setSpeakingPlacardEnabled(
  eventId: string,
  enabled: boolean
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("events")
    .update({ speaking_placard_enabled: enabled })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  revalidatePath("/yip/me");
  return { success: true, data: null };
}
