import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { JuryClient } from "./jury-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function JuryPage({
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
      <Forbidden403 reason="You don't have access to this event's jury. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Fetch jury
  const { data: jury } = await supabase
    .from("jury_assignments")
    .select("*")
    .eq("event_id", id)
    .order("created_at");

  return <JuryClient eventId={id} jury={jury ?? []} />;
}
