import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { listMedia, getMediaStats } from "@/app/actions/media";
import { MediaClient } from "./media-client";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

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
