import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getEventChecklist } from "@/app/actions/checklist";
import { ChecklistClient } from "./checklist-client";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const items = await getEventChecklist(id);

  return (
    <ChecklistClient
      eventId={id}
      eventName={event.name}
      initialItems={items}
    />
  );
}
