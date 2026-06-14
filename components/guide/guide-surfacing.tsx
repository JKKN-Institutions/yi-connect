"use client";

/**
 * Smart Guide — proactive surfacing (push, not pull).
 *
 * The FAB/nav guide is pull — the user has to open it. These bring the NEXT
 * undone step to the user where they already are, reaching the majority who
 * never click Help:
 *   - <GuideNudge>: a one-line banner for an empty state / dashboard top.
 *   - <NextStepWidget>: a compact dashboard card with progress + the next action.
 *
 * Both are client components (the CTA emits a `nudge_click` event) but render
 * fine inside a server component — pass `completed` (from getCompletedSteps) and
 * the guide from the server. When the lane is complete, GuideNudge renders
 * nothing and the widget shows a done state.
 */

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import {
  type PersonaGuide,
  type GuideEvent,
  resolveGuideHref,
  nextUndoneStep,
  laneProgress,
} from "@/lib/guide/types"; // ← adjust path

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Strip `**bold**` markers for a plain truncated label. */
function plain(text: string): string {
  return text.split("**").join("");
}

interface SurfacingProps {
  guide: PersonaGuide;
  /** Base path of the full-page guide, e.g. "/yip/guide". */
  basePath: string;
  scopeId?: string | null;
  /** Completed step keys from getCompletedSteps(persona). */
  completed?: string[];
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  className?: string;
}

/** Where the CTA should send the user: the step's own deep-link if it has one,
 *  else the full guide page anchored at that step's section. */
function ctaHref(
  guide: PersonaGuide,
  basePath: string,
  scopeId: string | null | undefined,
  next: NonNullable<ReturnType<typeof nextUndoneStep>>
): string {
  const link = next.step.link ? resolveGuideHref(next.step.link.href, scopeId) : null;
  return link ?? `${basePath}?persona=${guide.persona}#${next.sectionId}`;
}

export function GuideNudge({ guide, basePath, scopeId, completed, onEvent, className }: SurfacingProps) {
  const next = nextUndoneStep(guide, new Set(completed ?? []));
  if (!next) return null; // lane complete → nothing to nudge

  const href = ctaHref(guide, basePath, scopeId, next);
  const emit = () => {
    try {
      void onEvent?.({ name: "nudge_click", persona: guide.persona, surface: "nudge", stepKey: next.key });
    } catch {
      /* analytics must never break the UI */
    }
  };

  return (
    <div className={cx("flex items-center gap-3 rounded-xl border bg-primary/5 p-4", className)}>
      <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Next step</p>
        <p className="truncate text-sm font-medium text-foreground">{plain(next.step.action)}</p>
      </div>
      <Link
        href={href}
        onClick={emit}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {next.step.link?.label ?? "Show me"}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export function NextStepWidget({ guide, basePath, scopeId, completed, onEvent, className }: SurfacingProps) {
  const set = new Set(completed ?? []);
  const lp = laneProgress(guide, set);
  const next = nextUndoneStep(guide, set);
  const label = guide.title.replace(/ Guide$/, "");

  const emit = () => {
    try {
      if (next) void onEvent?.({ name: "nudge_click", persona: guide.persona, surface: "widget", stepKey: next.key });
    } catch {
      /* analytics must never break the UI */
    }
  };

  return (
    <div className={cx("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label} setup</p>
        <span className="text-xs text-muted-foreground">
          {lp.done}/{lp.total}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lp.percent}%` }} />
      </div>
      {next ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            Next: <span className="font-medium text-foreground">{plain(next.step.action)}</span>
          </p>
          <Link
            href={ctaHref(guide, basePath, scopeId, next)}
            onClick={emit}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {next.step.link?.label ?? "Continue setup"}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm font-medium text-primary">You&apos;re all set up 🎉</p>
      )}
    </div>
  );
}
