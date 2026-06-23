import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getScoringSettings } from "@/app/yip/actions/scoring-settings";
import { listSessionParameters } from "@/app/yip/actions/session-parameters";
import { getPositionBonusConfigAdmin } from "@/app/yip/actions/positions";
import {
  getScoringFlagsConfig,
  type FlagDeltas,
} from "@/app/yip/actions/scoring-flags";
import { listScoringBuckets } from "@/app/yip/actions/scoring-buckets";
import { listAwardDefinitions } from "@/app/yip/actions/admin-awards";
import { getCommitteeDimensionsConfigAdmin } from "@/app/yip/actions/committee-dimensions";
import { ScoringConfigClient } from "./scoring-config-client";

// Admin layout already gates with requireSuperAdmin() → Forbidden403, so this
// console is national / super-admin only. Always read live (no caching).
export const dynamic = "force-dynamic";

const DEFAULT_DELTAS: FlagDeltas = {
  no_confidence_brought: 0,
  walkout: 0,
  ruckus: 0,
  suspension: 0,
};

export default async function AdminScoringConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const [settings, components, bonusCfg, flagsRes, buckets, awards] =
    await Promise.all([
      getScoringSettings(),
      listSessionParameters(),
      getPositionBonusConfigAdmin(),
      getScoringFlagsConfig(),
      listScoringBuckets(),
      listAwardDefinitions(),
    ]);

  const deltas = flagsRes.success ? flagsRes.data.deltas : DEFAULT_DELTAS;

  return (
    <ScoringConfigClient
      initialSettings={settings}
      initialComponents={components}
      initialBonuses={bonusCfg.bonuses}
      initialDeltas={deltas}
      initialBuckets={buckets}
      initialAwards={awards}
    />
  );
}
