"use client";

/**
 * Smart Guide — the "Start / Resume onboarding" launcher.
 *
 * A deliberate, ALWAYS-VISIBLE entry into the guided walkthrough — distinct from
 * the FAB (passive Help) and the nudge (contextual push). Its whole reason to
 * exist: a user is rarely guided the first time they log in (they're busy doing
 * the thing they came for), so onboarding must be re-enterable LATER, on demand,
 * at any progress level. The label adapts from saved progress, never a
 * "first login" flag:
 *   - 0 done           → "Start onboarding"
 *   - part-done        → "Resume onboarding · N left"   (this is the skip-recovery case)
 *   - all done         → "Replay walkthrough"            (quiet; re-runnable)
 *
 * Clicking lands the viewer on their guide page anchored at the next undone step
 * (orientation + the step's own "Take me there" deep-link), and emits
 * `onboarding_start` (surface "onboarding", context = kind) so you can measure
 * how many people choose to be guided. Renders fine inside a server component —
 * pass `completed` (from getCompletedSteps) + the guide from the server.
 *
 * Graceful degradation: with no `completed`, the set is empty → it shows
 * "Start onboarding" and still works (just can't tell start from resume).
 */

import Link from "next/link";
import { PlayCircle, RotateCcw, ArrowRight } from "lucide-react";

import {
  type PersonaGuide,
  type GuideEvent,
  onboardingCta,
} from "@/lib/guide/types"; // ← adjust path

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

interface OnboardingLauncherProps {
  guide: PersonaGuide;
  /** Base path of the full-page guide, e.g. "/yip/guide". */
  basePath: string;
  /** Completed step keys from getCompletedSteps(persona). */
  completed?: string[];
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  /** "button" (default) = a standalone pill. "inline" = a quieter text link. */
  variant?: "button" | "inline";
  /** Hide the control once the lane is complete instead of offering a replay. */
  hideWhenComplete?: boolean;
  className?: string;
}

export function OnboardingLauncher({
  guide,
  basePath,
  completed,
  onEvent,
  variant = "button",
  hideWhenComplete = false,
  className,
}: OnboardingLauncherProps) {
  const cta = onboardingCta(guide, new Set(completed ?? []));
  if (cta.complete && hideWhenComplete) return null;

  // Land on the guide page at the next/first step — the page marks it `isNext`
  // and carries the per-step deep-link. `onboarding=1` is a hook installs can
  // use to auto-focus; the `#section` anchor scrolls there regardless.
  const anchor = cta.target ? `#${cta.target.sectionId}` : "";
  const href = `${basePath}?persona=${guide.persona}&onboarding=1${anchor}`;

  const emit = () => {
    // Guard sync throws AND async rejections — analytics must never break the UI.
    try {
      void Promise.resolve(
        onEvent?.({ name: "onboarding_start", persona: guide.persona, surface: "onboarding", context: cta.kind })
      ).catch(() => {});
    } catch {
      /* no-op */
    }
  };

  const Icon = cta.kind === "replay" ? RotateCcw : PlayCircle;
  const sub =
    cta.kind === "resume" && cta.remaining > 0
      ? ` · ${cta.remaining} left`
      : "";

  if (variant === "inline") {
    return (
      <Link
        href={href}
        onClick={emit}
        aria-label={`${cta.label}${sub}`}
        className={cx(
          "inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline",
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
          ? "border bg-transparent text-muted-foreground"
          : "bg-primary text-primary-foreground",
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
