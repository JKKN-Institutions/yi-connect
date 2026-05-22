import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import {
  adminGetSeasonStats,
  adminListSeasons,
  type SeasonStats,
} from "@/app/actions/admin-seasons";
import { SeasonsClient } from "./seasons-client";

export default async function AdminSeasonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const seasons = await adminListSeasons();

  // Fetch stats in parallel for a pre-rendered view.
  const statsEntries = await Promise.all(
    seasons.map(async (s) => [s.id, await adminGetSeasonStats(s.id)] as const)
  );
  const statsById: Record<string, SeasonStats> = {};
  for (const [id, stats] of statsEntries) {
    statsById[id] = stats;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <SeasonsClient initialSeasons={seasons} initialStats={statsById} />
    </div>
  );
}
