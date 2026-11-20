import { paramsTotal, type CountedScoreRow, type DutyProgress } from "@/lib/recognitions/scoring";
import { MAX_LAYER_TOTAL } from "@/lib/recognitions/constants";
import type { EvaluatorRow, MentorSendBackRow, ScoreHistoryRow, ScoreRow } from "@/lib/recognitions/types";
import { Seal, formatWhen } from "../../_ui/primitives";

/**
 * Control room only (super admin). Who on each recognition has submitted
 * every sheet and who is still pending. NEVER render this on an evaluator
 * page: an evaluator must not learn other evaluators' progress.
 *
 * The numbers are the platform's own (computeCompleteness perDuty), not
 * re-derived here.
 *
 * Two layers for a Regional Mentor (Piyush, 20 Nov 2026):
 *   1. Round 1, the original evaluation: their marks that COUNT
 *      (perDuty.counted), so a mark the NMT leader's send-back reopened and
 *      the Mentor never resubmitted still counts here through its earlier
 *      submitted mark, exactly as in the recognition-wise Excel report
 *      (Director, 16 Nov: withEarlierMarks). Before 20 Nov this list used
 *      perDuty.submitted (really submitted only), so such a Mentor showed as
 *      "Pending" with no marks while the Excel showed their scores.
 *   2. Re-evaluation, only after a send-back: how many of their marks were
 *      reopened, how many they re-scored, how many not, and per chapter the
 *      earlier total, the new one, and which one counts.
 */

/** "never": has a login but has never signed in. "no-login": no login is linked to the person. */
export type SignInGap = "never" | "no-login";

export type EvaluatorProgressRow = {
  dutyId: string;
  personId: string;
  name: string;
  role: string;
  required: number;
  /** Marks that count: really submitted plus earlier marks standing in for reopened drafts (perDuty.counted). */
  submitted: number;
  /** Re-evaluation after a send-back to the Mentors; null when none of this duty's marks was reopened. */
  reeval: ReevalSummary | null;
};

/** One reopened Mentor mark: the earlier submitted total, the re-score (if any), and the total that counts. */
export type ReevalMark = {
  scoreId: string;
  chapterName: string;
  earlierRound: number;
  earlierTotal: number;
  /** The resubmitted total, or null while the reopened draft is not resubmitted. */
  newTotal: number | null;
  /** The total that counts (the export's number): the re-score if resubmitted, else the earlier mark. */
  countingTotal: number | null;
};

export type ReevalSummary = {
  sentAt: string | null;
  round: number;
  marks: ReevalMark[];
};

/**
 * Per Regional Mentor duty: every score of theirs a send-back reopened (it
 * has a history snapshot), paired with its latest earlier snapshot. Rounds
 * are read from the rows, never assumed. `counted` is the export's
 * listCountedScoresForAward output, so the counting total matches the Excel.
 */
export function buildReevalByDuty(input: {
  scores: ScoreRow[];
  counted: CountedScoreRow[];
  history: ScoreHistoryRow[];
  sendBacks: MentorSendBackRow[];
  chapterOf: (nominationId: string) => string;
}): Map<string, ReevalSummary> {
  const out = new Map<string, ReevalSummary>();
  const countedById = new Map(input.counted.map((c) => [c.id, c]));
  const sendBackById = new Map(input.sendBacks.map((b) => [b.id, b]));
  for (const s of input.scores) {
    if (s.layer !== "rm") continue;
    const round = s.round ?? 1;
    let earlier: ScoreHistoryRow | null = null;
    for (const h of input.history) {
      if (h.score_id === s.id && h.layer === "rm" && h.round < round && (!earlier || h.round > earlier.round)) earlier = h;
    }
    if (!earlier) continue;
    const resubmitted = s.status === "submitted";
    const c = countedById.get(s.id);
    const mark: ReevalMark = {
      scoreId: s.id,
      chapterName: input.chapterOf(s.nomination_id),
      earlierRound: earlier.round,
      earlierTotal: paramsTotal(earlier.params),
      newTotal: resubmitted ? paramsTotal(s.params) : null,
      countingTotal: c && c.status === "submitted" ? paramsTotal(c.params) : null,
    };
    const sb = sendBackById.get(earlier.sendback_id);
    const prev = out.get(s.evaluator_id);
    if (!prev) {
      out.set(s.evaluator_id, { sentAt: sb?.sent_at ?? null, round: sb?.round ?? round, marks: [mark] });
    } else {
      prev.marks.push(mark);
      if (sb && (prev.sentAt === null || Date.parse(sb.sent_at) > Date.parse(prev.sentAt))) {
        prev.sentAt = sb.sent_at;
        prev.round = sb.round;
      }
    }
  }
  for (const r of out.values()) r.marks.sort((a, b) => a.chapterName.localeCompare(b.chapterName));
  return out;
}

const ROLE_ORDER = { leader: 0, nmt: 1, rm: 2, rmNoRegion: 3 } as const;

