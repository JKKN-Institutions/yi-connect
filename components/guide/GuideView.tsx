"use client";

/**
 * Smart Guide — full-page renderer (theme-neutral, with the adoption layer).
 *
 * Static guide (always): persona switcher, why-it-matters + start-here, journey
 * strip, per-step deep-links, glossary, planned-locale footer.
 *
 * Adoption layer (opt-in via `trackProgress` + the server-action props): each
 * step becomes a CHECKBOX, a per-lane progress bar + "X of N done" + completion
 * banner appears, the next undone step is highlighted with a Resume jump, and
 * every interaction fires a `GuideEvent` so you can MEASURE activation. With no
 * progress props the component renders the plain guide — graceful degradation.
 *
 * THEME: shadcn semantic tokens (primary / muted / card / …) → inherits brand
 * + dark mode. Swap for literal hexes only if you must hard-brand it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowRight, Download, Lightbulb, BookText, Check, AlertTriangle } from "lucide-react";

import {
  type GuideBook,
  type GuidePersona,
  type GuideStep,
  type GuideEvent,
  resolveGuideHref,
  stepKey,
  laneProgress,
  nextUndoneStep,
} from "@/lib/guide/types"; // ← adjust path
import { useGuideProgress } from "@/lib/guide/use-progress"; // ← adjust path

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Plain text (drop `**bold**` markers) — for aria-labels read by screen readers. */
function stripBold(text: string): string {
  return text.split("**").join("");
}

/** Tiny `**bold**` renderer (trusted static copy only — no other markup). */
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

