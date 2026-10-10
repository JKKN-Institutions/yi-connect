import "./parts.css";
import type { DossierView, MatrixView, MatrixViewRow, RationaleView } from "./shared";

export function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = n.toFixed(dp);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * The combined ("clubbed") matrix: Health Card, every RM and NMT total,
 * both averages, the weighted total and the provisional rank, per category.
 * Read-only. Plain props: pass the output of buildMatrixView.
 */
export function CombinedMatrix({ view }: { view: MatrixView }) {
  const anyRows = view.categories.some((c) => c.rows.length > 0);
  return (
    <section className="rx-stack" aria-labelledby="rx-p-matrix">
      <div className="rx-spread">
        <h2 className="rx-h2" id="rx-p-matrix">Combined matrix</h2>
        <span className="rx-small rx-mute rx-num">
          Health Card {view.weights.l1}% · RM {view.weights.l2}% · NMT {view.weights.l3}%
        </span>
      </div>
      <p className="rx-small rx-mute">
        Weighted total = {view.weights.l1} × Health Card ÷ 100 + {view.weights.l2} × RM layer + {view.weights.l3} × NMT
        layer. RM layer is{" "}
        {view.layer2Mode === "percentile"
          ? "the percentile of the RM average among nominations in the same region"
          : "the RM average out of 25"}
        ; NMT layer is the NMT average out of 25. A missing layer counts as zero and is flagged. Ties share a
        provisional rank.
      </p>
      {!anyRows ? (
        <p className="rx-mute">No nomination for this award has passed both checks.</p>
      ) : null}
      {view.categories
        .filter((c) => c.rows.length > 0)
        .map((cat) => (
          <div key={cat.category} className="rx-stack">
            <h3 className="rx-h3">
              {cat.label} <span className="rx-mute rx-small">· {cat.rows.length} nomination{cat.rows.length === 1 ? "" : "s"}</span>
            </h3>
            <div className="rx-ledger-wrap">
              <table className="rx-ledger">
                <thead>
                  <tr>
                    <th className="rx-num">Rank</th>
                    <th>Chapter</th>
                    <th>Region</th>
                    <th className="rx-num">Health Card</th>
                    {cat.rmColumns.map((c) => (
                      <th key={c.evaluatorId} className="rx-num">{c.label}</th>
                    ))}
                    <th className="rx-num rx-p-avg">RM avg</th>
                    {cat.nmtColumns.map((c) => (
                      <th key={c.evaluatorId} className="rx-num">{c.label}</th>
                    ))}
                    <th className="rx-num rx-p-avg">NMT avg</th>
                    <th className="rx-num rx-p-total">Weighted total</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.rows.map((r) => (
                    <tr key={r.nominationId}>
                      <td className="rx-num">{r.rank}</td>
                      <td>
                        {r.chapterName}
                        {r.missing.length > 0 ? (
                          <div className="rx-small rx-p-flag">Missing: {r.missing.join(", ")}</div>
                        ) : null}
                      </td>
                      <td>{r.region}</td>
                      <td className="rx-num">
                        {r.l1 === null ? <span className="rx-p-flag">missing</span> : fmt(r.l1)}
                      </td>
                      {cat.rmColumns.map((c) => (
                        <td key={c.evaluatorId} className="rx-num">{fmt(r.perEvaluator[c.evaluatorId])}</td>
                      ))}
                      <td className="rx-num rx-p-avg">{fmt(r.rmAvg)}</td>
                      {cat.nmtColumns.map((c) => (
                        <td key={c.evaluatorId} className="rx-num">{fmt(r.perEvaluator[c.evaluatorId])}</td>
                      ))}
                      <td className="rx-num rx-p-avg">{fmt(r.nmtAvg)}</td>
                      <td className="rx-num rx-p-total">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rx-small rx-mute">
              Evaluator totals are out of 25. A dash means that evaluator did not score the chapter (other region or a
              conflict of interest).
            </p>
            <div>
              {cat.rows.map((r) => (
                <NominationFold key={r.nominationId} row={r} />
              ))}
            </div>
          </div>
        ))}
    </section>
  );
}

function NominationFold({ row }: { row: MatrixViewRow }) {
  return (
    <details className="rx-p-fold">
      <summary>
        <span className="rx-num rx-mute">#{row.rank}</span>
        <span className="rx-h3">{row.chapterName}</span>
        <span className="rx-small rx-mute">Dossier and evaluator notes</span>
      </summary>
      <div className="rx-p-fold-body">
        <Dossier dossier={row.dossier} />
        <Rationales items={row.rationales} />
      </div>
    </details>
  );
}

export function Dossier({ dossier }: { dossier: DossierView }) {
  return (
    <div className="rx-stack">
      <div>
        <div className="rx-eyebrow">Why this chapter deserves the award</div>
        {dossier.reasons.length === 0 ? (
          <p className="rx-mute rx-small">No reasons written.</p>
        ) : (
          <ol className="rx-p-list">
            {dossier.reasons.map((r, i) => (
              <li key={i} className="rx-p-text">{r}</li>
            ))}
          </ol>
        )}
      </div>
      <dl className="rx-p-dl">
        <dt>Flagship event</dt>
        <dd className="rx-p-text">{dossier.flagship.trim() || "Not given"}</dd>
        <dt>Hosted event</dt>
        <dd>
          {dossier.hostedEvent
            ? `${dossier.hostedName ?? "Unnamed event"}${dossier.hostedType ? ` (${dossier.hostedType})` : ""}`
            : "None"}
        </dd>
      </dl>
      <div>
        <div className="rx-eyebrow">Announcement draft</div>
        <p className="rx-p-quote">{dossier.announcement.trim() || "Not written."}</p>
      </div>
    </div>
  );
}

export function Rationales({ items }: { items: RationaleView[] }) {
  if (items.length === 0) return <p className="rx-mute rx-small">No submitted evaluator notes yet.</p>;
  return (
    <div className="rx-stack">
      <div className="rx-eyebrow">Evaluator rationale</div>
      {items.map((it, i) => (
        <div key={i} className="rx-stack" style={{ gap: 6 }}>
          <div className="rx-row" style={{ gap: 8 }}>
            <strong>{it.label}</strong>
            <span className="rx-num rx-small rx-mute">{fmt(it.total)} / 25</span>
          </div>
          {it.reasons.length > 0 ? (
            <ol className="rx-p-list rx-small">
              {it.reasons.map((r, j) => (
                <li key={j} className="rx-p-text">{r}</li>
              ))}
            </ol>
          ) : (
            <p className="rx-small rx-mute">No reasons written.</p>
          )}
          {it.comments ? (
            <div>
              <div className="rx-small rx-mute">Additional comments</div>
              <p className="rx-p-quote rx-small">{it.comments}</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
