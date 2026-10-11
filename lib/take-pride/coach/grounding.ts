import "server-only";

import { tpService } from "../supabase";
import { livePeople } from "../ai/views";
import type { CoachCheckin } from "./queue";
import { assembleCoachGrounding, type CoachAllowed } from "./schemas";

/*
 * Grounding for one coach check-in, reached ONLY from the routine endpoint
 * behind X-Cron-Secret. Holds the delegate's pledge, this check-in's text and
 * mood, earlier steps (their text, mood and coach notes) and the people the
 * delegate actually met: mutual badge scans (tp_connections, scanned) and
 * accepted delegate meetings.
 *
 * Privacy: those people pass through livePeople(), so only delegates who are
 * directory_visible and in the same sample / real world appear, with card
 * fields only. Never phone, email, token, badge code, badge secret, private
 * notes or check-in data. assembleCoachGrounding() picks fields by name.
 */

const PEOPLE_CAP = 40;

/** Delegates I met: a scan either way, or an accepted delegate meeting. */
async function metIds(meId: string): Promise<Map<string, "connection" | "meeting" | "both">> {
  const db = tpService();
  const [c, m] = await Promise.all([
    db
      .from("tp_connections")
      .select("a_delegate_id, b_delegate_id")
      .eq("scanned", true)
      .or(`a_delegate_id.eq.${meId},b_delegate_id.eq.${meId}`)
      .limit(2000),
    db
      .from("tp_delegate_meetings")
      .select("from_delegate_id, to_delegate_id")
      .eq("status", "accepted")
      .or(`from_delegate_id.eq.${meId},to_delegate_id.eq.${meId}`)
      .limit(2000),
  ]);
  if (c.error) throw new Error(c.error.message);
  if (m.error) throw new Error(m.error.message);
  const out = new Map<string, "connection" | "meeting" | "both">();
  for (const r of (c.data ?? []) as { a_delegate_id: string; b_delegate_id: string }[]) {
    out.set(r.a_delegate_id === meId ? r.b_delegate_id : r.a_delegate_id, "connection");
  }
  for (const r of (m.data ?? []) as { from_delegate_id: string; to_delegate_id: string }[]) {
    const other = r.from_delegate_id === meId ? r.to_delegate_id : r.from_delegate_id;
    out.set(other, out.has(other) ? "both" : "meeting");
  }
  out.delete(meId);
  return out;
}

export type BuiltCoachGrounding = { grounding: Record<string, unknown>; allowed: CoachAllowed };

/** Null when the delegate no longer exists (the caller fails the check-in). */
export async function buildCoachGrounding(c: CoachCheckin): Promise<BuiltCoachGrounding | null> {
  const db = tpService();
  const { data: meRow, error } = await db
    .from("tp_delegates")
    .select("id, full_name, chapter, pledge, is_sample")
    .eq("id", c.delegate_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!meRow) return null;
  const me = meRow as { id: string; full_name: string; chapter: string; pledge: string | null; is_sample: boolean };

  const [prev, met] = await Promise.all([
    db
      .from("tp_coach_checkins")
      .select("step, update_text, mood, coach_note")
      .eq("delegate_id", me.id)
      .lt("step", c.step)
      .order("step"),
    metIds(me.id),
  ]);
  if (prev.error) throw new Error(prev.error.message);
  // Capped so the id list stays well inside one query string.
  const live = await livePeople(me, [...met.keys()].slice(0, 200));
  const people = [...live.values()]
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .slice(0, PEOPLE_CAP)
    .map((p) => ({ ...p, met_by: met.get(p.id) ?? ("connection" as const) }));

  return assembleCoachGrounding({
    me,
    step: c.step,
    update_text: c.update_text ?? "",
    mood: c.mood,
    previous: (prev.data ?? []) as { step: number; update_text: string | null; mood: string | null; coach_note: unknown }[],
    people,
  });
}
