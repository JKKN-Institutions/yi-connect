"use server";

import { createClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

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
