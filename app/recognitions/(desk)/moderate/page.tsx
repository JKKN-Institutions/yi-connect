import Link from "next/link";
import type { Metadata } from "next";
import { getRxViewer } from "@/lib/recognitions/auth";
import { getAwardState, getCurrentCycle, latestDecisionFor, type AwardState } from "@/lib/recognitions/data";
import { isPast } from "@/lib/recognitions/phase";
import { Ribbon } from "@/app/recognitions/_ui/ribbon";
import { IconArrowRight, IconLock } from "@/app/recognitions/_ui/icons";
import { NoAccess, PageHead, PhaseSeal, formatWhen } from "@/app/recognitions/_ui/primitives";
import { STAGE2_LOCKED } from "./copy";

export const metadata: Metadata = { title: "Stage 2" };

/** What this NMT member should know about the award right now. Never a count of others' progress. */
function waiting(state: AwardState, isLeader: boolean): { text: string; locked: boolean } {
  const { phase, cycle } = state;
  switch (phase) {
    case "setup":
    case "nominations":
    case "stage1":
      return { text: STAGE2_LOCKED, locked: true };
    case "stage2":
      if (isPast(cycle.stage2_deadline)) return { text: `Stage 2 closed on ${formatWhen(cycle.stage2_deadline)}.`, locked: false };
      return isLeader
        ? {
            text: state.latestVersion
              ? `Your draft (version ${state.latestVersion.version}) is saved. Finish and submit the final ranking.`
              : "Enter the final ranking and the top three texts.",
            locked: false,
          }
        : { text: "The combined matrix is open. The NMT leader is entering the final ranking.", locked: false };
    case "governance":
      return { text: "Moderation submitted. Waiting for National Leadership.", locked: false };
    case "reevaluation": {
      const sub = state.latestSubmittedVersion;
      const d = sub ? latestDecisionFor(state.decisions, sub.id) : null;
      const draft = state.latestVersion?.status === "draft";
      if (isPast(cycle.reevaluation_deadline)) {
        return { text: `Re-evaluation closed on ${formatWhen(cycle.reevaluation_deadline)}.`, locked: false };
      }
      if (isLeader) {
        return {
          text: draft
            ? `Re-evaluation draft (version ${state.latestVersion!.version}) is open. Amend and submit.`
            : `National Leadership sent this back${d?.reason ? `: ${d.reason}` : "."} Reopen moderation.`,
          locked: false,
        };
      }
      return { text: "National Leadership sent this back. The NMT leader is revising the ranking.", locked: false };
    }
    case "finalized":
      return { text: "Approved by National Leadership. This award is final.", locked: false };
  }
}

export default async function ModerateList() {
  const viewer = await getRxViewer();
  if (!viewer) return null; // the desk layout already shows the no-access panel
  const nmtDuties = viewer.duties.filter((d) => d.layer === "nmt");
  if (nmtDuties.length === 0) {
    return <NoAccess reason="You are not on the National Management Team of any award this year." />;
  }
  const cycle = await getCurrentCycle();
  const rows = (
    await Promise.all(nmtDuties.map(async (d) => ({ duty: d, state: await getAwardState(d.award_id) })))
  )
    .filter((r): r is { duty: (typeof nmtDuties)[number]; state: AwardState } => r.state !== null)
    .sort((a, b) => a.state.award.sort_order - b.state.award.sort_order || a.state.award.title.localeCompare(b.state.award.title));

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={cycle?.name ?? "Stage 2"} title="Stage 2 · moderation">
        <p className="rx-mute">
          The awards you moderate as part of the National Management Team. Each room opens once every Regional Mentor
          and NMT score for that award is in.
        </p>
      </PageHead>
      <div className="rx-stack">
        {rows.map(({ duty, state }) => {
          const w = waiting(state, duty.is_nmt_leader);
          return (
            <Link
              key={duty.id}
              href={`/recognitions/moderate/${state.award.id}`}
              className="rx-plate rx-stack"
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div className="rx-spread">
                <div className="rx-row" style={{ gap: 10 }}>
                  <Ribbon vertical={state.award.vertical} size="lg" />
                  <h2 className="rx-h2">{state.award.title}</h2>
                </div>
                <div className="rx-row" style={{ gap: 8 }}>
                  {duty.is_nmt_leader ? <span className="rx-eyebrow">NMT leader</span> : null}
                  <PhaseSeal phase={state.phase} />
                </div>
              </div>
              <div className="rx-spread">
                <p className="rx-small" style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}>
                  {w.locked ? <IconLock size={16} className="rx-mute" /> : null}
                  <span className={w.locked ? "rx-mute" : undefined}>{w.text}</span>
                </p>
                <IconArrowRight />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
