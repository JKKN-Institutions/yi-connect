"use server";

import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireVolunteerStation } from "@/lib/yip/auth/volunteer-station";
import {
  getScoreableParticipants,
  type ScoreableParticipant,
} from "@/app/yip/actions/scoring";
import { revalidatePath } from "next/cache";

// Live-session speaker control. Organiser writes gated on canManage + run on
// the service client (yip.* RLS read-only for authenticated). Previously
// getUser()-only with no event gate — any logged-in user could drive any
// event's speaker queue. (2026-05-30 chapter-roles migration.)
type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Get Speaker Queue ────────────────────────────────────────────

export async function getSpeakerQueue(agendaItemId: string) {
  const supabase = await createClient();

  const { data: speakers, error } = await supabase
    .from("agenda_speakers")
    .select(
      `
      *,
      participant:participants(
        id,
        full_name,
        parliament_role,
        party_side,
        constituency_name,
        constituency_state,
        school_name,
        ministry
      )
    `
    )
    .eq("agenda_item_id", agendaItemId)
    .order("speaking_order");

  if (error) return [];
  return speakers ?? [];
}

// ─── Advance Speaker ──────────────────────────────────────────────
// Marks the current speaker as completed, starts the next one

export async function advanceSpeaker(
  agendaItemId: string,
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Get all speakers ordered
  const { data: speakers } = await supabase
    .from("agenda_speakers")
    .select("*")
    .eq("agenda_item_id", agendaItemId)
    .order("speaking_order");

  if (!speakers || speakers.length === 0) {
    return { success: false, error: "No speakers in queue" };
  }

  // Find the current speaking speaker
  const currentIdx = speakers.findIndex((s) => s.status === "speaking");

  if (currentIdx >= 0) {
    // Mark current as completed
    const current = speakers[currentIdx];
    const actualSeconds = current.started_at
      ? Math.round(
          (Date.now() - new Date(current.started_at).getTime()) / 1000
        )
      : null;

    await supabase
      .from("agenda_speakers")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        actual_seconds: actualSeconds,
      })
      .eq("id", current.id);
  }

  // Find next pending speaker
  const searchStart = currentIdx >= 0 ? currentIdx + 1 : 0;
  let nextSpeaker = null;
  for (let i = searchStart; i < speakers.length; i++) {
    if (speakers[i].status === "pending" || speakers[i].status === null) {
      nextSpeaker = speakers[i];
      break;
    }
  }

  if (nextSpeaker) {
    const now = new Date();
    await supabase
      .from("agenda_speakers")
      .update({
        status: "speaking",
        started_at: now.toISOString(),
      })
      .eq("id", nextSpeaker.id);

    // Handbook p.14,15: enforce per-speaker allotted_seconds (default 90s).
    // Auto-start the live timer so projector + /me counts down for THIS speaker.
    const allottedSeconds =
      typeof nextSpeaker.allotted_seconds === "number" && nextSpeaker.allotted_seconds > 0
        ? nextSpeaker.allotted_seconds
        : 90;
    const timerEnd = new Date(now.getTime() + allottedSeconds * 1000).toISOString();

    // Fetch speaker's full name for the timer label
    const { data: speakerParticipant } = await supabase
      .from("participants")
      .select("full_name")
      .eq("id", nextSpeaker.participant_id)
      .single();

    const label = speakerParticipant?.full_name
      ? `${speakerParticipant.full_name} (${allottedSeconds}s)`
      : `Speaker (${allottedSeconds}s)`;

    await supabase
      .from("events")
      .update({
        live_timer_end: timerEnd,
        live_timer_running: true,
        live_timer_label: label,
      })
      .eq("id", eventId);
  } else {
    // No more speakers — stop the timer cleanly
    await supabase
      .from("events")
      .update({
        live_timer_running: false,
        live_timer_end: null,
        live_timer_label: null,
      })
      .eq("id", eventId);
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Skip Speaker ─────────────────────────────────────────────────

export async function skipSpeaker(
  agendaItemId: string,
  speakerId: string,
  eventId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Get the speaker to check if it's the current one
  const { data: speaker } = await supabase
    .from("agenda_speakers")
    .select("status")
    .eq("id", speakerId)
    .single();

  const wasSpeaking = speaker?.status === "speaking";

  await supabase
    .from("agenda_speakers")
    .update({
      status: "skipped",
      ended_at: new Date().toISOString(),
    })
    .eq("id", speakerId);

  // If the skipped speaker was currently speaking, auto-advance
  if (wasSpeaking) {
    return advanceSpeaker(agendaItemId, eventId);
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

// ─── Generate Speaker Queue ───────────────────────────────────────
// Auto-populates speakers from participants for speech items
// e.g., opening speeches — all MPs get a slot

export async function generateSpeakerQueue(
  eventId: string,
  agendaItemId: string,
  allottedSeconds: number = 90
): Promise<ActionResult<{ count: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  // Check if speakers already exist for this item
  const { count: existingCount } = await supabase
    .from("agenda_speakers")
    .select("*", { count: "exact", head: true })
    .eq("agenda_item_id", agendaItemId);

  if (existingCount && existingCount > 0) {
    return {
      success: false,
      error: "Speaker queue already exists for this item",
    };
  }

  // Get all allocated participants for this event (those with roles)
  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side")
    .eq("event_id", eventId)
    .not("parliament_role", "is", null)
    .order("party_side")
    .order("full_name");

  if (!participants || participants.length === 0) {
    return { success: false, error: "No allocated participants found" };
  }

  // Filter to MPs (those who speak in opening speeches)
  // Speaker/Deputy Speaker preside, not speak. But all others speak.
  const speakingRoles = [
    "prime_minister",
    "leader_of_opposition",
    "cabinet_minister",
    "shadow_minister",
    "mp",
  ];

  const speakers = participants.filter(
    (p) => p.parliament_role && speakingRoles.includes(p.parliament_role)
  );

  if (speakers.length === 0) {
    return { success: false, error: "No eligible speakers found" };
  }

  // Interleave ruling and opposition for fair ordering
  const ruling = speakers.filter((p) => p.party_side === "ruling");
  const opposition = speakers.filter((p) => p.party_side === "opposition");

  // Put PM first, then LOO, then interleave rest
  const ordered: typeof speakers = [];
  const pm = ruling.find((p) => p.parliament_role === "prime_minister");
  const loo = opposition.find(
    (p) => p.parliament_role === "leader_of_opposition"
  );

  if (pm) ordered.push(pm);
  if (loo) ordered.push(loo);

  // Remaining speakers interleaved
  const remainingRuling = ruling.filter((p) => p.id !== pm?.id);
  const remainingOpposition = opposition.filter((p) => p.id !== loo?.id);

  const maxLen = Math.max(remainingRuling.length, remainingOpposition.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < remainingRuling.length) ordered.push(remainingRuling[i]);
    if (i < remainingOpposition.length) ordered.push(remainingOpposition[i]);
  }

  // Insert speaker queue entries
  const speakerEntries = ordered.map((p, idx) => ({
    agenda_item_id: agendaItemId,
    participant_id: p.id,
    speaking_order: idx + 1,
    allotted_seconds: allottedSeconds,
    status: "pending",
  }));

  const { error } = await supabase
    .from("agenda_speakers")
    .insert(speakerEntries);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: { count: speakerEntries.length } };
}

// ═══════════════════════════════════════════════════════════════════
// "NOW SPEAKING" VOLUNTEER CONSOLE
// ───────────────────────────────────────────────────────────────────
// Live-debate broadcast: one floor volunteer taps the number of whoever the
// Speaker of the House just recognised, and every jury screen auto-opens that
// participant's scoring form. The jury client already subscribes to
// postgres_changes on agenda_speakers and reloads getCurrentSpeaker() on any
// change (jury-scoring-client.tsx) — so writing this table IS the broadcast;
// no jury-side code is touched.
//
// AUTH — these are gated by requireVolunteerStation(eventId, ["speaker_desk"])
// (lib/yip/auth/volunteer-station.ts), NOT by getYipEventAccess(canManage) and
// NOT by the event-wide requireVolunteerSession. Flipping the live speaker yanks
// EVERY jury screen, so it is an explicitly ASSIGNED role: only the volunteer an
// organiser has placed on the "Now Speaking (Speaker's aide)" station
// (speaker_desk) can drive it. The gate fails CLOSED — a null/unknown station,
// or any other station, is DENIED with a plain-words { success:false } that tells
// the volunteer to ask the organiser for the station on the Volunteers page.
//
// NEVER-TWO-'SPEAKING' — getCurrentSpeaker() reads the sole 'speaking' row with
// .single(); two such rows would error and jurors would lose the banner. Every
// write here completes ALL 'speaking' rows before setting the new one, and a
// partial unique index (migration 20260703090000_yip_agenda_speaker_one_speaking
// .sql: UNIQUE (agenda_item_id) WHERE status='speaking') makes a second
// 'speaking' row physically impossible. Concurrent taps that collide surface as
// 23505 and are retried (complete-again → set-again) so the LAST tap wins.

// Plain-words denial shown to a volunteer who isn't on the speaker_desk station.
const SPEAKER_DESK_DENIED =
  "This tool is for the assigned Now Speaking volunteer. Ask the organiser to assign you the 'Now Speaking' station on the Volunteers page.";

export type NowSpeakingData = {
  /** true only when the event is live AND a current agenda item is set. */
  active: boolean;
  eventStatus: string | null;
  agendaItemId: string | null;
  agendaItemTitle: string | null;
  /** participants.id of whoever is 'speaking' now, or null. */
  currentParticipantId: string | null;
  /** PII-safe scoreable roster (getScoreableParticipants shape), number-sorted. */
  participants: ScoreableParticipant[];
};

/** Read model for the console. Volunteer-gated, poll ~4s. */
export async function getNowSpeakingData(
  eventId: string
): Promise<ActionResult<NowSpeakingData>> {
  const gate = await requireVolunteerStation(
    eventId,
    ["speaker_desk"],
    SPEAKER_DESK_DENIED
  );
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = gate.supabase;

  const { data: event } = await supabase
    .from("events")
    .select("status, current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  const isLive = (event.status ?? "").includes("live");
  const agendaItemId = event.current_agenda_item_id ?? null;

  let agendaItemTitle: string | null = null;
  let currentParticipantId: string | null = null;
  if (agendaItemId) {
    const { data: item } = await supabase
      .from("agenda")
      .select("title")
      .eq("id", agendaItemId)
      .eq("event_id", eventId) // no cross-event leak
      .maybeSingle();
    agendaItemTitle = item?.title ?? null;

    const { data: speakingRows } = await supabase
      .from("agenda_speakers")
      .select("participant_id")
      .eq("agenda_item_id", agendaItemId)
      .eq("status", "speaking");
    currentParticipantId = speakingRows?.[0]?.participant_id ?? null;
  }

  const participants = await getScoreableParticipants(eventId);

  return {
    success: true,
    data: {
      active: isLive && !!agendaItemId,
      eventStatus: event.status ?? null,
      agendaItemId,
      agendaItemTitle,
      currentParticipantId,
      participants,
    },
  };
}

type SpeakerServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Mark EVERY currently-'speaking' row for an agenda item as completed, mirroring
 * advanceSpeaker's bookkeeping (status='completed', ended_at, actual_seconds
 * from started_at). Completing the 'speaking' row is exactly what advanceSpeaker
 * does when it moves on, so this stays compatible with a mid-way planned queue.
 */
async function completeSpeakingRows(
  supabase: SpeakerServiceClient,
  agendaItemId: string
): Promise<void> {
  const { data: rows } = await supabase
    .from("agenda_speakers")
    .select("id, started_at")
    .eq("agenda_item_id", agendaItemId)
    .eq("status", "speaking");

  for (const r of rows ?? []) {
    const actualSeconds = r.started_at
      ? Math.round((Date.now() - new Date(r.started_at).getTime()) / 1000)
      : null;
    await supabase
      .from("agenda_speakers")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        actual_seconds: actualSeconds,
      })
      .eq("id", r.id);
  }
}

