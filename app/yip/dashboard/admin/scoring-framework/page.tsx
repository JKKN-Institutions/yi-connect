import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getPositionBonusConfigAdmin } from "@/app/yip/actions/positions";
import { listScoringBuckets } from "@/app/yip/actions/scoring-buckets";
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

  const [buckets, bonus, settings] = await Promise.all([
    listScoringBuckets(),
    getPositionBonusConfigAdmin(),
    getScoringSettings(),
  ]);

  return (
    <ScoringFrameworkClient
      initialBuckets={buckets}
      initialBonuses={bonus.bonuses}
      initialUseBuckets={settings.use_bucket_model}
    />
  );
}
