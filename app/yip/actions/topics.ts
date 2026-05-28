"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
import type { YiZone } from "@/lib/yip/hierarchy";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type Topic = {
  id: string;
  category: "central" | "regional";
  zone: YiZone | null;
  topic_number: number | null;
  title: string;
  description: string | null;
  sub_points: string[];
  handbook_page: number | null;
  is_active: boolean;
};

export async function listTopics(filters?: {
  category?: "central" | "regional";
  zone?: YiZone;
  q?: string;
}): Promise<Topic[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("topics")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("zone", { nullsFirst: true })
    .order("topic_number");

  if (filters?.category) q = q.eq("category", filters.category);
  if (filters?.zone) q = q.eq("zone", filters.zone);
  if (filters?.q) q = q.ilike("title", `%${filters.q}%`);

  const { data } = await q;
  return (data ?? []).map((t) => ({
    ...t,
    sub_points: Array.isArray(t.sub_points) ? (t.sub_points as string[]) : [],
  })) as Topic[];
}

export async function assignTopicsToEvent(
  eventId: string,
  topicIds: string[],
  setCentralFlag: boolean = false
): Promise<ActionResult<{ assigned: number }>> {
  const supabase = await createServiceClient();

  // F2: For chapter-level events, enforce exactly-5 non-central
  // (regional/committee) topics. Other levels (regional, national) are
  // unconstrained. When setCentralFlag === true, this call is exclusively
  // writing central topics (batch push); skip the count check.
  if (!setCentralFlag) {
    const { data: eventRow } = await supabase
      .from("events")
      .select("level")
      .eq("id", eventId)
      .single();

    if (eventRow?.level === "chapter") {
      const { data: topicRows } = await supabase
        .from("topics")
        .select("id, category")
        .in("id", topicIds);

      const nonCentralCount =
        topicRows?.filter((t) => t.category !== "central").length ?? 0;

      if (nonCentralCount !== 5) {
        return {
          success: false,
          error: "Chapter events must have exactly 5 committee topics",
        };
      }
    }
  }

  // Per-row is_central derivation: so the per-event save (which mixes
  // central + regional in one call) tags rows correctly.
  const { data: topicCategoryRows } = await supabase
    .from("topics")
    .select("id, category")
    .in("id", topicIds);
  const categoryById = new Map(
    (topicCategoryRows ?? []).map((t) => [t.id, t.category])
  );

  const rows = topicIds.map((tid, i) => ({
    event_id: eventId,
    topic_id: tid,
    is_central: setCentralFlag || categoryById.get(tid) === "central",
    sequence: i,
  }));

  const { error } = await supabase
    .from("event_topics")
    .upsert(rows, { onConflict: "event_id,topic_id" });

  if (error) return { success: false, error: error.message };

  // F2: when per-event UI submits the full set (setCentralFlag=false),
  // prune assignments not in the submitted list so removals work.
  // Batch-push callers (setCentralFlag=true) only add.
  if (!setCentralFlag && topicIds.length > 0) {
    await supabase
      .from("event_topics")
      .delete()
      .eq("event_id", eventId)
      .not("topic_id", "in", `(${topicIds.join(",")})`);
  }

  revalidatePath(`/yip/dashboard/events/${eventId}`);
  revalidatePath(`/yip/dashboard/events/${eventId}/topics`);
  return { success: true, data: { assigned: topicIds.length } };
}

export async function removeTopicFromEvent(
  eventId: string,
  topicId: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("event_topics")
    .delete()
    .eq("event_id", eventId)
    .eq("topic_id", topicId);

  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "event_topics",
    target_id: topicId,
    target_event_id: eventId,
  });
  revalidatePath(`/yip/dashboard/events/${eventId}/topics`);
  return { success: true, data: null };
}

export async function getEventTopics(
  eventId: string
): Promise<Array<Topic & { is_central: boolean }>> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("event_topics")
    .select("is_central, sequence, topic:topics(*)")
    .eq("event_id", eventId)
    .order("sequence");

  if (!data) return [];
  return data
    .filter((r) => r.topic !== null)
    .map((r) => {
      const topic = r.topic as unknown as Topic;
      return {
        ...topic,
        sub_points: Array.isArray(topic.sub_points) ? topic.sub_points : [],
        is_central: r.is_central ?? false,
      };
    });
}
