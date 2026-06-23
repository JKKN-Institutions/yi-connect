import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { isAnyYipAdmin } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  Users,
  Calculator,
  Trophy,
  Crown,
  Info,
  CheckCircle2,
  Scale,
} from "lucide-react";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Scoring & Awards Guide — YIP",
};

// ── small presentational helpers (server component, no client JS) ──────────
function Section({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3 border-b border-[#1a1a3e]/10 pb-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FF9933]/12 text-[#FF9933]">
            {icon}
          </span>
          <h2 className="text-base font-bold text-[#1a1a3e]">
            <span className="text-[#FF9933]">{n}.</span> {title}
          </h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[#138808]/10 px-2 py-0.5 text-xs font-semibold text-[#138808]">
      {children}
    </span>
  );
}

export default async function ScoringGuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  if (!(await isAnyYipAdmin())) {
    return (
      <Forbidden403 reason="The Scoring & Awards Guide is for YIP admins, chairs and organisers. Your role doesn't include event management." />
    );
  }

  const thCls =
    "border border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.03] px-3 py-2 text-left font-semibold text-[#1a1a3e]";
  const tdCls = "border border-[#1a1a3e]/10 px-3 py-2 text-gray-700";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a3e]">
            How YIP Scoring &amp; Awards Work
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            A plain-English guide for chapter chairs, organisers and admins.
            Based on the Yi 2026 Evaluation Workbook. The names and marks below
            are an <strong>illustrative example</strong> (real committee, judges
            and students from Erode 2026 are used only to make it concrete) — not
            anyone&apos;s actual result.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* The big picture */}
      <Card className="border-[#FF9933]/30 bg-[#FF9933]/[0.04]">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-[#FF9933]" />
            <h2 className="text-base font-bold text-[#1a1a3e]">
              The whole idea in 30 seconds
            </h2>
          </div>
          <p className="text-sm text-gray-700">
            Every student is scored <strong>out of 100</strong>. That is{" "}
            <strong>six things they do on the floor (worth 90)</strong> plus a{" "}
            <strong>leadership bonus (up to 10)</strong> if they hold a role like
            Prime Minister or Speaker. One of those six things — their{" "}
            <strong>committee work</strong> — is a <em>shared team mark</em>:
            every member of a committee gets the same committee score, decided by
            the judges who evaluate that committee. Everything else they earn
            individually. Awards are then handed out by ranking students on
            different slices of this score.
          </p>
        </CardContent>
      </Card>

      {/* 1. Committee scoring */}
      <Section n={1} icon={<Users className="size-5" />} title="How a committee is scored (the shared team mark)">
        <p className="text-sm text-gray-700">
          Judges rate each committee on <strong>6 things, each out of 10 — so 60
          total</strong>. When several judges score the same committee, their
          marks are <strong>averaged</strong>. Example: the{" "}
          <strong>Ministry of Education</strong> committee, scored by two judges.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>What judges rate</th>
                <th className={thCls}>Mohandinesh Ayyasamy</th>
                <th className={thCls}>yASH</th>
                <th className={thCls}>Average</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Bill Draft Quality", 8, 9, 8.5],
                ["Policy Relevance", 7, 8, 7.5],
                ["Innovation", 6, 7, 6.5],
                ["Feasibility", 7, 6, 6.5],
                ["Team Collaboration", 9, 8, 8.5],
                ["Presentation & Defence", 8, 9, 8.5],
              ].map(([k, a, b, avg]) => (
                <tr key={k as string}>
                  <td className={tdCls}>{k}</td>
                  <td className={tdCls}>{a}</td>
                  <td className={tdCls}>{b}</td>
                  <td className={tdCls}>{avg}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={tdCls}>Committee total /60</td>
                <td className={tdCls}>45</td>
                <td className={tdCls}>47</td>
                <td className={`${tdCls} text-[#FF9933]`}>46</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-700">
          That averaged <strong>46/60</strong> then splits into two final marks,
          each out of 5:
        </p>
        <ul className="ml-1 space-y-1 text-sm text-gray-700">
          <li>
            • The first five items (teamwork &amp; bill-drafting) = 37.5 of 50 →{" "}
            <strong>Committee Discussions: 3.75 / 5</strong>
          </li>
          <li>
            • Presentation &amp; Defence = 8.5 of 10 →{" "}
            <strong>Bill Presentation: 4.25 / 5</strong>
          </li>
        </ul>
        <p className="text-sm text-gray-700">
          So this committee contributes <Pill>3.75 + 4.25 = 8.00 points</Pill>{" "}
          — given <strong>identically to every one of its members</strong>. A
          perfect committee (60/60) would give 5 + 5 = 10.
        </p>
      </Section>

      {/* 2. Individual scorecard */}
      <Section n={2} icon={<Calculator className="size-5" />} title="A student's full scorecard (out of 100)">
        <p className="text-sm text-gray-700">
          A student is scored on these <strong>six components</strong> (the
          current Erode 2026 setup). The two marked{" "}
          <span className="text-[#138808] font-semibold">★</span> each contain
          the shared committee mark from Section 1.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Component</th>
                <th className={thCls}>Max</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Matters of Urgent Public Importance / Opening Speech", 15, false],
                ["Committee Discussions & Bill Drafting ★", 15, true],
                ["Question Hour", 20, false],
                ["Zero Hour", 15, false],
                ["Political Acumen & Legislative Strategy (Debate)", 10, false],
                ["Bill Presentation & Defence ★", 15, true],
              ].map(([k, m, star]) => (
                <tr key={k as string}>
                  <td className={tdCls}>
                    {k}{" "}
                    {star ? (
                      <span className="text-[#138808]">(holds committee mark)</span>
                    ) : null}
                  </td>
                  <td className={tdCls}>{m}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={tdCls}>Sum of the six</td>
                <td className={tdCls}>90</td>
              </tr>
              <tr className="font-semibold">
                <td className={tdCls}>+ Leadership bonus (0 for an ordinary MP)</td>
                <td className={tdCls}>up to 10</td>
              </tr>
              <tr className="font-bold">
                <td className={`${tdCls} text-[#1a1a3e]`}>GRAND TOTAL</td>
                <td className={`${tdCls} text-[#FF9933]`}>100</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm font-semibold text-[#1a1a3e]">
          Example — G.S.Aswatha (MP, Ministry of Education):
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Component</th>
                <th className={thCls}>Her mark</th>
                <th className={thCls}>Made of</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Urgent Public Importance /15", "10", "her own"],
                ["Committee Discussions /15", "11.75", "8 her own + 3.75 shared committee"],
                ["Question Hour /20", "13", "her own"],
                ["Zero Hour /15", "10", "her own"],
                ["Debate /10", "7", "her own"],
                ["Bill Presentation /15", "12.25", "8 her own + 4.25 shared committee"],
              ].map(([k, v, m]) => (
                <tr key={k as string}>
                  <td className={tdCls}>{k}</td>
                  <td className={tdCls}>{v}</td>
                  <td className={tdCls}>{m}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className={tdCls}>GRAND TOTAL</td>
                <td className={`${tdCls} text-[#FF9933]`}>64 / 100</td>
                <td className={tdCls}>MP → no leadership bonus</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-700">
          A teammate, <strong>Harshana J</strong> (same committee), gets the{" "}
          <strong>same 3.75 + 4.25 committee portion</strong>, but stronger
          speaking marks lift her to <strong>73 / 100</strong>. Same team mark —
          different individual marks decide who ranks higher.
        </p>
      </Section>

      {/* 3. Leadership */}
      <Section n={3} icon={<Crown className="size-5" />} title="Leadership roles (the bonus on top)">
        <p className="text-sm text-gray-700">
          A student elected to a role gets a flat <strong>leadership bonus</strong>{" "}
          added on top (capped at 10): Prime Minister / Speaker{" "}
          <strong>+5</strong>, Coalition Leader / Leader of Opposition / Deputy
          Speaker <strong>+4</strong>, Cabinet Minister / Party Leader{" "}
          <strong>+3</strong>, Committee Chair / Shadow Minister{" "}
          <strong>+2</strong>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Same person, same marks</th>
                <th className={thCls}>Base /90</th>
                <th className={thCls}>Leadership bonus</th>
                <th className={thCls}>Total /100</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdCls}>K.R.Ajay Adhithya — as a plain MP</td>
                <td className={tdCls}>77</td>
                <td className={tdCls}>+0</td>
                <td className={tdCls}>77</td>
              </tr>
              <tr className="font-semibold">
                <td className={tdCls}>K.R.Ajay Adhithya — if elected Prime Minister</td>
                <td className={tdCls}>77</td>
                <td className={tdCls}>+5</td>
                <td className={`${tdCls} text-[#FF9933]`}>82</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Note for Erode:</strong> no leaders are assigned yet — roles
          like PM and Speaker are <strong>elected during the event</strong>. Two
          big leadership-only sessions (Cabinet Intros, Speaker Speeches, each
          /100) exist in the master setup but are <strong>switched off</strong>{" "}
          for Erode right now; if turned on, leaders would be scored there too.
        </div>
      </Section>

      {/* 4. Awards */}
      <Section n={4} icon={<Trophy className="size-5" />} title="How the 15 awards are decided">
        <p className="text-sm text-gray-700">
          For each award the system takes everyone <strong>eligible</strong>,
          ranks them by <strong>that award&apos;s own formula</strong>, and the{" "}
          <strong>top scorer wins</strong> (one winner by default; admins can
          change the count per event). If a category was never scored, the award
          is skipped — it never invents a winner.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Award</th>
                <th className={thCls}>Who wins it</th>
                <th className={thCls}>Open to</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Best Parliamentarian", "Highest overall total /100", "everyone"],
                ["Best Debater", "Debate + Question Hour, added", "everyone"],
                ["Best Research & Presentation", "Research-related criteria across sessions", "everyone"],
                ["Most Valuable Participant (MVP)", "Most consistent — their weakest session is still high (must have played at least half the sessions)", "everyone"],
                ["Best Constituency Representative", "Urgent Importance + Question Hour + Zero Hour", "everyone"],
                ["Exemplary Parliamentary Decorum", "Best conduct marks AND no disciplinary flag", "clean record"],
                ["Team Spirit", "The whole TOP committee co-wins", "team"],
                ["Innovative Ideas", "Zero Hour creativity + problem-solving + policy", "everyone"],
                ["Community Impact", "Policy orientation + bill feasibility + constituency research", "everyone"],
                ["Best Speaker", "Highest total among the elected Speaker(s)", "Speaker"],
                ["Leadership Excellence", "Half role points + half participation", "leadership roles"],
                ["Best Member — Ruling Bench", "Debate + Question Hour + Bill", "ruling side"],
                ["Best Member — Opposition Bench", "Question Hour + Zero Hour + Debate", "opposition side"],
                ["Most Persuasive Policy Advocate", "Debate + Bill Presentation", "everyone"],
                ["Independent Voice of the House", "Debate + Zero Hour + Question Hour", "independent MPs"],
              ].map(([a, w, o], i) => (
                <tr key={a as string}>
                  <td className={`${tdCls} font-semibold text-[#1a1a3e]`}>
                    {i + 1}. {a}
                  </td>
                  <td className={tdCls}>{w}</td>
                  <td className={tdCls}>{o}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-sm font-semibold text-[#1a1a3e]">
          Worked example — four Ministry of Education students:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Student</th>
                <th className={thCls}>Total</th>
                <th className={thCls}>Debate+QH</th>
                <th className={thCls}>Consistency</th>
                <th className={thCls}>Conduct</th>
                <th className={thCls}>Flag</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["K.R.Ajay Adhithya", "74", "22", "0.70", "4.0", "—"],
                ["Harshana J", "73", "29", "0.60", "3.0", "⚠ walkout"],
                ["Harshita V", "73", "23", "0.75", "3.5", "—"],
                ["G.S.Aswatha", "64", "20", "0.65", "4.5", "—"],
              ].map(([n2, t, d, c, cd, f]) => (
                <tr key={n2 as string}>
                  <td className={tdCls}>{n2}</td>
                  <td className={tdCls}>{t}</td>
                  <td className={tdCls}>{d}</td>
                  <td className={tdCls}>{c}</td>
                  <td className={tdCls}>{cd}</td>
                  <td className={tdCls}>{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-1.5 text-sm text-gray-700">
          <li className="flex gap-2">
            <Trophy className="mt-0.5 size-4 shrink-0 text-[#FF9933]" />
            <span>
              <strong>Best Parliamentarian → K.R.Ajay Adhithya</strong> (highest
              total, 74)
            </span>
          </li>
          <li className="flex gap-2">
            <Trophy className="mt-0.5 size-4 shrink-0 text-[#FF9933]" />
            <span>
              <strong>Best Debater → Harshana J</strong> (Debate+QH = 29, even
              though she is only 2nd on total)
            </span>
          </li>
          <li className="flex gap-2">
            <Trophy className="mt-0.5 size-4 shrink-0 text-[#FF9933]" />
            <span>
              <strong>MVP → Harshita V</strong> (most even — her weakest session
              is still 75% of its max)
            </span>
          </li>
          <li className="flex gap-2">
            <Trophy className="mt-0.5 size-4 shrink-0 text-[#FF9933]" />
            <span>
              <strong>Exemplary Decorum → G.S.Aswatha</strong> (best conduct{" "}
              <em>and</em> clean — Harshana&apos;s higher activity is
              disqualified by her walkout flag)
            </span>
          </li>
          <li className="flex gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-[#138808]" />
            <span>
              <strong>Team Spirit → every Ministry of Education member</strong>{" "}
              (top committee, shared 8.00)
            </span>
          </li>
        </ul>
        <p className="text-sm text-gray-700">
          Notice four <em>different</em> students win — the system spreads
          recognition. Each award rewards a different strength, not just
          &quot;highest total wins everything&quot;.
        </p>
      </Section>

      {/* 5. Principles */}
      <Section n={5} icon={<Scale className="size-5" />} title="Key principles (and what is fair)">
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            "Several judges per committee are averaged — the standard, defensible way a panel scores. It matches how individual students are averaged too.",
            "The committee mark is a team component shared equally by its members; everything else is earned individually.",
            "What you see while scoring is exactly what counts — the same calculation runs on the scoring screen and in the final results, so they can never drift apart.",
            "Awards #10–13 and #15 (Best Speaker, Leadership Excellence, Ruling/Opposition Bench, Independent Voice) need roles and party sides assigned — they stay dormant until the elections happen at the event.",
            "A chair can manually override any award winner at the end if there is a tie or a special reason.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#138808]" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="pb-4 text-center text-xs text-gray-400">
        Yi Parliament · Scoring &amp; Awards methodology · Yi 2026 Evaluation
        Workbook. Example marks are illustrative.
      </p>
    </div>
  );
}
