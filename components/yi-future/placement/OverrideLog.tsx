// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — "who was placed without consenting, and by whom".
//
// The Director's condition on the staff override was that it be visible after
// the fact, not just stored. So this panel renders on the placement screen for
// BOTH routes (the chapter's own screen and the national drill-in), it renders
// whether or not the chapter still has anybody unteamed, and it names the admin
// who did each one.
//
// It is a plain server component: no state, no effects, nothing to click. It
// shows what the log says and nothing it infers.
//
// THREE STATES, ALL EXPLICIT
//   • log unreachable → says the override is switched off and why, rather than
//     showing an empty list that would read as "this has never happened".
//   • no rows          → says so in one line, so the absence is a statement.
//   • rows             → newest first, with the outcome of each. `pending` and
//     `failed` attempts are shown too: an attempt that did not land is still
//     something an auditor should see.
// ═══════════════════════════════════════════════════════════════════════

import type {
  PlacementOverrideLog,
  PlacementOverrideRecord,
} from "@/lib/yi-future/placement-override";

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function who(r: PlacementOverrideRecord): string {
  const label = r.placedByName ?? r.placedByEmail ?? "an admin";
  return r.placedByScope === "national"
    ? `${label} (national admin)`
    : `${label} (chapter admin)`;
}

export function OverrideLog({ log }: { log: PlacementOverrideLog }) {
  if (!log.available) {
    return (
      <section className="bg-white border border-navy/15 rounded-lg p-4">
        <h3 className="text-sm font-bold text-navy">
          Direct placements (override)
        </h3>
        <p className="mt-1 text-xs text-navy/70">{log.reason}</p>
        {log.detail && (
          <p className="mt-1 text-[11px] text-navy/50">
            Technical detail: {log.detail}
          </p>
        )}
      </section>
    );
  }

  const applied = log.rows.filter((r) => r.outcome === "applied");
  const attempts = log.rows.filter((r) => r.outcome !== "applied");

  if (log.rows.length === 0) {
    return (
      <section className="bg-white border border-navy/15 rounded-lg p-4">
        <h3 className="text-sm font-bold text-navy">
          Direct placements (override)
        </h3>
        <p className="mt-1 text-xs text-navy/70">
          No student in this chapter has been placed without accepting an
          invitation. Every current team member agreed to join.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white border-2 border-[#F5A623]/50 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-navy/10">
        <h3 className="text-sm font-bold text-navy">
          {applied.length} student{applied.length === 1 ? "" : "s"} placed
          without consenting
          {attempts.length > 0 &&
            ` · ${attempts.length} attempt${attempts.length === 1 ? "" : "s"} that did not complete`}
        </h3>
        <p className="mt-0.5 text-xs text-navy/60">
          These placements skipped the invitation. This is the permanent record —
          it cannot be deleted from the app, and it stays even if the student is
          later removed from the team, so a row here does not by itself mean they
          are still on it.
        </p>
      </div>
      <ul className="divide-y divide-navy/5">
        {log.rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-xs">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`font-bold ${
                  r.outcome === "applied"
                    ? "text-[#B26B00]"
                    : r.outcome === "failed"
                      ? "text-red-600"
                      : "text-navy/50"
                }`}
              >
                {r.outcome === "applied"
                  ? "placed"
                  : r.outcome === "failed"
                    ? "✕ not placed"
                    : "– outcome unknown"}
              </span>
              <span className="font-semibold text-navy">{r.delegateName}</span>
              <span className="text-navy/50">→ {r.teamName}</span>
              <span className="text-navy/60">by {who(r)}</span>
              <span className="text-navy/50">{fmtWhen(r.createdAt)}</span>
            </div>
            <div className="mt-0.5 text-navy/70">
              {r.reason ? (
                <span>Reason given: {r.reason}</span>
              ) : (
                <span className="text-navy/50">No reason was given.</span>
              )}
              {r.hadPendingInvite && (
                <span className="ml-2 text-[#B26B00]">
                  They had an unanswered invitation at the time.
                </span>
              )}
            </div>
            {r.outcome === "failed" && (
              <div className="mt-0.5 text-red-600/80">
                Nothing was placed — {r.errorDetail ?? "reason not recorded"}.
              </div>
            )}
            {r.outcome === "pending" && (
              <div className="mt-0.5 text-navy/60">
                The platform recorded the attempt but never confirmed the
                outcome. Open {r.teamName} to see whether {r.delegateName} is on
                it.
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
