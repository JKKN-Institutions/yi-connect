"use client";

/**
 * YiFi — per-module first-entry welcome (dark YiFi theme).
 *
 * The first time someone opens a module, one dismissible card greets them with
 * what it's for + "Show me how". Shows ONCE (then stays gone), but the Onboarding
 * launcher can replay it, and it's entry-triggered — a module a founder never
 * opened still welcomes them whenever they finally arrive.
 *
 * "Seen" persists in the SAME guide_progress table under welcomeSeenKey(moduleKey)
 * (syncs across devices) for organisers, with a localStorage fallback for
 * founders (who have no Supabase session). It is a CARD above the content, never
 * a blocking modal — and if its seen-state can't be resolved it fails to HIDDEN
 * (never nag, never crash). `welcome_shown` fires exactly once (a ref guard
 * survives StrictMode); every hook is above the early return.
 */

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, X } from "lucide-react";

import { type GuideLane, type GuideEvent } from "@/lib/yifi/guide/content";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const LS_PREFIX = "yifiguide:welcome:";

export function ModuleWelcome({
  moduleKey,
  lane,
  title,
  body,
  cta,
  seen,
  onSeen,
  onEvent,
  className,
}: {
  /** Stable id for THIS module's welcome, e.g. "participant-home". */
  moduleKey: string;
  lane: GuideLane;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  /** Server-known "already seen" — completed.includes(welcomeSeenKey(moduleKey)).
   *  When defined it is authoritative; omit it to fall back to localStorage. */
  seen?: boolean;
  /** Persist "seen": toggleStep(lane, welcomeSeenKey(moduleKey), true). */
  onSeen?: () => Promise<unknown> | void;
  onEvent?: (event: GuideEvent) => Promise<unknown> | void;
  className?: string;
}) {
  const [phase, setPhase] = React.useState<"pending" | "show" | "hide">("pending");
  const announced = React.useRef(false);

  const emit = React.useCallback(
    (event: GuideEvent) => {
      try {
        void Promise.resolve(onEvent?.(event)).catch(() => {});
      } catch {
        /* analytics must never break the UI */
      }
    },
    [onEvent]
  );

  React.useEffect(() => {
    let alreadySeen: boolean;
    if (seen !== undefined) {
      alreadySeen = seen;
    } else {
      try {
        alreadySeen = window.localStorage.getItem(LS_PREFIX + moduleKey) === "1";
      } catch {
        alreadySeen = true; // can't read → assume seen so we never nag
      }
    }
    if (alreadySeen) {
      setPhase("hide");
      return;
    }
    setPhase("show");
    if (!announced.current) {
      announced.current = true; // fires once even under StrictMode
      emit({ name: "welcome_shown", persona: lane, surface: "welcome", stepKey: moduleKey });
    }
  }, [seen, moduleKey, lane, emit]);

  const markSeen = React.useCallback(() => {
    setPhase("hide");
    try {
      if (onSeen) {
        void Promise.resolve(onSeen()).catch(() => {});
      } else {
        window.localStorage.setItem(LS_PREFIX + moduleKey, "1");
      }
    } catch {
      /* best-effort; re-shows at worst */
    }
  }, [onSeen, moduleKey]);

  if (phase !== "show") return null;

  return (
    <div
      role="note"
      aria-label={title}
      className={cx(
        "flex items-start gap-3 rounded-xl border border-[#FD7215]/30 bg-[#FD7215]/10 p-4",
        className
      )}
    >
      <Sparkles className="mt-0.5 size-5 shrink-0 text-[#FD7215]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-white/60">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            onClick={() => {
              emit({ name: "nudge_click", persona: lane, surface: "welcome", stepKey: moduleKey });
              markSeen();
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#FD7215] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e5660f]"
          >
            {cta.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          emit({ name: "guide_dismiss", persona: lane, surface: "welcome", stepKey: moduleKey });
          markSeen();
        }}
        aria-label={`Dismiss the ${title} intro`}
        className="shrink-0 rounded-md p-1 text-white/40 hover:bg-white/10"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
