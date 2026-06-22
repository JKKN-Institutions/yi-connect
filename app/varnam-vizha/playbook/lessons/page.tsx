import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { LESSONS } from "@/lib/varnam/data/playbook";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { ThumbsUp, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Lessons Learnt" };

export default async function VarnamPlaybookLessons() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const { worked, improve } = LESSONS;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D6336C]">
          Playbook
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45] sm:text-4xl">
          Lessons Learnt
        </h1>
        <p className="mt-3 max-w-2xl text-[#2B0A33]/70">
          The honest retrospective — what to keep doing, and what the next
          committee should fix. Drawn from the EC-meeting review after the last
          edition.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* What worked */}
        <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0CA4A5]/10 text-[#0a8485]">
              <ThumbsUp className="size-5" />
            </span>
            <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
              What worked
            </h2>
          </div>
          <ul className="space-y-3">
            {worked.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-[#2B0A33]/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0CA4A5]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What to improve */}
        <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D6336C]/10 text-[#b02a59]">
              <TrendingUp className="size-5" />
            </span>
            <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
              What to improve
            </h2>
          </div>
          <ul className="space-y-3">
            {improve.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-[#2B0A33]/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6336C]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-10">
        <Link
          href="/varnam-vizha/playbook"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← Back to Playbook
        </Link>
      </p>
    </div>
  );
}
