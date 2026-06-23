import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getJurorCommittees } from "@/app/yip/actions/committee-scores";
import { getCommitteeDimensionsConfig } from "@/app/yip/actions/committee-dimensions";
import { JurorCommitteesClient } from "./committees-client";

export default async function JuryCommitteesPage() {
  const session = await getYipSession();
  if (!session || session.type !== "jury") {
    redirect("/yip/join");
  }

  const [res, dimsCfg] = await Promise.all([
    getJurorCommittees(session.id, session.eventId),
    getCommitteeDimensionsConfig(),
  ]);

  return (
    <JurorCommitteesClient
      juryAssignmentId={session.id}
      eventId={session.eventId}
      locked={res.success ? res.data.locked : false}
      committees={res.success ? res.data.committees : []}
      dimensions={dimsCfg.dimensions}
      error={res.success ? null : res.error}
    />
  );
}
