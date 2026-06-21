"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import type { LiveSpotlightData } from "@/app/yip/dashboard/zones/_components/live-spotlight";

export async function getLiveSpotlight(): Promise<LiveSpotlightData | null> {
  const supabase = await createServiceClient();

  const { data: liveRaw } = await supabase
    .from("events")
    .select("id, name, status, is_mock")
    .in("status", ["day1_live", "day2_live"])
    .eq("is_mock", false);

  // Exclude demo/test events from the "Happening now" card — only a real live event counts.
  const live = (liveRaw ?? []).find((e) => !/\b(demo|test)\b/i.test(e.name ?? ""));
  if (!live) return null;

  const [{ data: agendaRaw }, { count: scoresCount }, { count: voteCount }] = await Promise.all([
    supabase
      .from("agenda")
      .select("title, status, day, sequence_order")
      .eq("event_id", live.id),
    supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .eq("event_id", live.id),
    supabase
      .from("vote_sessions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", live.id),
  ]);

  const agenda = agendaRaw ?? [];
  const agendaTotal = agenda.length;
  const agendaDone = agenda.filter((a) => a.status === "completed").length;

  let current: LiveSpotlightData["current"] = null;
  const inProgress = agenda.find((a) => a.status === "in_progress");
  if (inProgress) {
    current = { title: inProgress.title ?? "Current item", status: "in_progress" };
  } else {
    const nextUp = agenda
      .filter((a) => a.status === "upcoming")
      .sort(
        (a, b) =>
          (a.day ?? 0) - (b.day ?? 0) ||
          (a.sequence_order ?? 0) - (b.sequence_order ?? 0)
      )[0];
    if (nextUp) current = { title: nextUp.title ?? "Next item", status: "upcoming" };
  }

  return {
    id: live.id,
    name: live.name ?? "Live event",
    current,
    agendaDone,
    agendaTotal,
    scores: scoresCount ?? 0,
    voteSessions: voteCount ?? 0,
  };
}
