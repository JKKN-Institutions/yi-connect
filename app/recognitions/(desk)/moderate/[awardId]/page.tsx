import Link from "next/link";
import type { Metadata } from "next";
import { requireRxEvaluatorOnAward } from "@/lib/recognitions/auth";
import { getAwardState, getPeople, homeChapterNotes, latestDecisionFor } from "@/lib/recognitions/data";
import { mentorRescoreOpen, scoreSight } from "@/lib/recognitions/sight";
import { isPast } from "@/lib/recognitions/phase";
import { Ribbon } from "@/app/recognitions/_ui/ribbon";
import { IconArrowLeft } from "@/app/recognitions/_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, PhaseSeal, formatWhen } from "@/app/recognitions/_ui/primitives";
import { CombinedMatrix } from "@/app/recognitions/_parts/combined-matrix";
import { PredictionsBoard } from "@/app/recognitions/_parts/predictions-board";
import { RankingTable, VersionHistory } from "@/app/recognitions/_parts/ranking-view";
import { loadStage2 } from "@/app/recognitions/_parts/load";
import { buildRankingView, prefillFromMatrix } from "@/app/recognitions/_parts/shared";
import { CategoryTabs } from "@/app/recognitions/_parts/category-tabs";
import { STAGE2_LOCKED } from "../copy";
import { ModerationForm, type FormCategory, type FormInitial } from "./moderation-form";
import { ReopenButton } from "./reopen-button";
import { MentorSendBackPanel, SendBackHistory } from "./mentor-sendback";

export const metadata: Metadata = { title: "Stage 2 room" };

