import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import {
  getPositionBonusConfigAdmin,
  listPositionBonusScopes,
} from "@/app/yip/actions/positions";
import { listAllScoringBuckets } from "@/app/yip/actions/scoring-buckets";
import { getScoringSettings } from "@/app/yip/actions/scoring-settings";
import { ScoringFrameworkClient } from "./scoring-framework-client";

// Super-admin: the editable, configurable scoring framework. The 7-bucket /100
// model lives in yip.scoring_buckets (editable here, backwired — the engine
// reads it). Per-session jury criteria come from the static framework spec +
// live session_parameters. Layout (../layout.tsx) gates to super-admin.
export default async function AdminScoringFrameworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  // listAllScoringBuckets(), not listScoringBuckets(): this is the EDITOR, so it
  // must show every component including the level-scoped ones. listScoringBuckets()
  // resolves down to the set that would actually score one round.
  const [buckets, bonus, settings, bonusScopes] = await Promise.all([
    listAllScoringBuckets(),
    getPositionBonusConfigAdmin(),
    getScoringSettings(),
    listPositionBonusScopes(),
  ]);

  return (
    <ScoringFrameworkClient
      initialBuckets={buckets}
      initialBonuses={bonus.bonuses}
      initialUseBuckets={settings.use_bucket_model}
      initialBonusScopes={bonusScopes}
    />
  );
}
