import "./board.css";
import type { BoardData } from "@/lib/recognitions/board";
import { Ribbon } from "../../_ui/ribbon";

/**
 * Recognitions down the left, Pioneers / Trailblazers / Sparks across the
 * top (27 Oct). On a phone each recognition becomes its own card with the
 * three categories stacked. Read-only; pass the output of loadBoard.
 */
export function BoardMatrix({ board, empty }: { board: BoardData; empty: string }) {
  return (
    <div className="rx-bd" role="table" aria-label="Recognitions by chapter category">
      <div className="rx-bd-row rx-bd-head" role="row">
        <div role="columnheader">Recognition</div>
        {board.columns.map((c) => (
          <div key={c.category} role="columnheader">
            {c.label} <span className="rx-mute rx-num">· {c.chapterCount} chapters</span>
          </div>
        ))}
      </div>
      {board.rows.map((r) => (
        <div key={r.award.id} className="rx-bd-row" role="row">
          <div className="rx-bd-award" role="rowheader">
            <Ribbon vertical={r.award.vertical} kind={r.award.kind} />
            <span className="rx-h3">{r.award.title}</span>
          </div>
          {board.columns.map((c) => {
            const list = r.cells[c.category];
            return (
              <div key={c.category} className="rx-bd-cell" role="cell" data-label={c.label}>
                {list.length === 0 ? (
                  <span className="rx-small rx-mute">{empty}</span>
                ) : (
                  <ul className="rx-rivals rx-small">
                    {list.map((e, i) => (
                      <li key={e.chapterId} className={e.votes !== null && i === 0 ? "rx-bd-lead" : undefined}>
                        {e.chapterName}
                        {e.votes !== null ? <span className="rx-num"> ({e.votes})</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
