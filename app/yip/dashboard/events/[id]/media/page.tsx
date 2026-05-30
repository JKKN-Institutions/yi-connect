import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { listMedia, getMediaStats } from "@/app/yip/actions/media";
import { MediaClient } from "./media-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(eventId);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's media. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const [media, stats] = await Promise.all([
    listMedia(eventId),
    getMediaStats(eventId),
  ]);

  return (
    <MediaClient
      eventId={eventId}
      eventName={event.name}
      initialMedia={media}
      initialStats={stats}
    />
  );
}
