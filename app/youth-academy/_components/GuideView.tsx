/**
 * Yi Youth Academy guide — visual renderer for ONE lane.
 *
 * 12th-grader friendly by design (decision 2026-06-13): a journey map up top so
 * the whole arc is visible at a glance, then numbered one-action step cards with
 * plain-language detail and amber tip callouts, then a short FAQ. No screenshots
 * (durable over literal). Pure server component — the only interactivity is the
 * native <details> FAQ, which needs no JS.
 *
 * Reads its content from the shared data module (lib/yuva/guide/content.ts) so
 * the in-app view and the downloadable PDF never disagree.
 */
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
  type LucideIcon,
} from "lucide-react";
import {
  GUIDE_GLOSSARY,
  PLANNED_LOCALE_NOTE,
  type GuideContent,
  type GuideLane,
} from "@/lib/yuva/guide/content";

const LANE_ICON: Record<GuideLane, LucideIcon> = {
  applicant: Send,
  student: GraduationCap,
  mentor: Users,
  coordinator: Building2,
  chapter_admin: ShieldCheck,
  national: Landmark,
};

export function GuideView({ content }: { content: GuideContent }) {
  const Icon = LANE_ICON[content.lane];

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
            {section.steps.map((step, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                  {i + 1}
                </span>
                <div className="space-y-1.5">
                  <p className="font-medium leading-snug text-slate-900">
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
            ))}
          </ol>
        </section>
      ))}

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      {content.faqs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">
            Common questions
          </h2>
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
