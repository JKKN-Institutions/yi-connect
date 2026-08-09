import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getScoreGrid } from "@/app/yip/actions/scores-grid";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { ScoreGridClient } from "./score-grid-client";

// Organiser-side scoring grid: per-juror coverage matrix, participants shown
// as constituency NUMBERS only (never names — jury-blindness doctrine, safe to
// project). Any event viewer (organiser and up) sees coverage; numeric score
// values are additionally gated to canViewScores inside the action (masked
// server-side for other roles).

export default async function ScoringGridPage({
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

  const access = await getYipEventAccess(id);
  if (!access.canView) {
    return (
      <Forbidden403 reason="You don't have access to this event's score grid. Your role may not include this event's chapter or region." />
    );
  }

  const data = await getScoreGrid(id);
  if (!data) {
    return (
      <Forbidden403 reason="The score grid is not available for this event. The event may have been deleted, or your role may not include access." />
    );
  }

  return <ScoreGridClient eventId={id} data={data} />;
}
