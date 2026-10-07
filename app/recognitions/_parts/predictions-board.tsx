import "./parts.css";
import type { PredictionsView } from "./shared";

/**
 * Chapter sentiment & predictions (Phase 1B quiz). Not used in scoring.
 * Mail 1: visible to the NMT only once Stage 2 is active — the caller decides.
 */
export function PredictionsBoard({ view }: { view: PredictionsView }) {
  const total = view.reduce((s, c) => s + c.voters, 0);
  return (
    <section className="rx-stack" aria-labelledby="rx-p-predictions">
      <h2 className="rx-h2" id="rx-p-predictions">Chapter sentiment &amp; predictions</h2>
      <p className="rx-small rx-mute">
        Which chapter other chapters expect to win. This is the fun quiz from the nomination stage; it does not count
        towards any score.
      </p>
      {total === 0 ? (
        <p className="rx-mute">No chapter has made a prediction for this award.</p>
      ) : (
        <div className="rx-grid">
          {view.map((c) => {
            const top = c.entries[0]?.votes ?? 0;
            return (
              <div key={c.category} className="rx-plate rx-plate-tight rx-stack">
                <div className="rx-spread">
                  <h3 className="rx-h3">{c.label}</h3>
                  <span className="rx-small rx-mute rx-num">
                    {c.voters} vote{c.voters === 1 ? "" : "s"}
                  </span>
                </div>
                {c.entries.length === 0 ? (
                  <p className="rx-small rx-mute">No predictions in this category.</p>
                ) : (
                  <ol className="rx-p-list" style={{ paddingLeft: 0, listStyle: "none" }}>
                    {c.entries.map((e) => (
                      <li key={e.chapterName}>
                        <div className="rx-spread rx-small">
                          <span>{e.chapterName}</span>
                          <span className="rx-num">{e.votes}</span>
                        </div>
                        <div className="rx-p-bar">
                          <div className="rx-p-bar-track">
                            <div className="rx-p-bar-fill" style={{ width: `${top ? (e.votes / top) * 100 : 0}%` }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