/**
 * setLiveSpeaker — the tapped participant becomes the sole live speaker for the
 * current agenda item; every jury screen auto-opens their scoring form.
 */
export async function setLiveSpeaker(
  eventId: string,
  participantId: string
): Promise<ActionResult<{ currentParticipantId: string }>> {
  const gate = await requireVolunteerStation(
    eventId,
    ["speaker_desk"],
    SPEAKER_DESK_DENIED
  );
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = gate.supabase;

  // Resolve the live agenda item — fail closed if the event isn't live or has
  // no current item (the console is inactive in that state).
  const { data: event } = await supabase
    .from("events")
    .select("status, current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };
  if (!(event.status ?? "").includes("live")) {
    return { success: false, error: "The event isn't live right now." };
  }
  const agendaItemId = event.current_agenda_item_id;
  if (!agendaItemId) {
    return { success: false, error: "No agenda item is live right now." };
  }

  // The tapped participant must belong to THIS event (no cross-event broadcast).
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!participant) {
    return { success: false, error: "That participant isn't in this event." };
  }

  // Bounded retry: both the one-'speaking'-per-item partial index and the
  // unique(agenda_item_id, speaking_order) constraint surface as 23505 when two
  // volunteers tap at once. On collision we re-complete + re-set so the LAST tap
  // wins cleanly; human taps settle in a single extra pass.
  for (let attempt = 0; attempt < 4; attempt++) {
    // Double-tap / already-live is a no-op.
    const { data: speaking } = await supabase
      .from("agenda_speakers")
      .select("participant_id")
      .eq("agenda_item_id", agendaItemId)
      .eq("status", "speaking");
    if (
      speaking &&
      speaking.length === 1 &&
      speaking[0].participant_id === participantId
    ) {
      return { success: true, data: { currentParticipantId: participantId } };
    }

    // 1) Complete every currently-'speaking' row FIRST (never two speaking).
    await completeSpeakingRows(supabase, agendaItemId);

    // 2) Reuse this participant's existing row for the item if one exists
    //    (repeat speakers in debate, or a planned-queue row), else insert fresh.
    const { data: mine } = await supabase
      .from("agenda_speakers")
      .select("id")
      .eq("agenda_item_id", agendaItemId)
      .eq("participant_id", participantId)
      .order("speaking_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    let conflict = false;

    if (mine) {
      const { error } = await supabase
        .from("agenda_speakers")
        .update({
          status: "speaking",
          started_at: nowIso,
          ended_at: null,
          actual_seconds: null,
        })
        .eq("id", mine.id);
      if (error) {
        if (error.code === "23505") conflict = true;
        else return { success: false, error: error.message };
      }
    } else {
      const { data: maxRow } = await supabase
        .from("agenda_speakers")
        .select("speaking_order")
        .eq("agenda_item_id", agendaItemId)
        .order("speaking_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxRow?.speaking_order ?? 0) + 1;
      const { error } = await supabase.from("agenda_speakers").insert({
        agenda_item_id: agendaItemId,
        participant_id: participantId,
        status: "speaking",
        started_at: nowIso,
        speaking_order: nextOrder,
      });
      if (error) {
        if (error.code === "23505") conflict = true;
        else return { success: false, error: error.message };
      }
    }

    if (!conflict) {
      revalidatePath(`/yip/dashboard/events/${eventId}/control`);
      return { success: true, data: { currentParticipantId: participantId } };
    }
  }

  return {
    success: false,
    error: "Another volunteer just changed the speaker — try again.",
  };
}

/**
 * clearLiveSpeaker — "the speaker sat down, nobody new yet": complete the
 * current 'speaking' row(s) so the jury banner goes quiet until the next tap.
 */
export async function clearLiveSpeaker(eventId: string): Promise<ActionResult> {
  const gate = await requireVolunteerStation(
    eventId,
    ["speaker_desk"],
    SPEAKER_DESK_DENIED
  );
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = gate.supabase;

  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };
  if (!event.current_agenda_item_id) {
    return { success: true, data: null }; // nothing live to clear
  }

  await completeSpeakingRows(supabase, event.current_agenda_item_id);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}
