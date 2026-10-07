import Link from "next/link";
import {
  chapterMap,
  getChapterCategories,
  getCurrentCycle,
  listAwards,
  listNominationsForChapter,
  listPredictionsByChapter,
} from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, RANK_LABEL } from "@/lib/recognitions/constants";
import { Ribbon } from "../../_ui/ribbon";
import { IconArrowRight } from "../../_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, Seal, formatWhen } from "../../_ui/primitives";
import { ChapterSwitcher } from "./switcher";
import { gateChapterPage, nominationWindow, previousWinners } from "./load";
import { withChapter } from "./shared";

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
          <h2 className="rx-h2">No awards cycle is open yet</h2>
          <p className="rx-mute">
            When the Recognitions super admin opens this year&apos;s cycle, your chapter&apos;s category, the awards
            and the deadline will appear here.
          </p>
        </div>
      </div>
    );
  }

  const [awards, categories, chapters_] = await Promise.all([
    listAwards(cycle.id),
    getChapterCategories(cycle.id),
    chapterMap(),
  ]);
  const awardIds = awards.map((a) => a.id);
  const [nominations, predictions, podiums] = await Promise.all([
    listNominationsForChapter(chapter.id, awardIds),
    listPredictionsByChapter(chapter.id, awardIds),
    previousWinners(cycle),
  ]);
  const byAward = new Map(nominations.map((n) => [n.award_id, n]));
  const category = categories.get(chapter.id) ?? null;
  const win = nominationWindow(cycle);
  const fellows = category
    ? [...categories.entries()]
        .filter(([id, cat]) => cat === category && id !== chapter.id)
        .map(([id]) => chapters_.get(id)?.name)
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b))
    : [];
  const drafts = nominations.filter((n) => n.status === "draft").length;
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

      {!category ? (
        <Notice tone="alert">
          Your chapter hasn&apos;t been placed in a category yet. The Recognitions super admin does this. You
          can apply once it&apos;s done.
        </Notice>
      ) : win.state === "not_open" ? (
        <Notice>Nominations haven&apos;t opened yet. The Recognitions super admin will set the deadline.</Notice>
      ) : win.state === "closed" ? (
        <Notice>Nominations closed on {formatWhen(win.deadline)}. Only submitted nominations are entered.</Notice>
      ) : (
        <Notice>
          Drafts are not entered. Submit before the deadline.
          {drafts > 0 ? ` You have ${drafts} draft${drafts === 1 ? "" : "s"} waiting.` : ""}
        </Notice>
      )}

      <div className="rx-row">
        {category && win.state === "open" ? (
          <Link href={link("/recognitions/chapter/apply")} className="rx-btn">
            {nominations.length > 0 ? "Continue your nominations" : "Apply for awards"} <IconArrowRight size={16} />
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

      <section className="rx-stack">
        <div className="rx-eyebrow">Awards you can apply for</div>
        {awards.length === 0 ? (
          <p className="rx-mute">No awards have been set up for this cycle yet.</p>
        ) : (
          <div className="rx-stack" style={{ gap: 0 }}>
            {awards.map((a) => {
              const n = byAward.get(a.id);
              return (
                <article key={a.id} className="rx-plate rx-plate-tight rx-stack" style={{ marginTop: 10 }}>
                  <div className="rx-spread">
                    <div className="rx-row" style={{ gap: 10 }}>
                      <Ribbon vertical={a.vertical} size="lg" />
                      <h2 className="rx-h3">{a.title}</h2>
                    </div>
                    {n?.status === "submitted" ? (
                      <Seal tone="laurel">Submitted</Seal>
                    ) : n?.status === "draft" ? (
                      <Seal tone="gilt">Draft</Seal>
                    ) : (
                      <Seal tone="mute">Not applied</Seal>
                    )}
                  </div>
                  {a.criteria ? <p className="rx-small" style={{ whiteSpace: "pre-line" }}>{a.criteria}</p> : null}
                  {n?.status === "submitted" && n.submitted_at ? (
                    <p className="rx-small rx-mute">Submitted {formatWhen(n.submitted_at)}. Locked.</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rx-stack">
        <div className="rx-eyebrow">Fellow chapters in your category</div>
        {!category ? (
          <p className="rx-mute">You&apos;ll see them here once your chapter has a category.</p>
        ) : fellows.length === 0 ? (
          <p className="rx-mute">No other chapter is in {CATEGORY_LABEL[category]} yet.</p>
        ) : (
          <p className="rx-small">
            <span className="rx-mute">{CATEGORY_LABEL[category]}: </span>
            {fellows.join(" · ")}
          </p>
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
                  <Ribbon vertical={p.vertical} />
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
