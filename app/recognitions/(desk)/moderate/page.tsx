import Link from "next/link";
import type { Metadata } from "next";
import { getRxViewer } from "@/lib/recognitions/auth";
import { getAwardState, getCurrentCycle, latestDecisionFor, listAwards, type AwardState } from "@/lib/recognitions/data";
import { isPast } from "@/lib/recognitions/phase";
import { MARKS_HIDDEN_REASON, marksHiddenFrom } from "@/lib/recognitions/sight";
import { Ribbon } from "@/app/recognitions/_ui/ribbon";
import { IconArrowRight, IconLock } from "@/app/recognitions/_ui/icons";
import { NoAccess, PageHead, PhaseSeal, formatWhen } from "@/app/recognitions/_ui/primitives";
import { STAGE2_LOCKED } from "./copy";

export const metadata: Metadata = { title: "Stage 2" };

/** What this NMT member should know about the award right now. Never a count of others' progress. */
function waiting(
  state: AwardState,
  isLeader: boolean,
  isMentor = false,
  marksHidden = false
): { text: string; locked: boolean } {
  const { phase, cycle } = state;
  // recognitions_08: the super admin hid the marks from this plain NMT seat, so the room never opens for them.
  if (marksHidden) {
    return { text: MARKS_HIDDEN_REASON, locked: true };
  }
  if (isMentor && phase !== "setup" && phase !== "nominations" && phase !== "stage1") {
    return { text: "Read-only: the round-1 leaderboard and every mark, for the joint call.", locked: false };
  }
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
      return { text: "Approved by National Leadership. This recognition is final.", locked: false };
  }
}

export default async function ModerateList() {
  const viewer = await getRxViewer();
  if (!viewer) return null; // the desk layout already shows the no-access panel
  // recognitions_05: Regional Mentors open the room too (read-only). One row per recognition.
  const nmtDuties = viewer.duties
    .filter((d) => d.layer === "nmt" || !viewer.duties.some((x) => x.layer === "nmt" && x.award_id === d.award_id))
    .filter((d, i, all) => all.findIndex((x) => x.award_id === d.award_id) === i);
  // 20 Nov 2026: the super admin and National Leadership open EVERY recognition's room, view only.
  const oversight = viewer.isSuperAdmin || viewer.isNationalLeadership;
  if (nmtDuties.length === 0 && !oversight) {
    return <NoAccess reason="You are not a Regional Mentor or on the National Management Team of any recognition this year." />;
  }
  const cycle = await getCurrentCycle();
  const awardIds = oversight && cycle ? (await listAwards(cycle.id)).map((a) => a.id) : nmtDuties.map((d) => d.award_id);
  const rows = (
    await Promise.all(
      awardIds.map(async (id) => ({
        duty: nmtDuties.find((d) => d.award_id === id) ?? null,
        state: await getAwardState(id),
      }))
    )
  )
    .filter((r): r is { duty: (typeof nmtDuties)[number] | null; state: AwardState } => r.state !== null)
    .sort((a, b) => a.state.award.sort_order - b.state.award.sort_order || a.state.award.title.localeCompare(b.state.award.title));

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={cycle?.name ?? "Stage 2"} title="Stage 2 · moderation">
        <p className="rx-mute">
          {oversight
            ? "Every recognition's Stage 2 room. Where you hold no NMT or Regional Mentor seat, you see the room view only: the marks, the standings and the ranking, with nothing to change."
            : "The recognitions you moderate as part of the National Management Team. Each room opens once every Regional Mentor and NMT score for that recognition is in."}
        </p>
      </PageHead>
      <div className="rx-stack">
        {rows.map(({ duty, state }) => {
          const w = duty
            ? waiting(state, duty.is_nmt_leader, duty.layer === "rm", marksHiddenFrom(state, viewer.duties))
            : {
                text:
                  state.phase === "setup" || state.phase === "nominations" || state.phase === "stage1"
                    ? "View only. Stage 2 hasn't opened yet: the room shows the marks submitted so far."
                    : `View only. ${waiting(state, false).text}`,
                locked: false,
              };
          return (
            <Link
              key={state.award.id}
              href={`/recognitions/moderate/${state.award.id}`}
              className="rx-plate rx-stack"
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div className="rx-spread">
                <div className="rx-row" style={{ gap: 10 }}>
                  <Ribbon vertical={state.award.vertical} kind={state.award.kind} size="lg" />
                  <h2 className="rx-h2">{state.award.title}</h2>
                </div>
                <div className="rx-row" style={{ gap: 8 }}>
                  {duty?.is_nmt_leader ? <span className="rx-eyebrow">NMT leader</span> : null}
                  {duty?.layer === "rm" ? <span className="rx-eyebrow">Regional Mentor · read-only</span> : null}
                  {!duty ? <span className="rx-eyebrow">View only</span> : null}
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
