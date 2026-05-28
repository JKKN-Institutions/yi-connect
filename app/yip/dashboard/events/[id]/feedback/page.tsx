import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getFeedbackStats, listFeedback } from "@/app/yip/actions/feedback";
import { FeedbackDashboardClient } from "./feedback-dashboard-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function FeedbackDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Auth: organizer only
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's feedback. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Actions use createServiceClient internally to bypass RLS for full slice.
  const [stats, responses] = await Promise.all([
    getFeedbackStats(id),
    listFeedback(id),
  ]);

  return (
    <FeedbackDashboardClient
      eventId={id}
      eventName={event.name}
      stats={stats}
      responses={responses}
    />
  );
}