export function buildEvaluatorRows(
  duties: EvaluatorRow[],
  perDuty: DutyProgress[],
  names: Map<string, { full_name: string }>,
  reevalByDuty: Map<string, ReevalSummary> = new Map()
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
      // The marks that count, as in the Excel report (see the header).
      submitted: p.counted,
      reeval: reevalByDuty.get(d.id) ?? null,
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
  rescoreOpen = false,
  marksHiddenReason = null,
}: {
  rows: EvaluatorProgressRow[];
  signInGaps: Map<string, SignInGap>;
  /** The Mentors can still resubmit (sight.ts mentorMarksOpen, before the Stage 2 deadline). */
  rescoreOpen?: boolean;
  /** Set when the viewer scores this recognition and hasn't submitted: totals stay hidden ("blind until you submit"). */
  marksHiddenReason?: string | null;
}) {
  if (rows.length === 0) {
    return <p className="rx-small rx-mute">No evaluators are assigned to this recognition yet.</p>;
  }
  const count = (s: EvaluatorStatus) => rows.filter((r) => evaluatorStatus(r) === s).length;
  const none = count("none");
  const reevalRows = rows.filter((r) => r.reeval);
  const notRescored = reevalRows.reduce((n, r) => n + r.reeval!.marks.filter((m) => m.newTotal === null).length, 0);
  return (
    <details className="rx-ad-details">
      <summary>
        Evaluators by name: {count("submitted")} submitted · {count("pending")} pending
        {none > 0 ? ` · ${none} with no chapter to score` : ""}
        {reevalRows.length > 0
          ? ` · ${reevalRows.length} Regional Mentor${reevalRows.length === 1 ? "" : "s"} asked to re-evaluate, ${notRescored} mark${notRescored === 1 ? "" : "s"} not re-scored`
          : ""}
      </summary>
      {reevalRows.length > 0 ? (
        <p className="rx-ad-mini" style={{ margin: "0 0 8px" }}>
          Round 1 counts every Mentor mark that counts, as in the Excel report: a mark sent back and not re-scored
          counts through its earlier submitted mark.
          {marksHiddenReason ? ` ${marksHiddenReason}` : ""}
        </p>
      ) : null}
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
                    {gap === "never" ? "Never signed in" : "No login linked"}
                  </span>
                ) : null}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                {r.reeval ? <span className="rx-ad-mini">Round 1</span> : null}
                {status === "submitted" ? (
                  <Seal tone="laurel">Submitted</Seal>
                ) : status === "pending" ? (
                  <Seal tone="vermilion">
                    Pending ({r.submitted} of {r.required} done)
                  </Seal>
                ) : (
                  <Seal tone="mute">No chapter to score</Seal>
                )}
                {r.reeval ? <ReevalSeal reeval={r.reeval} rescoreOpen={rescoreOpen} /> : null}
              </span>
              {r.reeval ? (
                <ReevalDetail reeval={r.reeval} rescoreOpen={rescoreOpen} hideTotals={!!marksHiddenReason} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function ReevalSeal({ reeval, rescoreOpen }: { reeval: ReevalSummary; rescoreOpen: boolean }) {
  const total = reeval.marks.length;
  const done = reeval.marks.filter((m) => m.newTotal !== null).length;
  return (
    <>
      <span className="rx-ad-mini">Re-evaluation</span>
      {done >= total ? (
        <Seal tone="laurel">Re-scored ({done} of {total})</Seal>
      ) : (
        <Seal tone={rescoreOpen ? "gilt" : "mute"}>
          {done === 0 ? "Not re-scored" : `${done} of ${total} re-scored`}
          {rescoreOpen ? "" : " · closed"}
        </Seal>
      )}
    </>
  );
}

/** Per reopened mark: earlier total, re-score, and the total that counts. Totals hidden when the viewer is still blind. */
function ReevalDetail({
  reeval,
  rescoreOpen,
  hideTotals,
}: {
  reeval: ReevalSummary;
  rescoreOpen: boolean;
  hideTotals: boolean;
}) {
  const total = reeval.marks.length;
  const done = reeval.marks.filter((m) => m.newTotal !== null).length;
  const of = (n: number | null) => (n === null ? "—" : `${n}/${MAX_LAYER_TOTAL}`);
  return (
    <details className="rx-small" style={{ flexBasis: "100%" }}>
      <summary style={{ cursor: "pointer" }}>
        Sent back {reeval.sentAt ? formatWhen(reeval.sentAt) : "(date unknown)"} (Mentor round {reeval.round}): {total} reopened ·{" "}
        {done} re-scored · {total - done} not re-scored
      </summary>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {reeval.marks.map((m) => (
          <li key={m.scoreId}>
            {m.chapterName}
            {hideTotals ? (
              m.newTotal !== null ? " · re-scored" : " · not re-scored, the earlier mark counts"
            ) : m.newTotal !== null ? (
              <>
                {" "}· round {m.earlierRound}: {of(m.earlierTotal)} · re-scored: {of(m.newTotal)} · counts: {of(m.countingTotal)}
              </>
            ) : (
              <>
                {" "}· round {m.earlierRound}: {of(m.earlierTotal)} · not re-scored
                {rescoreOpen ? " yet" : ""} · counts: {of(m.countingTotal)} (the round {m.earlierRound} mark)
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
