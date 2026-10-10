import Link from "next/link";
import type { Metadata } from "next";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { TP_EVENT } from "@/lib/take-pride/constants";
import { getDelegateByToken } from "@/lib/take-pride/data";
import { getChapterJourney, STAGE_STEPS, type JourneyItem } from "@/lib/take-pride/recognitions-bridge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My chapter's journey" };

function istDate(iso: string | null): string {
  if (!iso) return "Date to be set";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(new Date(iso));
}

const STAGE_TEXT: Record<JourneyItem["stage"], string> = {
  nominated: "Your chapter has sent its nomination. Regional checkers are looking at it.",
  checked: "The nomination passed its checks and is in the race.",
  scoring: "Evaluators are scoring every chapter in the race.",
  final_list: "The national team is preparing the final list.",
  announced: "Winners have been announced on the Awards Night screen.",
  not_forward: "This nomination did not go forward to scoring this year.",
};

function Steps({ stage }: { stage: JourneyItem["stage"] }) {
  const at = STAGE_STEPS.findIndex((s) => s.key === stage);
  return (
    <ol className="tp-chips" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Stages">
      {STAGE_STEPS.map((s, i) => (
        <li key={s.key} className={`tp-chip${i <= at ? " on" : ""}`} aria-current={i === at ? "step" : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export default async function ChapterJourneyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // getDelegateByToken validates the token shape (isToken) before any query.
  const delegate = await getDelegateByToken(token);
  if (!delegate) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const journey = await getChapterJourney(delegate.chapter);
  const back = (
    <Link className="tp-btn ghost sm" href={`/take-pride/pass/${token}`}>
      Back to my pass
    </Link>
  );

  return (
    <main className="tp-main">
      <TopBar right={<span className="tp-eyebrow">My chapter</span>} />
      {delegate.is_sample && <SampleNote>This is a sample delegate for the demo.</SampleNote>}

      <section className="tp-stack" style={{ gap: 6 }}>
        <div className="tp-eyebrow">{TP_EVENT.name} awards</div>
        <h1 className="tp-h1">{journey.kind === "ok" ? `Yi ${journey.chapterName}` : delegate.chapter}</h1>
        <p className="tp-lede">Where your chapter stands in the national chapter awards, step by step.</p>
      </section>

      {journey.kind === "no_cycle" && (
        <div className="tp-card">
          <h2 className="tp-h2">Awards not set up yet</h2>
          <p className="tp-mute" style={{ margin: 0 }}>The national team has not opened this year&rsquo;s chapter awards yet. Check back soon.</p>
        </div>
      )}

      {journey.kind === "no_chapter" && (
        <div className="tp-card">
          <h2 className="tp-h2">We could not find your chapter</h2>
          <p className="tp-mute" style={{ margin: 0 }}>
            Your pass says &ldquo;{journey.chapterText}&rdquo;, and we could not match it to a chapter in the {journey.cycleName} awards.
            Ask the Take Pride desk to check your chapter name.
          </p>
        </div>
      )}

      {journey.kind === "ok" && (
        <>
          <section className="tp-card" aria-labelledby="tp-ch-noms">
            <div className="tp-row">
              <h2 className="tp-h2" id="tp-ch-noms">Your nominations</h2>
              {journey.categoryLabel && <span className="tp-tag green">{journey.categoryLabel}</span>}
            </div>
            {journey.items.length === 0 ? (
              <p className="tp-mute" style={{ margin: 0 }} data-testid="no-noms">
                {journey.nominationsClosed ? (
                  <>
                    Nominations for {journey.cycleName} closed on {istDate(journey.nominationDeadline)}. Your chapter did not send a
                    nomination this year.
                  </>
                ) : journey.nominationDeadline ? (
                  <>
                    Your chapter has not sent a nomination for {journey.cycleName} yet. Nominations close on{" "}
                    {istDate(journey.nominationDeadline)}. Your chapter chair can still nominate.
                  </>
                ) : (
                  <>
                    Your chapter has not sent a nomination for {journey.cycleName} yet. The closing date is not set yet. Your
                    chapter chair can still nominate.
                  </>
                )}
              </p>
            ) : (
              <div className="tp-list">
                {journey.items.map((it) => (
                  <article key={`${it.awardTitle}:${it.categoryLabel}`} className="tp-stack" style={{ gap: 8 }}>
                    <div className="tp-row" style={{ alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 className="tp-h3">{it.awardTitle}</h3>
                        <p className="tp-small" style={{ margin: 0 }}>{it.categoryLabel}</p>
                      </div>
                      {it.stage === "not_forward" && <span className="tp-tag">Not going forward</span>}
                    </div>
                    {it.stage !== "not_forward" && <Steps stage={it.stage} />}
                    <p className="tp-small" style={{ margin: 0 }}>{STAGE_TEXT[it.stage]}</p>
                    {it.announced && (
                      <p className={`tp-alert ${it.announced.isYou ? "ok" : "warn"}`} style={{ margin: 0 }}>
                        {it.announced.isYou ? "Your chapter won this award!" : `Winner: Yi ${it.announced.winner}`}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="tp-card" aria-labelledby="tp-ch-dates">
            <h2 className="tp-h2" id="tp-ch-dates">Key dates</h2>
            <div className="tp-list">
              {journey.timeline.map((t) => (
                <div key={t.label} className="tp-row">
                  <span>{t.label}</span>
                  <b className="tp-num">{istDate(t.at)}</b>
                </div>
              ))}
              <div className="tp-row">
                <span>Awards Night</span>
                <b className="tp-num">{TP_EVENT.dates}</b>
              </div>
            </div>
            <p className="tp-small" style={{ margin: 0 }}>Scores and ranks stay private. Winners are shown only once they are announced on stage.</p>
          </section>
        </>
      )}

      <div>{back}</div>
    </main>
  );
}
