import Link from "next/link";
import { getChapterCategories, getCurrentCycle, listAwards, listNominationsForChapter } from "@/lib/recognitions/data";
import { CATEGORY_LABEL } from "@/lib/recognitions/constants";
import type { NominationRow } from "@/lib/recognitions/types";
import { IconArrowLeft } from "../../../_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, Seal, formatWhen } from "../../../_ui/primitives";
import { ChapterSwitcher } from "../switcher";
import { gateChapterPage, nominationWindow } from "../load";
import { withChapter, type NominationForm } from "../shared";
import { NominationSummary } from "../summary";
import { ApplyWizard } from "./wizard";

export const metadata = { title: "Apply for awards" };

function toForm(n: NominationRow): NominationForm {
  const reasons = [...(n.reasons ?? [])];
  while (reasons.length < 5) reasons.push("");
  return {
    awardId: n.award_id,
    reasons: reasons.slice(0, 5),
    flagship: n.flagship_event ?? "",
    hosted: n.hosted_event,
    hostedName: n.hosted_event_name ?? "",
    hostedType: n.hosted_event_type ?? "",
    announcement: n.announcement_draft ?? "",
  };
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gate, chapters } = await gateChapterPage(searchParams);
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const chapter = gate.value;
  const back = withChapter("/recognitions/chapter", chapter.id, chapters.length);

  const head = (extra?: React.ReactNode) => (
    <PageHead eyebrow={`${chapter.name} · Nominations`} title="Apply for awards">
      <ChapterSwitcher chapters={chapters} currentId={chapter.id} path="/recognitions/chapter/apply" />
      <div>
        <Link href={back} className="rx-link rx-small">
          <IconArrowLeft size={14} /> Back to the chapter dashboard
        </Link>
      </div>
      {extra}
    </PageHead>
  );

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        {head()}
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No awards cycle is open yet</h2>
          <p className="rx-mute">You can apply once the Recognitions super admin opens this year&apos;s cycle.</p>
        </div>
      </div>
    );
  }

  const [awards, categories] = await Promise.all([listAwards(cycle.id), getChapterCategories(cycle.id)]);
  const nominations = await listNominationsForChapter(chapter.id, awards.map((a) => a.id));
  const category = categories.get(chapter.id) ?? null;
  const win = nominationWindow(cycle);
  const region = (chapter.region ?? "").trim();

  const meta = (
    <div className="rx-row" style={{ gap: 10 }}>
      {category ? <Seal tone="gilt">{CATEGORY_LABEL[category]}</Seal> : <Seal tone="mute">No category yet</Seal>}
      <Deadline label="Nominations close" iso={cycle.nomination_deadline} />
    </div>
  );

  // Whatever blocks the wizard, the chapter still sees what it has filed, read-only.
  const readOnlyList =
    nominations.length === 0 ? null : (
      <section className="rx-stack">
        <div className="rx-eyebrow">What your chapter has filed</div>
        {awards
          .filter((a) => nominations.some((n) => n.award_id === a.id))
          .map((a) => {
            const n = nominations.find((x) => x.award_id === a.id)!;
            return (
              <NominationSummary
                key={a.id}
                title={a.title}
                vertical={a.vertical}
                form={toForm(n)}
                status={n.status}
                note={
                  n.status === "submitted"
                    ? `Submitted ${formatWhen(n.submitted_at)}. Locked.`
                    : win.state === "closed"
                      ? "This draft was not submitted before the deadline, so it is not entered."
                      : undefined
                }
              />
            );
          })}
      </section>
    );

  let blocker: React.ReactNode = null;
  if (!category) {
    blocker = (
      <Notice tone="alert">
        Your chapter hasn&apos;t been placed in a category yet. The Recognitions super admin does this.
      </Notice>
    );
  } else if (region === "") {
    blocker = (
      <Notice tone="alert">
        Your chapter has no region on record. Ask the Recognitions super admin to add it before you apply.
      </Notice>
    );
  } else if (win.state === "not_open") {
    blocker = <Notice>Nominations haven&apos;t opened yet. The Recognitions super admin will set the deadline.</Notice>;
  } else if (win.state === "closed") {
    blocker = <Notice>Nominations closed on {formatWhen(win.deadline)}.</Notice>;
  } else if (awards.length === 0) {
    blocker = <Notice>No awards have been set up for this cycle yet.</Notice>;
  }

  if (blocker || win.state !== "open") {
    return (
      <div className="rx-stack-lg">
        {head(meta)}
        {blocker}
        {readOnlyList}
      </div>
    );
  }

  return (
    <div className="rx-stack-lg">
      {head(meta)}
      <ApplyWizard
        chapterId={chapter.id}
        chapterName={chapter.name}
        deadline={win.deadline}
        awards={awards.map((a) => ({ id: a.id, title: a.title, vertical: a.vertical, criteria: a.criteria }))}
        initial={nominations.map((n) => ({
          awardId: n.award_id,
          status: n.status,
          submittedAt: n.submitted_at,
          form: toForm(n),
        }))}
      />
    </div>
  );
}
