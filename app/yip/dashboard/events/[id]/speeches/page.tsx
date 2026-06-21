import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getEventParticipants } from "@/app/yip/actions/participants";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { SpeechesClient } from "./speeches-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function SpeechesPage({
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
      <Forbidden403 reason="You don't have access to this event. It may have been deleted, or your role may not include its chapter or region." />
    );
  }

  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Only event organisers can track speeches for this event." />
    );
  }

  // Gated service-role read (the roster includes fields revoked from the
  // authenticated role); the action re-checks canManage, so it stays scoped.
  const participants = await getEventParticipants(id);
  const roster = participants.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    party_number: p.party_number,
    constituency_number: p.constituency_number,
    speech_finished: !!(p as { speech_finished?: boolean | null })
      .speech_finished,
  }));

  return (
    <SpeechesClient eventId={id} eventName={event.name} roster={roster} />
  );
}
