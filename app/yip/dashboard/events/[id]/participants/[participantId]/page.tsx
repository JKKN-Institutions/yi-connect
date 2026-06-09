import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getParticipantProfile } from "@/app/yip/actions/participant-profile";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { ParticipantProfileClient } from "./participant-profile-client";

export default async function ParticipantProfilePage({
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
      <Forbidden403 reason="You don't have access to this event. It may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const profile = await getParticipantProfile(id, participantId);
  if (!profile) {
    return (
      <Forbidden403 reason="This participant's profile isn't available — they may not belong to this event, or your role may not include access." />
    );
  }

  return (
    <ParticipantProfileClient
      eventId={id}
      eventName={event.name}
      profile={profile}
    />
  );
}
