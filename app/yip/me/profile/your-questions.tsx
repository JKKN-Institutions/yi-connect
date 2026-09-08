import type { LucideIcon } from "lucide-react";
import { Megaphone, Hourglass, Clock, Archive, MessageSquareQuote } from "lucide-react";
import {
  getMyTabledQuestions,
  type QuestionOutcome,
  type TabledQuestion,
} from "@/app/yip/actions/my-questions";
import { SectionShell, SectionHeading, INK, SAFFRON, GOLD, GREEN, SERIF, inkA } from "../credential-ui";

/**
 * "Your questions" — what became of every question this member tabled.
 *
 * WHY. A participant wrote in after day 1 of the live SRTN round: her chapter
 * had researched hard and then watched half of Question Hour get cancelled.
 * "Our minds were filled with sagacious thoughts but we could not express
 * them." The platform kept no record, so a member whose question was never
 * called could not tell whether the House had run out of time or whether her
 * question had never been cleared at all. On that event 135 questions were
 * approved and 129 have no trace of being put.
 *
 * The whole point of this section is the SECOND group — approved, never
 * reached. Its wording has one job: make plain that this was the clock, not a
 * verdict on her question. Do not soften that into something that sounds like
 * she fell short, and do not add a reason to the fourth group either — a
 * sixteen-year-old is owed the fact, not a critique.
 *
 * NOTHING COMPETITIVE. Only the member's own rows are loaded. No score, no
 * rank, no count of anyone else's questions, no comparison of any kind — the
 * same line the rest of /yip/me holds.
 */

type GroupSpec = {
  outcome: QuestionOutcome;
  title: string;
  /** One fixed sentence — never generated, never conditional on a score. */
  note: string;
  accent: string;
  icon: LucideIcon;
};

const GROUPS: GroupSpec[] = [
  {
    outcome: "put",
    title: "Put to the House",
    note: "Called in the Chamber during Question Hour.",
    accent: GREEN,
    icon: Megaphone,
  },
  {
    outcome: "not_reached",
    title: "Approved, not reached",
    // Phrased without a subject pronoun so it reads correctly for one question
    // or for six — a member with a single unreached question is exactly the
    // person this sentence was written for.
    note: "Cleared by the Chair to be put, but Question Hour ended first. That is the clock running out — not a judgement on your question.",
    accent: GOLD,
    icon: Hourglass,
  },
  {
    outcome: "with_chair",
    title: "With the Chair",
    note: "Tabled and waiting to be reviewed.",
    accent: SAFFRON,
    icon: Clock,
  },
  {
    outcome: "not_taken",
    title: "Not taken up",
    note: "Not carried forward to the floor.",
    // Muted ink, never red. Red reads as a rebuke, and no reason is shown here
    // by design — the member is owed the fact and nothing more.
    accent: inkA(0.45),
    icon: Archive,
  },
];

function QuestionCard({ q }: { q: TabledQuestion }) {
  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{ background: inkA(0.03), border: `1px solid ${inkA(0.07)}` }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.12em]"
        style={{ color: inkA(0.45) }}
      >
        {q.ministry || "The Cabinet"}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK }}>
        {q.text}
      </p>
      {q.onTheFloorNow && (
        <p className="mt-1.5 text-[11px] font-semibold" style={{ color: GREEN }}>
          On the floor right now
        </p>
      )}
      {q.passedOver && (
        <p className="mt-1.5 text-[11px]" style={{ color: inkA(0.5) }}>
          Called, then the House moved on before an answer was recorded.
        </p>
      )}
    </div>
  );
}

export default async function YourQuestions() {
  // Takes NO argument on purpose — the reader resolves the member from the
  // signed participant cookie. Never pass an id and never read one from the
  // URL: that is exactly the hole commit a5011e2c closed.
  const questions = await getMyTabledQuestions();

  // null means the session is not a participant of a real event. The parent
  // page already says so once; saying it twice is noise, so render nothing.
  if (!questions) return null;

  const header = (
    <SectionHeading
      eyebrow="Question Hour"
      title="Your questions"
      icon={MessageSquareQuote}
      accent={GOLD}
    />
  );

  if (questions.length === 0) {
    return (
      <SectionShell accent={GOLD}>
        <div className="px-5 py-5">
          {header}
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: inkA(0.65) }}>
            You have not tabled a question yet. When you do, it will appear here
            with what became of it — right through to the floor of the House.
          </p>
        </div>
      </SectionShell>
    );
  }

  const notReached = questions.filter((q) => q.outcome === "not_reached").length;

  return (
    <SectionShell accent={GOLD}>
      <div className="px-5 py-5">
        {header}
        <p className="mt-3 text-[13px]" style={{ color: inkA(0.6) }}>
          Every question you tabled in this House, and what happened to each.
        </p>

        <div className="mt-5 space-y-6">
          {GROUPS.map((g) => {
            const rows = questions.filter((q) => q.outcome === g.outcome);
            if (rows.length === 0) return null;
            const Icon = g.icon;
            return (
              <div key={g.outcome}>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" style={{ color: g.accent }} />
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: g.accent }}
                  >
                    {g.title}
                  </p>
                  <span
                    className="text-[11px] font-bold"
                    style={{ ...SERIF, color: inkA(0.4) }}
                  >
                    {rows.length}
                  </span>
                </div>
                <p
                  className="mt-1 text-[11px] leading-relaxed"
                  style={{ color: inkA(0.55) }}
                >
                  {g.note}
                </p>
                <div className="mt-2.5 space-y-2">
                  {rows.map((q) => (
                    <QuestionCard key={q.id} q={q} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Only shown when it can actually apply. The House records a question
            at the moment it is called, and that recording has only just started
            working — so an older session can leave a question sitting under
            "not reached" even though it was put. Say so, and give the member
            somewhere to take it, rather than let the page quietly mislead her. */}
        {notReached > 0 && (
          <p
            className="mt-5 border-t pt-3 text-[11px] leading-relaxed"
            style={{ borderColor: inkA(0.08), color: inkA(0.5) }}
          >
            A question is recorded the moment the House calls it. If yours was
            put in the Chamber but still sits above as not reached, tell your
            organiser so the record can be corrected.
          </p>
        )}
      </div>
    </SectionShell>
  );
}
