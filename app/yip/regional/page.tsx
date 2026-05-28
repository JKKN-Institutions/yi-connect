import Link from "next/link";
import { listZoneSummaries } from "@/app/yip/actions/regional";

export const dynamic = "force-dynamic";

export default async function RegionalIndexPage() {
  const zones = await listZoneSummaries();

  return (
    <div className="flex min-h-screen flex-col bg-[#FEFCF6]">
      {/* Tricolor */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Nav */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/yip" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF9933] shadow-md shadow-[#FF9933]/20">
            <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">
              Y
            </span>
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide text-[#1a1a3e]">
              Young Indians
            </span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[#FF9933]">
              Parliament
            </span>
          </div>
        </Link>
      </nav>

      {/* Header */}
      <header className="mx-auto w-full max-w-6xl px-6 pb-6 pt-4">
        <div className="border-b border-[#1a1a3e]/5 pb-6">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9933]">
            Regional Standings
          </span>
          <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[#1a1a3e] sm:text-4xl">
            Six Regions, One Parliament
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#1a1a3e]/50">
            Cross-chapter career stats for every Yi region. Pick a region to
            see top young parliamentarians across all chapter rounds.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => {
            const hasData = z.eventsCount > 0;
            return (
              <Link
                key={z.code}
                href={`/yip/regional/${z.code.toLowerCase()}/leaderboard`}
                className={`group relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-lg ${
                  hasData
                    ? "border-[#FF9933]/20 hover:border-[#FF9933]/40 hover:shadow-[#FF9933]/10"
                    : "border-[#1a1a3e]/5 hover:border-[#1a1a3e]/10"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FF9933]">
                      {z.code}
                    </div>
                    <h2 className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[#1a1a3e]">
                      {z.label}
                    </h2>
                  </div>
                  <svg
                    className="size-5 text-[#1a1a3e]/30 transition-all group-hover:translate-x-0.5 group-hover:text-[#FF9933]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#1a1a3e]/5 pt-4">
                  <div>
                    <div className="font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-[#1a1a3e]">
                      {z.eventsCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#1a1a3e]/40">
                      Chapter Rounds
                    </div>
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-[#1a1a3e]">
                      {z.participantsCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#1a1a3e]/40">
                      Participants
                    </div>
                  </div>
                </div>

                {!hasData && (
                  <div className="mt-3 text-[11px] italic text-[#1a1a3e]/40">
                    No completed rounds yet.
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a3e]/5 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="mx-auto flex w-20 overflow-hidden rounded-full">
            <div className="h-1 flex-1 bg-[#FF9933]" />
            <div className="h-1 flex-1 bg-white border-y border-[#1a1a3e]/5" />
            <div className="h-1 flex-1 bg-[#138808]" />
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.15em] text-[#1a1a3e]/30">
            Young Indians Parliament &middot; Regional Standings
          </p>
        </div>
      </footer>
    </div>
  );
}
