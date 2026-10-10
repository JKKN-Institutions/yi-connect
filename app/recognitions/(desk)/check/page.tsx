import { getRxViewer, isChecker } from "@/lib/recognitions/auth";
import { getCurrentCycle } from "@/lib/recognitions/data";
import { checksOpen } from "@/lib/recognitions/check-rules";
import { Deadline, NoAccess, Notice, PageHead, Seal, formatWhen } from "../../_ui/primitives";
import { CheckList } from "./check-list";
import { loadCheckItems } from "./load";

export const metadata = { title: "Check nominations · Yi Recognitions" };

/**
 * The Check desk (recognitions_02). Regional Chairs and Regional Mentors
 * pass each nomination from their region, or send it back with a note.
 * BOTH must pass it before it is scored.
 */
export default async function CheckDeskPage() {
  const viewer = await getRxViewer();
  if (!viewer) return null; // the desk layout already rendered the no-access panel
  if (!isChecker(viewer)) {
    return (
      <NoAccess reason="The Check desk is for Regional Chairs and Regional Mentors. Your Yi account has neither role this year." />
    );
  }

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Before scoring" title="Check nominations" />
        <Notice>No recognitions cycle is open yet.</Notice>
      </div>
    );
  }

  const items = await loadCheckItems(viewer, cycle);
  // NL-added nominations (recognitions_03) stay checkable until the re-evaluation deadline.
  const nlStillOpen = items.filter((i) => i.nlAdded && (i.status === "submitted" || i.status === "returned")).length;
  const rmRegions =[...new Set(viewer.duties.filter((d) => d.layer === "rm").map((d) => d.region ?? ""))].filter(Boolean);

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`${cycle.name} · Before scoring`} title="Check nominations">
        <div className="rx-row" style={{ gap: 8 }}>
          {viewer.regionalChairZones.map((z) => (
            <Seal key={`rc-${z}`} tone="gilt">Regional Chair · {z}</Seal>
          ))}
          {rmRegions.map((r) => (
            <Seal key={`rm-${r}`} tone="laurel">Regional Mentor · {r}</Seal>
          ))}
        </div>
        <p className="rx-small">
          Check each nomination from your region for eligibility and completeness. It goes forward to scoring only
          when the <strong>Regional Chair and a Regional Mentor have both passed it</strong>. Either of you can send
          it back with a note; the chapter fixes it and both of you check the new version. A chapter National
          Leadership added during re-evaluation is marked as such: you check its reason instead of a form, and a
          send-back goes to National Leadership.
        </p>
        <div className="rx-stack" style={{ gap: 4 }}>
          <Deadline label="Chapters fix sent-back nominations by" iso={cycle.fix_deadline} />
          <Deadline label="Checks close" iso={cycle.check_deadline} />
        </div>
      </PageHead>

      {!checksOpen(cycle) ? (
        nlStillOpen > 0 ? (
          <Notice>
            Checks on chapter nominations closed on {formatWhen(cycle.check_deadline)}.{" "}
            {nlStillOpen === 1 ? "One chapter" : `${nlStillOpen} chapters`} added by National Leadership can still be
            checked until {formatWhen(cycle.reevaluation_deadline)}.
          </Notice>
        ) : (
          <Notice>Checks closed on {formatWhen(cycle.check_deadline)}. This page is read-only.</Notice>
        )
      ) : null}

      {items.length === 0 ? (
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No nominations from your region yet</h2>
          <p className="rx-mute">When a chapter in your region submits a nomination, it appears here for you to check.</p>
        </div>
      ) : (
        <CheckList items={items} cycle={cycle} />
      )}
    </div>
  );
}
