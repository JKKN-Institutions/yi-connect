import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { listTopics, getEventTopics } from "@/app/yip/actions/topics";
import type { YiZone } from "@/lib/yip/hierarchy";
import { TopicsEventClient } from "./topics-event-client";

export default async function EventTopicsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const event = await getEvent(id);
  if (!event) redirect("/dashboard");

  // Central pool — national agenda, applies to every event.
  const centralTopics = await listTopics({ category: "central" });

  // Regional pool — filter to the event's zone. If the event has no zone yet,
  // show none (user must set the event zone first).
  const regionalTopics = event.zone
    ? await listTopics({
        category: "regional",
        zone: event.zone as YiZone,
      })
    : [];

  // Currently-assigned topics for this event.
  const assigned = await getEventTopics(id);

  return (
    <TopicsEventClient
      eventId={id}
      eventLevel={event.level}
      eventZone={event.zone as YiZone | null}
      centralTopics={centralTopics}
      regionalTopics={regionalTopics}
      assignedTopicIds={assigned.map((t) => t.id)}
    />
  );
}
