import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Compass, BarChart3, Footprints, Sparkles, Hand } from "lucide-react";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getParliamentaryProfile } from "@/app/yip/actions/parliamentary-profile";
import type {
  AxisStanding,
  FootprintLine,
  NominationStanding,
} from "@/app/yip/actions/parliamentary-profile";
import YourQuestions from "./your-questions";
import {
  SectionShell,
  SectionHeading,
  INK,
  SAFFRON,
  GOLD,
  GREEN,
  SERIF,
  inkA,
} from "../credential-ui";

/**
 * "Where You Stand" — the Parliamentary Profile, participant-facing.
 *
 * /yip/me already tells a member what they DID. This page adds the half that
 * makes it mean something: where that sits among everyone who sat in the same
 * House. A sixteen-year-old cannot read anything into "you spoke three times"
 * without knowing what three times IS.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT RENDER
 * The engine returns richer data than this page shows, and that is on purpose.
 * Two Director rulings are recorded in this codebase and both bind here:
 *
 *   1. your-growth-card.tsx — "ZERO numbers ever — no score, no rank, no
 *      average, no percentage, no count-of-judges, nothing numeric derived
 *      from scores" (marked NON-NEGOTIABLE).
 *   2. me/journey/page.tsx strips avg_score before render — "Participants must
 *      NEVER see their raw scores ... raw scores invite comparison & disputes
 *      between students."
 *
 * So `you`, `houseMedian`, `percentile` and `juryCount` are NEVER printed as
 * digits anywhere below. The member sees the BAND only ("Top quarter of the
 * House"). The percentile is used for one thing — how far a bar is filled —
 * which conveys the same standing without handing a minor a number to argue
 * about or to compare against a friend in the corridor.
 *
 * Bands, never ranks (session ruling, mirroring PR #1009 which made marks
 * chair-only after named marks for 345 minors turned out to be readable). A
 * band cannot be reverse-engineered into another member's position; a rank can.
 * Do not "improve" this page by adding one.
 *
 * The FOOTPRINT counts below are not scores — they are the member's own actions
 * (times they took the floor, questions they tabled). Those are facts about
 * themselves that /yip/me already shows, so they render as real numbers.
 *
 * NO LLM. Every sentence here is arithmetic over the member's own record.
 */

/** Fill for the standing bar. Saffron→gold reads as "further along", not "better than N people". */
const BAR_FILL = `linear-gradient(to right, ${SAFFRON}, ${GOLD})`;

