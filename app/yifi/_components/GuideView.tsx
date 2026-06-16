"use client";

/**
 * YiFi guide — visual renderer for ONE lane (dark YiFi theme).
 *
 * 12th-grader friendly: why-it-matters + start-here, a journey map, numbered
 * one-action step cards with plain detail / orange tips / "take me there"
 * deep-links, then FAQ, glossary and help.
 *
 * Adoption layer (all OPTIONAL — off → the plain guide): when `trackProgress`
 * is set (organiser lane), each step becomes a checkbox, a progress bar + "X of
 * N" + completion banner + Resume appear, and interactions emit GuideEvents.
 * Reads its content from the shared data module (lib/yifi/guide/content).
 */
import * as React from "react";
import Link from "next/link";
import {
  UserRound,
  ShieldCheck,
  Lightbulb,
  ChevronRight,
  ArrowRight,
  Rocket,
  BookText,
  Check,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  GUIDE_GLOSSARY,
  laneProgress,
  nextUndoneStep,
  stepKey,
  type GuideContent,
  type GuideLane,
  type GuideEvent,
} from "@/lib/yifi/guide/content";
import { useGuideProgress } from "@/lib/yifi/guide/use-progress";

const LANE_ICON: Record<GuideLane, LucideIcon> = {
  participant: UserRound,
  organiser: ShieldCheck,
};

export function GuideView({
  content,
  trackProgress = false,
  initialCompleted,
  onToggleStep,
  onEvent,
}: {
  content: GuideContent;
  /** Organiser lane only — turns steps into a persisted checklist. */
  trackProgress?: boolean;
  initialCompleted?: string[];
  onToggleStep?: (
    persona: GuideLane,
    stepKey: string,
    done: boolean
  ) => Promise<unknown> | void;
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
}) {
  const Icon = LANE_ICON[content.lane];
  const { completed, toggle, emit } = useGuideProgress({
    persona: content.lane,
    surface: "page",
    initialCompleted,
    onToggle: onToggleStep,
    onEvent,
  });

  // guide_open once (ref-guarded so StrictMode's dev double-invoke can't dupe).
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    emit({ name: "guide_open", surface: "page" });
  }, [emit]);

  const lp = laneProgress(content, completed);
  const next = trackProgress ? nextUndoneStep(content, completed) : null;

  // lane_complete on the transition to all-done.
  const wasComplete = React.useRef(lp.complete);
  React.useEffect(() => {
    if (trackProgress && lp.complete && !wasComplete.current) {
      emit({ name: "lane_complete", surface: "page" });
    }
    wasComplete.current = lp.complete;
  }, [trackProgress, lp.complete, emit]);

  return (
    <article className="space-y-10">
      {/* ── Who this is for ─────────────────────────────────────────── */}
      <header className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FD7215]/15 px-3 py-1 text-sm font-semibold text-[#FD7215]">
          <Icon className="size-4" />
          {content.label}
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          How to use YiFi
        </h1>
        <p className="text-base text-white/60">{content.tagline}</p>
      </header>

      {/* ── Why it matters + start here ─────────────────────────────── */}
      <section className="rounded-2xl border border-[#FD7215]/30 bg-[#FD7215]/10 p-5">
        <p className="text-base font-medium text-white">{content.whyItMatters}</p>
        <Link
          href={content.startHere.href}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FD7215] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e5660f]"
        >
          <Rocket className="size-4" />
          {content.startHere.label}
        </Link>
      </section>

      {/* ── Progress (organiser checklist only) ─────────────────────── */}
      {trackProgress && lp.total > 0 && (
        <section
          aria-label="Your progress"
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          {lp.complete ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="size-5 text-[#229434]" />
              You&apos;ve completed this guide — you&apos;re all set. 🎉
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Your setup</p>
                <span className="text-sm text-white/50">
                  {lp.done} of {lp.total} done
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#FD7215] transition-all"
                  style={{ width: `${lp.percent}%` }}
                />
              </div>
              {next && (
                <a
                  href={`#step-${next.sectionIndex}-${next.stepIndex}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FD7215] hover:underline"
                >
                  Resume — next: {next.step.action}
                  <ArrowRight className="size-3.5" />
                </a>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Journey map ─────────────────────────────────────────────── */}
      <section
        aria-label="Your journey at a glance"
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#FD7215]">
          Your journey at a glance
        </p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {content.journey.map((node, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#FD7215] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-white/70">{node}</span>
              </span>
              {i < content.journey.length - 1 && (
                <ChevronRight className="size-4 text-white/20" aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── Step-by-step sections ───────────────────────────────────── */}
      {content.sections.map((section, sIdx) => (
        <section key={sIdx} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="text-[#FD7215]">{sIdx + 1}.</span>
            {section.heading}
          </h2>
          <ol className="space-y-3">
            {section.steps.map((step, i) => {
              const key = stepKey(sIdx, i);
              const done = trackProgress && completed.has(key);
              return (
                <li
                  id={`step-${sIdx}-${i}`}
                  key={i}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 scroll-mt-24"
                >
                  {trackProgress ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`${step.action} — ${done ? "done" : "not done"}`}
                      onClick={() => toggle(key)}
                      className={
                        done
                          ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FD7215] text-white"
                          : "flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FD7215]/15 text-sm font-bold text-[#FD7215] transition-colors hover:bg-[#FD7215]/25"
                      }
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </button>
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FD7215]/15 text-sm font-bold text-[#FD7215]">
                      {i + 1}
                    </span>
                  )}
                  <div className="space-y-1.5">
                    <p
                      className={
                        done
                          ? "font-medium leading-snug text-white/40 line-through"
                          : "font-medium leading-snug text-white"
                      }
                    >
                      {step.action}
                    </p>
                    {step.detail && (
                      <p className="text-sm leading-relaxed text-white/50">
                        {step.detail}
                      </p>
                    )}
                    {step.tip && (
                      <p className="flex items-start gap-1.5 rounded-lg bg-[#FD7215]/10 px-3 py-2 text-sm text-[#FD7215]">
                        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{step.tip}</span>
                      </p>
                    )}
                    {step.link && (
                      <Link
                        href={step.link.href}
                        onClick={() =>
                          emit({
                            name: "step_link_click",
                            surface: "page",
                            stepKey: key,
                            context: step.link!.href,
                          })
                        }
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#FD7215] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#e5660f]"
                      >
                        {step.link.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      {content.faqs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Common questions</h2>
          <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {content.faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white/90 marker:content-['']">
                  {faq.q}
                  <ChevronRight className="size-4 shrink-0 text-white/40 transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-white/60">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ── Words to know (glossary) ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <BookText className="size-5 text-[#FD7215]" />
          Words to know
        </h2>
        <dl className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {GUIDE_GLOSSARY.map((t) => (
            <div key={t.term} className="px-4 py-3">
              <dt className="text-sm font-semibold text-white">{t.term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-white/60">
                {t.def}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Help ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#FD7215]/20 bg-[#FD7215]/5 p-4">
        <p className="text-sm text-white/70">
          <span className="font-semibold text-[#FD7215]">Need help? </span>
          {content.help}
        </p>
      </section>
    </article>
  );
}
