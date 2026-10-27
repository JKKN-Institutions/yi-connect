import type { Metadata } from "next";
import { loadBoard, requireRxBoard, sightLine } from "@/lib/recognitions/board";
import { NoAccess, PageHead } from "../../_ui/primitives";
import { BoardMatrix } from "./board-matrix";

export const metadata: Metadata = { title: "Nominations board" };

export default async function NominationsBoardPage() {
  const gate = await requireRxBoard();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const board = await loadBoard("nominations", gate.sight);
  if (!board) {
    return (
      <div className="rx-stack">
        <PageHead title="Nominations board" />
        <p className="rx-mute">No cycle is open yet.</p>
      </div>
    );
  }
  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={board.cycle.name} title="Nominations board">
        <p className="rx-mute">
          Every recognition against the three chapter categories. A chapter appears here as soon as it submits a
          nomination; drafts don&apos;t show. {sightLine(gate.sight)}
        </p>
        <p className="rx-small rx-num">
          {board.total} nomination{board.total === 1 ? "" : "s"} filed so far.
        </p>
      </PageHead>
      <BoardMatrix board={board} empty="None yet" />
    </div>
  );
}
