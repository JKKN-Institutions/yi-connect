"use client";

/**
 * YiFi — "Start / Resume onboarding" launcher (dark YiFi theme).
 *
 * Always visible, deliberate entry into the guided walkthrough. The label adapts
 * from saved progress (via onboardingCta) — never a "first login" flag — so an
 * organiser who skipped the tour on day one can resume it on day three:
 *   0 done → "Start onboarding"  ·  part-done → "Resume onboarding · N left"  ·  done → "Replay walkthrough"
 *
 * Clicking lands them on their guide lane (which marks the next undone step and
 * carries its "Take me there" deep-link) and emits `onboarding_start`. Renders
 * fine inside a server component — pass `completed` (getCompletedSteps) + the
 * lane's content from the server. Founders have no persisted progress, so their
 * launcher simply stays on "Start onboarding" — still a valid, useful entry.
 */

import Link from "next/link";
import { PlayCircle, RotateCcw, ArrowRight } from "lucide-react";

import {
  type GuideContent,
  type GuideLane,
  type GuideEvent,
  onboardingCta,
} from "@/lib/yifi/guide/content";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function OnboardingLauncher({
  content,
  lane,
  completed,
  onEvent,
  basePath = "/yifi/guide",
  variant = "button",
  hideWhenComplete = false,
  className,
}: {
  content: GuideContent;
  lane: GuideLane;
  completed?: string[];
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  basePath?: string;
  variant?: "button" | "inline";
  hideWhenComplete?: boolean;
  className?: string;
}) {
  const cta = onboardingCta(content, new Set(completed ?? []));
  if (cta.complete && hideWhenComplete) return null;

  const href = `${basePath}?lane=${lane}&onboarding=1`;

  const emit = () => {
    // Guard sync throws AND async rejection — analytics must never break the UI.
    try {
      void Promise.resolve(
        onEvent?.({ name: "onboarding_start", persona: lane, surface: "onboarding", context: cta.kind })
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
          "inline-flex items-center gap-1.5 text-sm font-medium text-[#FD7215] underline-offset-4 hover:underline",
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
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
        quiet
          ? "border border-white/20 bg-transparent text-white/70 hover:bg-white/5"
          : "bg-[#FD7215] text-white hover:bg-[#e5660f]",
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
