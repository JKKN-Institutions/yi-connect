// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — server half of the placement screen.
//
// Loads the chapter's roster (row-cap-safe, see lib/yi-future/placement-data.ts),
// builds the suggestion plan, and hands it to the client review board. Shared by
// the chapter-admin route and the national drill-in route so the two can never
// show different suggestions for the same chapter.
//
// AUTHORIZATION is the caller's job: each page gates with
// `requireChapterAdmin(chapterId)` BEFORE rendering this. The approve action
// re-gates independently — this component never writes anything.
// ═══════════════════════════════════════════════════════════════════════

import Link from "next/link";
import {
  getActivePlacementEdition,
  getPlacementChapter,
  getTeamsForPlacement,
  getUnteamedForPlacement,
} from "@/lib/yi-future/placement-data";
import {
  buildPlacementPlan,
  buildStrategyOptions,
} from "@/lib/yi-future/placement";
import {
  buildOverrideTargets,
  OVERRIDE_LOG_UNAVAILABLE_REASON,
} from "@/lib/yi-future/placement-override";
import { listPlacementOverrides } from "@/lib/yi-future/placement-override-data";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { PlacementBoard } from "@/components/yi-future/placement/PlacementBoard";
import { DirectPlacementPanel } from "@/components/yi-future/placement/DirectPlacementPanel";
import { OverrideLog } from "@/components/yi-future/placement/OverrideLog";
import type { PlacementOverrideLog } from "@/lib/yi-future/placement-override";

export async function PlacementScreen({
  chapterId,
  backHref,
  backLabel,
}: {
  chapterId: string;
  backHref: string;
  backLabel: string;
}) {
  const edition = await getActivePlacementEdition();
  const chapter = await getPlacementChapter(chapterId);

  if (!chapter) {
    return (
      <Panel
        title="Chapter not found"
        body="That chapter id does not exist. Nothing was loaded and nothing was changed."
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }
  if (!edition) {
    return (
      <Panel
        title="No active edition"
        body="Placement needs an active Future edition. Ask a national admin to activate one."
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  const [unteamed, teams] = await Promise.all([
    getUnteamedForPlacement(chapterId, edition.id),
    getTeamsForPlacement(chapterId, edition.id),
  ]);
  // Both are pure functions over the SAME roster read, so the four strategy
  // cards and the suggestion list can never disagree about this chapter.
  const plan = buildPlacementPlan({ unteamed, teams });
  const strategies = buildStrategyOptions({ unteamed, teams });
  // Same roster read again, so the override picker can never offer a student or
  // a team the rest of this screen does not know about.
  const overrideTargets = buildOverrideTargets({ unteamed, teams });

  // The override log is a SEPARATE table whose migration ships unapplied, so
  // this read is expected to fail on databases where it has not been run. It is
  // caught here because a missing audit table must not take down the placement
  // screen that shipped before it — the consent flow above keeps working, and
  // the override simply reports itself as switched off.
  let overrideLog: PlacementOverrideLog;
  try {
    overrideLog = await listPlacementOverrides(chapterId, edition.id);
  } catch (e) {
    overrideLog = {
      available: false,
      reason: OVERRIDE_LOG_UNAVAILABLE_REASON,
      detail: e instanceof Error ? e.message : null,
    };
  }
  const overridesApplied = overrideLog.available
    ? overrideLog.rows.filter((r) => r.outcome === "applied").length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">
            Place students in teams
          </h2>
          <p className="mt-1 text-sm text-navy/60">
            {chapter.name} · {edition.name} · teams cap at {TEAM_SIZE_MAX}{" "}
            members
          </p>
        </div>
        <Link
          href={backHref}
          className="text-xs font-semibold text-navy hover:text-yi-gold whitespace-nowrap"
        >
          ← {backLabel}
        </Link>
      </div>

      <PlacementBoard
        chapterId={chapterId}
        chapterName={chapter.name}
        plan={plan}
        strategies={strategies}
      />

      {/* The override lives BELOW the whole consent flow on purpose: an admin
          meets the invitation path first, and has to scroll past it and open a
          collapsed panel to place anybody directly. */}
      <DirectPlacementPanel
        chapterId={chapterId}
        targets={overrideTargets}
        disabledReason={overrideLog.available ? null : overrideLog.reason}
        recordedCount={overridesApplied}
      />

      <OverrideLog log={overrideLog} />
    </div>
  );
}

function Panel({
  title,
  body,
  backHref,
  backLabel,
}: {
  title: string;
  body: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-navy">{title}</h2>
      <div className="bg-white border border-navy/10 rounded-lg p-6">
        <p className="text-sm text-navy/70">{body}</p>
        <Link
          href={backHref}
          className="mt-3 inline-block text-xs font-semibold text-navy hover:text-yi-gold"
        >
          ← {backLabel}
        </Link>
      </div>
    </div>
  );
}