export default async function Stage2Room({ params }: { params: Promise<{ awardId: string }> }) {
  const { awardId } = await params;
  // recognitions_05: Regional Mentors open this room too, read-only.
  const gate = await requireRxEvaluatorOnAward(awardId);
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const nmtDuty = gate.value.find((d) => d.layer === "nmt") ?? null;

  const state = await getAwardState(awardId);
  if (!state) return <NoAccess reason="This recognition does not exist or was removed." contact={false} />;
  const home = await homeChapterNotes(state);
  const { award, cycle, phase } = state;

  const head = (
    <>
      <Link href="/recognitions/moderate" className="rx-link rx-small rx-row" style={{ gap: 6 }}>
        <IconArrowLeft size={14} /> All Stage 2 recognitions
      </Link>
      <PageHead eyebrow={`${cycle.name} · Stage 2 room`} title={award.title}>
        <div className="rx-row">
          <Ribbon vertical={award.vertical} kind={award.kind} size="lg" />
          <PhaseSeal phase={phase} />
        </div>
      </PageHead>
    </>
  );

  // BLIND until YOU submit (recognitions_05): no scores, matrix, predictions
  // or progress until this person has submitted every sheet they hold for
  // this recognition, or Stage 2 has opened (and their sheet isn't sent back).
  const sight = scoreSight(state, gate.value);
  const rescore = mentorRescoreOpen(state);
  const latestSendBack = state.sendBacks[0] ?? null;
  const sendBackNotice =
    rescore && latestSendBack ? (
      <Notice tone="alert">
        <strong>The NMT leader sent this recognition back to the Regional Mentors:</strong>{" "}
        <span className="rx-p-text">{latestSendBack.remark}</span>
        <br />
        <span className="rx-small rx-mute">
          Sent {formatWhen(latestSendBack.sent_at)} · Mentor round {latestSendBack.round} open until{" "}
          {formatWhen(cycle.stage2_deadline)}
        </span>
      </Notice>
    ) : null;
  if (!sight.sees) {
    return (
      <div className="rx-stack">
        {head}
        {sendBackNotice}
        <Notice>{phase === "setup" || phase === "nominations" ? STAGE2_LOCKED : sight.reason}</Notice>
        <div>
          <Link href="/recognitions/score" className="rx-link rx-small">Go to my scoring sheets</Link>
        </div>
      </div>
    );
  }

  // The duty list is already filtered on the directory nmt_leader role, so this flag is authoritative.
  const isLeader = nmtDuty?.is_nmt_leader ?? false;
  const beforeStage2 = phase === "setup" || phase === "nominations" || phase === "stage1";
  const sendBackPeople = await getPeople(state.sendBacks.map((b) => b.sent_by));
  const canSendBack =
    isLeader && (phase === "stage1" || phase === "stage2") && !rescore && !isPast(cycle.stage2_deadline);
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
  const initial: FormInitial = { ranks: {}, reasons: {}, texts: {} };
  const prefill = prefillFromMatrix(data.matrix);
  if (canEdit) {
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
          // The matrix rank (ties share it) and how many chapters share it.
          computedRank: prefill[r.nominationId]?.matrixRank ?? r.rank,
          tieSize: prefill[r.nominationId]?.tieSize ?? 1,
        })),
      }));
    const draft = draftOpen ? latest : null;
    for (const c of formCategories) {
      for (const r of c.rows) {
        const saved = draft?.rankings.find((x) => x.nomination_id === r.nominationId);
        if (draft) {
          initial.ranks[r.nominationId] = saved?.final_rank != null ? String(saved.final_rank) : "";
          initial.reasons[r.nominationId] = saved?.reason ?? "";
        } else {
          initial.ranks[r.nominationId] = prefill[r.nominationId] ? String(prefill[r.nominationId].rank) : "";
          initial.reasons[r.nominationId] = "";
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
        {!isLeader ? (
          <Notice>
            Read-only. You see every evaluator&apos;s marks for this recognition
            {sight.why === "submitted" ? " because you have submitted your own sheet" : ""}. Nothing here can be changed.
          </Notice>
        ) : null}
        {sendBackNotice}
        {beforeStage2 ? (
          <Notice>
            Round 1 is still being scored: the leaderboard below shows only the marks submitted so far.
          </Notice>
        ) : null}
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
          <Notice tone="ok">National Leadership approved version {latestSubmitted?.version}. This recognition is final.</Notice>
        ) : null}
      </div>

      <CategoryTabs counts={Object.fromEntries(data.matrix.categories.map((c) => [c.category, c.rows.length]))}>
      <CombinedMatrix view={data.matrix} home={home} />
      <PredictionsBoard view={data.predictions} />

      <section className="rx-stack" aria-labelledby="rx-final-ranking">
        <h2 className="rx-h2" id="rx-final-ranking">
          {phase === "reevaluation" ? "Re-evaluation: final ranking" : "Final ranking"}
        </h2>
        {!isLeader ? (
          <Notice>Only the NMT leader enters the final ranking.</Notice>
        ) : beforeStage2 ? (
          <Notice>The final ranking opens in Stage 2, once every Regional Mentor and NMT mark is in.</Notice>
        ) : canEdit ? (
          <>
            <p className="rx-small rx-mute">
              {draftOpen
                ? `You are editing draft version ${latest!.version}.`
                : "Ranks are prefilled from the combined matrix. Change them on the call with the Regional Mentors, and say why for every chapter that moves."}{" "}
              The 3 finalists in each category also need a rationale and a citation.
            </p>
            {formCategories.length === 0 ? (
              <p className="rx-mute">No nomination is in the race, so there is nothing to rank.</p>
            ) : (
              <ModerationForm
                awardId={award.id}
                categories={formCategories}
                initial={initial}
                mode={phase === "reevaluation" ? "reevaluation" : "stage2"}
                home={home}
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
            <RankingTable
              view={buildRankingView(shownVersion, state.nominations, data.chapters, undefined, prefill)}
              home={home}
            />
          </div>
        ) : null}
        {!shownVersion && !canEdit ? (
          <p className="rx-mute">The NMT leader hasn&apos;t submitted a ranking yet.</p>
        ) : null}
      </section>
      </CategoryTabs>

      {canSendBack ? <MentorSendBackPanel awardId={award.id} closesAt={formatWhen(cycle.stage2_deadline)} /> : null}
      <SendBackHistory
        items={state.sendBacks.map((b) => ({
          id: b.id,
          round: b.round,
          remark: b.remark,
          sentAt: formatWhen(b.sent_at),
          sentBy: sendBackPeople.get(b.sent_by)?.full_name ?? "The NMT leader",
          reopened: b.scores_reopened,
        }))}
      />

      <VersionHistory history={data.history} />
    </div>
  );
}
