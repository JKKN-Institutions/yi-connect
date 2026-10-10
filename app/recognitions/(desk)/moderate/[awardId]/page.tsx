import Link from "next/link";
import type { Metadata } from "next";
import { requireRxNmtOnAward } from "@/lib/recognitions/auth";
import { getAwardState, latestDecisionFor } from "@/lib/recognitions/data";
import { isPast } from "@/lib/recognitions/phase";
import { Ribbon } from "@/app/recognitions/_ui/ribbon";
import { IconArrowLeft } from "@/app/recognitions/_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, PhaseSeal, formatWhen } from "@/app/recognitions/_ui/primitives";
import { CombinedMatrix } from "@/app/recognitions/_parts/combined-matrix";
import { PredictionsBoard } from "@/app/recognitions/_parts/predictions-board";
import { RankingTable, VersionHistory } from "@/app/recognitions/_parts/ranking-view";
import { loadStage2 } from "@/app/recognitions/_parts/load";
import { buildRankingView, prefillFromMatrix } from "@/app/recognitions/_parts/shared";
import { STAGE2_LOCKED } from "../copy";
import { ModerationForm, type FormCategory, type FormInitial } from "./moderation-form";
import { ReopenButton } from "./reopen-button";

export const metadata: Metadata = { title: "Stage 2 room" };

