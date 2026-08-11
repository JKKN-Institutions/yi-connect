"use client";

// National-admin "reopen this juror's scorecard" control, shown against each
// submitted evaluation on /yi-future/chapter/scoring.
//
// This is used at a live chapter final, under time pressure, by people who are
// not technical — a juror says "I submitted by mistake" while the next team is
// already presenting. So:
//   - the confirm step spells out the consequence in plain words, including
//     the one that surprises people (the team's average drops until the juror
//     submits again), rather than asking "Are you sure?"
//   - it names the juror and the team, so the wrong row cannot be clicked by
//     accident on a page listing several jurors per team
//   - a second, differently-worded click is required to actually run it
//
// Matches UnlockAllTeamsButton's arm/confirm shape deliberately — an admin who
// has used one should recognise the other.

import { useState, useTransition } from "react";
import { unlockEvaluation } from "@/app/yi-future/actions/evaluations";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function UnlockEvaluationButton({
  evaluationId,
  juryName,
  teamName,
}: {
  evaluationId: string;
  juryName: string;
  teamName: string;
}) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  if (result) {
    return (
      <p
        className={
          result.ok
            ? "text-xs font-semibold text-yi-green"
            : "text-xs font-semibold text-red-600"
        }
      >
        {result.ok ? (result.message ?? "Reopened.") : result.error}
      </p>
    );
  }

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await unlockEvaluation({ evaluationId }));
      } catch {
        // A thrown action (flaky venue wifi, mid-deploy version skew) must
        // never look like it worked.
        setResult({
          ok: false,
          error:
            "Couldn't reopen the scorecard — check your connection and try again.",
        });
      }
    });
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
      >
        <span>🔓</span> Reopen
      </button>
    );
  }

  return (
    <div className="text-right">
      <p className="text-xs text-navy/70 max-w-[280px] mb-1.5">
        Lets <span className="font-semibold">{juryName}</span> change their
        score for {teamName} and submit again. Nothing is deleted — but until
        they submit again this score is left out of the team&apos;s average.
      </p>
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="text-xs font-bold text-navy bg-[#F5A623] hover:bg-[#F5A623]/90 rounded px-3 py-1.5 disabled:opacity-40"
        >
          {pending ? "Reopening…" : "Yes, reopen this scorecard"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={pending}
          className="text-xs font-semibold text-navy/60 hover:text-navy px-2 py-1.5"
        >
          Cancel
        </button>
      </span>
    </div>
  );
}
