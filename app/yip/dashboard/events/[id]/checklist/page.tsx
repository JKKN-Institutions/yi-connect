import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent, getEventSetupProgress } from "@/app/yip/actions/events";
import { getEventChecklist } from "@/app/yip/actions/checklist";
import { ChecklistClient } from "./checklist-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's checklist. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const items = await getEventChecklist(id);
  // Reuse the canonical setup-progress detection (same source as the nav
  // green-dots) to auto-check the "before you allocate" prerequisites.
  const setup = await getEventSetupProgress(id);

  return (
    <ChecklistClient
      eventId={id}
      eventName={event.name}
      initialItems={items}
      partiesSet={!!setup["/parties"]}
      committeesSet={!!setup["/topics"]}
    />
  );
}
