import type { Metadata } from "next";
import Link from "next/link";
import { getAllEditions } from "@/lib/varnam/data/editions";

export const metadata: Metadata = { title: "Past years" };

// Public history page — shows completed past editions (the current 'live'
// edition lives on the main pages). Good for showing the track record to
// visitors and sponsors.
export default async function VarnamPastPage() {
  const editions = (await getAllEditions()).filter((e) => e.status !== "live");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D6336C]">
          Erode Varnam Vizha
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-4xl font-extrabold text-[#3B0A45] sm:text-5xl">
          Through the years
        </h1>
        <p className="mt-2 text-[#2B0A33]/70">
          A decade of colour — every edition of Erode&apos;s flagship festival.
        </p>
      </header>

      {editions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#3B0A45]/20 bg-white p-10 text-center text-[#2B0A33]/60">
          Past editions will appear here soon.
        </p>
      ) : (
        <ol className="relative space-y-5 border-l-2 border-[#D6336C]/20 pl-6">
          {editions.map((e) => (
            <li key={e.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full bg-gradient-to-br from-[#F4A300] to-[#D6336C] ring-4 ring-[#FFF9F0]"
              />
              <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#D6336C]">
                    {e.year}
                  </span>
                  <span className="font-[family-name:var(--font-vv-display)] text-lg font-semibold text-[#3B0A45]">
                    {e.name}
                  </span>
                </div>
                {e.theme && (
                  <p className="mt-0.5 text-sm italic text-[#2B0A33]/60">
                    {e.theme}
                  </p>
                )}
                {e.summary && (
                  <p className="mt-1.5 text-sm text-[#2B0A33]/75">{e.summary}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-10 text-center">
        <Link
          href="/varnam-vizha"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← Back to this year&apos;s festival
        </Link>
      </p>
    </div>
  );
}
