"use client";

/**
 * Yi Future 6.0 full-page guide renderer.
 *
 * Mirrors the YIP / Youth Academy GuideView, Yi-Future-branded (navy / ivory /
 * yi-gold). Structure:
 *   - a persona switcher (chips) so anyone signed in can view any of the six
 *     lanes — national / chapter / delegate / mentor / jury / partner;
 *   - a "why it matters" opener + a Start-here button (per lane, optional);
 *   - a Print / Save-as-PDF button (browser print — no static files to rot);
 *   - a persona badge + title + tagline;
 *   - a "YOUR JOURNEY AT A GLANCE" numbered strip built from `journey`;
 *   - numbered sections, each step a card with a number chip, action, detail,
 *     a gold tip callout, and its OWN deep-link button ("Take me there →");
 *   - a shared "Words to know" glossary + a planned-translation footer.
 *
 * Client component: interactivity is the persona switch (a router push), the
 * print button, and the per-step links (plain <Link>s). It reads from the
 * shared data module so page, drawer and print never disagree.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Rocket,
  Compass,
  Scale,
  Handshake,
  Lightbulb,
  ChevronRight,
  ArrowRight,
  Printer,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

import {
  type GuideBook,
  type GuidePersona,
  GUIDE_PERSONAS,
} from "@/lib/yi-future/guide/types";

const PERSONA_ICON: Record<GuidePersona, LucideIcon> = {
  national: ShieldCheck,
  chapter: Building2,
  delegate: Rocket,
  mentor: Compass,
  jury: Scale,
  partner: Handshake,
};

/** Tiny `**bold**` renderer (trusted static copy only). */
function renderInline(text: string): React.ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-navy">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

interface GuideViewProps {
  guides: GuideBook;
  persona: GuidePersona;
}

export function GuideView({ guides, persona }: GuideViewProps) {
  const router = useRouter();
  const content = guides.lanes[persona];
  const Icon = PERSONA_ICON[persona];

  return (
    <div className="space-y-10">
      {/* ── Persona switcher ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm print:hidden">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-navy/40">
          Choose a guide
        </p>
        <div className="flex flex-wrap gap-2">
          {GUIDE_PERSONAS.map((p) => {
            const PIcon = PERSONA_ICON[p];
            const active = p === persona;
            return (
              <button
                key={p}
                type="button"
                onClick={() => router.push(`/yi-future/guide?persona=${p}`)}
                aria-pressed={active}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm"
                    : "inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3.5 py-1.5 text-sm font-medium text-navy/60 transition-colors hover:border-yi-gold/50 hover:text-navy"
                }
              >
                <PIcon className="size-3.5" />
                {guides.lanes[p].title.replace(/ Guide$/, "")}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Who this is for + Print ──────────────────────────────────── */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-yi-gold/15 px-3 py-1 text-sm font-semibold text-navy">
            <Icon className="size-4" />
            {content.title}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy/90 print:hidden"
          >
            <Printer className="size-4" />
            Print / Save as PDF
          </button>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          How to use Yi Future 6.0
        </h1>
        <p className="text-base text-navy/60">{content.tagline}</p>

        {content.whyItMatters && (
          <div className="rounded-xl border border-yi-gold/30 bg-yi-gold/8 p-4">
            <p className="text-sm leading-relaxed text-navy/80">
              {renderInline(content.whyItMatters)}
            </p>
            {content.startHere && (
              <Link
                href={content.startHere.href}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-yi-gold px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-yi-gold/90"
              >
                {content.startHere.label}
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </header>

      {/* ── Journey strip ───────────────────────────────────────────── */}
      <section
        aria-label="Your journey at a glance"
        className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-yi-gold">
          Your journey at a glance
        </p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {content.journey.map((node, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-navy/80">{node}</span>
              </span>
              {i < content.journey.length - 1 && (
                <ChevronRight className="size-4 text-navy/20" aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── Step-by-step sections ───────────────────────────────────── */}
      {content.sections.map((section, sIdx) => (
        <section key={section.id} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
            <span className="text-yi-gold">{sIdx + 1}.</span>
            {section.title}
          </h2>
          <ol className="space-y-3">
            {section.steps.map((step, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-xl border border-navy/10 bg-white p-4 shadow-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-yi-gold/20 text-sm font-bold text-navy">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium leading-snug text-navy">
                    {renderInline(step.action)}
                  </p>
                  {step.detail && (
                    <p className="text-sm leading-relaxed text-navy/55">
                      {renderInline(step.detail)}
                    </p>
                  )}
                  {step.tip && (
                    <p className="flex items-start gap-2 rounded-lg bg-yi-gold/10 px-3 py-2 text-sm text-navy/80">
                      <Lightbulb
                        className="mt-0.5 size-4 shrink-0 text-yi-gold"
                        aria-hidden
                      />
                      <span>{renderInline(step.tip)}</span>
                    </p>
                  )}
                  {step.link && (
                    <Link
                      href={step.link.href}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy/90 print:hidden"
                    >
                      {step.link.label}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {/* ── Glossary ────────────────────────────────────────────────── */}
      {guides.glossary.length > 0 && (
        <section
          aria-label="Words to know"
          className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-navy">
            <BookOpen className="size-4 text-yi-gold" aria-hidden />
            Words to know
          </h2>
          <dl className="space-y-3">
            {guides.glossary.map((g) => (
              <div key={g.term} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="font-semibold text-navy">{g.term}</dt>
                <dd className="text-sm leading-relaxed text-navy/60">
                  {renderInline(g.def)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {guides.plannedLocaleNote && (
        <p className="border-t border-navy/10 pt-5 text-center text-xs text-navy/40">
          {guides.plannedLocaleNote}
        </p>
      )}
    </div>
  );
}
