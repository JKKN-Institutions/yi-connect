import "server-only";

import { tpService } from "../supabase";
import { enqueueJob, latestReadyJob } from "./queue";
import { istDayStart, type WhyMeetOutput } from "./schemas";

/*
 * "Why meet" notes: one short AI line per suggested person, written by the
 * routine at most once a day per delegate. Other pages can show them next
 * to a name with getWhyMeet(); nothing here sends anything to the browser.
 * Callers MUST have resolved the delegate id from a pass token first.
 */

/**
 * Queue today's why_meet batch if this delegate has none today. Called when
 * a delegate opens /plan or /radar. Never throws, never blocks the page.
 * Returns true when a new job was queued.
 */
export async function ensureWhyMeetToday(delegateId: string): Promise<boolean> {
  try {
    const { count, error } = await tpService()
      .from("tp_ai_jobs")
      .select("id", { count: "exact", head: true })
      .eq("delegate_id", delegateId)
      .eq("kind", "why_meet")
      .gte("created_at", istDayStart());
    if (error || (count ?? 0) > 0) return false;
    const r = await enqueueJob(delegateId, "why_meet", {});
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * The latest "why meet" reasons for this delegate, keyed by the other
 * delegate's id. Only people who are STILL listed in the directory (and in
 * the same sample / real world) are returned, so a person who hid their
 * listing after the note was written drops out. Empty map when none.
 */
export async function getWhyMeet(delegateId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const job = await latestReadyJob(delegateId, "why_meet");
    const people = (job?.output as WhyMeetOutput | null)?.people ?? [];
    if (!people.length) return out;
    const db = tpService();
    const { data: me } = await db.from("tp_delegates").select("is_sample").eq("id", delegateId).maybeSingle();
    if (!me) return out;
    const { data, error } = await db
      .from("tp_delegates")
      .select("id")
      .in("id", people.map((p) => p.id))
      .eq("directory_visible", true)
      .eq("is_sample", (me as { is_sample: boolean }).is_sample);
    if (error) return out;
    const live = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
    for (const p of people) if (live.has(p.id) && p.id !== delegateId) out.set(p.id, p.reason);
  } catch {
    // Notes are a nice-to-have: an empty map, never an error page.
  }
  return out;
}
