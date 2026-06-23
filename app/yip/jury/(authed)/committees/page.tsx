import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getJurorCommittees } from "@/app/yip/actions/committee-scores";
import { JurorCommitteesClient } from "./committees-client";

export default async function JuryCommitteesPage() {
  const session = await getYipSession();
  if (!session || session.type !== "jury") {
    redirect("/yip/join");
  }

  const res = await getJurorCommittees(session.id, session.eventId);

  return (
    <JurorCommitteesClient
      juryAssignmentId={session.id}
      eventId={session.eventId}
      locked={res.success ? res.data.locked : false}
      committees={res.success ? res.data.committees : []}
      error={res.success ? null : res.error}
    />
  );
}
