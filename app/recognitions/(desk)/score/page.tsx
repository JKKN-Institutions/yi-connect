import Link from "next/link";
import { getRxViewer } from "@/lib/recognitions/auth";
import { getAwardState, listScoresForDuty, nominationsForDuty, type AwardState } from "@/lib/recognitions/data";
import { Ribbon } from "../../_ui/ribbon";
import { IconArrowRight, IconEyeOff } from "../../_ui/icons";
import { Deadline, Notice, PageHead, PhaseSeal, Seal, formatWhen } from "../../_ui/primitives";
import { dutyLayerLabel, nominationScoringWindow, scoringWindow } from "./score-rules";
import { isNlAdded } from "@/lib/recognitions/check-rules";
import "./score.css";

export const metadata = { title: "My scoring sheets · Yi Recognitions" };

export default async function MySheetsPage() {
  const viewer = await getRxViewer();
  if (!viewer) return null; // the desk layout already rendered the no-access panel

  const duties = viewer.duties;
  if (duties.length === 0) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Stage 1 · blind scoring" title="My scoring sheets" />
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No scoring sheets yet</h2>
          <p className="rx-mute">
            You haven&apos;t been assigned as a Regional Mentor or NMT evaluator for any award this year. When the
            Recognitions super admin adds you, your sheets appear here.
          </p>
        </div>
      </div>
    );
  }

  // One award state per award (a person may hold an RM and an NMT duty on the same award).
  const states = new Map<string, AwardState | null>();
  for (const d of duties) {
    if (!states.has(d.award_id)) states.set(d.award_id, await getAwardState(d.award_id));
  }

  const rows = await Promise.all(
    duties.map(async (duty) => {
      const state = states.get(duty.award_id) ?? null;
      if (!state) return { duty, state, total: 0, submitted: 0, nlOpen: 0 };
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
      return { duty, state, total: visible.length, submitted: submittedIds.size, nlOpen };
    })
  );

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow="Stage 1 · blind scoring" title="My scoring sheets">
        <div className="rx-row rx-small rx-mute" style={{ gap: 8 }}>
          <IconEyeOff size={16} />
          <span>Your marks are private. Other evaluators can&apos;t see them and you can&apos;t see theirs.</span>
        </div>
      </PageHead>

      <div>
        {rows.map(({ duty, state, total, submitted, nlOpen }) => {
          const award = state?.award ?? duty.award;
          const win = state ? scoringWindow(state.phase, state.cycle) : null;
          return (
            <section key={duty.id} className="rx-plate rx-stack rx-sheet-duty">
              <div className="rx-spread">
                <div className="rx-row" style={{ gap: 10 }}>
                  <Ribbon vertical={award.vertical} size="lg" />
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
                <Notice tone="alert">This award could not be loaded. Reload the page; if it persists, tell the Recognitions super admin.</Notice>
              ) : win?.state === "notYet" ? (
                <Notice>
                  {state.cycle.nomination_deadline
                    ? `Scoring opens when nominations close on ${formatWhen(state.cycle.nomination_deadline)}.`
                    : "Scoring opens once the nomination deadline has been set and has passed."}
                </Notice>
              ) : (
                <>
                  <Deadline label="Stage 1 closes" iso={state.cycle.stage1_deadline} />
                  {win?.state === "closed" ? (
                    <Notice>Scoring closed on {formatWhen(state.cycle.stage1_deadline)}. Your sheet is read-only.</Notice>
                  ) : null}
                  {nlOpen > 0 ? (
                    <Notice tone="alert">
                      {nlOpen === 1 ? "One chapter" : `${nlOpen} chapters`} added by National Leadership during
                      re-evaluation {nlOpen === 1 ? "is" : "are"} waiting for your marks. Score by{" "}
                      {formatWhen(state.cycle.reevaluation_deadline)}.
                    </Notice>
                  ) : win?.state === "over" ? (
                    <Notice>Stage 1 is over for this award. Your sheet is read-only.</Notice>
                  ) : null}
                  {total === 0 ? (
                    <p className="rx-mute rx-small">No nomination on your sheet has passed both checks yet. Only those reach scoring.</p>
                  ) : null}
                  <div>
                    <Link href={`/recognitions/score/${duty.id}`} className="rx-btn">
                      {(win?.state === "open" && submitted < total) || nlOpen > 0 ? "Open my sheet" : "View my sheet"}{" "}
                      <IconArrowRight size={16} />
                    </Link>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
