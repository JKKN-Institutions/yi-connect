import Link from "next/link";
import {
  chapterMap,
  getChapterCategories,
  getCurrentCycle,
  listAwards,
  listPredictionsByChapter,
} from "@/lib/recognitions/data";
import { CATEGORY_LABEL, type Category } from "@/lib/recognitions/constants";
import { Ribbon } from "../../../_ui/ribbon";
import { IconArrowLeft } from "../../../_ui/icons";
import { NoAccess, Notice, PageHead, Seal, formatWhen } from "../../../_ui/primitives";
import { ChapterSwitcher } from "../switcher";
import { gateChapterPage, nominationWindow } from "../load";
import { withChapter } from "../shared";
import { PredictionGrid } from "./grid";

export const metadata = { title: "Predict the winners" };

/** Column order exactly as the spec lists it. */
const QUIZ_ORDER: Category[] = ["sparks", "trailblazers", "pioneers"];

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gate, chapters } = await gateChapterPage(searchParams);
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const chapter = gate.value;
  const back = withChapter("/recognitions/chapter", chapter.id, chapters.length);

  const head = (
    <PageHead eyebrow={`${chapter.name} · Fun quiz`} title="Predict the winners">
      <ChapterSwitcher chapters={chapters} currentId={chapter.id} path="/recognitions/chapter/quiz" />
      <div>
        <Link href={back} className="rx-link rx-small">
          <IconArrowLeft size={14} /> Back to the chapter dashboard
        </Link>
      </div>
      <p className="rx-small">
        For every award and category, pick the chapter you think will win. You may pick your own chapter.{" "}
        <strong>Not used in scoring.</strong>
      </p>
    </PageHead>
  );

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        {head}
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No awards cycle is open yet</h2>
          <p className="rx-mute">The quiz opens with this year&apos;s nominations.</p>
        </div>
      </div>
    );
  }

  const [awards, categories, names] = await Promise.all([
    listAwards(cycle.id),
    getChapterCategories(cycle.id),
    chapterMap(),
  ]);
  const predictions = await listPredictionsByChapter(chapter.id, awards.map((a) => a.id));

  // Locked: show this chapter's own picks only.
  if (predictions.length > 0) {
    const lockedAt = predictions.map((p) => p.submitted_at).sort()[0];
    const pick = (awardId: string, cat: Category) =>
      predictions.find((p) => p.award_id === awardId && p.category === cat);
    return (
      <div className="rx-stack-lg">
        {head}
        <Notice tone="ok">Locked on {formatWhen(lockedAt)}. These are your chapter&apos;s picks.</Notice>
        <div className="rx-stack">
          {awards.map((a) => (
            <article key={a.id} className="rx-plate rx-plate-tight rx-stack">
              <div className="rx-row" style={{ gap: 10 }}>
                <Ribbon vertical={a.vertical} />
                <h2 className="rx-h3">{a.title}</h2>
              </div>
              <dl className="rx-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: 0 }}>
                {QUIZ_ORDER.map((cat) => {
                  const p = pick(a.id, cat);
                  return (
                    <div key={cat}>
                      <dt className="rx-label" style={{ marginBottom: 2 }}>{CATEGORY_LABEL[cat]}</dt>
                      <dd className="rx-small" style={{ margin: 0 }}>
                        {p ? names.get(p.predicted_chapter_id)?.name ?? "A chapter no longer listed" : <span className="rx-mute">No pick</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      </div>
    );
  }

  const win = nominationWindow(cycle);
  let closed: string | null = null;
  if (!cycle.quiz_open) closed = "The prediction quiz is closed.";
  else if (win.state === "not_open") closed = "The quiz opens with nominations. The Recognitions super admin hasn't set the deadline yet.";
  else if (win.state === "closed") closed = `The quiz closed with nominations on ${formatWhen(win.deadline)}.`;
  else if (awards.length === 0) closed = "No awards have been set up for this cycle yet.";

  if (closed) {
    return (
      <div className="rx-stack-lg">
        {head}
        <Notice>{closed}</Notice>
      </div>
    );
  }

  const columns = QUIZ_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABEL[cat],
    chapters: [...categories.entries()]
      .filter(([, c]) => c === cat)
      .map(([id]) => ({ id, name: names.get(id)?.name ?? "" }))
      .filter((c) => c.name !== "")
      .sort((x, y) => x.name.localeCompare(y.name)),
  }));

  return (
    <div className="rx-stack-lg">
      {head}
      <div className="rx-row">
        <Seal tone="gilt">Open until {formatWhen(win.state === "open" ? win.deadline : null)}</Seal>
      </div>
      <PredictionGrid
        chapterId={chapter.id}
        awards={awards.map((a) => ({ id: a.id, title: a.title, vertical: a.vertical }))}
        columns={columns}
      />
    </div>
  );
}
