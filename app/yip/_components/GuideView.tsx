"use client"

/**
 * YIP full-page guide renderer.
 *
 * Mirrors the Youth Academy GuideView (app/youth-academy/_components/GuideView)
 * but YIP-branded (saffron #FF9933 / green #138808). Structure:
 *   - a persona switcher (chips) so anyone logged in can view any of the four
 *     lanes — organiser / student / volunteer / jury;
 *   - a Download-PDF button (points at the static /yip/guides/{persona}.pdf);
 *   - a persona badge + title + tagline;
 *   - a "YOUR JOURNEY AT A GLANCE" numbered strip built from `journey`;
 *   - numbered sections, each step a card with a number chip, action, detail,
 *     a green tip callout, and — the key feature — its OWN prominent deep-link
 *     button ("Take me there →") resolved through resolveGuideHref. Event-scoped
 *     organiser links hide when no event is in context.
 *
 * Client component: the only interactivity is the persona switch (a router
 * push) and the per-step links (plain <Link>s). It reads from the shared data
 * module so the page, the drawer and the PDF never disagree.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Megaphone,
  GraduationCap,
  HandHelping,
  Scale,
  Lightbulb,
  ChevronRight,
  ArrowRight,
  Download,
  type LucideIcon,
} from "lucide-react"

import {
  type GuideBook,
  type GuidePersona,
  GUIDE_PERSONAS,
  resolveGuideHref,
} from "@/lib/yip/guide/types"

const PERSONA_ICON: Record<GuidePersona, LucideIcon> = {
  organiser: Megaphone,
  student: GraduationCap,
  volunteer: HandHelping,
  jury: Scale,
}

/** Tiny `**bold**` renderer (trusted static copy only). */
function renderInline(text: string): React.ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[#1a1a3e]">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

interface GuideViewProps {
  guides: GuideBook
  persona: GuidePersona
  /** Current event id, for resolving organiser `:eventId` deep-links. */
  eventId?: string | null
}

export function GuideView({ guides, persona, eventId }: GuideViewProps) {
  const router = useRouter()
  const content = guides[persona]
  const Icon = PERSONA_ICON[persona]

  return (
    <div className="space-y-10">
      {/* ── Persona switcher ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1a1a3e]/40">
          Choose a guide
        </p>
        <div className="flex flex-wrap gap-2">
          {GUIDE_PERSONAS.map((p) => {
            const PIcon = PERSONA_ICON[p]
            const active = p === persona
            return (
              <button
                key={p}
                type="button"
                onClick={() => router.push(`/yip/guide?persona=${p}`)}
                aria-pressed={active}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full bg-[#FF9933] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-[#FF9933]/30"
                    : "inline-flex items-center gap-1.5 rounded-full border border-[#1a1a3e]/12 px-3.5 py-1.5 text-sm font-medium text-[#1a1a3e]/60 transition-colors hover:border-[#FF9933]/40 hover:text-[#1a1a3e]"
                }
              >
                <PIcon className="size-3.5" />
                {guides[p].title.replace(/ Guide$/, "")}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Who this is for + Download ───────────────────────────────── */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FF9933]/12 px-3 py-1 text-sm font-semibold text-[#b35e00]">
            <Icon className="size-4" />
            {content.title}
          </span>
          <a
            href={content.pdfPath}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#138808] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0f6e06]"
          >
            <Download className="size-4" />
            Download as PDF
          </a>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a1a3e] sm:text-3xl">
          How to use YIP
        </h1>
        <p className="text-base text-[#1a1a3e]/60">{content.tagline}</p>
      </header>

      {/* ── Journey strip ───────────────────────────────────────────── */}
      <section
        aria-label="Your journey at a glance"
        className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-5 shadow-sm"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#138808]">
          Your journey at a glance
        </p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {content.journey.map((node, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#FF9933] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-[#1a1a3e]/80">
                  {node}
                </span>
              </span>
              {i < content.journey.length - 1 && (
                <ChevronRight className="size-4 text-[#1a1a3e]/20" aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── Step-by-step sections ───────────────────────────────────── */}
      {content.sections.map((section, sIdx) => (
        <section key={section.id} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1a1a3e]">
            <span className="text-[#FF9933]">{sIdx + 1}.</span>
            {section.title}
          </h2>
          <ol className="space-y-3">
            {section.steps.map((step, i) => {
              const resolved = step.link
                ? resolveGuideHref(step.link.href, eventId)
                : null
              // On the standalone /yip/guide page an organiser has no single
              // event in context, so event-scoped (`:eventId`) links can't
              // resolve. Rather than hide the button, send the organiser to
              // My Events — they pick an event there, then reach the tab.
              // Other lanes' links never use the token, so they resolve as-is.
              const href =
                resolved ??
                (step.link && persona === "organiser"
                  ? "/yip/dashboard"
                  : null)
              return (
                <li
                  key={i}
                  className="flex gap-4 rounded-xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FF9933]/15 text-sm font-bold text-[#b35e00]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium leading-snug text-[#1a1a3e]">
                      {renderInline(step.action)}
                    </p>
                    {step.detail && (
                      <p className="text-sm leading-relaxed text-[#1a1a3e]/55">
                        {renderInline(step.detail)}
                      </p>
                    )}
                    {step.tip && (
                      <p className="flex items-start gap-2 rounded-lg bg-[#138808]/8 px-3 py-2 text-sm text-[#0f6e06]">
                        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{renderInline(step.tip)}</span>
                      </p>
                    )}
                    {step.link && href && (
                      <Link
                        href={href}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#FF9933] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E68A2E]"
                      >
                        {step.link.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
