"use client";

/**
 * The guide's renderer.
 *
 * Client only because the sections collapse — at 390px, four lanes of six
 * sections is a very long page, and a reader wants the one section they are
 * on. Everything else is server-rendered data.
 *
 * The audience switch is a set of real links (`?for=`), not client state, so
 * a lane is a shareable URL: a chapter organiser can hand a teacher the
 * teacher lane. The server page remounts this component per audience, so the
 * open/closed state re-seeds instead of carrying over from the last lane.
 *
 * Colours are literals on purpose — the per-vertical CSS custom properties in
 * yiq.css are scoped to .yiq-root and the brand tokens elsewhere in this repo
 * are dead. Saffron never carries text on the paper ground (it fails contrast
 * there); it is a fill, a border or a rule, and text on it is ink.
 */

import { useState } from "react";
import Link from "next/link";
import {
  YIQ_GLOSSARY,
  YIQ_GUIDE_AUDIENCES,
  type YiqAudienceGuide,
  type YiqGuideAudience,
  type YiqGuideStep,
} from "@/lib/yiq/guide/content";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const DIM_INK = "#9fb0d4";
const DIM_PAPER = "#5a6480";
const RULE = "rgba(247,244,237,0.14)";
const RULE_PAPER = "rgba(10,22,51,0.12)";

