import Link from "next/link";
import { getCurrentCycle, getPeople, listAwards, listNominationsForChapter } from "@/lib/recognitions/data";
import { canFix, effectiveStatus, exclusionReason } from "@/lib/recognitions/check-rules";
import { CHECK_STEP_ENABLED, WORDS } from "@/lib/recognitions/constants";
import { IconArrowLeft } from "../../../_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, formatWhen } from "../../../_ui/primitives";
import { ChapterSwitcher } from "../switcher";
import { categoryAndRivals, gateChapterPage, nominationWindow } from "../load";
import { formFromRow, isLegacyForm, withChapter } from "../shared";
import { NominationSummary } from "../summary";
import { ApplyInstructions, CategoryPanel } from "../category-panel";
import { ApplyWizard } from "./wizard";
import { FixReturnedForm } from "./fix-form";

export const metadata = { title: "Apply for recognitions" };

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
    <PageHead eyebrow={`${chapter.name} · Nominations`} title="Apply for recognitions">
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
          <h2 className="rx-h2">No recognitions cycle is open yet</h2>
          <p className="rx-mute">You can apply once the Recognitions super admin opens this year&apos;s cycle.</p>
        </div>
      </div>
    );
  }

  const [awards, { category, rivals }] = await Promise.all([
    listAwards(cycle.id),
    categoryAndRivals(cycle.id, chapter.id),
  ]);
  const nominations = await listNominationsForChapter(chapter.id, awards.map((a) => a.id));
  const win = nominationWindow(cycle);
  const region = (chapter.region ?? "").trim();

  const meta = <Deadline label="Nominations close" iso={cycle.nomination_deadline} />;
  const intro = (
    <>
      <ApplyInstructions
        deadline={cycle.nomination_deadline ? formatWhen(cycle.nomination_deadline) : "the deadline"}
        whyWords={WORDS.justification}
      />
      <CategoryPanel category={category} rivals={rivals} />
    </>
  );

  // Sent back by a checker before the check step was dropped, and still
  // inside the fix window (recognitions_02): editable here even after the
  // nomination deadline. No new send-backs happen in 2026.
  const fixable = nominations.filter((n) => canFix(n, cycle));
  const returners = await getPeople(fixable.map((n) => n.returned_by).filter((x): x is string => !!x));
  const fixForms =
    fixable.length === 0 ? null : (
      <section className="rx-stack-lg">
        <div className="rx-eyebrow">Sent back to you for a fix</div>
        {fixable.map((n) => {
          const a = awards.find((x) => x.id === n.award_id);
          if (!a) return null;
          const form = formFromRow(n);
          return (
            <FixReturnedForm
              key={n.id}
              chapterId={chapter.id}
              award={{ id: a.id, title: a.title, vertical: a.vertical, kind: a.kind, criteria: a.criteria }}
              initial={form}
              legacy={isLegacyForm(form)}
              note={n.return_note ?? ""}
              returnedBy={(n.returned_by && returners.get(n.returned_by)?.full_name) || "A checker"}
              returnedAt={n.returned_at}
              fixDeadline={cycle.fix_deadline}
            />
          );
        })}
      </section>
    );

  // Whatever blocks the form, the chapter still sees what it has filed, read-only.
  const filedList = nominations.filter((n) => !canFix(n, cycle));
  const readOnlyList =
    filedList.length === 0 ? null : (
      <section className="rx-stack">
        <div className="rx-eyebrow">What your chapter has filed</div>
        {awards
          .filter((a) => filedList.some((n) => n.award_id === a.id))
          .map((a) => {
            const n = filedList.find((x) => x.award_id === a.id)!;
            const st = effectiveStatus(n, cycle);
            const filedNote = CHECK_STEP_ENABLED
              ? `Submitted ${formatWhen(n.submitted_at)}. Locked while the Regional Chair and a Regional Mentor check it.`
              : `Submitted ${formatWhen(n.submitted_at)}. Locked. It goes to the evaluators for scoring.`;
            return (
              <NominationSummary
                key={a.id}
                title={a.title}
                vertical={a.vertical}
                kind={a.kind}
                form={formFromRow(n)}
                status={st}
                note={
                  st === "submitted"
                    ? filedNote
                    : st === "checked"
                      ? CHECK_STEP_ENABLED
                        ? "Passed both checks. It is being evaluated."
                        : filedNote
                      : st === "excluded"
                        ? (exclusionReason(n, cycle) ?? undefined)
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
    blocker = <Notice>
          {win.opensAt
            ? `Nominations open on ${formatWhen(win.opensAt)}.`
            : "Nominations haven't opened yet. The Recognitions super admin will set the deadline."}
        </Notice>;
  } else if (win.state === "closed") {
    blocker = <Notice>Nominations closed on {formatWhen(win.deadline)}.</Notice>;
  } else if (awards.length === 0) {
    blocker = <Notice>No recognitions have been set up for this cycle yet.</Notice>;
  }

  if (blocker || win.state !== "open") {
    return (
      <div className="rx-stack-lg">
        {head(meta)}
        {intro}
        {blocker}
        {fixForms}
        {readOnlyList}
      </div>
    );
  }

  return (
    <div className="rx-stack-lg">
      {head(meta)}
      {intro}
      {fixForms}
      <ApplyWizard
        chapterId={chapter.id}
        chapterName={chapter.name}
        deadline={win.deadline}
        awards={awards.map((a) => ({ id: a.id, title: a.title, vertical: a.vertical, kind: a.kind, criteria: a.criteria }))}
        initial={nominations.map((n) => ({
          awardId: n.award_id,
          // The form only knows "draft" and "filed (locked)". A sent-back one is fixed above.
          status: n.status === "draft" ? ("draft" as const) : ("submitted" as const),
          submittedAt: n.submitted_at,
          justification: n.justification ?? "",
        }))}
      />
    </div>
  );
}