function AxisRow({ axis }: { axis: AxisStanding }) {
  // Floor the visible fill so a member in the "Building" band still sees a
  // sliver of progress rather than an empty trough, which reads as a rebuke.
  const fill = Math.max(6, Math.min(100, axis.percentile));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium" style={{ color: INK }}>
          {axis.label}
        </p>
        <p
          className="shrink-0 text-[11px] font-semibold"
          style={{ color: SAFFRON }}
        >
          {axis.band}
        </p>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: inkA(0.07) }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${fill}%`, background: BAR_FILL }}
        />
      </div>
    </div>
  );
}

function FootprintRow({ line }: { line: FootprintLine }) {
  // houseMedian is the median among members who did this AT ALL (the engine
  // builds its map only from doers), so it is described that way. Calling it
  // "the House median" would overstate it whenever most of the House did none.
  const context =
    line.houseDidAny === 0
      ? // houseDidAny counts everyone who did this AT ALL, the member included.
        // Zero therefore means nobody has — which also means `you` is zero, so
        // this can never be phrased as "you are the first".
        "No one has done this yet"
      : line.houseDidAny === 1 && line.you > 0
        ? "You are the only one so far"
        : `Typical among the ${line.houseDidAny} who did: ${line.houseMedian}`;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium" style={{ color: INK }}>
          {line.label}
        </p>
        <p className="text-[11px]" style={{ color: inkA(0.5) }}>
          {context}
        </p>
      </div>
      <p
        className="shrink-0 text-[22px] font-bold leading-none"
        style={{ ...SERIF, color: line.you > 0 ? INK : inkA(0.25) }}
      >
        {line.you}
      </p>
    </div>
  );
}

/**
 * What the member STOOD FOR — intent, not outcome.
 *
 * Renders no result and no winner: a member sees the posts they put their own
 * name forward for, and how many others stood for the same. That second number
 * is the size of a group, exactly like the footprint's `houseDidAny`, so it
 * tells a sixteen-year-old that standing for Prime Minister was contested
 * without handing anyone a position to argue about in the corridor.
 *
 * Do not "improve" this by adding who won, or by turning the count into an
 * ordering ("you were the 3rd to apply") — that is a rank, and ranks are the
 * one thing this page must never show.
 */
function NominationsSection({
  nominations,
}: {
  nominations: NominationStanding;
}) {
  return (
    <SectionShell accent={SAFFRON}>
      <div className="px-5 py-5">
        <SectionHeading
          eyebrow="Your nomination"
          title="What you put your hand up for"
          icon={Hand}
        />
        {!nominations.filed ? (
          // ~28 of 196 members at the SRTN round filed nothing. They get a
          // plain statement of fact, not a nudge and not a rebuke.
          <p
            className="mt-3 text-[13px] leading-relaxed"
            style={{ color: inkA(0.6) }}
          >
            You did not put your name forward for a post at this round. Taking
            the floor, tabling questions and moving bills all count on their
            own — standing for a post is one more way in, not the only one.
          </p>
        ) : (
          <>
            <div className="mt-2 divide-y" style={{ borderColor: inkA(0.07) }}>
              {nominations.roles.map((r) => (
                <div key={r.role} className="py-2">
                  <p
                    className="text-[13px] font-medium"
                    style={{ color: INK }}
                  >
                    {r.label}
                  </p>
                  <p className="text-[11px]" style={{ color: inkA(0.5) }}>
                    {r.houseWanted <= 1
                      ? "You were the only one who stood for this"
                      : `${r.houseWanted} members stood for this`}
                  </p>
                </div>
              ))}
            </div>
            {nominations.ministries.length > 0 && (
              <div className="mt-3">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: inkA(0.45) }}
                >
                  Portfolios you chose
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nominations.ministries.map((m) => (
                    <span
                      key={m}
                      className="rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{ background: `${SAFFRON}14`, color: SAFFRON }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SectionShell>
  );
}

export default async function ParliamentaryProfilePage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") redirect("/yip/join");

  // Takes NO argument on purpose — the engine resolves the subject from the
  // signed participant cookie. Never pass an id here and never read one from
  // the URL: that is exactly the hole commit a5011e2c closed.
  const profile = await getParliamentaryProfile();

  const header = (
    <div>
      <Link
        href="/yip/me"
        className="mb-2 inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e]"
      >
        <ArrowLeft className="size-3" /> Back to My Dashboard
      </Link>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: SAFFRON }}
      >
        The Comparison
      </p>
      <h1
        className="mt-0.5 text-[28px] font-bold leading-[1.1] tracking-tight"
        style={{ ...SERIF, color: INK }}
      >
        Where You Stand
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: inkA(0.6) }}>
        Your record in this House, set against everyone who sat in it.
      </p>
    </div>
  );

  // The engine returns null when the session is not a participant of a real
  // event. Fail with something explicit and readable rather than a blank page.
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-24">
        {header}
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-12 text-center">
            <p className="text-sm" style={{ color: inkA(0.6) }}>
              We could not find your place in this House yet. If you have just
              been added, check back after your organiser completes setup.
            </p>
          </div>
        </SectionShell>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-24">
      {header}

      {/* ── Signature axis — the one thing to take away ──────────────── */}
      {profile.scored && profile.signature && (
        <SectionShell
          accent={`linear-gradient(to right, #FF9933 0 33.33%, ${GOLD} 33.33% 66.66%, ${GREEN} 66.66% 100%)`}
        >
          <div className="px-5 py-5">
            <SectionHeading
              eyebrow="Your strongest suit"
              title={profile.signature.label}
              icon={Compass}
            />
            <p
              className="mt-3 text-[20px] font-bold leading-tight"
              style={{ ...SERIF, color: SAFFRON }}
            >
              {profile.signature.band}
            </p>
            <p className="mt-2 text-[13px]" style={{ color: inkA(0.6) }}>
              This is where your jurors rated you highest relative to the rest
              of the House.
            </p>
          </div>
        </SectionShell>
      )}

      {/* ── Not scored yet — honest, not an error ────────────────────── */}
      {!profile.scored && (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-5">
            <SectionHeading
              eyebrow="Still early"
              title="No scores in yet"
              icon={Sparkles}
            />
            <p className="mt-3 text-[13px]" style={{ color: inkA(0.65) }}>
              Your jurors have not submitted anything for you so far. This page
              fills itself in as sessions are scored — there is nothing to
              re-run and nothing you need to do. Come back after your next
              session. What you have already done is below.
            </p>
          </div>
        </SectionShell>
      )}

      {/* ── The four axes ────────────────────────────────────────────── */}
      {profile.scored && profile.axes.length > 0 && (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-5">
            <SectionHeading
              eyebrow="How you compare"
              title="The four axes"
              icon={BarChart3}
            />
            <div className="mt-4 space-y-4">
              {profile.axes.map((a) => (
                <AxisRow key={a.axis} axis={a} />
              ))}
            </div>
            <p
              className="mt-5 border-t pt-3 text-[11px] leading-relaxed"
              style={{ borderColor: inkA(0.08), color: inkA(0.5) }}
            >
              Bands, never positions. You are never shown another member&apos;s
              score, and no one is shown yours.
              {profile.sampleSize > 0 && profile.sampleSize < 3 && (
                <>
                  {" "}
                  Only a little of your record has been scored so far, so treat
                  this gently — it sharpens with every session.
                </>
              )}
            </p>
          </div>
        </SectionShell>
      )}

      {/* ── Footprint — own actions, safe as real numbers ────────────── */}
      <SectionShell accent={GOLD}>
        <div className="px-5 py-5">
          <SectionHeading
            eyebrow="Your footprint"
            title="What you actually did"
            icon={Footprints}
          />
          <div className="mt-2 divide-y" style={{ borderColor: inkA(0.07) }}>
            {profile.footprint.map((f) => (
              <FootprintRow key={f.key} line={f} />
            ))}
          </div>
        </div>
      </SectionShell>

      {/* ── Question Hour — the footprint count, opened up ───────────── */}
      {/* Sits directly under the footprint because that section already says
          how many questions were tabled; this says what became of each. */}
      <YourQuestions />

      {/* ── What they stood for ──────────────────────────────────────── */}
      {/* Sits AFTER YourQuestions on purpose: that block is a drill-down of
          the footprint's "Questions you tabled" line and has to stay next to
          it. This is a separate part of the record — what the member asked
          for rather than what they did — so it follows the pair. */}
      <NominationsSection nominations={profile.nominations} />

      {/* ── Stands out for ───────────────────────────────────────────── */}
      {profile.standsOutFor.length > 0 && (
        <SectionShell accent={GREEN}>
          <div className="px-5 py-5">
            <SectionHeading
              eyebrow="Noticed"
              title="You did more of this than most"
              icon={Sparkles}
              accent={GREEN}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.standsOutFor.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{ background: `${GREEN}14`, color: GREEN }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </SectionShell>
      )}
    </div>
  );
}
