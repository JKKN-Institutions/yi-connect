import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import {
  getResults,
  getDay2CheckinWarning,
  getAwardCandidates,
} from "@/app/yip/actions/results";
import { getAwardOverrides } from "@/app/yip/actions/award-overrides";
import { getPositionBonusConfigAdmin } from "@/app/yip/actions/positions";
import { getZoneAwardConfig } from "@/app/yip/actions/qualification";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { ResultsClient } from "./results-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function ResultsPage({
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
      <Forbidden403 reason="You don't have access to this event's results. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Scores / leaderboard / metrics are national/super-admin-only (2026-06-13).
  const access = await getYipEventAccess(id);
  if (!access.canViewScores) {
    return (
      <Forbidden403 reason="Scores and results are visible to national/super-admins only." />
    );
  }

  const results = await getResults(id);
  const awardOverrides = await getAwardOverrides(id);
  const positionConfig = await getPositionBonusConfigAdmin();
  const day2Warning = await getDay2CheckinWarning(id);
  const awardCandidates = await getAwardCandidates(id);
  // Award-based qualification: which awards confer advancement is per-zone config
  // (default = all). Locking qualifiers is a national-team (super-admin) action.
  const zoneAwardConfig = await getZoneAwardConfig(event.yi_zone_code ?? null);
  const canQualify = access.role === "super_admin";

  return (
    <ResultsClient
      eventId={id}
      eventName={event.name}
      resultsPublishedAt={event.results_published_at}
      results={results}
      awardOverrides={awardOverrides}
      canOverrideAwards={access.canDelete}
      positionBonuses={positionConfig.bonuses}
      day2CheckinWarning={day2Warning.shouldWarn}
      awardCandidates={awardCandidates}
      zoneAwardConfig={zoneAwardConfig}
      canQualify={canQualify}
    />
  );
}
