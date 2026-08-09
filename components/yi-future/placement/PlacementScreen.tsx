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
import { buildPlacementPlan } from "@/lib/yi-future/placement";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { PlacementBoard } from "@/components/yi-future/placement/PlacementBoard";

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
  const plan = buildPlacementPlan({ unteamed, teams });

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
      />
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
