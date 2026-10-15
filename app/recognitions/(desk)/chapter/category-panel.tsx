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
          done, you&apos;ll see here the chapters you compete with.
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
            You compete only with these {rivals.length === 1 ? "chapter" : `${rivals.length} chapters`}:
          </p>
          <ul className="rx-rivals rx-small">
            {rivals.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </>
      )}
      <p className="rx-small rx-mute">
        Chapters in {others.join(" and ")} are a separate race. You do not compete with them: each category gets its
        own winner, runner-up and second runner-up for every recognition.
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
        <li>Tick each recognition your chapter wants to apply for. You can tick as many as you like.</li>
        <li>
          For every one you tick, answer &ldquo;Why should your chapter get this recognition?&rdquo; in {whyWords} words
          or fewer. This answer is compulsory.
        </li>
        <li>Save a draft whenever you like. A draft is not entered.</li>
        <li>
          Submit before {deadline}. Once submitted, a nomination is locked: it can&apos;t be changed or withdrawn.
        </li>
        <li>Evaluators then score your nominations against the other chapters in your category only.</li>
      </ol>
    </section>
  );
}
