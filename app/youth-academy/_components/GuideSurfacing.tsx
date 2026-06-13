"use client";

/**
 * Yi Youth Academy guide — proactive surfacing (push, not pull).
 *
 * The FAB/nav guide is pull — the user must open it. These bring the NEXT
 * undone step to the user where they already are (e.g. the chapter dashboard),
 * reaching the staff who never click Help:
 *   - <GuideNudge>: a one-line banner for an empty state / page top.
 *   - <NextStepWidget>: a compact card with progress + the next action.
 *
 * Both are client components (the CTA emits a nudge_click event) but render fine
 * inside a server component — pass `completed` (from getCompletedSteps) + the
 * guide + the logGuideEvent action from the server. Lane complete → GuideNudge
 * renders nothing; the widget shows a done state.
 */
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  laneProgress,
  nextUndoneStep,
  type GuideContent,
  type GuideEvent,
  type NextStep,
} from "@/lib/yuva/guide/content";

const BASE = "/youth-academy/guide";

function plain(s: string): string {
  return s.split("**").join("");
}

interface SurfacingProps {
  guide: GuideContent;
  completed?: string[];
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  className?: string;
}

/** The step's own deep-link, else the guide page anchored at that step. */
function ctaHref(guide: GuideContent, next: NextStep): string {
  return (
    next.step.link?.href ??
    `${BASE}?lane=${guide.lane}#step-${next.sectionIndex}-${next.stepIndex}`
  );
}

export function GuideNudge({ guide, completed, onEvent, className }: SurfacingProps) {
  const next = nextUndoneStep(guide, new Set(completed ?? []));
  if (!next) return null; // lane complete → nothing to nudge

  const emit = () => {
    try {
      void onEvent?.({
        name: "nudge_click",
        persona: guide.lane,
        surface: "nudge",
        stepKey: next.key,
      });
    } catch {
      /* analytics must never break the UI */
    }
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-[#0f2557]/15 bg-[#0f2557]/5 p-4 ${className ?? ""}`}
    >
      <Sparkles className="size-5 shrink-0 text-[#0f2557]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0f2557]">
          Next step
        </p>
        <p className="truncate text-sm font-medium text-slate-900">
          {plain(next.step.action)}
        </p>
      </div>
      <Link
        href={ctaHref(guide, next)}
        onClick={emit}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0f2557] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0f2557]/90"
      >
        {next.step.link?.label ?? "Show me"}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export function NextStepWidget({ guide, completed, onEvent, className }: SurfacingProps) {
  const set = new Set(completed ?? []);
  const lp = laneProgress(guide, set);
  const next = nextUndoneStep(guide, set);

  const emit = () => {
    try {
      if (next)
        void onEvent?.({
          name: "nudge_click",
          persona: guide.lane,
          surface: "widget",
          stepKey: next.key,
        });
    } catch {
      /* analytics must never break the UI */
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Getting started</p>
        <span className="text-xs text-slate-500">
          {lp.done}/{lp.total}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#0f2557] transition-all"
          style={{ width: `${lp.percent}%` }}
        />
      </div>
      {next ? (
        <>
          <p className="mt-3 text-sm text-slate-500">
            Next:{" "}
            <span className="font-medium text-slate-900">
              {plain(next.step.action)}
            </span>
          </p>
          <Link
            href={ctaHref(guide, next)}
            onClick={emit}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0f2557] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0f2557]/90"
          >
            {next.step.link?.label ?? "Continue setup"}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm font-medium text-[#0f2557]">
          You&apos;re all set up 🎉
        </p>
      )}
    </div>
  );
}
