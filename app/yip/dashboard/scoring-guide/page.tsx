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
  MapPin,
  Gavel,
  ScrollText,
  ListChecks,
  Sparkles,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Scoring & Awards Guide — YIP",
};

// ── presentational helpers (server component, no client JS) ────────────────
function Section({
  n,
  icon,
  title,
  subtitle,
  children,
}: {
  n: number | string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3 border-b border-[#1a1a3e]/10 pb-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FF9933]/12 text-[#FF9933]">
            {icon}
          </span>
          <div>
            <h2 className="text-base font-bold text-[#1a1a3e]">
              <span className="text-[#FF9933]">{n}.</span> {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Bar({ v, max }: { v: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((v / max) * 100)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a1a3e]/[0.07]">
      <div
        className="h-2 rounded-full bg-[#FF9933]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Analogy({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-[#138808]/25 bg-[#138808]/[0.05] px-4 py-3 text-sm text-[#14532d]">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-[#138808]" />
      <p>
        <strong>In plain terms:</strong> {children}
      </p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-[#1a1a3e]/10 bg-white px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-[#1a1a3e]">
        {q}
        <span className="text-[#FF9933] transition-transform group-open:rotate-90">
          <ArrowRight className="size-4" />
        </span>
      </summary>
      <div className="mt-2 text-sm text-gray-600">{children}</div>
    </details>
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
  const tdCls = "border border-[#1a1a3e]/10 px-3 py-2 text-gray-700 align-top";

  const journey = [
    { icon: <MapPin className="size-5" />, t: "Gets a place", d: "A party, a constituency and a committee" },
    { icon: <ScrollText className="size-5" />, t: "Plays 6 sessions", d: "Speaks & debates on the floor" },
    { icon: <Gavel className="size-5" />, t: "Judges score", d: "Each session marked by judges" },
    { icon: <Users className="size-5" />, t: "Committee mark shared", d: "One team mark for the whole committee" },
    { icon: <Calculator className="size-5" />, t: "Total /100", d: "Sessions + leadership bonus" },
    { icon: <Trophy className="size-5" />, t: "Awards", d: "Top of each category wins" },
  ];

  const glossary = [
    ["Party", "The group (A–G) a student is placed in — their team in the house."],
    ["Constituency", "The region a student represents in the house."],
    ["Committee", "A Ministry team that drafts a bill together and is scored as a team."],
    ["Bench (optional)", "Some events split the house into a Ruling bench (in power) and an Opposition bench. Many chapters — and the default benchless setup — skip this: students simply belong to a Party (A–G) and a committee."],
    ["Judge / Jury", "An adult evaluator who scores students on each session."],
    ["Session", "One activity on the agenda (e.g. Question Hour) that students are scored on."],
    ["Leadership role", "An elected post — Prime Minister, Speaker, Minister — that earns a small bonus."],
    ["Bill", "The proposed law a committee writes, then presents and defends."],
  ];

  // PM hero scorecard (real seeded numbers — engine output)
  const pmCard: [string, number, number, string][] = [
    ["Urgent Public Importance", 12.0, 15, "his own"],
    ["Committee Discussions & Bill Drafting", 14.05, 15, "10 his own + 4.05 committee"],
    ["Question Hour", 17.0, 20, "his own"],
    ["Zero Hour", 12.0, 15, "his own"],
    ["Debate (Political Acumen)", 8.0, 10, "his own"],
    ["Bill Presentation & Defence", 14.0, 15, "10 his own + 4.00 committee"],
  ];

  // real demo leaderboard (engine output)
  const board: [number, string, string, string, number][] = [
    [1, "Aarav Sharma", "Prime Minister", "77.05 + 5", 82.05],
    [2, "Ishaan Kapoor", "Speaker", "74.6 + 5", 79.6],
    [3, "Saanvi Rao", "Deputy Prime Minister", "74.6 + 4", 78.6],
    [4, "Reyansh Gupta", "Leader of Opposition", "74.6 + 4", 78.6],
    [5, "Kabir Anand", "Shadow Minister", "76.05 + 2", 78.05],
    [6, "Ananya Iyer", "MP", "75.05 + 0", 75.05],
    [7, "Myra Joshi", "Deputy Speaker", "69.6 + 4", 73.6],
    [8, "Diya Nair", "MP", "72.05 + 0", 72.05],
    [9, "Vihaan Reddy", "Cabinet Minister", "68.05 + 3", 71.05],
    [10, "Arjun Mehta", "MP", "70.6 + 0", 70.6],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a3e]">
            How YIP Scoring &amp; Awards Work
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            A step-by-step walkthrough for chapter chairs, organisers and admins —
            written so anyone can follow it, no scoring background needed.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* This is a REAL demo */}
      <Card className="border-[#FF9933]/30 bg-[#FF9933]/[0.05]">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-[#FF9933]" />
            <h2 className="text-base font-bold text-[#1a1a3e]">
              This isn&apos;t made up — it&apos;s a real demo event in your system
            </h2>
          </div>
          <p className="text-sm text-gray-700">
            Every name and number below comes from a genuine demo event —{" "}
            <strong>&quot;DEMO — Election Rehearsal&quot;</strong> — with{" "}
            <strong>10 students</strong>, an elected{" "}
            <strong>Prime Minister</strong>, two committees and two judges, all
            fully scored. The totals are exactly what the live scoring engine
            computes. A super-admin can open it any time under{" "}
            <strong>Admin → Mock Data</strong> to see the same figures. So this is
            a real simulation, not a hypothetical.
          </p>
        </CardContent>
      </Card>

      {/* The journey */}
      <Section
        n={1}
        icon={<ListChecks className="size-5" />}
        title="The journey of one score"
        subtitle="From the moment a student arrives to the awards ceremony"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {journey.map((s, i) => (
            <div
              key={s.t}
              className="relative rounded-xl border border-[#1a1a3e]/10 bg-white p-3 text-center"
            >
              <span className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-[#1a1a3e]/[0.04] text-[#FF9933]">
                {s.icon}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#1a1a3e]">
                {i + 1}. {s.t}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-700">
          A student&apos;s final mark is <strong>out of 100</strong>: six things
          they do on the floor (worth 90) plus a small leadership bonus (up to 10)
          if they hold an elected post. We&apos;ll walk through each step with a
          real committee and a real Prime Minister.
        </p>
      </Section>

      {/* Glossary */}
      <Section
        n={2}
        icon={<HelpCircle className="size-5" />}
        title="The words, in plain English"
        subtitle="Quick reference if any term is new"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {glossary.map(([term, def]) => (
            <div
              key={term}
              className="rounded-lg border border-[#1a1a3e]/10 bg-white px-3 py-2"
            >
              <p className="text-sm font-semibold text-[#1a1a3e]">{term}</p>
              <p className="text-xs text-gray-600">{def}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Act 1 — committee */}
      <Section
        n={3}
        icon={<Users className="size-5" />}
        title="The committee's shared team mark"
        subtitle="Demo committee: Ministry of Education (5 students)"
      >
        <p className="text-sm text-gray-700">
          Five students form the <strong>Ministry of Education</strong> committee
          and write a bill together. Two judges score the{" "}
          <strong>whole committee</strong> on 6 things, each out of 10 — so 60
          total. Several judges? Their marks are <strong>averaged</strong>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>What judges rate</th>
                <th className={thCls}>Mr. Rajesh Kumar</th>
                <th className={thCls}>Ms. Priya Menon</th>
                <th className={thCls}>Average</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Bill Draft Quality", 8, 9, 8.5],
                ["Policy Relevance", 7, 8, 7.5],
                ["Innovation", 8, 7, 7.5],
                ["Feasibility", 9, 8, 8.5],
                ["Team Collaboration", 8, 9, 8.5],
                ["Presentation & Defence", 8, 8, 8.0],
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
                <td className={tdCls}>48</td>
                <td className={tdCls}>49</td>
                <td className={`${tdCls} text-[#FF9933]`}>48.5</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-700">
          That averaged <strong>48.5/60</strong> splits into two final marks:{" "}
          <strong>Committee Discussions 4.05 / 5</strong> (from the five teamwork
          items) and <strong>Bill Presentation 4.00 / 5</strong> (from the
          presentation item) — together{" "}
          <strong className="text-[#FF9933]">8.05 points</strong>, handed{" "}
          <strong>identically to all 5 members</strong>.
        </p>
        <Analogy>
          the committee mark is like a <strong>group-project grade</strong> —
          everyone in the group gets the same marks for the shared work. What sets
          them apart is their <em>own</em> performance in the other sessions.
        </Analogy>
      </Section>

      {/* Act 2 — individual scorecard */}
      <Section
        n={4}
        icon={<Calculator className="size-5" />}
        title="One student's full scorecard"
        subtitle="Following Aarav Sharma — a member of that committee"
      >
        <p className="text-sm text-gray-700">
          Aarav is scored on <strong>six components</strong>. Two of them (marked
          <span className="text-[#138808] font-semibold"> ★</span>) carry the
          shared committee mark from Step 3; the rest he earns himself.
        </p>
        <div className="space-y-2">
          {pmCard.map(([label, v, max, made]) => (
            <div key={label} className="rounded-lg border border-[#1a1a3e]/10 p-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-[#1a1a3e]">
                  {label}
                  {made.includes("committee") ? (
                    <span className="text-[#138808]"> ★</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-semibold text-[#1a1a3e]">
                  {v}
                  <span className="text-gray-400">/{max}</span>
                </span>
              </div>
              <Bar v={v} max={max} />
              <p className="mt-1 text-[11px] text-gray-500">{made}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#1a1a3e]/[0.04] px-4 py-3 text-sm">
          <span className="text-gray-600">
            Six components added up = <strong>77.05 / 90</strong>
          </span>
          <span className="font-bold text-[#1a1a3e]">
            (his leadership bonus comes next →)
          </span>
        </div>
        <p className="text-sm text-gray-700">
          His committee teammate <strong>Diya Nair</strong> carries the{" "}
          <strong>same 8.05 committee portion</strong>, but her own speaking marks
          land her at <strong>72.05 / 90</strong>. Same team mark — individual
          performance decides who ranks higher.
        </p>
      </Section>

      {/* Act 3 — leadership */}
      <Section
        n={5}
        icon={<Crown className="size-5" />}
        title="Leadership — the bonus on top"
        subtitle="Aarav was elected Prime Minister"
      >
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FF9933]/30 bg-[#FF9933]/[0.05] p-4">
          <div className="text-sm">
            <div className="text-gray-600">Aarav&apos;s six components</div>
            <div className="text-xl font-bold text-[#1a1a3e]">77.05</div>
          </div>
          <span className="text-[#FF9933]">＋</span>
          <div className="text-sm">
            <div className="text-gray-600">Prime Minister bonus</div>
            <div className="text-xl font-bold text-[#1a1a3e]">5</div>
          </div>
          <span className="text-[#FF9933]">＝</span>
          <div className="text-sm">
            <div className="text-gray-600">Final total</div>
            <div className="text-xl font-bold text-[#FF9933]">82.05 / 100</div>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          As an ordinary MP he&apos;d have <strong>77.05</strong>; the{" "}
          <strong>+5</strong> is his leadership bonus. Every elected post earns
          one (newly completed in the backend so <em>every</em> role is defined):
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Leadership role</th>
                <th className={thCls}>Bonus</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Prime Minister · Speaker", "+5"],
                ["Deputy PM · Deputy Speaker · Leader of Opposition · Coalition Leader", "+4"],
                ["Cabinet Minister · Party Leader", "+3"],
                ["Shadow Minister · Committee Chairperson", "+2"],
                ["Nominated Speaker", "+1"],
                ["MP · Bill Committee · Independent MP", "+0"],
              ].map(([r, b]) => (
                <tr key={r as string}>
                  <td className={tdCls}>{r}</td>
                  <td className={`${tdCls} font-semibold`}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-sm font-semibold text-[#1a1a3e]">
          The real demo leaderboard (what the engine computed):
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>#</th>
                <th className={thCls}>Student</th>
                <th className={thCls}>Role</th>
                <th className={thCls}>Floor + bonus</th>
                <th className={thCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {board.map(([rank, name, role, calc, total]) => (
                <tr key={name as string} className={rank === 1 ? "bg-[#FF9933]/[0.06]" : ""}>
                  <td className={tdCls}>{rank}</td>
                  <td className={`${tdCls} font-medium text-[#1a1a3e]`}>{name}</td>
                  <td className={tdCls}>{role}</td>
                  <td className={tdCls}>{calc}</td>
                  <td className={`${tdCls} font-semibold text-[#FF9933]`}>{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          This demo happens to be a benched event, so a couple of rows are tagged
          Ruling / Opposition. On a benchless event (the default — students just
          have a Party A–G and a committee) the <strong>/100 math is identical</strong>;
          only the bench label is absent.
        </p>
        <Analogy>
          the bonus <em>helps</em> but doesn&apos;t decide everything. Notice Kabir
          (Shadow Minister) has one of the strongest floor performances, yet his
          smaller +2 bonus leaves him 5th — and a strong ordinary MP, Ananya, sits
          6th, ahead of several leaders. Performance is most of the score.
        </Analogy>
      </Section>

      {/* Act 4 — awards */}
      <Section
        n={6}
        icon={<Trophy className="size-5" />}
        title="The awards"
        subtitle="15 awards — each rewards a different strength"
      >
        <p className="text-sm text-gray-700">
          For each award the system takes everyone <strong>eligible</strong>,
          ranks them by <strong>that award&apos;s own formula</strong>, and the
          top scorer wins. If a category was never scored, that award is skipped —
          it never invents a winner.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={thCls}>Award</th>
                <th className={thCls}>Who wins it</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Best Parliamentarian", "Highest overall total"],
                ["Best Debater", "Debate + Question Hour"],
                ["Best Research & Presentation", "Research-heavy criteria across sessions"],
                ["MVP", "Most consistent (strongest weakest-session)"],
                ["Best Constituency Representative", "Urgent Importance + Question Hour + Zero Hour"],
                ["Exemplary Decorum", "Best conduct AND no disciplinary flag"],
                ["Team Spirit", "The whole top committee"],
                ["Innovative Ideas", "Zero Hour creativity + problem-solving"],
                ["Community Impact", "Policy + feasibility + constituency research"],
                ["Best Speaker", "Top among the elected Speaker(s)"],
                ["Leadership Excellence", "Half role points + half participation"],
                ["Best Member — Ruling Bench", "Debate + Question Hour + Bill (if the event uses benches)"],
                ["Best Member — Opposition Bench", "Question Hour + Zero Hour + Debate (if the event uses benches)"],
                ["Most Persuasive", "Debate + Bill Presentation"],
                ["Independent Voice", "Debate + Zero Hour + Question Hour"],
              ].map(([a, w], i) => (
                <tr key={a as string}>
                  <td className={`${tdCls} font-semibold text-[#1a1a3e]`}>
                    {i + 1}. {a}
                  </td>
                  <td className={tdCls}>{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#1a1a3e]">
          What the demo actually awarded:
        </p>
        <ul className="space-y-1.5 text-sm text-gray-700">
          {[
            ["Best Parliamentarian", "Aarav Sharma", "highest total, 82.05"],
            ["Best Speaker", "Ishaan Kapoor", "top among Speakers"],
            ["Leadership Excellence", "Aarav Sharma", "strong on both role + participation"],
            ["Best Member — Ruling Bench", "Diya Nair", "best ruling-side MP"],
            ["Best Member — Opposition Bench", "Ananya Iyer", "best opposition MP"],
          ].map(([award, who, why]) => (
            <li key={award} className="flex gap-2">
              <Trophy className="mt-0.5 size-4 shrink-0 text-[#FF9933]" />
              <span>
                <strong>
                  {award} → {who}
                </strong>{" "}
                <span className="text-gray-500">({why})</span>
              </span>
            </li>
          ))}
          <li className="flex gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-[#138808]" />
            <span>
              <strong>Team Spirit → the whole top committee</strong> (shared mark)
            </span>
          </li>
        </ul>
        <p className="text-sm text-gray-700">
          The recognition <strong>spreads</strong> — the overall winner is one
          student while a whole committee shares Team Spirit. (This demo is a
          benched event, so it also has best ruling and best opposition members;
          benchless events simply skip those two bench awards.)
        </p>
      </Section>

      {/* FAQ */}
      <Section
        n={7}
        icon={<HelpCircle className="size-5" />}
        title="Common questions"
        subtitle="What organisers usually ask"
      >
        <div className="space-y-2">
          <Faq q="What if two students tie?">
            They share the same rank. For a single-winner award the chair can step
            in and pick between them — there&apos;s a manual override on the
            results screen.
          </Faq>
          <Faq q="Can a score change after it's entered?">
            Yes — until the chair <strong>locks</strong> the event&apos;s scores.
            After locking, entry is read-only so results can&apos;t shift under
            people.
          </Faq>
          <Faq q="Who enters the committee score — the judge or the organiser?">
            Judges score from their own login. An organiser can also enter a
            judge&apos;s marks on their behalf (e.g. from a paper sheet). Either
            way the committee&apos;s several judges are averaged.
          </Faq>
          <Faq q="What if a judge doesn't turn up?">
            No problem — only the judges who actually scored are averaged. A
            committee can be scored by a single judge if needed.
          </Faq>
          <Faq q="Why didn't the highest-bonus leader automatically win?">
            Because the leadership bonus (max 10) is small next to the 90 points
            earned on the floor. A leader still has to perform; the bonus is a
            tie-breaker-sized nudge, not a free pass.
          </Faq>
          <Faq q="Are there special leadership-only sessions?">
            Yes — large &quot;Cabinet Introductions&quot; and &quot;Speaker
            Speeches&quot; sessions exist in the setup, but they&apos;re switched
            off by default and can be turned on per event.
          </Faq>
        </div>
      </Section>

      {/* Principles */}
      <Section
        n={8}
        icon={<Scale className="size-5" />}
        title="The principles behind it"
        subtitle="Why this is fair"
      >
        <ul className="space-y-2 text-sm text-gray-700">
          {[
            "Several judges per committee are averaged — the standard, defensible way a panel scores.",
            "The committee mark is a team component shared equally by its members; everything else is earned individually.",
            "What you see while scoring is exactly what counts — the same calculation runs on the scoring screen and in the final results.",
            "Every assignable role now has a defined leadership bonus, so no role is ever silently scored as zero by accident.",
            "Role-based awards (Best Speaker, etc.) only activate once roles are assigned; the Ruling/Opposition Bench awards apply only if the event uses benches (benchless events skip them).",
            "A chair can manually override any award winner if there's a tie or a special reason.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#138808]" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="pb-4 text-center text-xs text-gray-400">
        Yi Parliament · Scoring &amp; Awards walkthrough · based on the live demo
        event &quot;DEMO — Election Rehearsal&quot; and the Yi 2026 Evaluation
        Workbook.
      </p>
    </div>
  );
}
