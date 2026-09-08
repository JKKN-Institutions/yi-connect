import { UserX } from "lucide-react";
import { Card, CardContent } from "@/components/yip/ui/card";
import type { UnmarkedStudents } from "@/app/yip/actions/unmarked-students";

/**
 * "Not marked" — the results half of Director ruling 08 (2026-08-29): a student
 * who ends up with no mark is LISTED in the results as not marked, rather than
 * quietly omitted. At the SRTN Regional Round 196 students sat and only 168
 * appeared in the results; the other 28 vanished without trace.
 *
 * Presentation only. These students genuinely have no row in `yip.results` and
 * this does NOT create one — computeResults() is untouched, which matters
 * because a hard rubric freeze is in force until 8 September 2026. The list is
 * derived at read time (roster minus whoever the snapshot has a row for) by
 * getUnmarkedStudents, so no score, rank, average or award is read or written.
 *
 * Rendered as a sibling of ResultsClient from the results page, so that file is
 * not touched.
 */
export function NotMarkedPanel({ data }: { data: UnmarkedStudents | null }) {
  if (!data || data.couldNotCheck) return null;
  // Before the first compute there is no snapshot to be missing from — the
  // page's own empty state already says "no results yet".
  if (!data.resultsComputed) return null;
  if (data.notInResults.length === 0) return null;

  const n = data.notInResults.length;

  return (
    <Card className="border-amber-300 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-400" />
      <CardContent className="space-y-3 pt-4 pb-4">
        <div className="flex items-start gap-2">
          <UserX className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Not marked — {n} of {data.totalParticipants} students are not in
              this ranking
            </h2>
            <p className="text-xs text-gray-500">
              No judge saved a mark for {n === 1 ? "this student" : "these students"},
              so the results have no row for them. They are listed here rather
              than left out silently.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {data.notInResults.map((s) => (
            <div key={s.participantId} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {s.participantName}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {[s.constituencyName, s.schoolName].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
                {s.presenceLabel}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
