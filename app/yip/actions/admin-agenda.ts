"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import type { Database } from "@/types/yip/database";

// ─── Types ──────────────────────────────────────────────────────

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// The agenda_mode enum lives in the PUBLIC schema (shared across yi apps).
type AgendaMode = Database["public"]["Enums"]["agenda_mode"];

// The central agenda template — one canonical 2-day agenda that every chapter
// event inherits at creation (and can be re-pushed to all chapter events).
export type AgendaTemplateItem = {
  id: string;
  day: number;
  sequence_order: number;
  title: string;
  description: string | null;
  agenda_type: string | null;
  duration_minutes: number | null;
  mode: AgendaMode;
  is_scoreable: boolean;
  session_key: string | null;
};

export type AgendaItemInput = {
  day: number;
  sequence_order?: number | null;
  title: string;
  description?: string | null;
  agenda_type?: string | null;
  duration_minutes?: number | null;
  mode: AgendaMode;
  is_scoreable?: boolean;
  session_key?: string | null;
};

// Column list shared by all selects so every field is always present.
const AGENDA_TEMPLATE_COLS =
  "id, day, sequence_order, title, description, agenda_type, duration_minutes, mode, is_scoreable, session_key";

const VALID_MODES: AgendaMode[] = ["party", "committee", "mixed"];

// ─── Validation helpers (local, not exported) ───────────────────

function validateInput(input: AgendaItemInput): string | null {
  if (!input.title || input.title.trim().length < 3) {
    return "Title must be at least 3 characters";
  }
  if (input.day !== 1 && input.day !== 2) {
    return "Day must be 1 or 2";
  }
  if (!VALID_MODES.includes(input.mode)) {
    return "Mode must be party, committee, or mixed";
  }
  return null;
}

function mapRow(row: {
  id: string;
  day: number;
  sequence_order: number;
  title: string;
  description: string | null;
  agenda_type: string | null;
  duration_minutes: number | null;
  mode: AgendaMode;
  is_scoreable: boolean;
  session_key: string | null;
}): AgendaTemplateItem {
  return {
    id: row.id,
    day: row.day,
    sequence_order: row.sequence_order,
    title: row.title,
    description: row.description,
    agenda_type: row.agenda_type,
    duration_minutes: row.duration_minutes,
    mode: row.mode,
    is_scoreable: row.is_scoreable,
    session_key: row.session_key,
  };
}

// ─── List ───────────────────────────────────────────────────────
// NOT gated — read-only template.

export async function adminListAgendaTemplate(): Promise<AgendaTemplateItem[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("agenda_template")
    .select(AGENDA_TEMPLATE_COLS)
    .order("day")
    .order("sequence_order");

  if (error || !data) return [];
  return data.map(mapRow);
}

// ─── Upsert (create or update by id) ────────────────────────────

export async function adminUpsertAgendaItem(
  input: AgendaItemInput,
  id?: string
): Promise<ActionResult<AgendaTemplateItem>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const err = validateInput(input);
  if (err) return { success: false, error: err };

  const supabase = await createServiceClient();

  // ── Update path ──
  if (id) {
    const { data, error } = await supabase
      .from("agenda_template")
      .update({
        day: input.day,
        sequence_order: input.sequence_order ?? undefined,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        agenda_type: input.agenda_type?.trim() || null,
        duration_minutes: input.duration_minutes ?? null,
        mode: input.mode,
        is_scoreable: input.is_scoreable ?? false,
        session_key: input.session_key?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(AGENDA_TEMPLATE_COLS)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Failed to update agenda item",
      };
    }
    revalidatePath("/yip/dashboard/admin/agenda");
    return { success: true, data: mapRow(data) };
  }

  // ── Create path ──
  // Auto-assign sequence_order = max+1 for that day when not provided.
  let sequenceOrder = input.sequence_order ?? null;
  if (sequenceOrder == null) {
    const { data: maxRows } = await supabase
      .from("agenda_template")
      .select("sequence_order")
      .eq("day", input.day)
      .order("sequence_order", { ascending: false })
      .limit(1);
    const currentMax = maxRows?.[0]?.sequence_order ?? 0;
    sequenceOrder = currentMax + 1;
  }

  const { data, error } = await supabase
    .from("agenda_template")
    .insert({
      day: input.day,
      sequence_order: sequenceOrder,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      agenda_type: input.agenda_type?.trim() || null,
      duration_minutes: input.duration_minutes ?? null,
      mode: input.mode,
      is_scoreable: input.is_scoreable ?? false,
      session_key: input.session_key?.trim() || null,
    })
    .select(AGENDA_TEMPLATE_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create agenda item",
    };
  }

  revalidatePath("/yip/dashboard/admin/agenda");
  return { success: true, data: mapRow(data) };
}

// ─── Delete ─────────────────────────────────────────────────────

