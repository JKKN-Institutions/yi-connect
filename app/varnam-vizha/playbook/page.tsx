import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { getAllEditions } from "@/lib/varnam/data/editions";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { ClipboardList, Phone, Lightbulb, BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Playbook" };

const NAV = [
  {
    href: "/varnam-vizha/playbook/templates",
    icon: ClipboardList,
    title: "Event Templates",
    desc: "Blueprints and run-checklists for every signature event.",
  },
  {
    href: "/varnam-vizha/playbook/contacts",
    icon: Phone,
    title: "Key Contacts",
    desc: "Government, sponsor targets, official channels and partner forums.",
  },
  {
    href: "/varnam-vizha/playbook/lessons",
    icon: Lightbulb,
    title: "Lessons Learnt",
    desc: "What worked and what to improve, edition over edition.",
  },
];

function statusChip(status: string): string {
  switch (status) {
    case "live":
      return "bg-[#D6336C]/10 text-[#b02a59]";
    case "completed":
      return "bg-[#0CA4A5]/10 text-[#0a8485]";
    case "planning":
      return "bg-[#F4A300]/15 text-[#a06a00]";
    default:
      return "bg-[#3B0A45]/10 text-[#3B0A45]";
  }
}

export default async function VarnamPlaybookHome() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const editions = await getAllEditions();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-[#D6336C]">
          <BookOpen className="size-5" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em]">
            Committee Playbook
          </p>
        </div>
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45] sm:text-4xl">
          How to run Varnam Vizha
        </h1>
        <p className="mt-3 max-w-2xl text-[#2B0A33]/70">
          The institutional memory of Yi Erode&apos;s flagship festival —
          curated from every edition so each new committee can run it without
          starting from scratch. Use the event templates to plan, the contacts
          to open doors, and the lessons to avoid past mistakes.
        </p>
      </header>

      {/* Nav cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {NAV.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm transition hover:border-[#D6336C]/40 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#F4A300] to-[#D6336C] text-white">
              <Icon className="size-5" />
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45] group-hover:text-[#D6336C]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[#2B0A33]/65">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Year-by-year history */}
      <section className="mt-12">
        <h2 className="mb-5 font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
          Through the years
        </h2>
        {editions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#3B0A45]/20 bg-white p-8 text-center text-[#2B0A33]/60">
            No editions recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-[#3B0A45]/10 pl-6">
            {editions.map((ed) => (
              <li key={ed.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#F4A300] to-[#D6336C] ring-4 ring-[#FFF9F0]" />
                <article className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#D6336C]">
                      {ed.year}
                    </span>
                    <h3 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
                      {ed.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusChip(
                        ed.status
                      )}`}
                    >
                      {ed.status}
                    </span>
                  </div>
                  {ed.theme && (
                    <p className="mt-1 text-sm italic text-[#2B0A33]/60">
                      {ed.theme}
                    </p>
                  )}
                  {ed.summary && (
                    <p className="mt-2 text-sm text-[#2B0A33]/70">
                      {ed.summary}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="mt-10">
        <Link
          href="/varnam-vizha/dashboard"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← Committee
        </Link>
      </p>
    </div>
  );
}
