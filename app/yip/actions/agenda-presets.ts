"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";

// Chapter agenda presets (Phase 3). A chapter can save several NAMED agendas and
// reuse them on future events. Decisions: several named presets · chair-only to
// save/delete · FROZEN (a plain snapshot — central template changes never touch a
// saved preset). All ops run through an EVENT for auth context (getYipEventAccess)
// and are scoped to that event's chapter_name, so a chair only ever touches their
// own chapter's presets. yip.agenda_presets is RLS-on with no policies → only the
// service client (after the capability gate) can read/write it.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// One agenda row as stored in a preset snapshot (runtime fields like status /
// actual_* / config are intentionally excluded — apply re-seeds them fresh).
export type PresetItem = {
  day: number;
  sequence_order: number;
  title: string;
  description: string | null;
  agenda_type: string | null;
  duration_minutes: number | null;
  mode: "party" | "committee" | "mixed";
  is_scoreable: boolean;
  session_key: string | null;
};

export type PresetSummary = {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
};

function asPresetItems(raw: unknown): PresetItem[] {
  return Array.isArray(raw) ? (raw as PresetItem[]) : [];
}

/** Presets for the calling event's chapter (canView-gated). */
export async function listPresetsForEvent(
  eventId: string
): Promise<PresetSummary[]> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return [];
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("chapter_name")
    .eq("id", eventId)
    .single();
  if (!event?.chapter_name) return [];

  const { data } = await supabase
    .from("agenda_presets")
    .select("id, name, items, created_at")
    .eq("chapter_name", event.chapter_name)
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    item_count: asPresetItems(p.items).length,
    created_at: p.created_at,
  }));
}

/** Save the event's CURRENT agenda as a named preset for its chapter (chair only). */
export async function savePresetFromEvent(
  eventId: string,
  name: string
): Promise<ActionResult<{ id: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete)
    return {
      success: false,
      error: "Only the chapter chair or a national admin can save a preset.",
    };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Preset name is required." };
  if (trimmed.length > 80)
    return { success: false, error: "Preset name is too long (max 80)." };

  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("chapter_name, yi_chapter_id")
    .eq("id", eventId)
    .single();
  if (!event?.chapter_name)
    return {
      success: false,
      error: "This event has no chapter, so a chapter preset can't be saved.",
    };

  // Snapshot the current agenda (frozen — central changes won't affect it).
  const { data: rows } = await supabase
    .from("agenda")
    .select(
      "day, sequence_order, title, description, agenda_type, duration_minutes, mode, is_scoreable, session_key"
    )
    .eq("event_id", eventId)
    .order("day")
    .order("sequence_order");
  const items = (rows ?? []) as PresetItem[];
  if (items.length === 0)
    return { success: false, error: "This event has no agenda to save." };

  // Who's saving (for the record) — best-effort.
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const { data, error } = await supabase
    .from("agenda_presets")
    .insert({
      chapter_name: event.chapter_name,
      yi_chapter_id: event.yi_chapter_id,
      name: trimmed,
      items,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    // 23505 = unique (chapter_name, name) violation.
    if (error?.code === "23505")
      return {
        success: false,
        error: "A preset with this name already exists for your chapter.",
      };
    return { success: false, error: error?.message ?? "Failed to save preset." };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  return { success: true, data: { id: data.id } };
}

/**
 * Replace the event's agenda with a saved preset (canManage). Refuses on a live
 * event or one that already has scores/votes — applying would wipe the agenda
 * those are tied to. The preset must belong to the event's chapter.
 */
export async function applyPresetToEvent(
  eventId: string,
  presetId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage)
    return { success: false, error: "Not authorized to manage this event" };
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("chapter_name, status")
    .eq("id", eventId)
    .single();
  if (!event)
    return { success: false, error: "Event not found" };
  if (event.status === "day1_live" || event.status === "day2_live")
    return {
      success: false,
      error:
        "The event is live — applying a preset replaces the whole agenda. Do this before the event.",
    };

  const { data: preset } = await supabase
    .from("agenda_presets")
    .select("id, chapter_name, items")
    .eq("id", presetId)
    .maybeSingle();
  if (!preset) return { success: false, error: "Preset not found." };
  if (preset.chapter_name !== event.chapter_name)
    return {
      success: false,
      error: "That preset belongs to a different chapter.",
    };

  // Data protection: don't wipe an agenda that scores or votes are tied to.
  const [scoresRes, votesRes] = await Promise.all([
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("vote_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);
  if ((scoresRes.count ?? 0) > 0 || (votesRes.count ?? 0) > 0)
    return {
      success: false,
      error:
        "This event already has recorded scores or votes — applying a preset would wipe the agenda they're tied to.",
    };

  const items = asPresetItems(preset.items);
  if (items.length === 0)
    return { success: false, error: "This preset has no items." };

  // Snapshot the current agenda first so we can restore it if the re-insert
  // fails (supabase-js has no multi-statement transaction). Safe to restore with
  // fresh ids: the guard above guarantees no scores/votes reference these rows.
  const { data: backup } = await supabase
    .from("agenda")
    .select(
      "day, sequence_order, title, description, agenda_type, duration_minutes, mode, is_scoreable, session_key, status, skip_reason, config, planned_start"
    )
    .eq("event_id", eventId);

  // Replace: clear the event's agenda, then insert the preset's items fresh.
  const { error: delErr } = await supabase
    .from("agenda")
    .delete()
    .eq("event_id", eventId);
  if (delErr) return { success: false, error: delErr.message };

  const newRows = items.map((it) => ({
    event_id: eventId,
    day: it.day,
    sequence_order: it.sequence_order,
    title: it.title,
    description: it.description ?? null,
    agenda_type: it.agenda_type ?? "general",
    duration_minutes: it.duration_minutes ?? 15,
    mode: it.mode ?? "party",
    is_scoreable: it.is_scoreable ?? false,
    session_key: it.session_key ?? null,
    status: "upcoming" as const,
  }));
  const { error: insErr } = await supabase.from("agenda").insert(newRows);
  if (insErr) {
    // Best-effort restore so a failed apply never leaves an empty agenda.
    if (backup && backup.length > 0) {
      await supabase
        .from("agenda")
        .insert(backup.map((r) => ({ ...r, event_id: eventId })));
    }
    return {
      success: false,
      error: `Couldn't apply the preset (${insErr.message}). Your agenda was left unchanged.`,
    };
  }

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  revalidatePath(`/yip/dashboard/events/${eventId}/control`);
  return { success: true, data: null };
}

/** Delete a chapter preset (chair only; must belong to the event's chapter). */
export async function deletePreset(
  eventId: string,
  presetId: string
): Promise<ActionResult> {
  const access = await getYipEventAccess(eventId);
  if (!access.canDelete)
    return {
      success: false,
      error: "Only the chapter chair or a national admin can delete a preset.",
    };
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("chapter_name")
    .eq("id", eventId)
    .single();
  const { data: preset } = await supabase
    .from("agenda_presets")
    .select("id, chapter_name")
    .eq("id", presetId)
    .maybeSingle();
  if (!preset) return { success: false, error: "Preset not found." };
  if (!event?.chapter_name || preset.chapter_name !== event.chapter_name)
    return {
      success: false,
      error: "That preset belongs to a different chapter.",
    };

  const { error } = await supabase
    .from("agenda_presets")
    .delete()
    .eq("id", presetId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${eventId}/agenda`);
  return { success: true, data: null };
}
