import Link from "next/link";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { QuestionShowcase, type ShowcaseQuestion } from "./_components/QuestionShowcase";

export const revalidate = 300;

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

async function getShowcase(): Promise<ShowcaseQuestion[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .from("questions")
    .select(
      "id, question_text, option_a, option_b, option_c, option_d, correct_option, topics(name)"
    )
    .eq("is_active", true)
    .eq("question_type", "mcq")
    .limit(6);

  return (data ?? [])
    .filter((q) => q.correct_option)
    .map((q) => ({
      id: q.id,
      topic:
        (q.topics as { name: string } | null)?.name ?? "Young Indians Quiz",
      text: q.question_text,
      options: [
        { key: "a", text: q.option_a ?? "" },
        { key: "b", text: q.option_b ?? "" },
        { key: "c", text: q.option_c ?? "" },
        { key: "d", text: q.option_d ?? "" },
      ],
      correct: q.correct_option as string,
    }));
}

async function getStats() {
  const svc = await createServiceClient();
  const [chapters, questions, topics] = await Promise.all([
    svc.from("chapter_events").select("id", { count: "exact", head: true }),
    svc
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    svc
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);
  return {
    chapters: chapters.count ?? 0,
    questions: questions.count ?? 0,
    topics: topics.count ?? 0,
  };
}

export default async function YiqLandingPage() {
  const [showcase, stats] = await Promise.all([getShowcase(), getStats()]);

  return (
    <main id="yiq-main" style={{ background: INK, color: PAPER }}>
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the thesis is a real question, played live.                */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.16]"
          style={{
            background:
              "radial-gradient(circle, #e8a33d 0%, rgba(232,163,61,0) 68%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className="yiq-eyebrow rounded-full px-3 py-1"
                style={{ background: SAFFRON, color: INK, fontWeight: 700 }}
              >
                Young Indians
              </span>
              <span className="yiq-eyebrow" style={{ color: DIM }}>
                India · Innovation · Intellect
              </span>
            </div>

            <h1
              className="yiq-display mt-6 text-[3.25rem] sm:text-[4.5rem] lg:text-[5.25rem]"
              style={{ color: PAPER }}
            >
              India&apos;s brightest
              <br />
              minds. One
              <br />
              <span style={{ color: SAFFRON }}>national stage.</span>
            </h1>

            <p
              className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed"
              style={{ color: DIM }}
            >
              YIQ is the Young Indians Quiz — a national championship for
              Classes 9 to 12. Your school team competes in the chapter online
              round, the top ten meet on the chapter stage, and one champion
              team from every chapter goes to the National Grand Finale.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/yiq/register"
                className="rounded-full px-6 py-3.5 text-[0.9375rem] font-bold transition-transform active:translate-y-px"
                style={{ background: SAFFRON, color: INK }}
              >
                Register your school team
              </Link>
              <Link
                href="/yiq/login"
                className="rounded-full border px-6 py-3.5 text-[0.9375rem] font-semibold transition-colors hover:bg-white/5"
                style={{ borderColor: RULE, color: PAPER }}
              >
                I have an access code
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-9 gap-y-4">
              {[
                { n: stats.chapters, l: "Yi chapters" },
                { n: stats.topics, l: "Quiz topics" },
                { n: `${stats.questions}+`, l: "Questions live" },
                { n: "9–12", l: "Classes" },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="sr-only">{s.l}</dt>
                  <dd
                    className="yiq-data text-[1.75rem] font-semibold"
                    style={{ color: PAPER }}
                  >
                    {s.n}
                  </dd>
                  <p className="yiq-eyebrow mt-0.5" style={{ color: DIM }}>
                    {s.l}
                  </p>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:pl-4">
            <p className="yiq-eyebrow mb-3" style={{ color: DIM }}>
              A question from the live bank
            </p>
            <QuestionShowcase questions={showcase} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The two levels. Numbered because the content genuinely is ordered.*/}
      {/* ---------------------------------------------------------------- */}
      <section
        className="border-t"
        style={{ borderColor: RULE, background: "#12224a" }}
      >
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
          <h2 className="yiq-display text-[2.25rem] sm:text-[2.75rem]">
            Two levels. One champion.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[
              {
                n: "01",
                t: "Chapter Championship",
                arrow: "Students → Chapter",
                steps: [
                  "Every eligible student competes in one timed online round",
                  "The top ten teams are selected directly — no intermediate rounds",
                  "Those ten meet on stage for the live Chapter Finals",
                  "One champion team, plus the Best Individual Quizzer",
                ],
              },
              {
                n: "02",
                t: "National Grand Finale",
                arrow: "Chapters → Nation",
                steps: [
                  "Every chapter's champion team enters the national round",
                  "National semi-finals narrow the field",
                  "Live finale at the Yi National Convention, streamed",
                  "Gold trophy, scholarship and a mentorship programme",
                ],
              },
            ].map((lv) => (
              <article
                key={lv.n}
                className="rounded-2xl border p-6 sm:p-7"
                style={{ borderColor: RULE, background: "rgba(10,22,51,0.45)" }}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="yiq-data text-[2.5rem] font-bold leading-none"
                    style={{ color: SAFFRON }}
                  >
                    {lv.n}
                  </span>
                  <div>
                    <h3 className="yiq-display text-[1.5rem]">{lv.t}</h3>
                    <p className="yiq-eyebrow mt-1" style={{ color: DIM }}>
                      {lv.arrow}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 grid gap-3">
                  {lv.steps.map((s) => (
                    <li
                      key={s}
                      className="flex gap-3 text-[0.9375rem] leading-relaxed"
                      style={{ color: "#cdd7ee" }}
                    >
                      <span
                        aria-hidden
                        className="mt-[0.55rem] h-1.5 w-1.5 flex-none rounded-full"
                        style={{ background: SAFFRON }}
                      />
                      {s}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Topics + categories                                               */}
      {/* ---------------------------------------------------------------- */}
      <section style={{ background: PAPER, color: INK }}>
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="yiq-display text-[2.25rem] sm:text-[2.75rem]">
              What you&apos;ll be asked
            </h2>
            <div className="flex gap-2">
              <span
                className="yiq-eyebrow rounded-full px-3 py-1.5"
                style={{ background: INK, color: PAPER }}
              >
                Junior · Cl 9–10
              </span>
              <span
                className="yiq-eyebrow rounded-full px-3 py-1.5"
                style={{ background: INK, color: PAPER }}
              >
                Senior · Cl 11–12
              </span>
            </div>
          </div>
          <p
            className="mt-3 max-w-2xl text-[0.9375rem]"
            style={{ color: "#5a6480" }}
          >
            Separate championships run for each category, across seven topics.
          </p>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-3"
              style={{ background: "rgba(10,22,51,0.12)" }}>
            {[
              ["India", "History, Geography, Culture, Constitution, Parliament"],
              ["Young India & Leadership", "Startups, Innovation, Social Impact"],
              ["Business & Economics", "GDP, Markets, Banking, Finance, Trade"],
              ["Science & Technology", "AI, Space, Medicine, Environment"],
              ["Current Affairs", "National, International, Sports, Business"],
              ["Sports", "Olympics, Cricket, Chess, Football, Indian Sports"],
              ["Arts & Culture", "Music, Cinema, Literature, Dance, Architecture"],
            ].map(([t, d]) => (
              <li key={t} className="p-5 sm:p-6" style={{ background: PAPER }}>
                <h3 className="text-[1.0625rem] font-bold">{t}</h3>
                <p
                  className="mt-1.5 text-[0.875rem] leading-relaxed"
                  style={{ color: "#5a6480" }}
                >
                  {d}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Calendar                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section style={{ background: INK }}>
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
          <h2 className="yiq-display text-[2.25rem] sm:text-[2.75rem]">
            The road to the finale
          </h2>
          <ol className="mt-9 grid gap-px overflow-hidden rounded-2xl md:grid-cols-5"
              style={{ background: RULE }}>
            {[
              ["Jul – Aug", "Chapter registrations"],
              ["Sep – Oct", "Final online round"],
              ["Nov", "Chapter finals"],
              ["Jan", "National semi-finals"],
              ["Feb", "National Grand Finale"],
            ].map(([when, what], i) => (
              <li key={what} className="p-5" style={{ background: "#12224a" }}>
                <p
                  className="yiq-data text-[0.8125rem] font-semibold"
                  style={{ color: SAFFRON }}
                >
                  {when}
                </p>
                <p className="mt-1.5 text-[0.9375rem] font-semibold leading-snug">
                  {what}
                </p>
                <p className="yiq-eyebrow mt-3" style={{ color: DIM }}>
                  Stage {i + 1}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer
        className="border-t"
        style={{ borderColor: RULE, background: INK }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="yiq-display text-[1.375rem]">YIQ</p>
            <p className="yiq-eyebrow mt-1" style={{ color: DIM }}>
              Young Indians Quiz · India. Innovation. Intellect.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem]">
            <Link href="/yiq/register" style={{ color: DIM }}>
              Register
            </Link>
            <Link href="/yiq/login" style={{ color: DIM }}>
              Access code
            </Link>
            <Link href="/yiq/dashboard" style={{ color: DIM }}>
              Chapter dashboard
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
