"use client"

import * as React from "react"
import Link from "next/link"
import {
  XIcon,
  DownloadIcon,
  ChevronDownIcon,
  LightbulbIcon,
  ArrowRightIcon,
} from "lucide-react"

import { cn } from "@/lib/yip/utils"
import { Button } from "@/components/yip/ui/button"
import {
  type PersonaGuide,
  type GuideSection,
  resolveGuideHref,
} from "@/lib/yip/guide/types"

/**
 * GuideDrawer — the slide-over reading panel for the in-app adaptive guide.
 *
 * Responsive behaviour:
 *  - Desktop (>= sm): a right-anchored, full-height panel ~440px wide that
 *    slides in from the right edge (translate-x).
 *  - Mobile (< sm): a full-width sheet that slides up from the bottom and
 *    fills (almost) the whole height, with rounded top corners.
 * A dimmed backdrop sits behind it. Closes on backdrop click, the X button,
 * and the Escape key. Body scroll is locked while open.
 */

interface GuideDrawerProps {
  guide: PersonaGuide
  eventId?: string | null
  open: boolean
  onClose: () => void
}

/** Tiny, dependency-free `**bold**` renderer. Content is our own trusted
 *  static copy, so we only split on the bold delimiter and render nothing
 *  else as markup. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split("**")
  return parts.map((part, i) =>
    // Odd indices sit between a pair of `**` → bold.
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function SectionCard({
  section,
  eventId,
  defaultOpen,
  onNavigate,
}: {
  section: GuideSection
  eventId?: string | null
  defaultOpen: boolean
  onNavigate: () => void
}) {
  const [expanded, setExpanded] = React.useState(defaultOpen)
  const bodyId = `guide-section-${section.id}`

  // Only links with a resolvable href survive (event-scoped links hide when no
  // event is in context).
  const links = (section.links ?? [])
    .map((link) => ({ link, href: resolveGuideHref(link.href, eventId) }))
    .filter((x): x is { link: (typeof x)["link"]; href: string } => x.href !== null)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/50",
          "min-h-[52px]"
        )}
      >
        <span className="flex-1 text-[0.95rem] font-semibold leading-snug text-foreground">
          {section.title}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div
          id={bodyId}
          className="space-y-4 border-t border-border/70 px-4 pb-4 pt-3.5"
        >
          <p className="text-[0.9rem] leading-relaxed text-muted-foreground">
            {renderInline(section.summary)}
          </p>

          {section.steps && section.steps.length > 0 && (
            <ol className="space-y-2.5">
              {section.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#FF9933]/15 text-xs font-semibold text-[#b35e00]"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-[0.9rem] leading-relaxed text-foreground">
                    {renderInline(step)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {section.tips && section.tips.length > 0 && (
            <div className="space-y-2">
              {section.tips.map((tip, i) => (
                <div
                  key={i}
                  className="flex gap-2.5 rounded-lg bg-[#138808]/8 px-3 py-2.5"
                >
                  <LightbulbIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-[#138808]"
                  />
                  <span className="text-[0.85rem] leading-relaxed text-foreground/90">
                    {renderInline(tip)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {links.length > 0 && (
            <div className="flex flex-col gap-2 pt-0.5">
              {links.map(({ link, href }, i) => (
                <Button
                  key={i}
                  size="lg"
                  variant="outline"
                  className="h-11 w-full justify-between border-[#FF9933]/40 text-[0.9rem] font-medium hover:bg-[#FF9933]/10 hover:text-foreground"
                  render={
                    <Link href={href} onClick={onNavigate}>
                      <span>{link.label}</span>
                      <ArrowRightIcon className="size-4 text-[#FF9933]" />
                    </Link>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function GuideDrawer({ guide, eventId, open, onClose }: GuideDrawerProps) {
  // Keep the panel mounted briefly after `open` flips to false so the
  // slide-out transition can play, then unmount.
  const [mounted, setMounted] = React.useState(open)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setMounted(true)
      // Next frame: flip to the "in" position so the transition runs.
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), 250)
    return () => clearTimeout(t)
  }, [open])

  // Escape to close.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={guide.title}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-250 supports-backdrop-filter:backdrop-blur-[2px]",
          visible ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Panel: bottom sheet on mobile, right rail on >= sm */}
      <div
        className={cn(
          "absolute flex flex-col bg-background shadow-2xl transition-transform duration-250 ease-out",
          // Mobile: full-width sheet from the bottom, rounded top, tall.
          "inset-x-0 bottom-0 top-12 rounded-t-2xl",
          // Desktop: right rail, full height, fixed width.
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-full sm:max-w-[440px] sm:rounded-none",
          // Slide direction differs per breakpoint.
          visible
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-border bg-gradient-to-br from-[#FF9933]/12 via-background to-[#138808]/8 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-semibold leading-tight text-foreground">
                {guide.title}
              </h2>
              <p className="mt-1 text-[0.85rem] leading-snug text-muted-foreground">
                {guide.tagline}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close guide"
              className="shrink-0"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="mt-3.5 h-9 gap-2 border-[#FF9933]/40 bg-background/70 px-3 text-[0.8rem] font-medium hover:bg-[#FF9933]/10 hover:text-foreground"
            render={
              <a href={guide.pdfPath} download target="_blank" rel="noopener noreferrer">
                <DownloadIcon className="size-3.5 text-[#FF9933]" />
                Download PDF
              </a>
            }
          />
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {guide.sections.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              eventId={eventId}
              defaultOpen={i === 0}
              onNavigate={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
