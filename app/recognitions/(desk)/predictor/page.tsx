import type { Metadata } from "next";
import { loadBoard, requireRxBoard, sightLine } from "@/lib/recognitions/board";
import { IconDownload } from "../../_ui/icons";
import { NoAccess, PageHead } from "../../_ui/primitives";
import { BoardMatrix } from "../board/board-matrix";

export const metadata: Metadata = { title: "Recognitions predictor" };

export default async function PredictorBoardPage() {
  const gate = await requireRxBoard();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const board = await loadBoard("predictions", gate.sight);
  if (!board) {
    return (
      <div className="rx-stack">
        <PageHead title="Recognitions predictor" />
        <p className="rx-mute">No cycle is open yet.</p>
      </div>
    );
  }
  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={board.cycle.name} title="Recognitions predictor">
        <p>Identify the most vibrant chapter within each vertical, category-wise.</p>
        <p className="rx-mute">
          The chapters expected to be recognised for each recognition, as picked by other chapters in the fun quiz. The number in brackets is the
          votes; the leader is on top and highlighted. Not used in scoring. {sightLine(gate.sight)}
        </p>
        <div>
          <a className="rx-btn rx-btn-quiet" href="/api/recognitions/boards?kind=predictions">
            <IconDownload size={16} /> Download Excel
          </a>
        </div>
      </PageHead>
      <BoardMatrix board={board} empty="No votes yet" />
    </div>
  );
}
