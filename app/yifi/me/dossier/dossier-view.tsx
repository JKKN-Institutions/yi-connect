"use client";

import Link from "next/link";
import type {
  DossierRow,
  DossierQuote,
  DossierTakeaway,
  DossierSpeakerRank,
  DossierActionItem,
  DossierTourCard,
} from "./types";

interface DossierViewProps {
  dossier: DossierRow;
  memberName: string;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function DossierView({ dossier, memberName }: DossierViewProps) {
  const quotes = asArray<DossierQuote>(dossier.top_quotes);
  const takeaways = asArray<DossierTakeaway>(dossier.takeaways);
  const speakers = asArray<DossierSpeakerRank>(dossier.speaker_ranking);
  const actionPlan = asArray<DossierActionItem>(dossier.action_plan);
  const tourCards = asArray<DossierTourCard>(dossier.tour_cards);

  // Group takeaways by session title for a cleaner read.
  const takeawayGroups = new Map<string, string[]>();
  for (const t of takeaways) {
    const tk = nonEmpty(t.takeaway);
    if (!tk) continue;
    const session = nonEmpty(t.session_title) ?? "General";
    const list = takeawayGroups.get(session) ?? [];
    list.push(tk);
    takeawayGroups.set(session, list);
  }

  const hasAnyContent =
    quotes.length > 0 ||
    takeawayGroups.size > 0 ||
    speakers.length > 0 ||
    actionPlan.length > 0 ||
    tourCards.length > 0;

  return (
    <main className="min-h-screen bg-[#000066]">
      {/* Sticky header — matches me/page header */}
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/yifi" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
          <Link
            href="/yifi/me"
            className="text-xs text-white/70 border border-white/20 hover:border-white/40 px-2.5 py-1 rounded-md transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Title block */}
        <section>
          <div className="bg-gradient-to-r from-[#FD7215]/20 to-[#229434]/20 border border-[#FD7215]/30 rounded-xl p-6">
            <p className="text-[#FD7215] text-xs uppercase tracking-wide font-medium mb-1">
              Personalised Deliverable
            </p>
            <h1 className="text-2xl font-bold text-white">Your YiFi Dossier</h1>
            {nonEmpty(memberName) && (
              <p className="text-white/80 text-sm mt-1">{memberName}</p>
            )}
            <p className="text-white/50 text-sm mt-3">
              Filtered to your sector and your challenges.
            </p>
          </div>
        </section>

        {!hasAnyContent && (
          <section>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-white/50 text-sm">
                Your dossier is ready, but its content is still being assembled.
                Check back shortly.
              </p>
            </div>
          </section>
        )}

        {/* Top Quotes */}
        {quotes.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-[#FD7215]">❝</span> Top Quotes
            </h2>
            <div className="space-y-3">
              {quotes.map((q, i) => {
                const quote = nonEmpty(q.quote);
                if (!quote) return null;
                const speaker = nonEmpty(q.speaker);
                const session = nonEmpty(q.session_title);
                const why = nonEmpty(q.why_relevant);
                return (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-xl p-4"
                  >
                    <p className="text-white text-sm italic">
                      &ldquo;{quote}&rdquo;
                    </p>
                    {(speaker || session) && (
                      <p className="text-white/50 text-xs mt-2">
                        {speaker && <span>— {speaker}</span>}
                        {speaker && session && <span> · </span>}
                        {session && <span>{session}</span>}
                      </p>
                    )}
                    {why && (
                      <div className="mt-3 border-l-2 border-[#FD7215]/50 pl-3">
                        <p className="text-[#FD7215] text-[11px] uppercase tracking-wide font-medium">
                          Why this matters to you
                        </p>
                        <p className="text-white/60 text-xs mt-0.5">{why}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Key Takeaways (grouped by session) */}
        {takeawayGroups.size > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-[#FD7215]">💡</span> Key Takeaways
            </h2>
            <div className="space-y-3">
              {Array.from(takeawayGroups.entries()).map(([session, items], i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <h3 className="text-[#229434] font-medium text-sm mb-2">
                    {session}
                  </h3>
                  <ul className="space-y-1.5">
                    {items.map((item, j) => (
                      <li
                        key={j}
                        className="text-white/70 text-sm flex gap-2"
                      >
                        <span className="text-[#FD7215] flex-shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Speakers to Follow */}
        {speakers.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-[#FD7215]">🎤</span> Speakers to Follow
            </h2>
            <div className="space-y-3">
              {speakers.map((s, i) => {
                const speaker = nonEmpty(s.speaker);
                if (!speaker) return null;
                const reason = nonEmpty(s.reason);
                return (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#FD7215]/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {speaker.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{speaker}</p>
                      {reason && (
                        <p className="text-white/50 text-xs mt-0.5">{reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 8-Step Action Plan */}
        {actionPlan.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-[#FD7215]">📋</span> Your Action Plan
            </h2>
            <div className="space-y-2">
              {actionPlan.map((a, i) => {
                const action = nonEmpty(a.action);
                if (!action) return null;
                const day =
                  typeof a.day_offset === "number" ? a.day_offset : null;
                return (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-3"
                  >
                    <span className="text-[#229434] text-xs font-semibold uppercase tracking-wide bg-[#229434]/10 rounded-md px-2 py-1 flex-shrink-0">
                      {day !== null ? `Day ${day}` : `Step ${i + 1}`}
                    </span>
                    <p className="text-white/80 text-sm">{action}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Experience Cards — only when present */}
        {tourCards.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-[#FD7215]">🗺️</span> Experience Cards
            </h2>
            <div className="space-y-3">
              {tourCards.map((c, i) => {
                const title = nonEmpty(c.title as string | null | undefined);
                const description = nonEmpty(
                  c.description as string | null | undefined
                );
                if (!title && !description) return null;
                return (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-xl p-4"
                  >
                    {title && (
                      <p className="text-white font-medium text-sm">{title}</p>
                    )}
                    {description && (
                      <p className="text-white/60 text-xs mt-1">{description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <section className="border-t border-white/10 pt-8">
          <div className="bg-gradient-to-r from-[#000066] to-[#000044] border border-white/10 rounded-xl p-6 text-center space-y-3">
            <Link
              href="/yifi/me"
              className="block text-[#FD7215] text-sm font-medium hover:underline"
            >
              ← Back to My YiFi
            </Link>
            <p className="text-white/40 text-xs">
              YiFi is part of Yi Connect.
            </p>
            <Link
              href="/"
              className="text-white/60 text-sm hover:underline"
            >
              Explore Yi Connect →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
