import type { DutyProgress } from "@/lib/recognitions/scoring";
import type { EvaluatorRow } from "@/lib/recognitions/types";
import { Seal } from "../../_ui/primitives";

/**
 * Control room only (super admin). Who on each recognition has submitted
 * every sheet and who is still pending. NEVER render this on an evaluator
 * page: an evaluator must not learn other evaluators' progress.
 *
 * The numbers are the platform's own (computeCompleteness perDuty), not
 * re-derived here.
 */

/** "never": has a login but has never signed in. "no-login": no login linked to the person, so they cannot sign in. */
export type SignInGap = "never" | "no-login";

export type EvaluatorProgressRow = {
  dutyId: string;
  personId: string;
  name: string;
  role: string;
  required: number;
  submitted: number;
};

const ROLE_ORDER = { leader: 0, nmt: 1, rm: 2, rmNoRegion: 3 } as const;

export function buildEvaluatorRows(
  duties: EvaluatorRow[],
  perDuty: DutyProgress[],
  names: Map<string, { full_name: string }>
): EvaluatorProgressRow[] {
  const byId = new Map(duties.map((d) => [d.id, d]));
  const sortable = perDuty.flatMap((p) => {
    const d = byId.get(p.evaluatorId);
    if (!d) return [];
    const region = (d.region ?? "").trim();
    const rank =
      d.layer === "nmt" ? (d.is_nmt_leader ? ROLE_ORDER.leader : ROLE_ORDER.nmt) : region ? ROLE_ORDER.rm : ROLE_ORDER.rmNoRegion;
    const role =
      d.layer === "nmt" ? (d.is_nmt_leader ? "NMT leader" : "NMT") : region ? `RM ${region}` : "RM (no region)";
    const row: EvaluatorProgressRow = {
      dutyId: d.id,
      personId: d.person_id,
      name: names.get(d.person_id)?.full_name?.trim() || "Unknown person",
      role,
      required: p.required,
      submitted: p.submitted,
    };
    return [{ rank, region, row }];
  });
  sortable.sort(
    (a, b) => a.rank - b.rank || a.region.localeCompare(b.region) || a.row.name.localeCompare(b.row.name)
  );
  return sortable.map((s) => s.row);
}

export type EvaluatorStatus = "submitted" | "pending" | "none";

export function evaluatorStatus(r: Pick<EvaluatorProgressRow, "required" | "submitted">): EvaluatorStatus {
  if (r.required === 0) return "none";
  return r.submitted >= r.required ? "submitted" : "pending";
}

export function EvaluatorProgress({
  rows,
  signInGaps,
}: {
  rows: EvaluatorProgressRow[];
  signInGaps: Map<string, SignInGap>;
}) {
  if (rows.length === 0) {
    return <p className="rx-small rx-mute">No evaluators are assigned to this recognition yet.</p>;
  }
  const count = (s: EvaluatorStatus) => rows.filter((r) => evaluatorStatus(r) === s).length;
  const none = count("none");
  return (
    <details className="rx-ad-details">
      <summary>
        Evaluators by name: {count("submitted")} submitted · {count("pending")} pending
        {none > 0 ? ` · ${none} with no chapter to score` : ""}
      </summary>
      <ul className="rx-stack" style={{ gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r) => {
          const status = evaluatorStatus(r);
          const gap = status === "pending" ? signInGaps.get(r.personId) : undefined;
          return (
            <li
              key={r.dutyId}
              className="rx-spread rx-small"
              style={{ gap: "4px 12px", borderTop: "1px solid var(--rx-line)", paddingTop: 8 }}
            >
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <strong>{r.name}</strong> <span className="rx-mute">· {r.role}</span>
                {gap ? (
                  <span className="rx-ad-mini" style={{ display: "block" }}>
                    {gap === "never" ? "Never signed in" : "No login linked, so they cannot sign in"}
                  </span>
                ) : null}
              </span>
              {status === "submitted" ? (
                <Seal tone="laurel">Submitted</Seal>
              ) : status === "pending" ? (
                <Seal tone="vermilion">
                  Pending ({r.submitted} of {r.required} done)
                </Seal>
              ) : (
                <Seal tone="mute">No chapter to score</Seal>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
