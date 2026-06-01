import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getParticipantScoringDetail } from "@/app/yip/actions/scoring-detail";
import { ParticipantDetailClient } from "./participant-detail-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function ParticipantScoringDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const { id, participantId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's scoring. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const detail = await getParticipantScoringDetail(id, participantId);
  if (!detail) {
    return (
      <Forbidden403 reason="This participant's scoring detail isn't available — they may not belong to this event, or your role may not include access." />
    );
  }

  return <ParticipantDetailClient eventId={id} detail={detail} />;
}
