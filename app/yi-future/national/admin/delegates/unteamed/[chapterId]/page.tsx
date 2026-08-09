// National drill-in: place one chapter's unteamed students.
//
// Gated with requireChapterAdmin(chapterId) rather than the national-only gate,
// so the SAME code serves a national admin (isNational short-circuits) and, if
// this route is ever exposed under /chapter, a chair of that one chapter.
// requireChapterAdmin fails CLOSED (an unknown/blank chapter denies) and denies
// EXPLICITLY by redirecting to /yi-future/forbidden — never a silent bounce to a
// dashboard, which would look like the link is broken.

import { requireChapterAdmin } from "@/lib/yi-future/auth/require-access";
import { PlacementScreen } from "@/components/yi-future/placement/PlacementScreen";

// Placement decisions read live team sizes — a cached snapshot would suggest
// seats that are already taken.
export const dynamic = "force-dynamic";

export default async function NationalChapterPlacementPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  await requireChapterAdmin(chapterId);

  return (
    <PlacementScreen
      chapterId={chapterId}
      backHref="/yi-future/national/admin/delegates/unteamed"
      backLabel="All unteamed delegates"
    />
  );
}
