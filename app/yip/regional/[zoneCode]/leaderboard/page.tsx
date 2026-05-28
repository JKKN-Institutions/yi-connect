import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegionalLeaderboard } from "@/app/yip/actions/regional";
import { LeaderboardClient } from "./leaderboard-client";

// Public route — no auth required.
export const dynamic = "force-dynamic";

export default async function RegionalLeaderboardPage({
  params,
}: {
  params: Promise<{ zoneCode: string }>;
}) {
  const { zoneCode } = await params;
  const data = await getRegionalLeaderboard(zoneCode);
  if (!data) notFound();

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
        <Link
          href="/yip/regional"
          className="rounded-lg px-4 py-2 text-sm font-medium text-[#1a1a3e]/70 transition-colors hover:text-[#1a1a3e]"
        >
          All Regions
        </Link>
      </nav>

      {/* Header */}
      <header className="mx-auto w-full max-w-6xl px-6 pb-6 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1a1a3e]/5 pb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9933]">
              Regional Leaderboard
            </span>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[#1a1a3e] sm:text-4xl">
              {data.zone.label}{" "}
              <span className="text-[#1a1a3e]/40">&middot;</span>{" "}
              <span className="text-[#1a1a3e]/60">{data.zone.code}</span>
            </h1>
            <p className="mt-2 text-sm text-[#1a1a3e]/50">
              Career stats across every chapter round in this region
              {data.year ? ` — ${data.year.display_name}` : ""}.
            </p>
          </div>

          <div className="flex gap-3">
            <Stat label="Chapter Rounds" value={data.eventsCount} />
            <Stat label="Participants" value={data.rows.length} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        {data.eventsCount === 0 ? (
          <EmptyState />
        ) : (
          <LeaderboardClient rows={data.rows} zoneLabel={data.zone.label} />
        )}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#1a1a3e]/5 bg-white px-4 py-3 text-center shadow-sm">
      <div className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#1a1a3e]/40">
        {label}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-2xl border border-dashed border-[#1a1a3e]/15 bg-white/50 px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FF9933]/10">
        <svg
          className="h-8 w-8 text-[#FF9933]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <h2 className="mt-6 font-[family-name:var(--font-heading)] text-xl font-bold text-[#1a1a3e]">
        No completed chapter rounds in this region yet.
      </h2>
      <p className="mt-2 text-sm text-[#1a1a3e]/50">
        Once chapter events finish and publish results, standings will appear
        here.
      </p>
      <Link
        href="/yip/regional"
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#1a1a3e]/10 bg-white px-4 py-2 text-sm font-medium text-[#1a1a3e] transition-colors hover:border-[#1a1a3e]/20"
      >
        Browse other regions
      </Link>
    </div>
  );
}
