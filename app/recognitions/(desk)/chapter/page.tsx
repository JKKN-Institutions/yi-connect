import Link from "next/link";
import {
  getCurrentCycle,
  listAwards,
  listNominationsForChapter,
  listPredictionsByChapter,
} from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, CHECK_STEP_ENABLED, RANK_LABEL, groupByKind } from "@/lib/recognitions/constants";
import { Ribbon } from "../../_ui/ribbon";
import { IconArrowRight } from "../../_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, Seal, formatWhen } from "../../_ui/primitives";
import { ChapterSwitcher } from "./switcher";
import { categoryAndRivals, gateChapterPage, nominationWindow, previousWinners } from "./load";
import { CategoryPanel } from "./category-panel";
import { withChapter } from "./shared";
import { STATUS_TONE } from "./summary";
import { NOMINATION_STATUS_LABEL, effectiveStatus, exclusionReason } from "@/lib/recognitions/check-rules";

export const metadata = { title: "Chapter" };

export default async function ChapterDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gate, chapters } = await gateChapterPage(searchParams);
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const chapter = gate.value;
  const link = (path: string) => withChapter(path, chapter.id, chapters.length);

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Chapter" title={chapter.name}>
          <ChapterSwitcher chapters={chapters} currentId={chapter.id} path="/recognitions/chapter" />
        </PageHead>
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No recognitions cycle is open yet</h2>
          <p className="rx-mute">
            When the Recognitions super admin opens this year&apos;s cycle, your chapter&apos;s category, the
            recognitions and the deadline will appear here.
          </p>
        </div>
      </div>
    );
  }

  const [awards, { category, rivals }] = await Promise.all([
    listAwards(cycle.id),
    categoryAndRivals(cycle.id, chapter.id),
  ]);
  const awardIds = awards.map((a) => a.id);
  const [nominations, predictions, podiums] = await Promise.all([
    listNominationsForChapter(chapter.id, awardIds),
    listPredictionsByChapter(chapter.id, awardIds),
    previousWinners(cycle),
  ]);
  const byAward = new Map(nominations.map((n) => [n.award_id, n]));
  const win = nominationWindow(cycle);
  const drafts = nominations.filter((n) => n.status === "draft").length;
  const toFix = nominations.filter((n) => effectiveStatus(n, cycle) === "returned").length;
  const quizOpen = cycle.quiz_open && win.state === "open";

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`${cycle.name} · Chapter`} title={chapter.name}>
        <ChapterSwitcher chapters={chapters} currentId={chapter.id} path="/recognitions/chapter" />
        <div className="rx-row" style={{ gap: 10 }}>
          {category ? (
            <Seal tone="gilt">{CATEGORY_LABEL[category]}</Seal>
          ) : (
            <Seal tone="mute">No category yet</Seal>
          )}
          {chapter.region ? <span className="rx-small rx-mute rx-num">{chapter.region}</span> : null}
        </div>
        <Deadline label="Nominations close" iso={cycle.nomination_deadline} />
      </PageHead>

      {toFix > 0 ? (
        <Notice tone="alert">
          {toFix === 1 ? "One nomination was" : `${toFix} nominations were`} sent back for a fix. Read the note, fix and
          resubmit by {formatWhen(cycle.fix_deadline)}, or {toFix === 1 ? "it drops" : "they drop"} out of the race.{" "}
          <Link href={link("/recognitions/chapter/apply")} className="rx-link">Fix now</Link>
        </Notice>
      ) : null}

      {!category ? (
        <Notice tone="alert">
          Your chapter hasn&apos;t been placed in a category yet. The Recognitions super admin does this. You
          can apply once it&apos;s done.
        </Notice>
      ) : win.state === "not_open" ? (
        <Notice>Nominations haven&apos;t opened yet. The Recognitions super admin will set the deadline.</Notice>
      ) : win.state === "closed" ? (
        <Notice>
          Nominations closed on {formatWhen(win.deadline)}.{" "}
          {CHECK_STEP_ENABLED
            ? "Only nominations the Regional Chair and a Regional Mentor both pass are scored."
            : "Every nomination your chapter submitted goes to the evaluators for scoring."}
        </Notice>
      ) : (
        <Notice>
          Drafts are not entered. Submit before the deadline.
          {drafts > 0 ? ` You have ${drafts} draft${drafts === 1 ? "" : "s"} waiting.` : ""}
        </Notice>
      )}

      <div className="rx-row">
        {category && win.state === "open" ? (
          <Link href={link("/recognitions/chapter/apply")} className="rx-btn">
            {nominations.length > 0 ? "Continue your nominations" : "Apply for recognitions"} <IconArrowRight size={16} />
          </Link>
        ) : (
          <Link href={link("/recognitions/chapter/apply")} className="rx-btn rx-btn-quiet">
            See your nominations
          </Link>
        )}
        <Link href={link("/recognitions/chapter/quiz")} className={quizOpen && predictions.length === 0 ? "rx-btn rx-btn-gilt" : "rx-btn rx-btn-quiet"}>
          {predictions.length > 0 ? "See your predictions" : "Predict the winners"}
        </Link>
      </div>

      <CategoryPanel category={category} rivals={rivals} />

      <section className="rx-stack">
        <div className="rx-eyebrow">Recognitions you can apply for</div>
        {awards.length === 0 ? (
          <p className="rx-mute">No recognitions have been set up for this cycle yet.</p>
        ) : (
          groupByKind(awards).map((g) => (
            <div key={g.kind ?? "other"} className="rx-stack" style={{ gap: 0 }}>
              <div className="rx-label" style={{ marginTop: 6 }}>{g.label}</div>
              {g.items.map((a) => {
                const n = byAward.get(a.id);
                const st = n ? effectiveStatus(n, cycle) : null;
                const why = (n?.justification ?? "").trim();
                return (
                  <article key={a.id} className="rx-plate rx-plate-tight rx-stack" style={{ marginTop: 10 }}>
                    <div className="rx-spread">
                      <div className="rx-row" style={{ gap: 10, minWidth: 0 }}>
                        <Ribbon vertical={a.vertical} kind={a.kind} size="lg" />
                        <h2 className="rx-h3" style={{ overflowWrap: "anywhere" }}>{a.title}</h2>
                      </div>
                      {st ? (
                        <Seal tone={STATUS_TONE[st]}>{NOMINATION_STATUS_LABEL[st]}</Seal>
                      ) : (
                        <Seal tone="mute">Not applied</Seal>
                      )}
                    </div>
                    {a.criteria ? <p className="rx-small" style={{ whiteSpace: "pre-line" }}>{a.criteria}</p> : null}
                    {n && why ? (
                      <div className="rx-small">
                        <div className="rx-label" style={{ marginBottom: 2 }}>
                          {n.status === "draft" ? "Your draft answer" : "Why your chapter should get it"}
                        </div>
                        <p style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{why}</p>
                      </div>
                    ) : null}
                    {n && st === "returned" ? (
                      <div className="rx-notice rx-notice-alert rx-small">
                        <strong>Sent back for a fix.</strong> {n.return_note}
                        <div style={{ marginTop: 6 }}>
                          Fix and resubmit by {formatWhen(cycle.fix_deadline)}.{" "}
                          <Link href={link("/recognitions/chapter/apply")} className="rx-link">Fix it now</Link>
                        </div>
                      </div>
                    ) : n && (st === "submitted" || st === "checked") && n.submitted_at ? (
                      <p className="rx-small rx-mute">
                        {CHECK_STEP_ENABLED
                          ? st === "checked"
                            ? "Passed both checks. It is in the race and is being scored."
                            : `Submitted ${formatWhen(n.submitted_at)}. Waiting for the Regional Chair and a Regional Mentor to check it.`
                          : `Submitted ${formatWhen(n.submitted_at)}. Locked. It goes to the evaluators for scoring.`}
                      </p>
                    ) : n && st === "excluded" ? (
                      <p className="rx-small rx-mute">{exclusionReason(n, cycle)}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ))
        )}
      </section>

      <section className="rx-stack">
        <div className="rx-eyebrow">Previous winners</div>
        {podiums.length === 0 ? (
          <p className="rx-mute">No previous winners recorded yet.</p>
        ) : (
          <div className="rx-grid">
            {podiums.map((p) => (
              <article key={`${p.cycleName}-${p.awardTitle}`} className="rx-plate rx-plate-tight rx-stack">
                <div className="rx-row" style={{ gap: 10 }}>
                  <Ribbon vertical={p.vertical} kind={p.kind} />
                  <div>
                    <div className="rx-h3">{p.awardTitle}</div>
                    <div className="rx-small rx-mute">{p.cycleName}</div>
                  </div>
                </div>
                {CATEGORIES.map((cat) => {
                  const places = p.places.filter((x) => x.category === cat);
                  if (places.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="rx-label" style={{ marginBottom: 2 }}>{CATEGORY_LABEL[cat]}</div>
                      <ul className="rx-small" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {places.map((x) => (
                          <li key={`${cat}-${x.rank}`}>
                            {x.chapterName} <span className="rx-mute">· {RANK_LABEL[x.rank]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
