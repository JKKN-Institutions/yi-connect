import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getCommitteeScoring } from "@/app/yip/actions/committee-scores";
import { CommitteeScoringClient } from "./committee-scoring-client";

export default async function CommitteeScoringPage({
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
      <Forbidden403 reason="You don't have access to this event's committee scoring. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // The committee scoring WORKSPACE is for whoever runs the event (organiser+):
  // judges score, and organisers may enter on a judge's behalf. The results
  // leaderboard stays national/super-admin-only (see getResults).
  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Committee scoring is for the chapter team and judges. Your role doesn't include managing this event." />
    );
  }

  const scoringRes = await getCommitteeScoring(id);

  return (
    <CommitteeScoringClient
      eventId={id}
      eventName={event.name}
      committees={scoringRes.success ? scoringRes.data : []}
      locked={Boolean(event.scores_locked)}
    />
  );
}
