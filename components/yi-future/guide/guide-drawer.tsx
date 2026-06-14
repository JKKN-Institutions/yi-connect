"use client";

import * as React from "react";
import Link from "next/link";
import {
  XIcon,
  PrinterIcon,
  ChevronDownIcon,
  LightbulbIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  type PersonaGuide,
  type GuideSection,
  type GuideStep,
} from "@/lib/yi-future/guide/types";

/**
 * GuideDrawer — the slide-over reading panel for the Yi Future in-app guide.
 *
 * Renders the per-step model: each section is a collapsible list of step cards,
 * and every step with a `link` shows its own "Take me there →" button. A header
 * link opens the full guide page (/yi-future/guide) for the same persona.
 *
 * Responsive: desktop (≥ sm) a right-anchored full-height ~440px rail; mobile
 * a full-width bottom sheet. Dimmed backdrop; closes on backdrop click, the X,
 * and Escape; body scroll locked while open.
 */

interface GuideDrawerProps {
  guide: PersonaGuide;
  open: boolean;
  onClose: () => void;
}

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

function StepCard({
  step,
  index,
  onNavigate,
}: {
  step: GuideStep;
  index: number;
  onNavigate: () => void;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-yi-gold/20 text-xs font-semibold text-navy"
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[0.9rem] font-medium leading-relaxed text-navy">
          {renderInline(step.action)}
        </p>
        {step.detail && (
          <p className="text-[0.85rem] leading-relaxed text-navy/55">
            {renderInline(step.detail)}
          </p>
        )}
        {step.tip && (
          <div className="flex gap-2.5 rounded-lg bg-yi-gold/10 px-3 py-2.5">
            <LightbulbIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-yi-gold"
            />
            <span className="text-[0.85rem] leading-relaxed text-navy/80">
              {renderInline(step.tip)}
            </span>
          </div>
        )}
        {step.link && (
          <Link
            href={step.link.href}
            onClick={onNavigate}
            className="flex h-11 w-full items-center justify-between rounded-lg border border-yi-gold/40 px-3.5 text-[0.9rem] font-medium text-navy transition-colors hover:bg-yi-gold/10"
          >
            <span>{step.link.label}</span>
            <ArrowRightIcon className="size-4 text-yi-gold" />
          </Link>
        )}
      </div>
    </li>
  );
}

function SectionCard({
  section,
  defaultOpen,
  onNavigate,
}: {
  section: GuideSection;
  defaultOpen: boolean;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = React.useState(defaultOpen);
  const bodyId = `guide-section-${section.id}`;

  return (
    <div className="overflow-hidden rounded-xl border border-navy/10 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className={cn(
          "flex min-h-[52px] w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
          "hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yi-gold/50"
        )}
      >
        <span className="flex-1 text-[0.95rem] font-semibold leading-snug text-navy">
          {section.title}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-5 shrink-0 text-navy/40 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div id={bodyId} className="border-t border-navy/8 px-4 pb-4 pt-3.5">
          <ol className="space-y-4">
            {section.steps.map((step, i) => (
              <StepCard
                key={i}
                step={step}
                index={i}
                onNavigate={onNavigate}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function GuideDrawer({ guide, open, onClose }: GuideDrawerProps) {
  // Keep mounted briefly after close so the slide-out transition can play.
  const [mounted, setMounted] = React.useState(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 250);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

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

      {/* Panel: bottom sheet on mobile, right rail on ≥ sm */}
      <div
        className={cn(
          "absolute flex flex-col bg-ivory shadow-2xl transition-transform duration-250 ease-out",
          "inset-x-0 bottom-0 top-12 rounded-t-2xl",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-full sm:max-w-[440px] sm:rounded-none",
          visible
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-navy/10 bg-gradient-to-br from-yi-gold/12 via-ivory to-navy/5 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight text-navy">
                {guide.title}
              </h2>
              <p className="mt-1 text-[0.85rem] leading-snug text-navy/55">
                {guide.tagline}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close guide"
              className="shrink-0 rounded-md p-1.5 text-navy/60 transition-colors hover:bg-navy/5 hover:text-navy"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Link
              href={`/yi-future/guide?persona=${guide.persona}`}
              onClick={onClose}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-yi-gold/40 bg-ivory/70 px-3 text-[0.8rem] font-medium text-navy transition-colors hover:bg-yi-gold/10"
            >
              <ExternalLinkIcon className="size-3.5 text-yi-gold" />
              Open full guide
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-yi-gold/40 bg-ivory/70 px-3 text-[0.8rem] font-medium text-navy transition-colors hover:bg-yi-gold/10"
            >
              <PrinterIcon className="size-3.5 text-yi-gold" />
              Print
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {guide.sections.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              defaultOpen={i === 0}
              onNavigate={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
