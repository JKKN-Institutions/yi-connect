import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getScoringSettings } from "@/app/yip/actions/scoring-settings";
import { getScoringFlagsConfig, type FlagDeltas } from "@/app/yip/actions/scoring-flags";
import { getPositionBonusConfigAdmin } from "@/app/yip/actions/positions";
import { ScoringRulesClient } from "./scoring-rules-client";

// Super-admin: global scoring rules — aggregation, special-remarks values,
// role bonuses. Layout gates to super-admin.
export default async function AdminScoringRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const [settings, flags, bonus] = await Promise.all([
    getScoringSettings(),
    getScoringFlagsConfig(),
    getPositionBonusConfig(),
  ]);

  const deltas: FlagDeltas = flags.success
    ? flags.data.deltas
    : { no_confidence_brought: 3, walkout: -5, ruckus: -3, suspension: -10 };

  return (
    <ScoringRulesClient
      initialSettings={settings}
      initialDeltas={deltas}
      initialBonuses={bonus.bonuses}
    />
  );
}
