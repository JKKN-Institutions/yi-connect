import Link from "next/link";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import {
  PHASES,
  PHASE_LABELS,
  PHASE_MONTHS,
  PHASE_EVENT_LABELS,
  PHASE_EVENT_TYPES_BY_PHASE,
} from "@/lib/yi-future/constants";

const PHASE_DELIVERABLES: Record<(typeof PHASES)[number], string> = {
  phase_a: "Problem Definition Note",
  phase_b: "Draft Framework",
  phase_c: "Final Policy Document + Pitch Deck",
};

const PHASE_COLORS: Record<(typeof PHASES)[number], string> = {
  phase_a: "#FF9933",
  phase_b: "#F5A623",
  phase_c: "#138808",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-ivory">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="py-4 px-4 border-b border-navy/10 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/join"
            className="text-sm font-semibold text-navy hover:text-yi-gold transition-colors"
          >
            Register →
          </Link>
        </div>
      </header>

      {/* ─── Intro ──────────────────────────────────────────────── */}
      <section className="px-4 pt-16 pb-10 max-w-4xl mx-auto text-center">
        <BrandStrip className="mb-8" />
        <h1 className="text-5xl font-bold text-navy tracking-tight">
          The 90-Day Journey
        </h1>
        <p className="mt-6 text-lg text-navy/70 max-w-2xl mx-auto leading-relaxed">
          Three phases. Nine structured events. Two flagship convenings.
          Delegates move from understanding a problem to presenting a
          policy-ready framework and solution.
        </p>
      </section>

      {/* ─── Three Phases Timeline ──────────────────────────────── */}
      <section className="px-4 pb-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PHASES.map((phase, idx) => {
            const events = PHASE_EVENT_TYPES_BY_PHASE[phase];
            const color = PHASE_COLORS[phase];
            return (
              <article
                key={phase}
                className="bg-white rounded-lg p-6 shadow-sm border border-navy/10 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: color }}
                />
                <div className="flex items-baseline gap-3 mb-4">
                  <span
                    className="text-3xl font-black"
                    style={{ color }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-navy/50">
                    {PHASE_MONTHS[phase]}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-navy mb-4">
                  {PHASE_LABELS[phase]}
                </h3>

                <div className="space-y-2 mb-5">
                  {events.map((ev, i) => (
                    <div
                      key={ev}
                      className="flex items-start gap-3 text-sm text-navy/80"
                    >
                      <span className="text-navy/30 font-mono text-xs mt-0.5">
                        {i + 1}.
                      </span>
                      <span>{PHASE_EVENT_LABELS[ev]}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-navy/10">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mb-1">
                    Deliverable
                  </div>
                  <div className="text-sm font-semibold text-navy">
                    {PHASE_DELIVERABLES[phase]}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── Finals ─────────────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-navy text-center mb-8">
          The Finals
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-navy text-ivory rounded-lg p-6">
            <div className="text-yi-gold text-xs font-semibold uppercase tracking-widest mb-3">
              Day 90
            </div>
            <h3 className="text-xl font-bold mb-3">Chapter Final</h3>
            <p className="text-sm text-ivory/80 leading-relaxed">
              A 1-day event per chapter. Opening, team presentations, jury Q&A,
              government/industry interaction, and announcement of teams
              advancing to the National Track Final.
            </p>
          </div>

          <div className="bg-gradient-to-br from-yi-gold to-yi-saffron text-white rounded-lg p-6">
            <div className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-3">
              August 2026
            </div>
            <h3 className="text-xl font-bold mb-3">National Track Final</h3>
            <p className="text-sm text-white/90 leading-relaxed">
              A 2-day conclave per track across 5 host chapters. Day 1 is
              learning — keynotes, masterclasses, town hall. Day 2 is
              competition — semi-finals, grand finals, opportunity interviews,
              awards.
            </p>
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 text-center">
        <Link
          href="/yi-future/join"
          className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-navy text-ivory font-semibold hover:bg-navy-dark transition-colors"
        >
          Enter your access code
        </Link>
        <p className="mt-3 text-xs text-navy/50">
          Already have a code from your chapter? Use it to sign in.
        </p>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <BrandStrip />
      </footer>
    </main>
  );
}
