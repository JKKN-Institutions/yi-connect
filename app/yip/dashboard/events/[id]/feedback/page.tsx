import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getFeedbackStats, listFeedback } from "@/app/yip/actions/feedback";
import { FeedbackDashboardClient } from "./feedback-dashboard-client";

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

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();
  if (!event) redirect("/yip/dashboard");

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
