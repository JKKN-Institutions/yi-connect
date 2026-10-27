import type { Metadata } from "next";
import { loadBoard, requireRxBoard, sightLine } from "@/lib/recognitions/board";
import { NoAccess, PageHead } from "../../_ui/primitives";
import { BoardMatrix } from "../board/board-matrix";

export const metadata: Metadata = { title: "Winner predictor" };

export default async function PredictorBoardPage() {
  const gate = await requireRxBoard();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const board = await loadBoard("predictions", gate.sight);
  if (!board) {
    return (
      <div className="rx-stack">
        <PageHead title="Winner predictor" />
        <p className="rx-mute">No cycle is open yet.</p>
      </div>
    );
  }
  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={board.cycle.name} title="Winner predictor">
        <p className="rx-mute">
          Which chapter the chapters expect to win each recognition, from the fun quiz. The number in brackets is the
          votes; the leader is on top and highlighted. Not used in scoring. {sightLine(gate.sight)}
        </p>
      </PageHead>
      <BoardMatrix board={board} empty="No votes yet" />
    </div>
  );
}
