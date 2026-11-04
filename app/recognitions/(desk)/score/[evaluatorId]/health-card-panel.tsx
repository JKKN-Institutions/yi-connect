import { IconLock } from "../../../_ui/icons";
import { HC_TABLE_TITLE, lines, type ChapterHealthCard, type HcMeasure, type HcTableKey } from "@/lib/recognitions/health-card";

/**
 * The chapter's Health Card on the scoring sheet: objective data, frozen,
 * shown as REFERENCE for the evaluator's own Part A marks (30 Oct model: this
 * uploaded score no longer feeds the matrix total),
 * shown before and after submitting (it is not another evaluator's mark, so
 * blind scoring is untouched). Only the super admin changes it, in the
 * control room. Each measure name is a <details> summary: a tap (phone) or
 * click opens its definition and indicators; the title gives a hover hint.
 */
export function HealthCardPanel({
  tableKey,
  measures,
  card,
  weightLayer1,
}: {
  tableKey: HcTableKey;
  measures: HcMeasure[];
  card: ChapterHealthCard | null;
  weightLayer1: number;
}) {
  const hasMeasureScores = !!card && card.scores.some((s) => s.score !== null);
  const showTable = !!card && (hasMeasureScores || card.source === "measures");
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

  if (!card) {
    return (
      <div className="rx-notice" data-hc="none">
        <strong>No Health Card data</strong> for this chapter has been loaded by the super admin yet. Mark Part A on what you
        know of the chapter&apos;s activity.
      </div>
    );
  }

  return (
    <div className="rx-stack" style={{ gap: 8 }} data-hc={card.source ?? (card.incomplete ? "incomplete" : "none")}>
      <p className="rx-small rx-mute rx-row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}>
        <IconLock size={14} />
        <span>
          Table {tableKey} · {HC_TABLE_TITLE[tableKey]}. Read-only: loaded by the Recognitions super admin.
          {showTable ? " Tap a measure to see what it means." : ""}
        </span>
      </p>
      {showTable ? (
        <div className="rx-ledger-wrap">
          <table className="rx-ledger rx-hc-table">
            <thead>
              <tr>
                <th>Measure</th>
                <th className="rx-num">Score</th>
              </tr>
            </thead>
            <tbody>
              {measures.map((m) => {
                const s = card.scores.find((x) => x.key === m.key)?.score ?? null;
                const ind = lines(m.indicators);
                return (
                  <tr key={m.key}>
                    <td>
                      <details className="rx-hc-measure" data-measure={m.key}>
                        <summary title={m.definition}>{m.label}</summary>
                        <div className="rx-small rx-stack" style={{ gap: 4, marginTop: 6 }}>
                          <p style={{ margin: 0 }}>{m.definition}</p>
                          {ind.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
                              {ind.map((x, i) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </details>
                      <div className="rx-small rx-mute">{fmt(m.weight)}% weight</div>
                    </td>
                    <td className="rx-num">{s === null ? <span className="rx-mute">—</span> : fmt(s)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Health Card score (out of 100)</th>
                <td className="rx-num" data-hc-layer1>
                  <strong>{card.layer1 === null ? "missing" : fmt(card.layer1)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="rx-sheet-total" data-hc-layer1-single>
          <span className="rx-small">
            Health Card · one overall score, no measure breakdown
          </span>
          <span className="rx-sheet-total-n">{card.layer1 === null ? "—" : fmt(card.layer1)}</span>
        </div>
      )}
      {card.incomplete ? (
        <p className="rx-small rx-notice">
          Some measure scores are missing, so this chapter&apos;s overall Health Card score can&apos;t be shown until the super admin loads the rest.
        </p>
      ) : null}
      <p className="rx-small rx-mute">
        Reference only. The {weightLayer1}% Health Card share of the final score comes from the Part A marks the Regional
        Mentors and the NMT give, not from this figure.
      </p>
    </div>
  );
}
