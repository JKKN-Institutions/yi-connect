"use client";

/**
 * YIP guide — "Start / Resume onboarding" launcher.
 *
 * Always visible, deliberate entry into the guided walkthrough. The label adapts
 * from saved progress (via onboardingCta) — never a "first login" flag — so an
 * organiser who skipped the tour on day one can resume it on day three:
 *   0 done → "Start onboarding"  ·  part-done → "Resume onboarding · N left"  ·  done → "Replay walkthrough"
 *
 * Clicking lands them on their guide lane (which marks the next undone step and
 * carries its "Take me there" deep-link) and emits `onboarding_start`. Renders
 * fine inside a server component — pass `completed` (getCompletedSteps) + the
 * lane's content from the server.
 *
 * YIP-branded (saffron #FF9933) to match components/yip/guide/* + GuideView.
 */

import Link from "next/link";
import { PlayCircle, RotateCcw, ArrowRight } from "lucide-react";

import {
  type PersonaGuide,
  type GuidePersona,
  type GuideEvent,
  onboardingCta,
} from "@/lib/yip/guide/types";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function OnboardingLauncher({
  guide,
  persona,
  completed,
  onEvent,
  basePath = "/yip/guide",
  variant = "button",
  hideWhenComplete = false,
  className,
}: {
  guide: PersonaGuide;
  persona: GuidePersona;
  completed?: string[];
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  basePath?: string;
  variant?: "button" | "inline";
  hideWhenComplete?: boolean;
  className?: string;
}) {
  const cta = onboardingCta(guide, new Set(completed ?? []));
  if (cta.complete && hideWhenComplete) return null;

  const href = `${basePath}?persona=${persona}&onboarding=1`;

  const emit = () => {
    // Guard sync throws AND async rejection — analytics must never break the UI.
    try {
      void Promise.resolve(
        onEvent?.({ name: "onboarding_start", persona, surface: "onboarding", context: cta.kind })
      ).catch(() => {});
    } catch {
      /* no-op */
    }
  };

  const Icon = cta.kind === "replay" ? RotateCcw : PlayCircle;
  const sub = cta.kind === "resume" && cta.remaining > 0 ? ` · ${cta.remaining} left` : "";

  if (variant === "inline") {
    return (
      <Link
        href={href}
        onClick={emit}
        aria-label={`${cta.label}${sub}`}
        className={cx(
          "inline-flex items-center gap-1.5 text-sm font-medium text-[#b35e00] underline-offset-4 hover:underline",
          className
        )}
      >
        <Icon className="size-4" aria-hidden />
        {cta.label}
        {sub}
      </Link>
    );
  }

  const quiet = cta.kind === "replay";
  return (
    <Link
      href={href}
      onClick={emit}
      aria-label={`${cta.label}${sub}`}
      className={cx(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90",
        quiet
          ? "border border-[#1a1a3e]/12 bg-transparent text-[#1a1a3e]/60"
          : "bg-[#FF9933] text-white",
        className
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span>
        {cta.label}
        {sub}
      </span>
      {!quiet && <ArrowRight className="size-3.5" aria-hidden />}
    </Link>
  );
}
