// Chapter-admin route: place MY chapter's unteamed students.
//
// The chapter is taken from the signed-in user's own core-team context — never
// from a URL parameter — so a chair cannot aim this screen at another chapter.
// `requireChapterAdmin` then re-checks that same chapter: it fails CLOSED and
// denies EXPLICITLY (/yi-future/forbidden). When the user has no chapter at all
// (e.g. a national admin who is on no core team) we render a stated reason with
// a link onward, NOT a silent redirect to /yi-future/chapter — a silent bounce
// is the undiagnosable failure this codebase has been bitten by before.

import Link from "next/link";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { PlacementScreen } from "@/components/yi-future/placement/PlacementScreen";

// Placement decisions read live team sizes — a cached snapshot would suggest
// seats that are already taken.
export const dynamic = "force-dynamic";

export default async function ChapterPlacementPage() {
  const ctx = await getChapterContext();

  if (!ctx) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-navy">Place students in teams</h2>
        <div className="bg-white border border-navy/10 rounded-lg p-6">
          <p className="text-sm font-semibold text-navy">
            You are not on a chapter core team for the active edition.
          </p>
          <p className="mt-1 text-sm text-navy/70">
            This screen places one chapter&apos;s students, so it needs to know
            which chapter you run. National admins can open any chapter from the
            unteamed-delegates list instead.
          </p>
          <Link
            href="/yi-future/national/admin/delegates/unteamed"
            className="mt-3 inline-block text-xs font-semibold text-navy hover:text-yi-gold"
          >
            Unteamed delegates (national) →
          </Link>
        </div>
      </div>
    );
  }

  await requireChapterAdmin(ctx.chapterId);

  return (
    <PlacementScreen
      chapterId={ctx.chapterId}
      backHref="/yi-future/chapter/teams"
      backLabel="Teams"
    />
  );
}
