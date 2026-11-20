/**
 * Yi Rural Hub — Anumanpalli road map, as a public feedback form.
 *
 * Public by design: lib/supabase/middleware.ts protects an allowlist of
 * prefixes and /rural-hub is not one of them, so villagers open it from a
 * shared link without signing in. Answers are stored by sendRuralFeedback
 * (./actions.ts); only the Yi Erode Chapter Chair and Co-Chair read them, at
 * /rural-hub/anumanpalli/results.
 *
 * Content is the page projected at the launch on 2 Oct 2026, Tamil first with
 * the English line under it. Tamil NEEDS NATIVE REVIEW (TAMIL_REVIEWED flag).
 */
import type { Metadata } from "next";
import { Baloo_Thambi_2, Mukta_Malar } from "next/font/google";
import {
  ABOUT,
  ABOUT_NOTE,
  HEADER,
  TAMIL_REVIEWED,
  YOU_SAID,
  YOU_SAID_HEADING,
} from "@/lib/rural-hub/anumanpalli-survey";
import { FeedbackForm } from "./feedback-form";
import { Step } from "./step";

const display = Baloo_Thambi_2({
  variable: "--font-rh-display",
  subsets: ["latin", "tamil"],
  weight: ["600", "700"],
});
const body = Mukta_Malar({
  variable: "--font-rh-body",
  subsets: ["latin", "tamil"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "அனுமன்பள்ளி வளர்ச்சிப் பாதை · Anumanpalli Road Map",
  description:
    "Yi Rural Hub, Attavanai and Mugasi Anumanpalli. Tell us what to start first.",
};

export default function AnumanpalliFeedbackPage() {
  return (
    <div
      lang="ta"
      className={`${display.variable} ${body.variable} -mx-4 -my-8 bg-[#F7F5EF] px-4 pt-8 pb-16 font-[family-name:var(--font-rh-body)] text-[#161C24] sm:px-6`}
    >
      <div className="mx-auto max-w-3xl">
        {!TAMIL_REVIEWED && (
          <p className="mb-6 rounded border border-[#9C2F28]/30 bg-[#F9E8E6] px-4 py-2 text-sm text-[#9C2F28]">
            Draft: the Tamil on this page has not yet been checked by a native
            speaker.
          </p>
        )}

        <header className="border-b-[3px] border-[#865600] pb-6">
          <p className="text-sm font-semibold text-[#865600]">{HEADER.label}</p>
          <h1 className="mt-2 font-[family-name:var(--font-rh-display)] text-[2rem] leading-tight font-bold sm:text-5xl">
            {HEADER.title.ta}
          </h1>
          <p className="mt-1 text-sm text-[#4F5866]">{HEADER.title.en}</p>
          <p className="mt-4 text-lg leading-relaxed text-[#404A57]">
            {HEADER.sub.ta}
          </p>
          <p className="mt-1 text-sm text-[#4F5866]">{HEADER.sub.en}</p>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded border border-[#E0DBCF] bg-[#E0DBCF] sm:grid-cols-2">
          {ABOUT.map((a) => (
            <div key={a.k} className="bg-white px-4 py-3">
              <p className="text-sm text-[#4F5866]">{a.k}</p>
              <p className="font-semibold">{a.ta}</p>
              <p className="text-sm text-[#4F5866]">{a.en}</p>
            </div>
          ))}
        </section>
        <p className="mt-2 text-sm text-[#4F5866]">
          {ABOUT_NOTE.ta} · {ABOUT_NOTE.en}
        </p>

        <section className="mt-12">
          <Step n={1} ta={YOU_SAID_HEADING.ta} en={YOU_SAID_HEADING.en} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {YOU_SAID.map((t) => (
              <div
                key={t.titleTa}
                className="rounded border border-[#E0DBCF] border-t-4 border-t-[#253F6E] bg-white px-4 py-4"
              >
                <h3 className="font-[family-name:var(--font-rh-display)] text-lg font-bold">
                  {t.titleTa}
                </h3>
                <p className="mt-1 text-[#404A57]">{t.ta}</p>
                <p className="mt-1 text-sm text-[#4F5866]">{t.en}</p>
              </div>
            ))}
          </div>
        </section>

        <FeedbackForm />
      </div>
    </div>
  );
}