export default async function Stage2Room({ params }: { params: Promise<{ awardId: string }> }) {
  const { awardId } = await params;
  const gate = await requireRxNmtOnAward(awardId);
  if (!gate.ok) return <NoAccess reason={gate.error} />;

  const state = await getAwardState(awardId);
  if (!state) return <NoAccess reason="This award does not exist or was removed." contact={false} />;
  const { award, cycle, phase } = state;

  const head = (
    <>
      <Link href="/recognitions/moderate" className="rx-link rx-small rx-row" style={{ gap: 6 }}>
        <IconArrowLeft size={14} /> All Stage 2 awards
      </Link>
      <PageHead eyebrow={`${cycle.name} · Stage 2 room`} title={award.title}>
        <div className="rx-row">
          <Ribbon vertical={award.vertical} size="lg" />
          <PhaseSeal phase={phase} />
        </div>
      </PageHead>
    </>
  );

  // BLIND until Stage 2: no scores, matrix, predictions or progress before then.
  if (phase === "setup" || phase === "nominations" || phase === "stage1") {
    return (
      <div className="rx-stack">
        {head}
        <Notice>{STAGE2_LOCKED}</Notice>
      </div>
    );
  }

  // The duty list is already filtered on the directory nmt_leader role, so this flag is authoritative.
  const isLeader = gate.value.is_nmt_leader;
  const data = await loadStage2(state, { withNames: false });
  const latest = state.latestVersion;
  const latestSubmitted = state.latestSubmittedVersion;
  const sendBack =
    phase === "reevaluation" && latestSubmitted ? latestDecisionFor(state.decisions, latestSubmitted.id) : null;
  const deadline = phase === "reevaluation" ? cycle.reevaluation_deadline : cycle.stage2_deadline;
  const windowOpen = !isPast(deadline);
  const draftOpen = latest?.status === "draft";
  const canEdit =
    isLeader && windowOpen && (phase === "stage2" || (phase === "reevaluation" && draftOpen));
  const canReopen = isLeader && windowOpen && phase === "reevaluation" && !draftOpen && !!sendBack;

  // Form data: rows from the matrix, prefilled from the open draft or the computed totals.
  let formCategories: FormCategory[] = [];
  const initial: FormInitial = { scores: {}, ranks: {}, texts: {} };
  if (canEdit) {
    const prefill = prefillFromMatrix(data.matrix);
    formCategories = data.matrix.categories
      .filter((c) => c.rows.length > 0)
      .map((c) => ({
        category: c.category,
        label: c.label,
        rows: c.rows.map((r) => ({
          nominationId: r.nominationId,
          chapterName: r.chapterName,
          region: r.region,
          computedTotal: r.total,
          computedRank: r.rank,
        })),
      }));
    const draft = draftOpen ? latest : null;
    for (const c of formCategories) {
      for (const r of c.rows) {
        const saved = draft?.rankings.find((x) => x.nomination_id === r.nominationId);
        if (draft) {
          initial.scores[r.nominationId] = saved?.final_score != null ? String(saved.final_score) : "";
          initial.ranks[r.nominationId] = saved?.final_rank != null ? String(saved.final_rank) : "";
        } else {
          initial.scores[r.nominationId] = prefill[r.nominationId]?.score.toFixed(2) ?? "";
          initial.ranks[r.nominationId] = prefill[r.nominationId] ? String(prefill[r.nominationId].rank) : "";
        }
      }
    }
    for (const t of draft?.top3 ?? []) {
      initial.texts[t.nomination_id] = { rationale: t.rationale, citation: t.citation };
    }
  }

  const shownVersion = latestSubmitted ?? null;

  return (
    <div className="rx-stack-lg">
      <div className="rx-stack">
        {head}
        {phase === "stage2" || phase === "reevaluation" ? (
          <Deadline label={phase === "reevaluation" ? "Re-evaluation closes" : "Stage 2 closes"} iso={deadline} />
        ) : null}
        {sendBack && sendBack.decision === "reevaluate" ? (
          <Notice tone="alert">
            <strong>National Leadership sent this back:</strong>{" "}
            <span className="rx-p-text">{sendBack.reason}</span>
            <br />
            <span className="rx-small rx-mute">Sent {formatWhen(sendBack.decided_at)}</span>
          </Notice>
        ) : null}
        {phase === "governance" ? (
          <Notice>Version {latestSubmitted?.version} is submitted and waiting for National Leadership.</Notice>
        ) : null}
        {phase === "finalized" ? (
          <Notice tone="ok">National Leadership approved version {latestSubmitted?.version}. This award is final.</Notice>
        ) : null}
      </div>

      <CombinedMatrix view={data.matrix} />
      <PredictionsBoard view={data.predictions} />

      <section className="rx-stack" aria-labelledby="rx-final-ranking">
        <h2 className="rx-h2" id="rx-final-ranking">
          {phase === "reevaluation" ? "Re-evaluation: final ranking" : "Final ranking"}
        </h2>
        {!isLeader ? (
          <Notice>Only the NMT leader enters the final ranking.</Notice>
        ) : canEdit ? (
          <>
            <p className="rx-small rx-mute">
              {draftOpen
                ? `You are editing draft version ${latest!.version}.`
                : "Scores and ranks are prefilled from the combined matrix. Change them after the team meeting."}{" "}
              The top three in each category need a rationale and a citation.
            </p>
            {formCategories.length === 0 ? (
              <p className="rx-mute">No nomination has passed both checks, so there is nothing to rank.</p>
            ) : (
              <ModerationForm
                awardId={award.id}
                categories={formCategories}
                initial={initial}
                mode={phase === "reevaluation" ? "reevaluation" : "stage2"}
              />
            )}
          </>
        ) : canReopen ? (
          <div className="rx-stack">
            <p>Reopen the moderation to amend the ranking and the podium texts, then submit the revised version.</p>
            <ReopenButton awardId={award.id} fromVersion={state.versions[0]?.version ?? latestSubmitted!.version} />
          </div>
        ) : (phase === "stage2" || phase === "reevaluation") && !windowOpen ? (
          <Notice tone="alert">
            {phase === "reevaluation" ? "Re-evaluation" : "Stage 2 moderation"} closed on {formatWhen(deadline)}. The
            ranking can no longer be changed here; ask the Recognitions super admin if the date needs to move.
          </Notice>
        ) : null}
        {shownVersion && !canEdit ? (
          <div className="rx-stack">
            <div className="rx-eyebrow">Latest submitted · version {shownVersion.version}</div>
            <RankingTable view={buildRankingView(shownVersion, state.nominations, data.chapters)} />
          </div>
        ) : null}
        {!shownVersion && !canEdit ? (
          <p className="rx-mute">The NMT leader hasn&apos;t submitted a ranking yet.</p>
        ) : null}
      </section>

      <VersionHistory history={data.history} />
    </div>
  );
}
