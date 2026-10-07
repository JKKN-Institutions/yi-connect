import "./parts.css";
import { Seal, formatWhen } from "../_ui/primitives";
import { fmt } from "./combined-matrix";
import type { HistoryView, RankingView } from "./shared";

/** One moderation version's final ranking and podium, read-only. */
export function RankingTable({ view }: { view: RankingView }) {
  if (view.length === 0) return <p className="rx-mute rx-small">No ranking entered in this version.</p>;
  return (
    <div className="rx-stack">
      {view.map((cat) => (
        <div key={cat.category} className="rx-stack">
          <h3 className="rx-h3">{cat.label}</h3>
          <div className="rx-ledger-wrap">
            <table className="rx-ledger">
              <thead>
                <tr>
                  <th className="rx-num">Final rank</th>
                  <th>Chapter</th>
                  <th>Region</th>
                  <th className="rx-num">Final score</th>
                </tr>
              </thead>
              <tbody>
                {cat.entries.map((e) => (
                  <tr key={e.nominationId}>
                    <td className="rx-num">{e.finalRank ?? "—"}</td>
                    <td>{e.chapterName}</td>
                    <td>{e.region}</td>
                    <td className="rx-num">{fmt(e.finalScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cat.podium.length > 0 ? (
            <div className="rx-podium">
              {cat.podium.map((p) => (
                <article key={p.rank} className="rx-plate rx-place rx-stack" data-rank={p.rank}>
                  <div>
                    <div className="rx-eyebrow">{p.placeLabel}</div>
                    <div className="rx-h2">{p.chapterName}</div>
                  </div>
                  <div>
                    <div className="rx-small rx-mute">Why {p.placeLabel}?</div>
                    <p className="rx-p-text rx-small">{p.rationale || "Not written yet."}</p>
                  </div>
                  <div>
                    <div className="rx-small rx-mute">{p.placeLabel} citation</div>
                    <p className="rx-p-quote rx-small">{p.citation || "Not written yet."}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Every moderation version, newest first, each with the decisions taken on it. */
export function VersionHistory({ history }: { history: HistoryView }) {
  return (
    <section className="rx-stack" aria-labelledby="rx-p-history">
      <h2 className="rx-h2" id="rx-p-history">Version history</h2>
      <p className="rx-small rx-mute">
        Every moderation is kept. A submitted version is never changed; a re-evaluation opens a new version.
      </p>
      {history.length === 0 ? (
        <p className="rx-mute">No moderation has been started yet.</p>
      ) : (
        <div>
          {history.map((v) => (
            <details key={v.id} className="rx-p-fold">
              <summary>
                <span className="rx-h3">Version {v.version}</span>
                <Seal tone={v.status === "submitted" ? "laurel" : "gilt"}>
                  {v.status === "submitted" ? "Submitted" : "Draft"}
                </Seal>
                {v.decisions[0] ? (
                  <Seal tone={v.decisions[0].decision === "approve" ? "laurel" : "vermilion"}>
                    {v.decisions[0].decision === "approve" ? "Approved" : "Sent back"}
                  </Seal>
                ) : null}
                <span className="rx-small rx-mute">
                  {v.status === "submitted"
                    ? `Submitted ${formatWhen(v.submittedAt)}${v.submittedBy ? ` by ${v.submittedBy}` : ""}`
                    : `Started ${formatWhen(v.createdAt)}${v.createdBy ? ` by ${v.createdBy}` : ""}`}
                </span>
              </summary>
              <div className="rx-p-fold-body">
                {v.respondsTo ? (
                  <p className="rx-small">
                    <span className="rx-mute">Opened in answer to the send-back of {formatWhen(v.respondsTo.decidedAt)}: </span>
                    <span className="rx-p-text">{v.respondsTo.reason ?? ""}</span>
                  </p>
                ) : null}
                {v.decisions.length > 0 ? (
                  <div className="rx-stack" style={{ gap: 6 }}>
                    <div className="rx-eyebrow">National Leadership decisions</div>
                    {v.decisions.map((d, i) => (
                      <p key={i} className="rx-small">
                        <strong>{d.decision === "approve" ? "Approved" : "Sent back for re-evaluation"}</strong>{" "}
                        <span className="rx-mute">
                          {formatWhen(d.decidedAt)}
                          {d.decidedBy ? ` by ${d.decidedBy}` : ""}
                        </span>
                        {d.reason ? (
                          <>
                            <br />
                            <span className="rx-p-text">{d.reason}</span>
                          </>
                        ) : null}
                      </p>
                    ))}
                  </div>
                ) : null}
                <RankingTable view={v.ranking} />
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
