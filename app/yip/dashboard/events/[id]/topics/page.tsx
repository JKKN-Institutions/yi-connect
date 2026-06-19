import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { getEvent, listCommitteeTopics } from "@/app/yip/actions/events";
import { CommitteePickerClient } from "./topics-event-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

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
  if (!user) redirect("/yip/login");

  // getEvent returns null when the caller has no access to this event.
  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's committees. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // The official 15-committee catalogue (admin-managed at /yip/dashboard/admin/topics).
  const catalog = await listCommitteeTopics();

  // This event's currently-selected committees = the keys of committee_topics.
  // Read on the service client (yip.events is RLS read-only for `authenticated`,
  // but the column is non-sensitive and the access gate above already passed).
  const service = await createServiceClient();
  const { data: row } = await service
    .from("events")
    .select("committee_topics")
    .eq("id", id)
    .single();

  const ct = (row?.committee_topics ?? {}) as
    | Record<string, string>
    | string[]
    | null;
  let initialSelected: string[] = [];
  if (Array.isArray(ct)) initialSelected = ct.map(String);
  else if (ct && typeof ct === "object") initialSelected = Object.keys(ct);

  return (
    <CommitteePickerClient
      eventId={id}
      catalog={catalog}
      initialSelected={initialSelected}
    />
  );
}
