"use client";

/**
 * Yi Youth Academy guide — visual renderer for ONE lane.
 *
 * 12th-grader friendly: why-it-matters + start-here, a journey map, numbered
 * one-action step cards with plain detail / amber tips / "take me there"
 * deep-links / the odd entry screenshot, then FAQ, glossary and help.
 *
 * Adoption layer (all OPTIONAL — off → the plain guide): when `trackProgress`
 * is set (staff lanes), each step becomes a checkbox, a progress bar + "X of N"
 * + completion banner + Resume appear, and interactions emit GuideEvents. Reads
 * its content from the shared data module so the in-app view and the PDF never
 * disagree.
 */
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Send,
  GraduationCap,
  Users,
  Building2,
  ShieldCheck,
  Landmark,
  Lightbulb,
  ChevronRight,
  ArrowRight,
  Rocket,
  BookText,
  Languages,
  Check,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  GUIDE_GLOSSARY,
  PLANNED_LOCALE_NOTE,
  laneProgress,
  nextUndoneStep,
  stepKey,
  type GuideContent,
  type GuideLane,
  type GuideEvent,
} from "@/lib/yuva/guide/content";
import { useGuideProgress } from "@/lib/yuva/guide/use-progress";

const LANE_ICON: Record<GuideLane, LucideIcon> = {
  applicant: Send,
  student: GraduationCap,
  mentor: Users,
  coordinator: Building2,
  chapter_admin: ShieldCheck,
  national: Landmark,
};

/** Strip **bold** markers for plain inline text (resume label). */
function plain(s: string): string {
  return s.split("**").join("");
}

export function GuideView({
  content,
  trackProgress = false,
  initialCompleted,
  onToggleStep,
  onEvent,
}: {
  content: GuideContent;
  /** Staff lanes only — turns steps into a persisted checklist. */
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
        <span className="inline-flex items-center gap-2 rounded-full bg-[#0f2557]/10 px-3 py-1 text-sm font-semibold text-[#0f2557]">
          <Icon className="size-4" />
          {content.label}
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          How to use Yi Youth Academy
        </h1>
        <p className="text-base text-slate-600">{content.tagline}</p>
      </header>

      {/* ── Why it matters + start here ─────────────────────────────── */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-base font-medium text-slate-800">
          {content.whyItMatters}
        </p>
        <Link
          href={content.startHere.href}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
        >
          <Rocket className="size-4" />
          {content.startHere.label}
        </Link>
      </section>

      {/* ── Progress (staff checklist only) ─────────────────────────── */}
      {trackProgress && lp.total > 0 && (
        <section
          aria-label="Your progress"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          {lp.complete ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0f2557]">
              <CheckCircle2 className="size-5 text-emerald-600" />
              You&apos;ve completed this guide — you&apos;re all set up. 🎉
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Your setup
                </p>
                <span className="text-sm text-slate-500">
                  {lp.done} of {lp.total} done
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0f2557] transition-all"
                  style={{ width: `${lp.percent}%` }}
                />
              </div>
              {next && (
                <a
                  href={`#step-${next.sectionIndex}-${next.stepIndex}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f2557] hover:underline"
                >
                  Resume — next: {plain(next.step.action)}
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
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-amber-600">
          Your journey at a glance
        </p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {content.journey.map((node, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0f2557] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {node}
                </span>
              </span>
              {i < content.journey.length - 1 && (
                <ChevronRight className="size-4 text-slate-300" aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── Step-by-step sections ───────────────────────────────────── */}
      {content.sections.map((section, sIdx) => (
        <section key={sIdx} className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="text-amber-600">{sIdx + 1}.</span>
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
                  className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-24"
                >
                  {trackProgress ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`${plain(step.action)} — ${done ? "done" : "not done"}`}
                      onClick={() => toggle(key)}
                      className={
                        done
                          ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0f2557] text-white"
                          : "flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-200"
                      }
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </button>
                  ) : (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                      {i + 1}
                    </span>
                  )}
                  <div className="space-y-1.5">
                    <p
                      className={
                        done
                          ? "font-medium leading-snug text-slate-400 line-through"
                          : "font-medium leading-snug text-slate-900"
                      }
                    >
                      {step.action}
                    </p>
                    {step.detail && (
                      <p className="text-sm leading-relaxed text-slate-500">
                        {step.detail}
                      </p>
                    )}
                    {step.tip && (
                      <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#0f2557] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f2557]/90"
                      >
                        {step.link.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                    {step.image && (
                      <Image
                        src={step.image.src}
                        alt={step.image.alt}
                        width={step.image.width}
                        height={step.image.height}
                        className="mt-2 h-auto w-full max-w-sm rounded-lg border border-slate-200 shadow-sm"
                      />
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
          <h2 className="text-lg font-bold text-slate-900">Common questions</h2>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {content.faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-800 marker:content-['']">
                  {faq.q}
                  <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ── Words to know (glossary) ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <BookText className="size-5 text-[#0f2557]" />
          Words to know
        </h2>
        <dl className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {GUIDE_GLOSSARY.map((t) => (
            <div key={t.term} className="px-4 py-3">
              <dt className="text-sm font-semibold text-slate-900">{t.term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">
                {t.def}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Help ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#0f2557]/15 bg-[#0f2557]/5 p-4">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-[#0f2557]">Need help? </span>
          {content.help}
        </p>
      </section>

      {/* ── Planned-locale note ─────────────────────────────────────── */}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <Languages className="size-3.5" />
        {PLANNED_LOCALE_NOTE}
      </p>
    </article>
  );
}
