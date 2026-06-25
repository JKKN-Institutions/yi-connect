import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { ControlPanel } from "./control-panel";
import { getChapterControlFilter } from "@/app/yip/actions/agenda";

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

  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's live control panel. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Previous (undo a mis-advance) is now ANY organiser (canManage). Reset (full
  // rewind to the start) + Re-open stay CHAIR / NATIONAL only.
  const access = await getYipEventAccess(id);
  const canManageAgenda = access.canManage;
  const canControlAgendaBackward =
    access.role === "super_admin" || access.role === "chapter_admin";
  const controlAgendaFilter = await getChapterControlFilter(id);

  // Fetch agenda items
  const { data: agendaItems } = await supabase
    .from("agenda")
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
          party_number,
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
    <div className="space-y-4">
      <ControlPanel
        initialEvent={event}
        initialAgendaItems={agendaItems ?? []}
        initialSpeakers={currentSpeakers ?? []}
        canControlAgendaBackward={canControlAgendaBackward}
        canManageAgenda={canManageAgenda}
        initialControlFilter={controlAgendaFilter}
        stats={{
          totalParticipants: participantRes.count ?? 0,
          checkedIn: checkedInRes.count ?? 0,
          scoresSubmitted: scoresRes.count ?? 0,
        }}
      />
    </div>
  );
}
