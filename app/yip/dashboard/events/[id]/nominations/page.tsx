/**
 * YIP Self-Nomination — organiser results screen.
 *
 * Students put themselves forward (from home, on their phones) for Administrator
 * / Speaker / Party Leader BEFORE event day. This page is the organiser's read
 * of that list plus the single explicit toggle that opens and closes the window.
 *
 * Director decision 1 (2026-08-14): this is a LIST TO READ, not a ballot feed.
 * Nothing here writes vote_sessions.config.candidateIds — the organiser still
 * hand-picks ballot candidates on the Control panel exactly as before. The only
 * concession to the "someone nominates and silently never appears on the ballot"
 * risk is a read-only signpost line pointing at Control.
 *
 * Gate: EVENT-SCOPED. canView to read the list, canManage for the toggle and
 * the CSV export (enforced again server-side in the actions). Denials render
 * <Forbidden403> — never a silent redirect.
 */
import type { Metadata } from "next";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getSelfNominationResults } from "@/app/yip/actions/self-nomination";
import { emptySelfNominationStats } from "@/lib/yip/self-nomination";
import { NominationsClient } from "./nominations-client";

export const metadata: Metadata = {
  title: "Nominations — YIP 2026",
};

export default async function NominationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const access = await getYipEventAccess(id);
  if (!access.canView) {
    return (
      <Forbidden403 reason="You don't have access to this event's nominations. If you should have access, ask your chapter chair to add you to the event team." />
    );
  }

  const res = await getSelfNominationResults(id);

  return (
    <NominationsClient
      eventId={id}
      canManage={access.canManage}
      initialOpen={res.success ? res.data.open : false}
      initialRows={res.success ? res.data.rows : []}
      initialStats={res.success ? res.data.stats : emptySelfNominationStats()}
      initialError={res.success ? null : res.error}
    />
  );
}