export async function adminDeleteAgendaItem(
  id: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("agenda_template")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/yip/dashboard/admin/agenda");
  return { success: true, data: null };
}

// ─── Reorder within a day ───────────────────────────────────────
// Two-phase update to avoid tripping the UNIQUE(day, sequence_order)
// constraint while numbers temporarily collide. Mirrors adminReorderTopics.

export async function adminReorderAgendaItems(
  day: number,
  orderedIds: string[]
): Promise<ActionResult<{ reordered: number }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (day !== 1 && day !== 2) {
    return { success: false, error: "Day must be 1 or 2" };
  }
  if (orderedIds.length === 0) {
    return { success: true, data: { reordered: 0 } };
  }

  const supabase = await createServiceClient();

  // Phase 1: push all affected rows into a high negative space to free slots.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("agenda_template")
      .update({ sequence_order: -(i + 1) - 100000 })
      .eq("id", orderedIds[i]);
    if (error) return { success: false, error: error.message };
  }

  // Phase 2: write the intended 1..N sequence.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("agenda_template")
      .update({ sequence_order: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/yip/dashboard/admin/agenda");
  return { success: true, data: { reordered: orderedIds.length } };
}

// ─── Push template to all chapter events (OVERWRITE draft events) ─────────────
// Overwrites the agenda on every NOT-YET-STARTED chapter event
// (level='chapter', is_mock=false, status='draft'): delete its yip.agenda rows
// then insert fresh ones from the template.
//
// Started/scored events are deliberately SKIPPED and reported: their agenda
// items are referenced by scores + vote_sessions (ON DELETE NO ACTION → a
// delete would FAIL) and by votes + jury_session_assignments + agenda_speakers
// (ON DELETE CASCADE → a delete would DESTROY live voting/jury data). So a true
// blanket overwrite of live events is unsafe; we protect them instead.

export async function pushAgendaToAllChapterEvents(
  eventIds?: string[]
): Promise<
  ActionResult<{
    events_updated: number;
    events_skipped: number;
    items_each: number;
    skipped_names: string[];
  }>
> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createServiceClient();

  // Read the canonical template.
  const { data: template, error: tplError } = await supabase
    .from("agenda_template")
    .select(AGENDA_TEMPLATE_COLS)
    .order("day")
    .order("sequence_order");

  if (tplError) return { success: false, error: tplError.message };
  if (!template || template.length === 0) {
    return { success: false, error: "Agenda template is empty — nothing to push." };
  }

  // Selective push (eventIds given) targets exactly the chosen events; "push to
  // all" (no IDs) targets every real chapter event. Either way bounded to
  // level=chapter + non-mock so a stray ID can't hit a regional/national/mock.
  const selective = !!(eventIds && eventIds.length > 0);
  let evQ = supabase
    .from("events")
    .select("id, name, status")
    .eq("level", "chapter")
    .eq("is_mock", false);
  if (selective) evQ = evQ.in("id", eventIds);
  const { data: events, error: eventsError } = await evQ;

  if (eventsError) return { success: false, error: eventsError.message };
  if (!events || events.length === 0) {
    return {
      success: true,
      data: { events_updated: 0, events_skipped: 0, items_each: template.length, skipped_names: [] },
    };
  }

  let updated = 0;
  const skipped: string[] = [];
  for (const ev of events) {
    // Bulk "push to all" protects started events (their agenda may carry
    // scores/votes). Selective push is a deliberate, warned choice, so it
    // proceeds even on started events — but the delete below still rolls back
    // (and skips) if a FK from real scores/votes would be violated.
    if (!selective && ev.status !== "draft") {
      skipped.push(ev.name ?? ev.id);
      continue;
    }

    // Overwrite: delete existing agenda rows for this draft event…
    const { error: delError } = await supabase
      .from("agenda")
      .delete()
      .eq("event_id", ev.id);
    if (delError) {
      // Safety net: a draft event with unexpected agenda-dependent data trips
      // a FK violation; the delete rolls back (no data lost) — skip, don't abort.
      skipped.push(ev.name ?? ev.id);
      continue;
    }

    // …then insert fresh rows mapped from the template.
    const rows = template.map((t) => ({
      event_id: ev.id,
      day: t.day,
      sequence_order: t.sequence_order,
      title: t.title,
      description: t.description,
      agenda_type: t.agenda_type,
      duration_minutes: t.duration_minutes,
      mode: t.mode,
      is_scoreable: t.is_scoreable,
      session_key: t.session_key,
    }));

    const { error: insError } = await supabase.from("agenda").insert(rows);
    if (insError) return { success: false, error: insError.message };
    updated++;
  }

  revalidatePath("/yip/dashboard/admin/agenda");
  return {
    success: true,
    data: {
      events_updated: updated,
      events_skipped: skipped.length,
      items_each: template.length,
      skipped_names: skipped,
    },
  };
}
