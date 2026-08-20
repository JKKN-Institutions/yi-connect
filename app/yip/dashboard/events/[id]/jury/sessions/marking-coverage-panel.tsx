import { AlertTriangle, UserCheck, Users } from "lucide-react";
import type { MarkingCoverage } from "@/app/yip/actions/results";

// ─────────────────────────────────────────────────────────────────────
// Marking coverage — the CHAIR's view.
//
// The results screen is super-admin only (canViewScores), deliberately, to
// protect named minor students' scores. That left the chapter chair — the only
// person who can actually send another judge to a student mid-round — unable to
// see which students still need one. This panel closes that gap without touching
// the safeguard (Director, 2026-08-19).
//
// It shows COVERAGE, never scores: who marked, how many were assigned, and which
// bench a mark was taken on. No score, mark, total, average or rank appears here,
// and getMarkingCoverage() does not select one. Anything that would let a score
// be inferred does not belong on this panel.
// ─────────────────────────────────────────────────────────────────────

export function MarkingCoveragePanel({
  coverage,
}: {
  coverage: MarkingCoverage;
}) {
  const { singleJudgeStudents, sideChangeStudents, couldNotCheck } = coverage;

  // Say so rather than showing an empty panel that reads as "all clear".
  if (couldNotCheck) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Marking coverage could not be checked</p>
            <p className="mt-0.5">{couldNotCheck}</p>
          </div>
        </div>
      </div>
    );
  }

  if (singleJudgeStudents.length === 0 && sideChangeStudents.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <div className="flex items-start gap-2">
          <UserCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            Every student marked so far was seen by all the judges assigned to
            their sessions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {singleJudgeStudents.length > 0 && (
        <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <div className="flex items-start gap-2">
            <UserCheck className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {singleJudgeStudents.length}{" "}
                {singleJudgeStudents.length === 1 ? "student needs" : "students need"}{" "}
                another judge
              </p>
              <p className="mt-0.5">
                Fewer judges put marks on record for them than were assigned to
                the session. The marks they have still count exactly as they are.
                If the round is still running, sending another judge to watch
                them is worth doing now.
              </p>
              <ul className="mt-2 space-y-1.5 border-t border-sky-200 pt-2">
                {singleJudgeStudents.map((s) => (
                  <li key={s.participantId} className="text-xs">
                    <span className="font-medium">{s.participantName}</span>
                    {s.constituencyName ? (
                      <span className="text-sky-800/70"> — {s.constituencyName}</span>
                    ) : null}
                    <span className="block text-sky-800/70">
                      {s.sessions
                        .map(
                          (x) => `${x.label} (${x.marked} of ${x.assigned} judges)`
                        )
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {sideChangeStudents.length > 0 && (
        <div className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {sideChangeStudents.length}{" "}
                {sideChangeStudents.length === 1 ? "student changed" : "students changed"}{" "}
                bench part-way through
              </p>
              <p className="mt-0.5">
                They were marked on the government side in some sessions and on
                the opposition side in others — normally because the government
                changed after the no-confidence motion. Each mark was judged on
                the criteria for the bench they were on at the time, and stays as
                it is.
              </p>
              <ul className="mt-2 space-y-1.5 border-t border-violet-200 pt-2">
                {sideChangeStudents.map((s) => (
                  <li key={s.participantId} className="text-xs">
                    <span className="font-medium">{s.participantName}</span>
                    {s.constituencyName ? (
                      <span className="text-violet-800/70">
                        {" "}
                        — {s.constituencyName}
                      </span>
                    ) : null}
                    <span className="block text-violet-800/70">
                      {s.sideLabels.join(" and ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
