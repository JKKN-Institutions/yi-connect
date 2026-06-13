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
      <Forbidden403 reason="You don't have access to this event's committee scoring. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Scores / committee metrics are national/super-admin-only (2026-06-13).
  const access = await getYipEventAccess(id);
  if (!access.canViewScores) {
    return (
      <Forbidden403 reason="Scores and results are visible to national/super-admins only." />
    );
  }

  const res = await getCommitteeScoring(id);
  const committees = res.success ? res.data : [];

  return (
    <CommitteeScoringClient
      eventId={id}
      eventName={event.name}
      committees={committees}
      canManage={access.canManage}
    />
  );
}
