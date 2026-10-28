import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/recognitions/constants";
import { Seal } from "../../_ui/primitives";

/**
 * "Your category and your rivals" (Director, 2026-10-15): the other active
 * chapters in the same category this cycle, and a plain word that the other
 * categories are separate races.
 */
export function CategoryPanel({ category, rivals }: { category: Category | null; rivals: string[] }) {
  if (!category) {
    return (
      <section className="rx-plate rx-plate-tight rx-stack" aria-label="Your category">
        <div className="rx-eyebrow">Your category</div>
        <p className="rx-small">
          Your chapter hasn&apos;t been placed in a category yet. The Recognitions super admin does this. Once it is
          done, you&apos;ll see here the chapters you are evaluated alongside.
        </p>
      </section>
    );
  }
  const others = CATEGORIES.filter((c) => c !== category).map((c) => CATEGORY_LABEL[c]);
  return (
    <section className="rx-plate rx-plate-tight rx-stack" aria-label="Your category">
      <div className="rx-row" style={{ gap: 8 }}>
        <span className="rx-h3">Your category:</span>
        <Seal tone="gilt">{CATEGORY_LABEL[category]}</Seal>
      </div>
      {rivals.length === 0 ? (
        <p className="rx-small">No other chapter is in {CATEGORY_LABEL[category]} this year yet.</p>
      ) : (
        <>
          <p className="rx-small">
            You are evaluated alongside these {rivals.length === 1 ? "chapter" : `${rivals.length} chapters`}:
          </p>
          <ul className="rx-rivals rx-small">
            {rivals.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </>
      )}
      <p className="rx-small rx-mute">
        Chapters in {others.join(" and ")} are evaluated separately. Each category gets its own Gold, Silver and
        Bronze for every recognition.
      </p>
    </section>
  );
}

/** One short box at the top of the apply page: the whole process in plain words. */
export function ApplyInstructions({ deadline, whyWords }: { deadline: string; whyWords: number }) {
  return (
    <section className="rx-notice rx-stack" aria-label="How to apply" style={{ gap: 0 }}>
      <div className="rx-h3">How to apply</div>
      <ol className="rx-small" style={{ margin: "6px 0 0", paddingLeft: 20, listStyle: "decimal" }}>
        <li>
          <strong>Select Recognitions:</strong> The Chapter Chair may nominate the chapter for any number of recognitions
          across verticals.
        </li>
        <li>
          <strong>Mandatory Justification:</strong> Each nomination must include a justification answering &ldquo;Why
          should your chapter receive this recognition?&rdquo; in {whyWords} words or fewer.
        </li>
        <li>
          <strong>Save as Draft:</strong> Drafts can be saved anytime but are not considered submitted.
        </li>
        <li>
          <strong>Submission Deadline:</strong> Submit by {deadline}. Late submissions will not be considered under any
          circumstances.
        </li>
        <li>
          <strong>Locked Submissions:</strong> Once submitted, nominations cannot be modified or withdrawn.
        </li>
        <li>
          <strong>Category-Based Evaluation:</strong> Only self-nominated chapters will be evaluated against others in
          their respective categories.
        </li>
        <li>
          <strong>Final Decision:</strong> Decisions of the Recognitions &amp; Celebrations team are final and binding. No
          disputes will be entertained.
        </li>
      </ol>
    </section>
  );
}
