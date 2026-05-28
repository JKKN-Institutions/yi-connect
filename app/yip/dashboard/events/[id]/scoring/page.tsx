import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getScoringProgress } from "@/app/yip/actions/results";
import { ScoringProgress } from "./scoring-progress";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function ScoringPage({
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
      <Forbidden403 reason="You don't have access to this event's scoring. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const progress = await getScoringProgress(id);

  if (!progress) {
    return (
      <Forbidden403 reason="Scoring progress is not available for this event. Scoring may not have started yet, or your role may not include access." />
    );
  }

  return <ScoringProgress eventId={id} data={progress} />;
}
