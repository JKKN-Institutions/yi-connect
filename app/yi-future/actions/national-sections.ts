"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import type { ActionResult } from "./editions";
import {
  NATIONAL_DAY1_SECTIONS,
  NATIONAL_DAY1_SECTION_LABELS,
  NATIONAL_DAY2_SECTIONS,
  NATIONAL_DAY2_SECTION_LABELS,
} from "@/lib/yi-future/constants";

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");
  return user.id;
}

/**
 * The `future.national_event_sections` table was added in migration 116.
 * Generated types in `src/types/database.ts` won't include it until the
 * migration is applied and types are regenerated. Until then, we access
 * the table via a loosely-typed handle.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function sectionsTable(): Promise<any> {
  const svc = await createServiceClient();
  return (svc as any).schema("future").from("national_event_sections");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Seed national Day 1 + Day 2 sections for an event. Safe to re-run:
 * duplicates are ignored on the (event_id, day, section_key) unique key.
 */
export async function seedNationalSections(
  eventId: string
): Promise<ActionResult> {
  await requireAuth();

  const rows: Array<{
    event_id: string;
    day: number;
    section_key: string;
    title: string;
    sequence_order: number;
    is_active: boolean;
  }> = [];

  NATIONAL_DAY1_SECTIONS.forEach((k, i) => {
    rows.push({
      event_id: eventId,
      day: 1,
      section_key: k,
      title: NATIONAL_DAY1_SECTION_LABELS[k],
      sequence_order: i,
      is_active: false,
    });
  });
  NATIONAL_DAY2_SECTIONS.forEach((k, i) => {
    rows.push({
      event_id: eventId,
      day: 2,
      section_key: k,
      title: NATIONAL_DAY2_SECTION_LABELS[k],
      sequence_order: i,
      is_active: false,
    });
  });

  const tbl = await sectionsTable();
  const { error } = await tbl.upsert(rows, {
    onConflict: "event_id,day,section_key",
    ignoreDuplicates: true,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/agenda/day1");
  revalidatePath("/yi-future/host/agenda/day2");
  return { ok: true, message: "National sections seeded." };
}

export async function activateNationalSection(
  eventId: string,
  day: 1 | 2,
  sectionKey: string
): Promise<ActionResult> {
  await requireAuth();

  const now = new Date().toISOString();

  // Close any currently-active section across both days for this event
  const tbl1 = await sectionsTable();
  await tbl1
    .update({ is_active: false, ends_at: now })
    .eq("event_id", eventId)
    .eq("is_active", true);

  const tbl2 = await sectionsTable();
  const { error } = await tbl2
    .update({
      is_active: true,
      starts_at: now,
      ends_at: null,
    })
    .eq("event_id", eventId)
    .eq("day", day)
    .eq("section_key", sectionKey);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/agenda/day1");
  revalidatePath("/yi-future/host/agenda/day2");
  revalidatePath(`/yi-future/host/event/${eventId}/live`);
  revalidatePath(`/event/${eventId}/display`);
  return { ok: true, message: `Day ${day} · "${sectionKey}" is live.` };
}

export async function endAllNationalSections(
  eventId: string
): Promise<ActionResult> {
  await requireAuth();

  const now = new Date().toISOString();
  const tbl = await sectionsTable();
  const { error } = await tbl
    .update({ is_active: false, ends_at: now })
    .eq("event_id", eventId)
    .eq("is_active", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/host/agenda/day1");
  revalidatePath("/yi-future/host/agenda/day2");
  revalidatePath(`/yi-future/host/event/${eventId}/live`);
  revalidatePath(`/event/${eventId}/display`);
  return { ok: true, message: "All national sections closed." };
}

export async function updateNationalSectionNotes(
  eventId: string,
  day: 1 | 2,
  sectionKey: string,
  notes: string | null
): Promise<ActionResult> {
  await requireAuth();

  const tbl = await sectionsTable();
  const { error } = await tbl
    .update({ notes })
    .eq("event_id", eventId)
    .eq("day", day)
    .eq("section_key", sectionKey);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/yi-future/host/agenda/day${day}`);
  return { ok: true };
}
