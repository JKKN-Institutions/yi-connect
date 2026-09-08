import type { createServiceClient } from "@/lib/yip/supabase/server";

type SpeakerServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * The shared "who is at the mic right now" writer for `yip.agenda_speakers`.
 *
 * Writing that table IS the broadcast to every jury screen: the jury client
 * subscribes to postgres_changes on `agenda_speakers` and reloads
 * getCurrentSpeaker() (which reads the sole `status='speaking'` row) on any
 * change. Two surfaces drive it and must behave identically:
 *
 *   1. the "Now Speaking (Speaker's aide)" volunteer console
 *      (setLiveSpeaker, app/yip/actions/speakers.ts) — a volunteer taps the
 *      number of whoever the Speaker just recognised;
 *   2. the Speaking Floor's Call button (callSpeaker,
 *      app/yip/actions/speaking-floor.ts) — the Speaker or organiser calls the
 *      next member off the fair-turn queue.
 *
 * This lives in lib/ rather than in either action file ON PURPOSE. Both of
 * those files are `"use server"`, so anything exported from them becomes a
 * callable server-action endpoint. Exporting an UNGATED writer from one would
 * let any caller yank every jury screen to a participant of their choosing.
 * Each action keeps its own auth gate and calls in here afterwards.
 *
 * NEVER-TWO-'SPEAKING': getCurrentSpeaker() reads the live row with `.single()`,
 * so two such rows would error and every juror would lose the banner. Every
 * write below completes ALL 'speaking' rows before setting the new one, and a
 * partial unique index (migration 20260703090000_yip_agenda_speaker_one_speaking
 * .sql: UNIQUE (agenda_item_id) WHERE status='speaking') makes a second
 * 'speaking' row physically impossible. Collisions surface as 23505 and are
 * retried (complete-again → set-again) so the LAST caller wins.
 */

/**
 * Mark EVERY currently-'speaking' row for an agenda item as completed, mirroring
 * advanceSpeaker's bookkeeping (status='completed', ended_at, actual_seconds
 * from started_at). Completing the 'speaking' row is exactly what advanceSpeaker
 * does when it moves on, so this stays compatible with a mid-way planned queue.
 *
 * Also the "nobody is speaking now" writer: call it on its own when a member
 * sits down (Spoken / Skip) so the jury banner goes quiet rather than leaving
 * the last speaker pinned on every juror's screen.
 */
export async function completeSpeakingRows(
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
 * Make `participantId` the sole live speaker for `agendaItemId`.
 *
 * Callers MUST have already authorised the request and resolved the live agenda
 * item — this function deliberately performs no auth and no event-membership
 * check of its own.
 *
 * Bounded retry: both the one-'speaking'-per-item partial index and the
 * unique(agenda_item_id, speaking_order) constraint surface as 23505 when two
 * callers act at once. On collision we re-complete + re-set so the LAST caller
 * wins cleanly; human taps settle in a single extra pass.
 */
export async function setLiveSpeakerCore(
  supabase: SpeakerServiceClient,
  agendaItemId: string,
  participantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
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
      return { ok: true };
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
        else return { ok: false, error: error.message };
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
        else return { ok: false, error: error.message };
      }
    }

    if (!conflict) return { ok: true };
  }

  return {
    ok: false,
    error: "Another volunteer just changed the speaker — try again.",
  };
}
