import Link from "next/link";
import { getRxViewer } from "@/lib/recognitions/auth";
import {
  chapterMap,
  getAwardState,
  getCurrentCycle,
  getPeople,
  listScoresForDuty,
  nominationsForDuty,
  type AwardState,
} from "@/lib/recognitions/data";
import { mentorRescoreOpen, scoreSight } from "@/lib/recognitions/sight";
import {
  addableForDuty,
  askNmtToAddNote,
  evaluatorAddWindow,
  nmtAddCloses,
  pendingApprovalsFor,
} from "@/lib/recognitions/evaluator-add";
import { isPast } from "@/lib/recognitions/phase";
import { AddChapterForDuty, PendingApprovals, type PendingItem } from "./evaluator-add";
import { Ribbon } from "../../_ui/ribbon";
import { IconArrowRight, IconEyeOff } from "../../_ui/icons";
import { Deadline, Notice, PageHead, PhaseSeal, Seal, formatWhen } from "../../_ui/primitives";
import { dutyLayerLabel, nominationScoringWindow, scoringWindow } from "./score-rules";
import { effectiveStatus, isNlAdded } from "@/lib/recognitions/check-rules";
import "./score.css";

export const metadata = { title: "My scoring sheets" };

export default async function MySheetsPage() {
  const viewer = await getRxViewer();
  if (!viewer) return null; // the desk layout already rendered the no-access panel

  const duties = viewer.duties;
  if (duties.length === 0) {
    // A Regional Chair holds no scoring duty, but is told who adds a missed chapter while that still matters.
    const cycle = viewer.regionalChairZones.length > 0 ? await getCurrentCycle() : null;
    const rcNote = cycle && !isPast(nmtAddCloses(cycle)) ? askNmtToAddNote(cycle, formatWhen) : null;
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Stage 1 · blind scoring" title="My scoring sheets" />
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No scoring sheets yet</h2>
          <p className="rx-mute">
            You haven&apos;t been assigned as a Regional Mentor or NMT evaluator for any recognition this year. When the
            Recognitions super admin adds you, your sheets appear here.
          </p>
          {rcNote ? <p className="rx-small rx-mute">{rcNote}</p> : null}
        </div>
      </div>
    );
  }

  // One award state per award (a person may hold an RM and an NMT duty on the same award).
  const states = new Map<string, AwardState | null>();
  for (const d of duties) {
    if (!states.has(d.award_id)) states.set(d.award_id, await getAwardState(d.award_id));
  }

  const chapters = await chapterMap();
  const nameOfChapter = (id: string) => chapters.get(id)?.name ?? "Unknown chapter";
  const rows = await Promise.all(
    duties.map(async (duty) => {
      const state = states.get(duty.award_id) ?? null;
      if (!state) return { duty, state, total: 0, submitted: 0, nlOpen: 0, extra: null };
      // BLIND: progress comes only from this duty's own scores and the chapters it sees.
      const visible = nominationsForDuty(state, duty);
      const mine = await listScoresForDuty(duty.id);
      const visibleIds = new Set(visible.map((n) => n.id));
      const submittedIds = new Set(
        mine.filter((s) => s.status === "submitted" && visibleIds.has(s.nomination_id)).map((s) => s.nomination_id)
      );
      // Chapters National Leadership added (recognitions_03), open for scoring in re-evaluation and not yet submitted.
      const nlOpen = visible.filter(
        (n) =>
          isNlAdded(n) &&
          !submittedIds.has(n.id) &&
          nominationScoringWindow(state.phase, state.cycle, n).state === "open"
      ).length;
      // recognitions_05: blind until you submit, the Mentors' send-back, and chapters added by evaluators.
      const sight = scoreSight(state, viewer.duties);
      const rescore = mentorRescoreOpen(state);
      const addWin = evaluatorAddWindow(state, formatWhen, duty.layer);
      const addable = addWin.open ? await addableForDuty(state, duty) : null;
      // Who can add a missed chapter, and when (Piyush 28 Oct): said plainly while it still matters.
      const addNote =
        !addWin.open && (state.phase === "nominations" || state.phase === "stage1") ? addWin.reason : null;
      const pending = pendingApprovalsFor(state, duty);
      const mineAdded = state.nominations.filter((n) => n.added_by === viewer.personId && (n.origin === "rm_added" || n.origin === "nmt_added"));
      const people = await getPeople(pending.map((p) => p.nomination.added_by).filter((x): x is string => !!x));
      const pendingItems: PendingItem[] = pending.map((p) => ({
        nominationId: p.nomination.id,
        chapterName: nameOfChapter(p.nomination.chapter_id),
        region: p.nomination.region,
        category: p.nomination.category,
        addedBy: (p.nomination.added_by && people.get(p.nomination.added_by)?.full_name) || "A Regional Mentor",
        addedAt: formatWhen(p.nomination.added_at),
        reason: p.nomination.added_reason ?? "",
        blocked: p.blocked,
      }));
      return {
        duty,
        state,
        total: visible.length,
        submitted: submittedIds.size,
        nlOpen,
        extra: { sight, rescore, addable, addNote, pendingItems, mineAdded },
      };
    })
  );

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow="Stage 1 · blind scoring" title="My scoring sheets">
        <div className="rx-row rx-small rx-mute" style={{ gap: 8 }}>
          <IconEyeOff size={16} />
          <span>
            Your marks are private. Other evaluators can&apos;t see them, and you see theirs only after you submit every
            chapter on your sheet.
          </span>
        </div>
      </PageHead>

      <div>
        {rows.map(({ duty, state, total, submitted, nlOpen, extra }) => {
          const award = state?.award ?? duty.award;
          const win = state ? scoringWindow(state.phase, state.cycle) : null;
          return (
            <section key={duty.id} className="rx-plate rx-stack rx-sheet-duty">
              <div className="rx-spread">
                <div className="rx-row" style={{ gap: 10 }}>
                  <Ribbon vertical={award.vertical} kind={award.kind} size="lg" />
                  <h2 className="rx-h2">{award.title}</h2>
                </div>
                {state ? <PhaseSeal phase={state.phase} /> : null}
              </div>

              <div className="rx-row" style={{ gap: 10 }}>
                <Seal tone={duty.layer === "rm" ? "laurel" : "gilt"}>{dutyLayerLabel(duty)}</Seal>
                {win && win.state !== "notYet" ? (
                  <span className="rx-num rx-small">
                    {submitted} of {total} submitted
                  </span>
                ) : null}
              </div>

              {!state ? (
                <Notice tone="alert">This recognition could not be loaded. Reload the page; if it persists, tell the Recognitions super admin.</Notice>
              ) : win?.state === "notYet" ? (
                <Notice>
                  {state.cycle.nomination_deadline
                    ? `Scoring opens when nominations close on ${formatWhen(state.cycle.nomination_deadline)}.`
                    : "Scoring opens once the nomination deadline has been set and has passed."}
                </Notice>
              ) : (
                <>
                  <Deadline label="Stage 1 closes" iso={state.cycle.stage1_deadline} />
                  {extra?.rescore && duty.layer === "rm" && state.sendBacks[0] ? (
                    <Notice tone="alert">
                      <strong>The NMT leader sent this recognition back to the Regional Mentors:</strong>{" "}
                      <span className="rx-p-text">{state.sendBacks[0].remark}</span>
                      <br />
                      <span className="rx-small">
                        Your marks are open again as drafts. Review and resubmit by {formatWhen(state.cycle.stage2_deadline)}.
                      </span>
                    </Notice>
                  ) : win?.state === "closed" ? (
                    <Notice>Scoring closed on {formatWhen(state.cycle.stage1_deadline)}. Your sheet is read-only.</Notice>
                  ) : null}
                  {nlOpen > 0 ? (
                    <Notice tone="alert">
                      {nlOpen === 1 ? "One chapter" : `${nlOpen} chapters`} added by National Leadership during
                      re-evaluation {nlOpen === 1 ? "is" : "are"} waiting for your marks. Score by{" "}
                      {formatWhen(state.cycle.reevaluation_deadline)}.
                    </Notice>
                  ) : win?.state === "over" && !(extra?.rescore && duty.layer === "rm") ? (
                    <Notice>Stage 1 is over for this recognition. Your sheet is read-only.</Notice>
                  ) : null}
                  {total === 0 ? (
                    <p className="rx-mute rx-small">No nomination has reached your sheet yet.</p>
                  ) : null}
                  <div>
                    <Link href={`/recognitions/score/${duty.id}`} className="rx-btn">
                      {(win?.state === "open" && submitted < total) || nlOpen > 0 || (extra?.rescore && duty.layer === "rm")
                        ? "Open my sheet"
                        : "View my sheet"}{" "}
                      <IconArrowRight size={16} />
                    </Link>
                  </div>
                  {extra?.sight.sees ? (
                    <div>
                      <Link href={`/recognitions/moderate/${award.id}`} className="rx-link rx-small" data-testid={`see-all-${award.id}`}>
                        {extra.sight.why === "submitted"
                          ? "You've submitted your sheet: see every evaluator's marks (read-only)"
                          : "Open the round-1 leaderboard (read-only)"}
                      </Link>
                    </div>
                  ) : null}
                </>
              )}
              {state && extra ? (
                <>
                  {extra.pendingItems.length > 0 ? (
                    <PendingApprovals evaluatorId={duty.id} items={extra.pendingItems} />
                  ) : null}
                  {extra.mineAdded.length > 0 ? (
                    <div className="rx-stack" style={{ gap: 6 }}>
                      <h3 className="rx-h3">Chapters you put forward</h3>
                      <ul className="rx-small rx-stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
                        {extra.mineAdded.map((n) => {
                          const st = effectiveStatus(n, state.cycle);
                          return (
                            <li key={n.id} style={{ overflowWrap: "anywhere" }}>
                              <strong>{nameOfChapter(n.chapter_id)}</strong>:{" "}
                              {n.declined_at
                                ? `declined by the NMT: ${n.decline_reason ?? ""}`
                                : n.origin === "rm_added" && !n.approved_at
                                  ? st === "excluded"
                                    ? "not approved before scoring closed"
                                    : "waiting for an NMT member's approval"
                                  : "on the scoring sheets"}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  {extra.addable ? (
                    <AddChapterForDuty
                      evaluatorId={duty.id}
                      awardTitle={award.title}
                      layer={duty.layer}
                      region={duty.region}
                      options={extra.addable.eligible}
                      skipped={extra.addable.skipped}
                      closesAt={formatWhen(nmtAddCloses(state.cycle))}
                    />
                  ) : extra.addNote ? (
                    <p className="rx-small rx-mute">{extra.addNote}</p>
                  ) : null}
                </>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