export function GuideView({
  guide,
  labels,
}: {
  guide: YiqAudienceGuide;
  /** Switch labels, in order, resolved on the server from the book. */
  labels: Record<YiqGuideAudience, string>;
}) {
  // The first section is open; the rest start closed. A reader arriving at the
  // top of a lane sees content, not a wall of shut drawers.
  const [open, setOpen] = useState<string[]>(
    guide.sections.length > 0 ? [guide.sections[0].id] : []
  );

  function toggle(id: string) {
    setOpen((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  const allOpen = open.length === guide.sections.length;

  return (
    <main id="yiq-main" style={{ background: PAPER, minHeight: "100vh" }}>
      {/* ---- Header ---------------------------------------------------- */}
      <header style={{ background: INK, color: PAPER }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/yiq" className="yiq-display text-[1.375rem]">
            YIQ
          </Link>
          <span className="yiq-eyebrow" style={{ color: DIM_INK }}>
            How it works
          </span>
        </div>

        {/* Audience switch. Real links, so every lane is a shareable URL. */}
        <nav
          aria-label="Choose who you are"
          className="mx-auto max-w-3xl px-5 pb-5 sm:px-8"
        >
          <ul className="flex flex-wrap gap-2">
            {YIQ_GUIDE_AUDIENCES.map((a) => {
              const active = a === guide.audience;
              return (
                <li key={a}>
                  <Link
                    href={`/yiq/guide?for=${a}`}
                    aria-current={active ? "page" : undefined}
                    className="inline-block rounded-full border px-4 py-2 text-[0.875rem] font-bold transition-colors"
                    style={
                      active
                        ? { background: SAFFRON, borderColor: SAFFRON, color: INK }
                        : { borderColor: RULE, color: PAPER }
                    }
                  >
                    {labels[a]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        {/* ---- Lane title ---------------------------------------------- */}
        <p className="yiq-eyebrow" style={{ color: DIM_PAPER }}>
          {guide.tagline}
        </p>
        <h1
          className="yiq-display mt-2 text-[2.25rem] sm:text-[3rem]"
          style={{ color: INK }}
        >
          {guide.title}
        </h1>
        <p
          className="mt-3 text-[0.9375rem] leading-relaxed"
          style={{ color: DIM_PAPER }}
        >
          {guide.whoFor} Not you? Pick a different one above.
        </p>

        {/* ---- Journey strip ------------------------------------------- */}
        <ol className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-2">
          {guide.journey.map((phase, i) => (
            <li key={phase} className="flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold"
                style={{ background: "#fff", border: `1px solid ${RULE_PAPER}`, color: INK }}
              >
                <span className="yiq-data mr-1.5" style={{ color: DIM_PAPER }}>
                  {i + 1}
                </span>
                {phase}
              </span>
              {i < guide.journey.length - 1 ? (
                <span aria-hidden style={{ color: SAFFRON }}>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        {/* ---- Expand / collapse all ----------------------------------- */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="yiq-display text-[1.375rem]" style={{ color: INK }}>
            Step by step
          </h2>
          <button
            type="button"
            onClick={() =>
              setOpen(allOpen ? [] : guide.sections.map((s) => s.id))
            }
            className="rounded-full border px-3.5 py-2 text-[0.8125rem] font-semibold"
            style={{ borderColor: RULE_PAPER, color: INK }}
          >
            {allOpen ? "Collapse all" : "Open all"}
          </button>
        </div>

        {/* ---- Sections ------------------------------------------------ */}
        <div className="mt-4 grid gap-3">
          {guide.sections.map((section, si) => {
            const isOpen = open.includes(section.id);
            const panelId = `yiq-guide-panel-${section.id}`;
            return (
              <section
                key={section.id}
                id={section.id}
                className="overflow-hidden rounded-2xl border"
                style={{ borderColor: RULE_PAPER, background: "#fff" }}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
                  >
                    <span
                      className="yiq-data flex-none rounded-lg px-2 py-1 text-[0.8125rem] font-bold"
                      style={{ background: PAPER, color: INK }}
                    >
                      {si + 1}
                    </span>
                    <span
                      className="flex-1 text-[1.0625rem] font-bold leading-snug"
                      style={{ color: INK }}
                    >
                      {section.title}
                    </span>
                    <span
                      aria-hidden
                      className="flex-none text-[0.875rem]"
                      style={{ color: DIM_PAPER }}
                    >
                      {isOpen ? "−" : `${section.steps.length} +`}
                    </span>
                  </button>
                </h3>

                {/* Rendered even when closed, and hidden with the `hidden`
                    attribute: it keeps aria-controls pointing at a real
                    element, and browser find-in-page still reaches the text. */}
                <ol
                  id={panelId}
                  hidden={!isOpen}
                  className="px-4 pb-2 sm:px-5"
                >
                  {section.steps.map((step, i) => (
                    <Step
                      key={`${section.id}:${i}`}
                      step={step}
                      index={i + 1}
                      last={i === section.steps.length - 1}
                    />
                  ))}
                </ol>
              </section>
            );
          })}
        </div>

        {/* ---- Questions people ask ------------------------------------ */}
        {guide.answers && guide.answers.length > 0 ? (
          <section className="mt-10" id="questions">
            <h2 className="yiq-display text-[1.375rem]" style={{ color: INK }}>
              Questions people ask
            </h2>
            <dl className="mt-4 grid gap-3">
              {guide.answers.map((qa) => (
                <div
                  key={qa.q}
                  className="rounded-2xl border px-4 py-4 sm:px-5"
                  style={{ borderColor: RULE_PAPER, background: "#fff" }}
                >
                  <dt
                    className="text-[0.9375rem] font-bold leading-snug"
                    style={{ color: INK }}
                  >
                    {qa.q}
                  </dt>
                  <dd
                    className="mt-1.5 text-[0.9375rem] leading-relaxed"
                    style={{ color: DIM_PAPER }}
                  >
                    {qa.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* ---- Words to know ------------------------------------------- */}
        <section className="mt-10" id="words">
          <h2 className="yiq-display text-[1.375rem]" style={{ color: INK }}>
            Words to know
          </h2>
          <dl
            className="mt-4 rounded-2xl border"
            style={{ borderColor: RULE_PAPER, background: "#fff" }}
          >
            {YIQ_GLOSSARY.map((entry, i) => (
              <div
                key={entry.term}
                className="px-4 py-3.5 sm:px-5"
                style={
                  i === 0 ? undefined : { borderTop: `1px solid ${RULE_PAPER}` }
                }
              >
                <dt
                  className="text-[0.9375rem] font-bold"
                  style={{ color: INK }}
                >
                  {entry.term}
                </dt>
                <dd
                  className="mt-1 text-[0.9375rem] leading-relaxed"
                  style={{ color: DIM_PAPER }}
                >
                  {entry.means}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---- Footer -------------------------------------------------- */}
        <footer
          className="mt-10 border-t pt-6 text-[0.875rem] leading-relaxed"
          style={{ borderColor: RULE_PAPER, color: DIM_PAPER }}
        >
          <p>
            Something here does not match what you see on screen? Tell your
            chapter organiser — the screens are the truth and this page follows
            them.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/yiq" style={{ color: INK, fontWeight: 600 }}>
              YIQ home
            </Link>
            <Link href="/yiq/register" style={{ color: INK, fontWeight: 600 }}>
              Register a team
            </Link>
            <Link href="/yiq/login" style={{ color: INK, fontWeight: 600 }}>
              Student sign-in
            </Link>
            <Link href="/yiq/results" style={{ color: INK, fontWeight: 600 }}>
              Results
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

/**
 * One step: its number, what to do, why, a watch-out, and a way there.
 *
 * The ordinal is drawn rather than left to a list marker — Tailwind's preflight
 * strips markers, and the order of these steps carries meaning ("answer what
 * you know first, THEN come back").
 */
function Step({
  step,
  index,
  last,
}: {
  step: YiqGuideStep;
  index: number;
  last: boolean;
}) {
  return (
    <li
      className="flex gap-3 py-3.5"
      style={last ? undefined : { borderBottom: `1px solid ${RULE_PAPER}` }}
    >
      <span
        aria-hidden
        // Saffron would fail contrast on a white card at this size — the
        // ordinal is dim ink, and saffron is kept for fills and rules.
        className="yiq-data w-6 flex-none pt-px text-[0.8125rem] font-semibold"
        style={{ color: DIM_PAPER }}
      >
        {index}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="text-[0.9375rem] font-semibold leading-snug"
          style={{ color: INK }}
        >
          {step.action}
        </p>

        {step.detail ? (
          <p
            className="mt-1.5 text-[0.9375rem] leading-relaxed"
            style={{ color: DIM_PAPER }}
          >
            {step.detail}
          </p>
        ) : null}

        {step.tip ? (
          <p
            className="mt-2.5 rounded-lg px-3 py-2.5 text-[0.875rem] leading-relaxed"
            style={{
              background: "rgba(232,163,61,0.14)",
              borderLeft: `3px solid ${SAFFRON}`,
              color: INK,
            }}
          >
            <span className="yiq-eyebrow mr-2" style={{ color: DIM_PAPER }}>
              Watch out
            </span>
            {step.tip}
          </p>
        ) : null}

        {step.link ? (
          <Link
            href={step.link.href}
            className="mt-3 inline-block rounded-full px-4 py-2.5 text-[0.875rem] font-bold"
            style={{ background: GREEN, color: PAPER }}
          >
            {step.link.label} →
          </Link>
        ) : null}
      </div>
    </li>
  );
}
