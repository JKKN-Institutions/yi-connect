import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { ControlPanel } from "./control-panel";

export default async function ControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  // Fetch event
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

  // Fetch agenda items
  const { data: agendaItems } = await supabase
    .from("agenda_items")
    .select("*")
    .eq("event_id", id)
    .order("day")
    .order("sequence_order");

  // Fetch participant stats
  const [participantRes, checkedInRes, scoresRes] = await Promise.all([
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("event_id", id),
    supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("event_id", id)
      .eq("checked_in", true),
    supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .eq("event_id", id)
      .eq("status", "submitted"),
  ]);

  // Fetch speakers for current agenda item (if any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentSpeakers: any[] = [];
  if (event.current_agenda_item_id) {
    const { data } = await supabase
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
      .eq("agenda_item_id", event.current_agenda_item_id)
      .order("speaking_order");
    currentSpeakers = data ?? [];
  }

  return (
    <ControlPanel
      initialEvent={event}
      initialAgendaItems={agendaItems ?? []}
      initialSpeakers={currentSpeakers ?? []}
      stats={{
        totalParticipants: participantRes.count ?? 0,
        checkedIn: checkedInRes.count ?? 0,
        scoresSubmitted: scoresRes.count ?? 0,
      }}
    />
  );
}