function StartHere({ why, href, label }: { why?: string; href?: string | null; label?: string }) {
  if (!why && !(href && label)) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      {why ? (
        <p className="text-sm">
          <span className="font-medium">Why this matters: </span>
          <span className="text-muted-foreground">{why}</span>
        </p>
      ) : (
        <span />
      )}
      {href && label && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  scopeId,
  fallbackHref,
  track,
  done,
  isNext,
  onToggle,
  onLinkClick,
}: {
  step: GuideStep;
  index: number;
  scopeId?: string | null;
  fallbackHref: string | null;
  track: boolean;
  done: boolean;
  isNext: boolean;
  onToggle: () => void;
  onLinkClick: () => void;
}) {
  const resolved = step.link ? resolveGuideHref(step.link.href, scopeId) : null;
  const href = resolved ?? (step.link ? fallbackHref : null);
  return (
    <li
      className={cx(
        "flex gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors",
        isNext && !done && "ring-2 ring-primary/40",
        done && "opacity-70"
      )}
    >
      {track ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${stripBold(step.action)} — ${done ? "done" : "not done"}`}
          onClick={onToggle}
          className={cx(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30 text-muted-foreground hover:border-primary"
          )}
        >
          {done ? <Check className="size-4" aria-hidden /> : <span className="text-sm font-bold">{index + 1}</span>}
        </button>
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {index + 1}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p
          className={cx(
            "font-medium leading-snug text-foreground",
            done && "line-through decoration-muted-foreground/40"
          )}
        >
          {renderInline(step.action)}
        </p>
        {step.detail && <p className="text-sm leading-relaxed text-muted-foreground">{renderInline(step.detail)}</p>}
        {step.prerequisite && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Required first: </span>
              {renderInline(step.prerequisite)}
            </span>
          </p>
        )}
        {step.platforms && (step.platforms.web || step.platforms.mobile) && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Where to find it</p>
            {step.platforms.web && (
              <p>
                <span className="font-medium">On the web: </span>
                <span className="text-muted-foreground">{renderInline(step.platforms.web)}</span>
              </p>
            )}
            {step.platforms.mobile && (
              <p>
                <span className="font-medium">On the app: </span>
                <span className="text-muted-foreground">{renderInline(step.platforms.mobile)}</span>
              </p>
            )}
          </div>
        )}
        {step.image && (
          <figure className="my-1">
            <div className="relative overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.image.src} alt={step.image.alt} width={step.image.width} height={step.image.height} className="block h-auto w-full" />
              {step.image.highlight && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute rounded-md ring-2 ring-primary ring-offset-1 ring-offset-background"
                  style={{
                    left: `${step.image.highlight.x}%`,
                    top: `${step.image.highlight.y}%`,
                    width: `${step.image.highlight.width}%`,
                    height: `${step.image.highlight.height}%`,
                  }}
                >
                  {step.image.highlight.label && (
                    <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      {step.image.highlight.label}
                    </span>
                  )}
                </span>
              )}
            </div>
          </figure>
        )}
        {step.tip && (
          <p className="flex items-start gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm text-foreground/90">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>{renderInline(step.tip)}</span>
          </p>
        )}
        {step.link && href && (
          <Link
            href={href}
            onClick={onLinkClick}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {step.link.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

interface GuideViewProps {
  guides: GuideBook;
  persona: GuidePersona;
  /** Lanes the viewer may switch to (permission-scoped by the page). */
  visiblePersonas: GuidePersona[];
  /** Current scope id, for resolving `:scopeId` deep-links. */
  scopeId?: string | null;
  /** Base path of the guide route, e.g. "/yip/guide" — drives the switcher URL. */
  basePath: string;
  /** Where scope-bound links fall back to when no scope is in context. */
  scopeFallbackHref?: string | null;
  /* ── adoption layer (all optional) ── */
  /** Turn the lane into a checkable activation checklist. */
  trackProgress?: boolean;
  /** Step keys this user has already completed (from getCompletedSteps). */
  initialCompleted?: string[];
  /** Server action persisting a toggle. */
  onToggleStep?: (persona: GuidePersona, key: string, done: boolean) => Promise<unknown> | void;
  /** Event sink for instrumentation. */
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
}

export function GuideView({
  guides,
  persona,
  visiblePersonas,
  scopeId,
  basePath,
  scopeFallbackHref = null,
  trackProgress = false,
  initialCompleted,
  onToggleStep,
  onEvent,
}: GuideViewProps) {
  const router = useRouter();
  const content = guides.lanes[persona];
  const progress = useGuideProgress({
    persona,
    surface: "page",
    initialCompleted,
    onToggle: onToggleStep,
    onEvent,
  });

  const lp = laneProgress(content, progress.completed);
  const next = trackProgress ? nextUndoneStep(content, progress.completed) : null;
  const startHref = content.startHere ? resolveGuideHref(content.startHere.href, scopeId) ?? scopeFallbackHref : null;
  const showSwitcher = visiblePersonas.length > 1;

  // Fire guide_open once per lane view.
  React.useEffect(() => {
    progress.emit({ name: "guide_open", surface: "page" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire lane_complete on the false→true transition.
  const wasComplete = React.useRef(lp.complete);
  React.useEffect(() => {
    if (trackProgress && lp.complete && !wasComplete.current) {
      progress.emit({ name: "lane_complete", surface: "page" });
    }
    wasComplete.current = lp.complete;
  }, [trackProgress, lp.complete, progress.emit]);

  return (
    <div className="space-y-10">
      {/* Persona switcher */}
      {showSwitcher && (
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Choose a guide</p>
          <div className="flex flex-wrap gap-2">
            {visiblePersonas.map((p) => {
              const active = p === persona;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    progress.emit({ name: "lane_switch", surface: "page", context: p });
                    router.push(`${basePath}?persona=${p}`);
                  }}
                  className={
                    active
                      ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground"
                      : "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  }
                >
                  {guides.lanes[p].title.replace(/ Guide$/, "")}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Header + Download PDF */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-1 text-sm font-semibold text-primary">
            {content.title}
          </span>
          {content.pdfPath ? (
            <a
              href={content.pdfPath}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => progress.emit({ name: "pdf_download", surface: "page" })}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Download className="size-4" aria-hidden />
              Download as PDF
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                progress.emit({ name: "pdf_download", surface: "page" });
                window.print();
              }}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted print:hidden"
            >
              <Download className="size-4" aria-hidden />
              Download / Print
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">How to use this</h1>
        <p className="text-base text-muted-foreground">{content.tagline}</p>
      </header>

      {/* Why it matters + Start here */}
      <StartHere why={content.whyItMatters} href={startHref} label={content.startHere?.label} />

      {/* Progress bar + Resume (adoption layer) */}
      {trackProgress && lp.total > 0 && (
        <section className={cx("rounded-xl border p-4", lp.complete ? "border-primary/40 bg-primary/5" : "bg-card")}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{lp.complete ? "You're all set up 🎉" : `${lp.done} of ${lp.total} done`}</span>
            <span className="text-muted-foreground">{lp.percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lp.percent}%` }} />
          </div>
          {!lp.complete && next && (
            <a href={`#${next.sectionId}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Resume: {next.sectionTitle}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          )}
        </section>
      )}

      {/* Journey strip */}
      <section aria-label="Your journey at a glance" className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Your journey at a glance</p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {content.journey.map((node, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground/80">{node}</span>
              </span>
              {i < content.journey.length - 1 && <ChevronRight className="size-4 text-muted-foreground/40" aria-hidden />}
            </li>
          ))}
        </ol>
      </section>

      {/* Step-by-step sections */}
      {content.sections.map((section, sIdx) => (
        <section key={section.id} id={section.id} className="space-y-4 scroll-mt-20">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="text-primary">{sIdx + 1}.</span>
            {section.title}
          </h2>
          <ol className="space-y-3">
            {section.steps.map((step, i) => {
              const key = stepKey(section.id, step, i);
              return (
                <StepCard
                  key={key}
                  step={step}
                  index={i}
                  scopeId={scopeId}
                  fallbackHref={scopeFallbackHref}
                  track={trackProgress}
                  done={progress.completed.has(key)}
                  isNext={next?.key === key}
                  onToggle={() => progress.toggle(key)}
                  onLinkClick={() => progress.emit({ name: "step_link_click", surface: "page", stepKey: key })}
                />
              );
            })}
          </ol>
        </section>
      ))}

      {/* Words to know (shared glossary) */}
      {guides.glossary && guides.glossary.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <BookText className="size-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold">Words to know</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {guides.glossary.map(({ term, def }) => (
              <div key={term} className="text-sm">
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground">{def}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Footer */}
      <p className="border-t pt-4 text-xs text-muted-foreground">
        {showSwitcher ? "Switch roles with the buttons up top. " : ""}
        {content.pdfPath ? "Use Download as PDF to save or share this guide. " : "Use Download / Print to save this guide. "}
        {guides.plannedLocaleNote ?? ""}
      </p>
    </div>
  );
}
