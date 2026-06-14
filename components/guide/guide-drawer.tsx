"use client";

/**
 * Smart Guide — in-app slide-over drawer (theme-neutral, dependency-light).
 *
 * Same data model as the full page, in a panel that opens IN CONTEXT from the
 * "? Help" FAB or a nav "Guide" item. Collapsible sections; per-step deep links.
 *
 * Adoption layer (opt-in via `trackProgress` + props): checkable steps, a
 * compact progress bar in the header, and `GuideEvent`s on open / dismiss /
 * link-click / step-toggle. With no progress props it's the plain drawer.
 *
 * Accessibility: role=dialog + aria-modal WITH real focus management — focus
 * moves into the panel on open, Tab is trapped, focus restores to the trigger
 * on close. Responsive: right-rail (≥ sm), bottom-sheet (mobile). Escape/
 * backdrop/X close; body scroll locks while open.
 */

import * as React from "react";
import Link from "next/link";
import { X, Download, ChevronDown, Lightbulb, ArrowRight, ExternalLink, Check } from "lucide-react";

import {
  type PersonaGuide,
  type GuideSection,
  type GuideStep,
  resolveGuideHref,
  stepKey,
  laneProgress,
} from "@/lib/guide/types"; // ← adjust path
import { type GuideProgressApi } from "@/lib/guide/use-progress"; // ← adjust path

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function renderInline(text: string): React.ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/** Plain text (drop `**bold**` markers) — for aria-labels read by screen readers. */
function stripBold(text: string): string {
  return text.split("**").join("");
}

function StepRow({
  step,
  index,
  scopeId,
  track,
  done,
  onToggle,
  onLinkClick,
}: {
  step: GuideStep;
  index: number;
  scopeId?: string | null;
  track: boolean;
  done: boolean;
  onToggle: () => void;
  onLinkClick: () => void;
}) {
  const href = step.link ? resolveGuideHref(step.link.href, scopeId) : null;
  return (
    <li className={cx("flex gap-3", done && "opacity-70")}>
      {track ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${stripBold(step.action)} — ${done ? "done" : "not done"}`}
          onClick={onToggle}
          className={cx(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground hover:border-primary"
          )}
        >
          {done ? <Check className="size-3.5" aria-hidden /> : <span className="text-xs font-semibold">{index + 1}</span>}
        </button>
      ) : (
        <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {index + 1}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p className={cx("text-[0.9rem] font-medium leading-relaxed text-foreground", done && "line-through decoration-muted-foreground/40")}>
          {renderInline(step.action)}
        </p>
        {step.detail && <p className="text-[0.85rem] leading-relaxed text-muted-foreground">{renderInline(step.detail)}</p>}
        {step.tip && (
          <div className="flex gap-2.5 rounded-lg bg-primary/8 px-3 py-2.5">
            <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-[0.85rem] leading-relaxed text-foreground/90">{renderInline(step.tip)}</span>
          </div>
        )}
        {step.link && href && (
          <Link
            href={href}
            onClick={onLinkClick}
            className="flex h-11 w-full items-center justify-between rounded-lg border px-3 text-[0.9rem] font-medium hover:bg-muted"
          >
            <span>{step.link.label}</span>
            <ArrowRight className="size-4 text-primary" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

function SectionItem({
  section,
  scopeId,
  defaultOpen,
  track,
  progress,
  onLink,
}: {
  section: GuideSection;
  scopeId?: string | null;
  defaultOpen: boolean;
  track: boolean;
  progress: GuideProgressApi;
  onLink: (key: string) => void;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const bodyId = `guide-section-${section.id}`;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/60"
      >
        <span className="flex-1 text-[0.95rem] font-semibold leading-snug">{section.title}</span>
        <ChevronDown aria-hidden className={cx("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={bodyId} className="border-t px-4 pb-4 pt-3.5">
          <ol className="space-y-4">
            {section.steps.map((step, i) => {
              const key = stepKey(section.id, step, i);
              return (
                <StepRow
                  key={key}
                  step={step}
                  index={i}
                  scopeId={scopeId}
                  track={track}
                  done={progress.completed.has(key)}
                  onToggle={() => progress.toggle(key)}
                  onLinkClick={() => onLink(key)}
                />
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

interface GuideDrawerProps {
  guide: PersonaGuide;
  /** Base path of the full-page guide, for the "Open full guide" link. */
  basePath: string;
  scopeId?: string | null;
  open: boolean;
  onClose: () => void;
  /* ── adoption layer (all optional) ── */
  trackProgress?: boolean;
  /** Shared progress api — created by the launcher so the FAB badge and the
   *  drawer read/write the SAME completed-set (single source of truth). */
  progress: GuideProgressApi;
}

export function GuideDrawer({
  guide,
  basePath,
  scopeId,
  open,
  onClose,
  trackProgress = false,
  progress,
}: GuideDrawerProps) {
  const [mounted, setMounted] = React.useState(open);
  const [visible, setVisible] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const lp = laneProgress(guide, progress.completed);

  // Dismiss = explicit close (backdrop / X / Escape). Following a deep-link
  // closes too, but that's a navigation, not a dismiss — handled separately.
  const dismiss = React.useCallback(() => {
    progress.emit({ name: "guide_dismiss", surface: "drawer" });
    onClose();
  }, [progress, onClose]);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      progress.emit({ name: "guide_open", surface: "drawer" });
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus IN on open; restore to trigger on close (WCAG modal contract).
  React.useEffect(() => {
    if (open) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null;
      const id = requestAnimationFrame(() => panelRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    triggerRef.current?.focus?.();
  }, [open]);

  // Escape closes; Tab trapped inside the panel.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const followLink = (key: string) => {
    progress.emit({ name: "step_link_click", surface: "drawer", stepKey: key });
    onClose();
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={guide.title}>
      <div onClick={dismiss} className={cx("absolute inset-0 bg-black/40 transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          "absolute flex flex-col bg-background shadow-2xl outline-none transition-transform duration-200 ease-out",
          "inset-x-0 bottom-0 top-12 rounded-t-2xl",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-full sm:max-w-[440px] sm:rounded-none",
          visible ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        )}
      >
        <div className="relative shrink-0 border-b bg-muted/30 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{guide.title}</h2>
              <p className="mt-1 text-[0.85rem] leading-snug text-muted-foreground">{guide.tagline}</p>
            </div>
            <button type="button" onClick={dismiss} aria-label="Close guide" className="shrink-0 rounded-md p-1.5 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          {trackProgress && lp.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[0.78rem]">
                <span className="font-medium">{lp.complete ? "All done 🎉" : `${lp.done} of ${lp.total} done`}</span>
                <span className="text-muted-foreground">{lp.percent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lp.percent}%` }} />
              </div>
            </div>
          )}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Link href={`${basePath}?persona=${guide.persona}`} onClick={onClose} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[0.8rem] font-medium hover:bg-muted">
              <ExternalLink className="size-3.5 text-primary" /> Open full guide
            </Link>
            {guide.pdfPath && (
              <a
                href={guide.pdfPath}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => progress.emit({ name: "pdf_download", surface: "drawer" })}
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[0.8rem] font-medium hover:bg-muted"
              >
                <Download className="size-3.5 text-primary" /> Download PDF
              </a>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {guide.sections.map((section, i) => (
            <SectionItem
              key={section.id}
              section={section}
              scopeId={scopeId}
              defaultOpen={i === 0}
              track={trackProgress}
              progress={progress}
              onLink={followLink}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
